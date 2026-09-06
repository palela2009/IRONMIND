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
    private var lastKnownForeground: String? = null
    private var appLimits: Map<String, Int> = emptyMap()
    private var warnedToday: MutableSet<String> = mutableSetOf()
    private var warnedDate: String = ""

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

        // START_STICKY restarts this service with a NULL intent after the system kills it,
        // so the config has to survive independently. Reading it only from the intent meant a
        // restarted service monitored an empty app list and silently never fired again, with
        // its foreground notification still showing as if everything was fine.
        val apps = intent?.getStringArrayExtra("apps")
        if (apps != null) {
            val uid = intent.getStringExtra("uid") ?: ""
            // The fired-today counter lives in device storage, so switching accounts would
            // otherwise hand a new user the previous account's exhausted daily limit and
            // fire nothing for them at all.
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (uid.isNotEmpty() && prefs.getString("uid", null) != uid) {
                prefs.edit().putString("uid", uid).putString("date", null).putInt("count", 0).apply()
            }
            saveConfig(apps, intent.getDoubleExtra("challengeWindowSeconds", 10.0), intent.getDoubleExtra("dailyLimit", 5.0))
            intent.getStringExtra("appLimits")?.let { saveLimits(it) }
        }
        appLimits = loadLimits()

        val config = loadConfig()
        monitoredPackages = config.first.mapNotNull { appName ->
            APP_PACKAGES[appName]?.let { pkg -> Pair(appName, pkg) }
        }
        challengeWindowMs = (config.second * 1000).toLong()
        maxDailyChallenges = config.third.toInt()

        handler.removeCallbacks(pollRunnable)
        handler.post(pollRunnable)

        return START_STICKY
    }

    private fun saveConfig(apps: Array<String>, windowSeconds: Double, dailyLimit: Double) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putStringSet("apps", apps.toSet())
            .putFloat("window", windowSeconds.toFloat())
            .putFloat("limit", dailyLimit.toFloat())
            .apply()
    }

    // Stored as the raw JSON string the bridge delivered. Persisting it alongside the rest of
    // the config matters for the same reason: a sticky restart arrives with a null intent and
    // would otherwise come back with no budgets at all.
    private fun saveLimits(json: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString("appLimits", json).apply()
    }

    private fun loadLimits(): Map<String, Int> {
        val raw = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("appLimits", null)
            ?: return emptyMap()
        return try {
            val obj = org.json.JSONObject(raw)
            obj.keys().asSequence().associateWith { obj.getInt(it) }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun minutesUsedToday(pkg: String): Int {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return 0
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val now = System.currentTimeMillis()

        val events = usm.queryEvents(cal.timeInMillis, now) ?: return 0
        val event = android.app.usage.UsageEvents.Event()
        var total = 0L
        var openedAt = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.packageName != pkg) continue
            when (event.eventType) {
                android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND,
                android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED -> openedAt = event.timeStamp
                android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND,
                android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED -> {
                    if (openedAt > 0L) {
                        total += event.timeStamp - openedAt
                        openedAt = 0L
                    }
                }
            }
        }
        // Still open right now: count the session so far, or a budget would only ever update
        // after the user closed the app.
        if (openedAt > 0L) total += now - openedAt

        return (total / 60000L).toInt()
    }

    private fun loadConfig(): Triple<List<String>, Double, Double> {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return Triple(
            prefs.getStringSet("apps", emptySet())?.toList() ?: emptyList(),
            prefs.getFloat("window", 10f).toDouble(),
            prefs.getFloat("limit", 5f).toDouble()
        )
    }

    private fun checkForegroundApp() {
        val foreground = getForegroundPackage() ?: return
        lastKnownForeground = foreground
        val now = System.currentTimeMillis()

        activeChallenge?.let { challenge ->
            val elapsedMs = now - challenge.startTime
            if (foreground != challenge.pkg) {
                // Only resolve once they actually leave — whether that's within the window
                // (success) or well after it expired (still a fail, but showing the real
                // time it took them to close it instead of a meaningless placeholder).
                val success = elapsedMs < challengeWindowMs
                emitChallengeResult(challenge.appName, elapsedMs / 1000.0, success)
                activeChallenge = null
                return
            }

            // A challenge that can never resolve blocks every future challenge, since nothing
            // else is evaluated while one is active. If we somehow never observe them leaving
            // — a missed event, a screen-off, a reboot mid-challenge — give up and record the
            // fail rather than silently disabling the app forever.
            if (elapsedMs > STUCK_CHALLENGE_MS) {
                emitChallengeResult(challenge.appName, elapsedMs / 1000.0, false)
                activeChallenge = null
            }
            return
        }

        for ((appName, pkg) in monitoredPackages) {
            if (foreground == pkg) {
                val limit = appLimits[appName] ?: 0
                val used = if (limit > 0) minutesUsedToday(pkg) else 0
                val overBudget = limit > 0 && used >= limit

                if (limit > 0 && !overBudget && used >= (limit * 8 / 10)) {
                    maybeWarn(appName, limit - used)
                }

                // Past the budget the usual restraints are lifted: every open is challenged,
                // ignoring both the per-app cooldown and the daily cap. Those exist to stop
                // IRONMIND nagging during normal use, and this is by definition not that.
                val sameAppCooldown = appName == lastChallengedApp && (now - lastChallengeTime) < cooldownMs
                val allowed = overBudget || (!sameAppCooldown && getFiredCountToday() < maxDailyChallenges)

                if (allowed) {
                    lastChallengedApp = appName
                    lastChallengeTime = now
                    activeChallenge = ActiveChallenge(appName, pkg, now)
                    fireChallengeNotification(appName, overBudget)
                    if (!overBudget) incrementFiredCountToday()
                }
                return
            }
        }
    }

    // One warning per app per day. Repeating it every poll would turn the approach to a
    // budget into exactly the nagging the cooldown exists to prevent.
    private fun maybeWarn(appName: String, minutesLeft: Int) {
        val today = getTodayKey()
        if (warnedDate != today) {
            warnedDate = today
            warnedToday = mutableSetOf()
        }
        if (!warnedToday.add(appName)) return

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = NotificationCompat.Builder(this, CHALLENGE_CHANNEL)
            .setContentTitle("$appName — ${minutesLeft}m left")
            .setContentText("You are close to your daily limit. Every open past it triggers a challenge.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        nm.notify(WARNING_ID, notification)
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

    // Reads the raw event stream rather than queryUsageStats. The aggregate query returns
    // day-length buckets whose lastTimeUsed is only loosely current, so a short window over it
    // frequently came back empty or stale and a genuine app switch went unnoticed.
    private fun getForegroundPackage(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()

        val events = usm.queryEvents(now - FOREGROUND_LOOKBACK_MS, now) ?: return null
        val event = android.app.usage.UsageEvents.Event()
        var latestPkg: String? = null
        var latestTime = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val isResume = event.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND ||
                event.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED
            // IRONMIND itself is deliberately not filtered out. Opening this app is one of the
            // most natural ways to escape a challenge, and ignoring its own resume events left
            // the challenge unresolved — which then blocked every later challenge, since none
            // are evaluated while one is active.
            if (isResume && event.timeStamp >= latestTime) {
                latestTime = event.timeStamp
                latestPkg = event.packageName
            }
        }

        return latestPkg ?: lastKnownForeground
    }

    private fun fireChallengeNotification(appName: String, overBudget: Boolean = false) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val windowSeconds = challengeWindowMs / 1000
        val notification = NotificationCompat.Builder(this, CHALLENGE_CHANNEL)
            .setContentTitle(if (overBudget) "OVER YOUR LIMIT" else "IRONMIND CHALLENGE")
            .setContentText(
                if (overBudget) "$appName is past its daily limit — exit in $windowSeconds seconds."
                else "You opened $appName — exit in $windowSeconds seconds."
            )
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
        const val WARNING_ID = 1003
        const val FOREGROUND_CHANNEL = "ironmind_monitor"
        const val CHALLENGE_CHANNEL = "ironmind_challenges"
        const val PREFS_NAME = "ironmind_challenge_prefs"
        const val FOREGROUND_LOOKBACK_MS = 60_000L
        const val STUCK_CHALLENGE_MS = 10 * 60 * 1000L
    }
}
