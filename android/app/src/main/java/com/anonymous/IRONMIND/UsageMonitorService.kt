package com.anonymous.IRONMIND

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class UsageMonitorService : Service() {

    private data class ActiveChallenge(val appName: String, val pkg: String, val startTime: Long, val id: String, val uid: String, val windowMs: Long)
    private data class PendingWin(val appName: String, val pkg: String, val exactMs: Long, val leftAt: Long, val id: String, val uid: String, val startTime: Long)

    private var pendingWin: PendingWin? = null

    private val handler = Handler(Looper.getMainLooper())
    private val syncExecutor = Executors.newSingleThreadExecutor()
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
    private val overLimitTracker = OverLimitTracker()
    private var lastBackgroundSyncAt: Long = 0L

    private val pollRunnable = object : Runnable {
        override fun run() {
            try { checkForegroundApp() } catch (e: Exception) { android.util.Log.e("IRONMIND", "Monitor tick failed", e) }
            try { maybeRunBackgroundSync() } catch (_: Exception) {}
            handler.postDelayed(this, 2000)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        running = true
        createChannels()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(this, FOREGROUND_ID, buildForegroundNotification(), type)

        val apps = intent?.getStringArrayExtra("apps")
        if (apps != null) {
            val uid = intent.getStringExtra("uid") ?: ""
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (uid.isNotEmpty() && prefs.getString("uid", null) != uid) {
                activeChallenge = null
                pendingWin = null
                overLimitTracker.resetForAccountSwitch()
                ChallengeStore.saveActive(this, null)
                prefs.edit().putString("uid", uid).putString("date", null).putInt("count", 0).apply()
            }
            intent.getStringExtra("timeZoneId")?.let { prefs.edit().putString("accountTimeZone", it).apply() }
            saveConfig(apps, intent.getDoubleExtra("challengeWindowSeconds", 10.0), intent.getDoubleExtra("dailyLimit", 5.0))
            intent.getStringExtra("appLimits")?.let { saveLimits(it) }
        }
        lastChallengeTime = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getLong("lastChallengeTime", 0L)
        appLimits = loadLimits()

        val config = loadConfig()
        monitoredPackages = config.first.flatMap { appName ->
            packagesForApp(appName).map { pkg -> Pair(appName, pkg) }
        }
        challengeWindowMs = (config.second * 1000).toLong()
        maxDailyChallenges = config.third.toInt()

        ChallengeStore.saveActive(this, null)
        activeChallenge = null
        pendingWin = null
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

    private fun saveLimits(json: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putString("appLimits", json).apply()
    }

    private fun loadLimits(): Map<String, Int> {
        val raw = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("appLimits", null)
            ?: return emptyMap()
        return try {
            val obj = JSONObject(raw)
            obj.keys().asSequence().associateWith { obj.getInt(it) }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun foregroundTimesForRange(startMs: Long, endMs: Long): Map<String, Long> {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return emptyMap()
        val cutoff = minOf(endMs, System.currentTimeMillis())
        if (cutoff <= startMs) return emptyMap()
        val events = usm.queryEvents(maxOf(0L, startMs - 86_400_000L), cutoff) ?: return emptyMap()
        val timeline = UsageTimeline(startMs, cutoff)
        val event = android.app.usage.UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            timeline.onEvent(event.packageName, event.eventType, event.timeStamp)
        }
        return timeline.totals()
    }

    private fun minutesUsedToday(appName: String): Int {
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val totals = foregroundTimesForRange(cal.timeInMillis, System.currentTimeMillis())
        val totalMs = packagesForApp(appName).sumOf { totals[it] ?: 0L }
        return (totalMs / 60_000L).toInt()
    }

    private fun maybeRunBackgroundSync() {
        val now = System.currentTimeMillis()
        if (now - lastBackgroundSyncAt < BACKGROUND_SYNC_INTERVAL_MS) return
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val uid = prefs.getString("uid", null)?.takeIf { it.isNotBlank() } ?: return
        val token = prefs.getString("syncToken", null)?.takeIf { it.isNotBlank() } ?: return
        val apiBase = prefs.getString("apiBaseUrl", null)?.takeIf { it.startsWith("http") } ?: return
        lastBackgroundSyncAt = now
        syncExecutor.execute {
            runBackgroundSync(apiBase.trimEnd('/'), uid, token)
        }
    }

    private fun runBackgroundSync(apiBase: String, uid: String, token: String) {
        try {
            val authHeader = "Sync $uid:$token"
            val cal = java.util.Calendar.getInstance()
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            val now = System.currentTimeMillis()
            val todayTotals = foregroundTimesForRange(cal.timeInMillis, now)
            val pm = packageManager
            val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val launcherPkg = pm.resolveActivity(homeIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
                ?.activityInfo?.packageName
            val skip = setOf("android", "com.android.systemui", launcherPkg)

            val appsArray = JSONArray()
            val byName = mutableMapOf<String, Double>()
            for ((pkg, ms) in todayTotals) {
                if (ms <= 0L || pkg in skip) continue
                if (pm.getLaunchIntentForPackage(pkg) == null) continue
                val friendly = appNameForPackage(pkg) ?: try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                } catch (_: Exception) { continue }
                byName[friendly] = (byName[friendly] ?: 0.0) + (ms / 60_000.0)
            }
            for ((name, mins) in byName.entries.sortedByDescending { it.value }.take(60)) {
                appsArray.put(JSONObject().put("app", name).put("minutes", mins.coerceIn(0.0, 1440.0)))
            }

            val duelReports = JSONArray()
            val duelsResp = httpGetJson("$apiBase/api/sync/duels", authHeader)
            val duels = duelsResp?.optJSONArray("duels")
            if (duels != null) {
                for (i in 0 until duels.length()) {
                    val d = duels.optJSONObject(i) ?: continue
                    val id = d.optString("id", "")
                    val startAt = d.optLong("startAt", 0L)
                    val endAt = d.optLong("endAt", 0L)
                    if (id.isEmpty() || startAt <= 0L) continue
                    val rangeEnd = if (endAt > 0L) minOf(now, endAt) else now
                    if (rangeEnd <= startAt) continue
                    val targetApps = mutableSetOf<String>()
                    val arr = d.optJSONArray("apps")
                    if (arr != null) {
                        for (j in 0 until arr.length()) {
                            arr.optString(j)?.takeIf { it.isNotBlank() }?.let { targetApps.add(it) }
                        }
                    }
                    if (targetApps.isEmpty()) continue
                    val rangeTotals = foregroundTimesForRange(startAt, rangeEnd)
                    var duelMs = 0L
                    for ((pkg, ms) in rangeTotals) {
                        val friendly = appNameForPackage(pkg) ?: try {
                            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                        } catch (_: Exception) { null }
                        if (friendly != null && friendly in targetApps) duelMs += ms
                    }
                    duelReports.put(JSONObject().put("id", id).put("minutes", (duelMs / 60_000.0).coerceIn(0.0, 1440.0)))
                }
            }

            val payload = JSONObject()
                .put("date", TrustedClock.dayKey(this))
                .put("apps", appsArray)
                .put("duelReports", duelReports)
            httpPostJson("$apiBase/api/sync/usage", authHeader, payload.toString())
        } catch (_: Exception) {}
    }

    private fun httpGetJson(urlStr: String, authHeader: String): JSONObject? {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8_000
            readTimeout = 8_000
            setRequestProperty("Authorization", authHeader)
        }
        return try {
            if (conn.responseCode !in 200..299) return null
            val text = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }

    private fun httpPostJson(urlStr: String, authHeader: String, body: String): Boolean {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8_000
            readTimeout = 8_000
            doOutput = true
            setRequestProperty("Authorization", authHeader)
            setRequestProperty("Content-Type", "application/json")
        }
        return try {
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            conn.responseCode in 200..299
        } finally {
            conn.disconnect()
        }
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
        if (getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("uid", null).isNullOrEmpty()) return
        val pausedUntil = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getLong("pausedUntil", 0L)
        if (System.currentTimeMillis() < pausedUntil) {
            activeChallenge = null
            pendingWin = null
            ChallengeStore.saveActive(this, null)
            return
        }

        val foreground = getForegroundPackage() ?: return
        lastKnownForeground = foreground
        if (BuildConfig.IRONMIND_REELS_TEST) reelsForegroundPackage = foreground

        val matched = monitoredPackages.firstOrNull { it.second == foreground }
        if (matched == null) {
            overLimitTracker.onForegroundChanged(foreground)
            return
        }

        val appName = matched.first
        val limit = appLimits[appName] ?: 0
        if (limit <= 0) {
            overLimitTracker.onForegroundChanged(foreground)
            return
        }

        val used = minutesUsedToday(appName)
        val shouldFireOverLimit = overLimitTracker.shouldAlertOnForeground(
            foreground = foreground,
            appName = appName,
            usedMinutes = used,
            limitMinutes = limit,
            dayKey = getTodayKey()
        )
        if (BuildConfig.IRONMIND_REELS_TEST && reelsChallengeInProgress) return
        if (shouldFireOverLimit) {
            fireOverLimitNotification(appName, used, limit)
        } else if (used < limit && used >= (limit * 8 / 10)) {
            maybeWarn(appName, limit - used)
        }
    }

    private fun fireOverLimitNotification(appName: String, usedMinutes: Int, limitMinutes: Int) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return
        val goal = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("userGoal", null)?.takeIf { it.isNotBlank() }
        val body = if (goal != null) {
            "You've used ${usedMinutes}m / ${limitMinutes}m today · Goal: $goal. Close $appName now."
        } else {
            "You've used ${usedMinutes}m / ${limitMinutes}m today. Close $appName now."
        }
        val notification = NotificationCompat.Builder(this, OVER_LIMIT_CHANNEL)
            .setContentTitle("⛔ $appName daily limit reached")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.notification_icon)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(longArrayOf(0, 250, 200, 250))
            .setOnlyAlertOnce(false)
            .setAutoCancel(true)
            .build()
        nm.cancel(OVER_LIMIT_ID)
        nm.notify(OVER_LIMIT_ID, notification)
    }

    private fun maybeWarn(appName: String, minutesLeft: Int) {
        val today = getTodayKey()
        if (warnedDate != today) {
            warnedDate = today
            warnedToday = mutableSetOf()
        }
        if (!warnedToday.add(appName)) return

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return
        val notification = NotificationCompat.Builder(this, OVER_LIMIT_CHANNEL)
            .setContentTitle("$appName — ${minutesLeft}m left")
            .setContentText("You are at 80% of your daily limit for $appName.")
            .setSmallIcon(R.drawable.notification_icon)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .build()
        nm.notify(WARNING_ID, notification)
    }

    private fun getTodayKey(): String = TrustedClock.dayKey(this)

    private fun resumedSince(pkg: String, since: Long): Boolean {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return false
        val events = usm.queryEvents(since, System.currentTimeMillis()) ?: return false
        val event = android.app.usage.UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.packageName == pkg && isResumeEvent(event.eventType) && event.timeStamp >= since) return true
        }
        return false
    }

    private fun fireReentryNotification(appName: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = NotificationCompat.Builder(this, CHALLENGE_CHANNEL)
            .setContentTitle("Back too soon")
            .setContentText("You reopened $appName within ${REENTRY_MS / 1000} seconds, so that challenge counts as lost.")
            .setSmallIcon(R.drawable.notification_icon)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        nm.notify(CHALLENGE_ID, notification)
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

    private fun saveChallenge() {
        val win = pendingWin
        val challenge = activeChallenge
        val state = if (win != null) JSONObject().put("phase", "pending").put("appName", win.appName).put("pkg", win.pkg).put("startTime", win.startTime).put("id", win.id).put("uid", win.uid).put("exactMs", win.exactMs).put("leftAt", win.leftAt)
            else if (challenge != null) JSONObject().put("phase", "active").put("appName", challenge.appName).put("pkg", challenge.pkg).put("startTime", challenge.startTime).put("id", challenge.id).put("uid", challenge.uid).put("windowMs", challenge.windowMs)
            else null
        ChallengeStore.saveActive(this, state)
    }

    private fun restoreChallenge() {
        val state = ChallengeStore.active(this) ?: return
        if (usesShortVideoChallenges(state.optString("pkg"))) {
            activeChallenge = null
            pendingWin = null
            ChallengeStore.saveActive(this, null)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(CHALLENGE_ID)
            return
        }
        if (state.getString("phase") == "pending") {
            pendingWin = PendingWin(state.getString("appName"), state.getString("pkg"), state.getLong("exactMs"), state.getLong("leftAt"), state.getString("id"), state.getString("uid"), state.getLong("startTime"))
            activeChallenge = null
        } else {
            activeChallenge = ActiveChallenge(state.getString("appName"), state.getString("pkg"), state.getLong("startTime"), state.getString("id"), state.getString("uid"), state.optLong("windowMs", challengeWindowMs))
        }
    }

    private fun emitChallengeResult(appName: String, elapsedTime: Double, wasSuccessful: Boolean, id: String, uid: String, startedAt: Long) {
        ChallengeStore.finish(this, JSONObject().put("id", id).put("uid", uid).put("targetApp", appName).put("elapsedTime", elapsedTime.coerceIn(0.0, 86400.0)).put("wasSuccessful", wasSuccessful).put("timestamp", startedAt))
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
        }
    }

    private fun leaveTimeAfter(pkg: String, since: Long): Long? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(since, now) ?: return null
        val event = android.app.usage.UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val left = (isResumeEvent(event.eventType) && event.packageName != pkg) || (event.packageName == pkg && event.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED) || event.eventType == android.app.usage.UsageEvents.Event.SCREEN_NON_INTERACTIVE
            if (left && event.timeStamp >= since) {
                return event.timeStamp
            }
        }
        return null
    }

    private fun isResumeEvent(type: Int): Boolean =
        type == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND ||
            type == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED

    private fun getForegroundPackage(): String? {
        val power = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        if (!power.isInteractive) return "__screen_off__"
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()

        val events = usm.queryEvents(now - FOREGROUND_LOOKBACK_MS, now) ?: return null
        val event = android.app.usage.UsageEvents.Event()
        var latestPkg: String? = null
        var latestTime = 0L
        var stopped = false

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val isResume = event.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND ||
                event.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED
            if (isResume && event.timeStamp >= latestTime) {
                latestTime = event.timeStamp
                latestPkg = event.packageName
                stopped = false
            } else if ((event.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED && event.packageName == (latestPkg ?: lastKnownForeground)) || event.eventType == android.app.usage.UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                latestPkg = null
                stopped = true
            }
        }

        return latestPkg ?: if (stopped) "__no_foreground__" else lastKnownForeground
    }

    private fun fireChallengeNotification(appName: String, overBudget: Boolean = false) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val windowSeconds = challengeWindowMs / 1000
        val goal = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString("userGoal", null)?.takeIf { it.isNotBlank() }
        val body = when {
            overBudget -> "$appName is past its daily limit — exit in $windowSeconds seconds."
            goal != null -> "Exit $appName in $windowSeconds seconds · Remember why: $goal"
            else -> "You opened $appName — exit in $windowSeconds seconds."
        }
        val notification = NotificationCompat.Builder(this, CHALLENGE_CHANNEL)
            .setContentTitle(if (overBudget) "OVER YOUR LIMIT" else "IRONMIND CHALLENGE")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.notification_icon)
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
            .setSmallIcon(R.drawable.notification_icon)
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

            val overLimitCh = NotificationChannel(
                OVER_LIMIT_CHANNEL, "Daily limit alerts", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts when an app approaches or exceeds its daily limit"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 200, 250)
            }

            nm.createNotificationChannel(foregroundCh)
            nm.createNotificationChannel(challengeCh)
            nm.createNotificationChannel(overLimitCh)
        }
    }

    override fun onDestroy() {
        running = false
        if (BuildConfig.IRONMIND_REELS_TEST) reelsForegroundPackage = null
        super.onDestroy()
        handler.removeCallbacks(pollRunnable)
        syncExecutor.shutdownNow()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun usesShortVideoChallenges(pkg: String): Boolean = BuildConfig.IRONMIND_REELS_TEST &&
        ShortVideoTarget.replacesAppReminder(pkg, getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE))

    companion object {
        @Volatile var running = false
        @Volatile internal var reelsForegroundPackage: String? = null
        @Volatile internal var reelsChallengeInProgress = false
        const val FOREGROUND_ID = 1001
        const val CHALLENGE_ID = 1002
        const val WARNING_ID = 1003
        const val OVER_LIMIT_ID = 1006
        const val FOREGROUND_CHANNEL = "ironmind_monitor"
        const val CHALLENGE_CHANNEL = "ironmind_challenges"
        const val OVER_LIMIT_CHANNEL = "ironmind_over_limit"
        const val PREFS_NAME = "ironmind_challenge_prefs"
        const val FOREGROUND_LOOKBACK_MS = 60_000L
        const val STUCK_CHALLENGE_MS = 10 * 60 * 1000L
        const val REENTRY_MS = 20_000L
        const val BACKGROUND_SYNC_INTERVAL_MS = 15 * 60 * 1000L

        private val APP_PACKAGE_MAP = mapOf(
            "Instagram" to listOf("com.instagram.android"),
            "YouTube" to listOf("com.google.android.youtube"),
            "TikTok" to listOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill"),
            "Facebook" to listOf("com.facebook.katana"),
            "X (Twitter)" to listOf("com.twitter.android"),
            "Reddit" to listOf("com.reddit.frontpage"),
            "Snapchat" to listOf("com.snapchat.android")
        )

        fun packagesForApp(appName: String): List<String> = APP_PACKAGE_MAP[appName] ?: emptyList()

        fun appNameForPackage(pkg: String): String? =
            APP_PACKAGE_MAP.entries.firstOrNull { pkg in it.value }?.key
    }
}
