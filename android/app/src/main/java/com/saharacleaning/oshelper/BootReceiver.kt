package com.saharacleaning.oshelper

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts the helper after a reboot, only if the user had pressed Start. Some Android versions refuse this; then opening the app once is enough. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = Prefs(context)
        if (!prefs.running || !prefs.configured) return
        try {
            context.startForegroundService(Intent(context, SyncService::class.java))
        } catch (e: Exception) {
            prefs.log("Could not restart after reboot — open the app once")
        }
    }
}
