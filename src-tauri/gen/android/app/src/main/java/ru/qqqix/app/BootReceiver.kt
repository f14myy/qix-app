package ru.qqqix.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Brings [QixNotificationService] back after a reboot, but only if the user had
 * background notifications switched on — the service stores that flag itself.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        QixNotificationService.restartIfEnabled(context)
    }
}
