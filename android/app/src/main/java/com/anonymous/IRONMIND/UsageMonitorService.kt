package com.anonymous.IRONMIND

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class UsageMonitorService : Service() {

    private data class ActiveChallenge(val appName: String, val pkg: String, val startTime: Long)

    private val handler = Handler(Looper.getMainLooper())
    private var monitoredPackages: List<Pair<String, String>> = emptyList()
    private var lastChallengedApp: String? = null
    private var lastChallengeTime: Long = 0
    private val cooldownMs = 120_000L
    private var activeChallenge: ActiveChallenge? = null
    private var challengeWindowMs = 10_000L
    private var maxDailyChallenges = 5

    private val APP_PACKAGES = mapOf(
        "Instagram" to "com.instagram.android",
        "YouTube" to "com.google.android.youtube",
        "TikTok" to "com.zhiliaoapp.musically",
        "Facebook" to "com.facebook.katana",
        "X (Twitter)" to "com.twitter.android",
        "Reddit" to "com.reddit.frontpage",
        "Snapchat" to "com.snapchat.android"
    )

    private val pollRunnable = object : Runnable {
        override fun run() {
            checkForegroundApp()
            handler.postDelayed(this, 2000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Android enforces a strict ~5s deadline between startForegroundService() and this
        // service calling startForeground() — miss it and the whole app is killed with
        // ForegroundServiceDidNotStartInTimeException. Call it before any other work so
        // nothing (parsing extras, creating channels) can push it past that deadline.
        createChannels()
        startForeground(FOREGROUND_ID, buildForegroundNotification())

        val apps = intent?.getStringArrayExtra("apps") ?: emptyArray()
        monitoredPackages = apps.mapNotNull { appName ->
            APP_PACKAGES[appName]?.let { pkg -> Pair(appName, pkg) }
        }
        if (intent?.hasExtra("challengeWindowSeconds") == true) {
            challengeWindowMs = (intent.getDoubleExtra("challengeWindowSeconds", 10.0) * 1000).toLong()
        }
        if (intent?.hasExtra("dailyLimit") == true) {
            maxDailyChallenges = intent.getDoubleExtra("dailyLimit", 5.0).toInt()
        }
        handler.post(pollRunnable)

        return START_STICKY
    }

    private fun checkForegroundApp() {
        val foreground = getForegroundPackage() ?: return
        val now = System.currentTimeMillis()

        activeChallenge?.let { challenge ->
            val elapsedMs = now - challenge.startTime
            // Check the deadline FIRST: polling only happens every 2s, so by the time a poll
            // notices the user has left the app, elapsed time may already be past the window —
            // that must still count as a fail, not a success just because they eventually left.
            if (elapsedMs >= challengeWindowMs) {
                emitChallengeResult(challenge.appName, -1.0, false)
                activeChallenge = null
            } else if (foreground != challenge.pkg) {
                emitChallengeResult(challenge.appName, elapsedMs / 1000.0, true)
                activeChallenge = null
            }
            // A challenge is in progress — don't evaluate for a new one until this resolves.
            return
        }

        for ((appName, pkg) in monitoredPackages) {
            if (foreground == pkg) {
                val sameAppCooldown = appName == lastChallengedApp && (now - lastChallengeTime) < cooldownMs
                if (!sameAppCooldown && getFiredCountToday() < maxDailyChallenges) {
                    lastChallengedApp = appName
                    lastChallengeTime = now
                    activeChallenge = ActiveChallenge(appName, pkg, now)
                    fireChallengeNotification(appName)
                    incrementFiredCountToday()
                }
                return
            }
        }
    }

    private fun getTodayKey(): String {
        val cal = java.util.Calendar.getInstance()
        return "${cal.get(java.util.Calendar.YEAR)}-${cal.get(java.util.Calendar.DAY_OF_YEAR)}"
    }

    private fun getFiredCountToday(): Int {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedDate = prefs.getString("date", null)
        return if (savedDate == getTodayKey()) prefs.getInt("count", 0) else 0
    }

    private fun incrementFiredCountToday() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("date", getTodayKey())
            .putInt("count", getFiredCountToday() + 1)
            .apply()
    }

    private fun emitChallengeResult(appName: String, elapsedTime: Double, wasSuccessful: Boolean) {
        try {
            val reactContext = (applicationContext as? ReactApplication)?.reactHost?.currentReactContext
                ?: return
            val params = Arguments.createMap().apply {
                putString("targetApp", appName)
                putDouble("elapsedTime", elapsedTime)
                putBoolean("wasSuccessful", wasSuccessful)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("IronmindChallengeResult", params)
        } catch (_: Exception) {
            // JS context may not be alive (app fully closed) — the local notification already
            // fired, which is the part the user actually sees; a missed result sync is acceptable.
        }
    }

    private fun getForegroundPackage(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 10_000, now)
        if (stats.isNullOrEmpty()) return null

        return stats
            .filter { it.packageName != packageName }
            .maxByOrNull { it.lastTimeUsed }
            ?.packageName
    }

    private fun fireChallengeNotification(appName: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val windowSeconds = challengeWindowMs / 1000
        val notification = NotificationCompat.Builder(this, CHALLENGE_CHANNEL)
            .setContentTitle("IRONMIND CHALLENGE")
            .setContentText("You opened $appName — exit in $windowSeconds seconds.")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVibrate(longArrayOf(0, 250, 250, 250))
            .setAutoCancel(true)
            .build()
        nm.notify(CHALLENGE_ID, notification)
    }

    private fun buildForegroundNotification(): Notification {
        return NotificationCompat.Builder(this, FOREGROUND_CHANNEL)
            .setContentTitle("IRONMIND")
            .setContentText("Monitoring your apps in background")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val foregroundCh = NotificationChannel(
                FOREGROUND_CHANNEL, "IRONMIND Monitor", NotificationManager.IMPORTANCE_MIN
            ).apply { description = "Silent channel keeping IRONMIND active" }

            val challengeCh = NotificationChannel(
                CHALLENGE_CHANNEL, "IRONMIND Challenges", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Challenge alerts"
                enableVibration(true)
            }

            nm.createNotificationChannel(foregroundCh)
            nm.createNotificationChannel(challengeCh)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(pollRunnable)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val FOREGROUND_ID = 1001
        const val CHALLENGE_ID = 1002
        const val FOREGROUND_CHANNEL = "ironmind_monitor"
        const val CHALLENGE_CHANNEL = "ironmind_challenges"
        const val PREFS_NAME = "ironmind_challenge_prefs"
    }
}
