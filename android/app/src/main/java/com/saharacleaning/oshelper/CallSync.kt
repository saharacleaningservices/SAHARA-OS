package com.saharacleaning.oshelper

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Reads this phone's call log (READ_CALL_LOG only) and tells Sahara OS about every finished call:
 * answered, missed or rejected incoming calls and connected outgoing calls. Unconnected outgoing calls are ignored.
 * Calls older than ~30 minutes are history: the server notes them on an existing lead only (no new lead, no WhatsApp reply).
 */
class CallSync(private val context: Context, private val prefs: Prefs) {
    data class Call(val number: String, val date: Long, val durationSec: Int, val type: Int) {
        val tenDigits: String get() = number.filter { it.isDigit() }.takeLast(10)
        fun externalId(label: String) = "$label:$date:$tenDigits"
    }

    fun hasPermission(): Boolean = context.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

    fun readCalls(since: Long): List<Call> {
        if (!hasPermission()) return emptyList()
        val out = ArrayList<Call>()
        val cols = arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.TYPE)
        context.contentResolver.query(CallLog.Calls.CONTENT_URI, cols, "${CallLog.Calls.DATE} > ?", arrayOf(since.toString()), "${CallLog.Calls.DATE} ASC")?.use { c ->
            while (c.moveToNext()) {
                out.add(Call(c.getString(0) ?: "", c.getLong(1), c.getInt(2), c.getInt(3)))
            }
        }
        return out
    }

    /** Sends new calls to /call-trigger. Returns how many were accepted. Stops on the first transport/auth failure and retries next cycle. */
    fun sync(): Int {
        if (!hasPermission() || !prefs.configured) return 0
        val firstRun = prefs.lastCallDate == 0L
        val since = if (firstRun) System.currentTimeMillis() - HISTORY_DAYS * 86_400_000L else prefs.lastCallDate
        var sent = 0
        for (call in readCalls(since).take(MAX_PER_CYCLE)) {
            val kind = classify(call)
            if (kind == null || call.tenDigits.length < 10) {
                prefs.lastCallDate = call.date
                continue
            }
            val endedAt = call.date + call.durationSec * 1000L
            val json = JSONObject()
                .put("caller", call.tenDigits)
                .put("status", kind.first)
                .put("direction", kind.second)
                .put("duration", call.durationSec)
                .put("endedAt", iso(endedAt))
                .put("externalId", call.externalId(prefs.deviceLabel))
                .put("deviceLabel", prefs.deviceLabel)
            val r = try {
                Api.postJson("${prefs.serverUrl}/api/v1/webhooks/call-trigger", prefs.token, json)
            } catch (e: Exception) {
                prefs.log("Call sync paused (no connection)")
                return sent
            }
            when {
                r.code in 200..299 -> { prefs.lastCallDate = call.date; sent++ }
                r.code == 401 || r.code == 403 -> { prefs.log("Server rejected the token (HTTP ${r.code}) — check the token"); return sent }
                r.code in 400..499 && r.code != 429 -> prefs.lastCallDate = call.date // not an Indian mobile etc.: skip it for good
                else -> { prefs.log("Call sync paused (HTTP ${r.code})"); return sent }
            }
        }
        if (sent > 0) prefs.log("Sent $sent call(s) to Sahara OS")
        return sent
    }

    /** (status, direction) for the server, or null when the entry is not a finished customer call. */
    private fun classify(c: Call): Pair<String, String>? = when (c.type) {
        CallLog.Calls.INCOMING_TYPE -> (if (c.durationSec > 0) "answered" else "missed") to "incoming"
        CallLog.Calls.MISSED_TYPE, CallLog.Calls.REJECTED_TYPE -> "missed" to "incoming"
        CallLog.Calls.OUTGOING_TYPE -> if (c.durationSec > 0) "answered" to "outgoing" else null
        else -> null
    }

    private fun iso(ms: Long): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(ms))

    companion object {
        const val HISTORY_DAYS = 90
        const val MAX_PER_CYCLE = 200
    }
}
