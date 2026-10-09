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

    @ReactMethod
    fun setPausedUntil(untilMs: Double) {
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putLong("pausedUntil", untilMs.toLong()).apply()
    }

    @ReactMethod
    fun getPausedUntil(promise: Promise) {
        val v = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .getLong("pausedUntil", 0L)
        promise.resolve(v.toDouble())
    }

    @ReactMethod
    fun getChallengeCountToday(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                UsageMonitorService.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            val todayKey = TrustedClock.dayKey(reactContext)
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
    fun getAppIcons(names: ReadableArray, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val byLabel by lazy {
                pm.queryIntentActivities(launcherIntent, 0).associate {
                    it.loadLabel(pm).toString() to it.activityInfo.packageName
                }
            }
            val size = 96
            val result = Arguments.createMap()
            for (i in 0 until names.size()) {
                val name = names.getString(i) ?: continue
                val pkg = APP_PACKAGES[name] ?: byLabel[name] ?: continue
                try {
                    val drawable = pm.getApplicationIcon(pkg)
                    val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
                    val canvas = android.graphics.Canvas(bitmap)
                    drawable.setBounds(0, 0, size, size)
                    drawable.draw(canvas)
                    val out = java.io.ByteArrayOutputStream()
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
                    val encoded = android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
                    result.putString(name, "data:image/png;base64,$encoded")
                } catch (_: Exception) {}
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ICON_ERROR", e.message)
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

        val cutoff = minOf(endMs, System.currentTimeMillis())
        foregroundStart.forEach { (pkg, start) ->
            if (cutoff > start) {
                foregroundTimes[pkg] = (foregroundTimes[pkg] ?: 0L) + (cutoff - start)
            }
        }

        return foregroundTimes
    }

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
