package com.saharacleaning.oshelper

import android.content.Context
import android.content.SharedPreferences

/** All settings live in this app's private storage. Nothing here is ever shown to other apps. */
class Prefs(context: Context) {
    private val sp: SharedPreferences = context.applicationContext.getSharedPreferences("helper", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = sp.getString("serverUrl", DEFAULT_URL)!!.trim().trimEnd('/')
        set(v) = sp.edit().putString("serverUrl", v.trim()).apply()

    var token: String
        get() = sp.getString("token", "")!!
        set(v) = sp.edit().putString("token", v.trim()).apply()

    /** Which phone this is: Owner / Francis / Shoaib. Printed on every call note in the CRM. */
    var deviceLabel: String
        get() = sp.getString("deviceLabel", "Owner")!!
        set(v) = sp.edit().putString("deviceLabel", v.trim().ifEmpty { "Owner" }).apply()

    /** The user pressed Start (so the boot receiver may restart the service). */
    var running: Boolean
        get() = sp.getBoolean("running", false)
        set(v) = sp.edit().putBoolean("running", v).apply()

    var uploadsEnabled: Boolean
        get() = sp.getBoolean("uploadsEnabled", false)
        set(v) = sp.edit().putBoolean("uploadsEnabled", v).apply()

    var uploadsExpiryMs: Long
        get() = sp.getLong("uploadsExpiryMs", 0L)
        set(v) = sp.edit().putLong("uploadsExpiryMs", v).apply()

    /** Newest call-log timestamp already sent (the watermark). */
    var lastCallDate: Long
        get() = sp.getLong("lastCallDate", 0L)
        set(v) = sp.edit().putLong("lastCallDate", v).apply()

    /** MediaStore ids of recordings that are finished (uploaded, duplicate, internal number, or too old to wait for a lead). */
    var doneRecordings: MutableSet<String>
        get() = HashSet(sp.getStringSet("doneRecordings", emptySet())!!)
        set(v) = sp.edit().putStringSet("doneRecordings", v).apply()

    val configured: Boolean get() = serverUrl.startsWith("https://") && token.length >= 16

    /** The 1-month switch: turning uploads on starts a 30-day window; after it the helper stops uploading audio by itself. */
    fun enableUploads(days: Int = UPLOAD_WINDOW_DAYS) {
        uploadsEnabled = true
        uploadsExpiryMs = System.currentTimeMillis() + days * 86_400_000L
    }

    fun uploadsActive(now: Long = System.currentTimeMillis()): Boolean = uploadsEnabled && now < uploadsExpiryMs

    @Synchronized
    fun log(line: String) {
        val stamp = java.text.SimpleDateFormat("dd MMM HH:mm", java.util.Locale.ENGLISH).format(java.util.Date())
        val all = (listOf("$stamp  $line") + logText().split("\n").filter { it.isNotBlank() }).take(MAX_LOG)
        sp.edit().putString("log", all.joinToString("\n")).apply()
    }

    fun logText(): String = sp.getString("log", "") ?: ""

    companion object {
        const val DEFAULT_URL = "https://crm.saharacleaningservices.com"
        const val UPLOAD_WINDOW_DAYS = 30
        private const val MAX_LOG = 40
    }
}
