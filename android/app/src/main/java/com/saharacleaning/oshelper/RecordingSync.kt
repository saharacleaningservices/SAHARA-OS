package com.saharacleaning.oshelper

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

/**
 * Finds the phone's call-recording files (Samsung keeps them in "Call/" or "Recordings/Call/"), works out which caller each belongs to
 * and uploads them to /call-recording — old (historical) files first, then new ones as they appear. The server is asked first
 * (check=1) and only receives the audio when the caller already has a lead there; nothing else leaves the phone.
 * Samsung records .m4a, which is uploaded exactly as it is (no conversion).
 */
class RecordingSync(private val context: Context, private val prefs: Prefs, private val calls: CallSync) {
    data class Rec(val id: Long, val name: String, val modifiedMs: Long, val relativePath: String)

    fun hasPermission(): Boolean {
        val perm = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        return context.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED
    }

    fun scan(): List<Rec> {
        val out = ArrayList<Rec>()
        val col = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val proj = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.DATE_MODIFIED, MediaStore.Audio.Media.RELATIVE_PATH)
        val rp = MediaStore.Audio.Media.RELATIVE_PATH
        val sel = "$rp LIKE ? OR $rp LIKE ? OR $rp LIKE ? OR $rp LIKE ?"
        val args = arrayOf("Call/%", "Recordings/Call/%", "Recordings/Call recordings/%", "Recordings/Call Recording/%")
        context.contentResolver.query(col, proj, sel, args, "${MediaStore.Audio.Media.DATE_MODIFIED} ASC")?.use { c ->
            while (c.moveToNext()) out.add(Rec(c.getLong(0), c.getString(1) ?: "", c.getLong(2) * 1000L, c.getString(3) ?: ""))
        }
        return out
    }

    /** Number from the file name when Samsung used it ("Call recording +919876543210_240915_103012.m4a"), else matched through the call log. */
    private fun match(rec: Rec, recent: List<CallSync.Call>): CallSync.Call? {
        val digits = Regex("(?<!\\d)\\+?(\\d{10,13})(?!\\d)").find(rec.name)?.groupValues?.get(1)?.takeLast(10)
        val start = fileStart(rec)
        val byTime = recent.filter { abs(it.date - start) <= 180_000L || abs(it.date + it.durationSec * 1000L - rec.modifiedMs) <= 180_000L }
        if (digits != null) {
            val sameNumber = recent.filter { it.tenDigits == digits && (abs(it.date - start) <= 300_000L || abs(it.date + it.durationSec * 1000L - rec.modifiedMs) <= 300_000L) }
            return sameNumber.minByOrNull { abs(it.date - start) } ?: CallSync.Call(digits, start, 0, 0)
        }
        return byTime.minByOrNull { abs(it.date - start) }
    }

    /** Start time from "_yyMMdd_HHmmss" in the name when present, else the modified time. */
    private fun fileStart(rec: Rec): Long {
        val m = Regex("_(\\d{6})_(\\d{6})").find(rec.name) ?: return rec.modifiedMs
        return try {
            SimpleDateFormat("yyMMddHHmmss", Locale.US).parse(m.groupValues[1] + m.groupValues[2])!!.time
        } catch (e: Exception) {
            rec.modifiedMs
        }
    }

    fun sync(): Int {
        if (!prefs.uploadsEnabled) return 0
        if (!prefs.uploadsActive()) {
            prefs.uploadsEnabled = false
            prefs.log("Recording uploads switched off — the 30-day window ended")
            return 0
        }
        if (!hasPermission() || !prefs.configured) return 0
        val done = prefs.doneRecordings
        val recent = calls.readCalls(System.currentTimeMillis() - CallSync.HISTORY_DAYS * 86_400_000L)
        var uploaded = 0
        var changed = false
        for (rec in scan()) {
            val key = rec.id.toString()
            if (key in done) continue
            val call = match(rec, recent)
            if (call == null || call.tenDigits.length < 10) {
                // No way to tell who it was — leave it alone for two days (the call-log entry may still be arriving), then forget it.
                if (System.currentTimeMillis() - rec.modifiedMs > WAIT_MS) { done.add(key); changed = true }
                continue
            }
            val label = prefs.deviceLabel
            val fields = LinkedHashMap<String, String>()
            fields["caller"] = call.tenDigits
            fields["externalId"] = if (call.type != 0) call.externalId(label) else "$label:rec${rec.id}:${call.tenDigits}"
            fields["durationSec"] = call.durationSec.toString()
            fields["endedAt"] = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(rec.modifiedMs))
            fields["deviceLabel"] = label
            val base = "${prefs.serverUrl}/api/v1/webhooks/call-recording"
            try {
                val ask = Api.postMultipart(base, prefs.token, fields + ("check" to "1"), null)
                if (ask.code == 401 || ask.code == 403) {
                    if (ask.body.contains("recording_uploads_closed")) { prefs.uploadsEnabled = false; prefs.log("Server closed recording uploads") }
                    else prefs.log("Server rejected the token (HTTP ${ask.code})")
                    break
                }
                if (ask.code !in 200..299) { prefs.log("Recording check paused (HTTP ${ask.code})"); break }
                val j = JSONObject(ask.body)
                if (!j.optBoolean("wantsUpload", false)) {
                    // No lead (yet): wait up to two days for staff to create one. Everything else (duplicate, internal number) is final.
                    val waiting = j.optString("reason") == "no_lead" && System.currentTimeMillis() - rec.modifiedMs <= WAIT_MS
                    if (!waiting) { done.add(key); changed = true }
                    continue
                }
                val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, rec.id)
                val stream = context.contentResolver.openInputStream(uri) ?: continue
                val mime = context.contentResolver.getType(uri) ?: "audio/mp4"
                val up = Api.postMultipart(base, prefs.token, fields, Api.FilePart(rec.name.ifEmpty { "call.m4a" }, mime, stream))
                when {
                    up.code in 200..299 -> { done.add(key); changed = true; uploaded++ }
                    up.code == 413 || up.code == 415 -> { done.add(key); changed = true; prefs.log("Skipped ${rec.name} (HTTP ${up.code})") }
                    up.code == 403 && up.body.contains("recording_uploads_closed") -> { prefs.uploadsEnabled = false; prefs.log("Server closed recording uploads"); break }
                    else -> { prefs.log("Recording upload paused (HTTP ${up.code})"); break }
                }
            } catch (e: Exception) {
                prefs.log("Recording upload paused (no connection)")
                break
            }
        }
        if (changed) prefs.doneRecordings = done
        if (uploaded > 0) prefs.log("Uploaded $uploaded call recording(s)")
        return uploaded
    }

    companion object {
        const val WAIT_MS = 48L * 3600_000L
    }
}
