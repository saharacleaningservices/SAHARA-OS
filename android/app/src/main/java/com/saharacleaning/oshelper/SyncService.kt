package com.saharacleaning.oshelper

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.CallLog
import java.util.concurrent.Executors

/**
 * Foreground service (Android requires the quiet status-bar notification — it is how the user can always see the helper is on).
 * A call-log observer syncs seconds after every call ends; a 10-minute timer picks up new recordings and anything that failed earlier.
 */
class SyncService : Service() {
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var prefs: Prefs
    private lateinit var calls: CallSync
    private lateinit var recordings: RecordingSync

    private val syncNow = Runnable { runSync() }
    private val observer = object : ContentObserver(handler) {
        override fun onChange(selfChange: Boolean) {
            handler.removeCallbacks(syncNow)
            handler.postDelayed(syncNow, 4_000L) // debounce: the log writes several rows per call
        }
    }
    private val tick = object : Runnable {
        override fun run() {
            runSync()
            handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        calls = CallSync(this, prefs)
        recordings = RecordingSync(this, prefs, calls)
        val channel = NotificationChannel(CHANNEL, "Sync status", NotificationManager.IMPORTANCE_MIN)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        val n = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("Sahara OS Helper is on")
            .setContentText("Sending call details to Sahara OS")
            .setOngoing(true)
            .build()
        startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        try {
            contentResolver.registerContentObserver(CallLog.Calls.CONTENT_URI, true, observer)
        } catch (e: SecurityException) {
            prefs.log("Call log permission is missing")
        }
        handler.post(tick)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_SYNC_NOW) runSync()
        return START_STICKY
    }

    private fun runSync() {
        executor.execute {
            try {
                calls.sync()
                recordings.sync()
            } catch (e: Exception) {
                prefs.log("Sync error: ${e.javaClass.simpleName}")
            }
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        contentResolver.unregisterContentObserver(observer)
        executor.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val CHANNEL = "sync"
        const val ACTION_SYNC_NOW = "com.saharacleaning.oshelper.SYNC_NOW"
        private const val TICK_MS = 10 * 60_000L
    }
}
