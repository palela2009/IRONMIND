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
    fun startMonitoring(apps: ReadableArray, challengeWindowSeconds: Double) {
        val appList = Array(apps.size()) { apps.getString(it) }
        val intent = Intent(reactContext, UsageMonitorService::class.java).apply {
            putExtra("apps", appList)
            putExtra("challengeWindowSeconds", challengeWindowSeconds)
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

    @ReactMethod
    fun getUsageStats(promise: Promise) {
        try {
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

            // Midnight today → now
            val cal = java.util.Calendar.getInstance()
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            val startOfDay = cal.timeInMillis
            val now = System.currentTimeMillis()

            // Use queryEvents for exact accuracy (tracks every FOREGROUND/BACKGROUND event)
            val eventsQuery = usm?.queryEvents(startOfDay, now)
            val foregroundTimes = mutableMapOf<String, Long>()
            val foregroundStart = mutableMapOf<String, Long>()

            if (eventsQuery != null) {
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
                // Add time for apps still in foreground right now
                foregroundStart.forEach { (pkg, start) ->
                    foregroundTimes[pkg] = (foregroundTimes[pkg] ?: 0L) + (now - start)
                }
            }

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

