package com.anonymous.IRONMIND

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class UsageMonitorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageMonitor"

    private val APP_PACKAGES = mapOf(
        "Instagram" to "com.instagram.android",
        "YouTube" to "com.google.android.youtube",
        "TikTok" to "com.zhiliaoapp.musically",
        "Facebook" to "com.facebook.katana",
        "X (Twitter)" to "com.twitter.android",
        "Reddit" to "com.reddit.frontpage",
        "Snapchat" to "com.snapchat.android"
    )

    @ReactMethod
    fun startMonitoring(
        apps: ReadableArray,
        challengeWindowSeconds: Double,
        dailyLimit: Double,
        uid: String?,
        appLimitsJson: String?
    ) {
        val appList = Array(apps.size()) { apps.getString(it) }
        val intent = Intent(reactContext, UsageMonitorService::class.java).apply {
            putExtra("apps", appList)
            putExtra("challengeWindowSeconds", challengeWindowSeconds)
            putExtra("dailyLimit", dailyLimit)
            putExtra("uid", uid ?: "")
            putExtra("appLimits", appLimitsJson ?: "{}")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopMonitoring() {
        val intent = Intent(reactContext, UsageMonitorService::class.java)
        reactContext.stopService(intent)
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // MIUI (and several other OEM skins) can throttle when they actually dispatch a
    // foreground service start well beyond Android's own Doze restrictions, which is a
    // common cause of ForegroundServiceDidNotStartInTimeException on those devices no
    // matter how fast our own code responds once invoked. This is the standard exemption
    // request; MIUI's own extra "Autostart" toggle has no public API to launch directly.
    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = android.net.Uri.parse("package:${reactContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            try {
                val fallback = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(fallback)
            } catch (_: Exception) {}
        }
    }

    // The service caps how many challenges may fire per day, and that counter is the only
    // thing that decides whether another one can. JS was inferring "challenges today" from
    // its own history of *resolved* results instead, so a user who had exhausted the cap saw
    // a screen claiming they had plenty left and no explanation for the silence.
    @ReactMethod
    fun getChallengeCountToday(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                UsageMonitorService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val cal = java.util.Calendar.getInstance()
            val todayKey = "${cal.get(java.util.Calendar.YEAR)}-${cal.get(java.util.Calendar.DAY_OF_YEAR)}"
            val count = if (prefs.getString("date", null) == todayKey) prefs.getInt("count", 0) else 0

            val map = Arguments.createMap()
            map.putInt("fired", count)
            map.putInt("limit", prefs.getFloat("limit", 5f).toInt())
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("COUNT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasUsageAccess(promise: Promise) {
        try {
            val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                reactContext.packageName
            )
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // Exact per-package foreground time over an arbitrary window, from the raw event stream
    // rather than UsageStatsManager's daily aggregate buckets — the aggregates snap to day
    // boundaries, which would make any window that doesn't start at midnight (a duel, for
    // example) silently wrong.
    private fun foregroundTimesFor(startMs: Long, endMs: Long): Map<String, Long> {
        val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        val eventsQuery = usm?.queryEvents(startMs, endMs) ?: return emptyMap()

        val foregroundTimes = mutableMapOf<String, Long>()
        val foregroundStart = mutableMapOf<String, Long>()

        val event = android.app.usage.UsageEvents.Event()
        while (eventsQuery.hasNextEvent()) {
            eventsQuery.getNextEvent(event)
            when (event.eventType) {
                android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    foregroundStart[event.packageName] = event.timeStamp
                }
                android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val start = foregroundStart.remove(event.packageName)
                    if (start != null) {
                        foregroundTimes[event.packageName] =
                            (foregroundTimes[event.packageName] ?: 0L) + (event.timeStamp - start)
                    }
                }
            }
        }

        // An app still in the foreground when the window closes has no MOVE_TO_BACKGROUND
        // event to pair with, so its final session would otherwise be dropped entirely.
        // Clamped to endMs so a past window can't accrue time up to the present.
        val cutoff = minOf(endMs, System.currentTimeMillis())
        foregroundStart.forEach { (pkg, start) ->
            if (cutoff > start) {
                foregroundTimes[pkg] = (foregroundTimes[pkg] ?: 0L) + (cutoff - start)
            }
        }

        return foregroundTimes
    }

    // Usage over an explicit window, used to settle duels. Kept separate from getUsageStats
    // so the duel result is computed over the duel's own rolling 24h rather than today's
    // calendar day, which would disagree between two players in different timezones.
    @ReactMethod
    fun getUsageForRange(startMs: Double, endMs: Double, promise: Promise) {
        try {
            val foregroundTimes = foregroundTimesFor(startMs.toLong(), endMs.toLong())
            val pm = reactContext.packageManager
            val result = Arguments.createArray()

            foregroundTimes
                .filter { it.value > 0L }
                .entries
                .sortedByDescending { it.value }
                .forEach { (pkg, timeMs) ->
                    try {
                        val appInfo = pm.getApplicationInfo(pkg, 0)
                        val label = pm.getApplicationLabel(appInfo).toString()
                        val friendlyName = APP_PACKAGES.entries.find { it.value == pkg }?.key ?: label
                        val map = Arguments.createMap()
                        map.putString("app", friendlyName)
                        map.putDouble("minutes", timeMs / 60000.0)
                        result.pushMap(map)
                    } catch (_: Exception) {}
                }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getUsageStats(promise: Promise) {
        try {
            // Midnight today → now
            val cal = java.util.Calendar.getInstance()
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            val startOfDay = cal.timeInMillis
            val now = System.currentTimeMillis()

            val foregroundTimes = foregroundTimesFor(startOfDay, now)

            val pm = reactContext.packageManager

            val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            val launcherPackage = pm.resolveActivity(homeIntent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
                ?.activityInfo?.packageName

            val NON_APP_PACKAGES = setOf(
                "android",
                "com.android.systemui",
                launcherPackage
            )

            fun isRealUserApp(pkg: String): Boolean {
                if (pkg == reactContext.packageName) return false
                if (NON_APP_PACKAGES.contains(pkg)) return false
                // Digital Wellbeing only attributes time to apps that appear in the launcher —
                // this is what excludes background system services with no user-facing UI.
                return pm.getLaunchIntentForPackage(pkg) != null
            }

            val result = Arguments.createArray()

            foregroundTimes
                .filter { it.value > 0L && isRealUserApp(it.key) }
                .entries
                .sortedByDescending { it.value }
                .take(10)
                .forEach { (pkg, timeMs) ->
                    try {
                        val appInfo = pm.getApplicationInfo(pkg, 0)
                        val label = pm.getApplicationLabel(appInfo).toString()
                        // Use friendly name for known apps
                        val friendlyName = APP_PACKAGES.entries.find { it.value == pkg }?.key ?: label
                        val map = Arguments.createMap()
                        map.putString("app", friendlyName)
                        map.putDouble("minutes", timeMs / 60000.0)
                        result.pushMap(map)
                    } catch (_: Exception) {}
                }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_ERROR", e.message)
        }
    }
}

