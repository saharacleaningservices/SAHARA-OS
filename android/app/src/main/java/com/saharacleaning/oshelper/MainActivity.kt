package com.saharacleaning.oshelper

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** One plain screen: connect to Sahara OS, grant the two permissions, start. No accounts, no ads, no other network traffic. */
class MainActivity : Activity() {
    private lateinit var prefs: Prefs
    private lateinit var url: EditText
    private lateinit var token: EditText
    private lateinit var label: EditText
    private lateinit var uploads: Switch
    private lateinit var expiry: TextView
    private lateinit var status: TextView
    private lateinit var log: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        val pad = (20 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        fun text(t: String, size: Float = 14f, bold: Boolean = false, color: Int = Color.parseColor("#0f172a")) = TextView(this).apply {
            this.text = t; textSize = size; setTextColor(color); if (bold) setTypeface(null, Typeface.BOLD)
            setPadding(0, pad / 3, 0, pad / 3)
        }
        root.addView(text("Sahara OS Helper", 22f, true, Color.parseColor("#1E40AF")))
        root.addView(text(
            "Sends this phone's call details (who called, how long, answered or missed) and, if you switch it on, call recordings to Sahara OS. " +
                "It never reads SMS or OTP messages, contacts, location or the microphone. Install it only on a phone whose owner has agreed, " +
                "and tell customers calls may be recorded.", 13f, false, Color.parseColor("#475569"),
        ))
        url = EditText(this).apply { hint = "Sahara OS address"; setText(prefs.serverUrl); inputType = InputType.TYPE_TEXT_VARIATION_URI }
        token = EditText(this).apply { hint = "Access token (from your admin)"; setText(prefs.token); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
        label = EditText(this).apply { hint = "This phone: Owner / Francis / Shoaib"; setText(prefs.deviceLabel) }
        root.addView(text("Connection", 15f, true)); root.addView(url); root.addView(token); root.addView(label)

        uploads = Switch(this).apply { text = "Upload call recordings (30 days)"; isChecked = prefs.uploadsActive() }
        expiry = text("", 12f, false, Color.parseColor("#475569"))
        uploads.setOnCheckedChangeListener { _, on ->
            if (on) prefs.enableUploads() else prefs.uploadsEnabled = false
            refresh()
        }
        root.addView(text("Recordings", 15f, true)); root.addView(uploads); root.addView(expiry)

        val start = Button(this).apply { text = "Save & start"; setOnClickListener { saveAndStart() } }
        val syncNow = Button(this).apply { text = "Sync now (includes history)"; setOnClickListener { saveFields(); startSync(Intent(this@MainActivity, SyncService::class.java).setAction(SyncService.ACTION_SYNC_NOW)) } }
        val stop = Button(this).apply { text = "Stop"; setOnClickListener { prefs.running = false; stopService(Intent(this@MainActivity, SyncService::class.java)); refresh() } }
        root.addView(start); root.addView(syncNow); root.addView(stop)
        status = text("", 14f, true)
        log = text("", 12f, false, Color.parseColor("#475569"))
        root.addView(status); root.addView(log)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    private fun saveFields() {
        prefs.serverUrl = url.text.toString()
        prefs.token = token.text.toString()
        prefs.deviceLabel = label.text.toString()
    }

    private fun saveAndStart() {
        saveFields()
        if (!prefs.configured) {
            status.text = "Enter an https:// address and the access token first."
            return
        }
        val need = ArrayList<String>()
        need.add(Manifest.permission.READ_CALL_LOG)
        need.add(if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE)
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = need.filter { checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 7) else startSync(Intent(this, SyncService::class.java))
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (checkSelfPermission(Manifest.permission.READ_CALL_LOG) == android.content.pm.PackageManager.PERMISSION_GRANTED) startSync(Intent(this, SyncService::class.java))
        else status.text = "Call-log permission is needed — without it the helper cannot work."
    }

    private fun startSync(intent: Intent) {
        prefs.running = true
        startForegroundService(intent)
        refresh()
    }

    private fun refresh() {
        status.text = if (prefs.running) "Running — calls are sent to Sahara OS." else "Stopped."
        expiry.text = if (prefs.uploadsActive()) "Recording uploads switch off by themselves on " + SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH).format(Date(prefs.uploadsExpiryMs)) + "."
        else "Recording uploads are off."
        if (uploads.isChecked != prefs.uploadsActive()) uploads.isChecked = prefs.uploadsActive()
        log.text = prefs.logText().ifEmpty { "No activity yet." }
        log.visibility = View.VISIBLE
    }
}
