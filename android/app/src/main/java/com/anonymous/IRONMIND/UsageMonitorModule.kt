package com.anonymous.IRONMIND

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class UsageMonitorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageMonitor"

    @ReactMethod
    fun getPendingResults(uid: String, promise: Promise) {
        try { promise.resolve(ChallengeStore.pending(reactContext, uid)) }
        catch (e: Exception) { promise.reject("RESULTS_ERROR", e.message) }
    }

    @ReactMethod
    fun acknowledgeResult(uid: String, id: String, promise: Promise) {
        try { ChallengeStore.acknowledge(reactContext, uid, id); promise.resolve(true) }
        catch (e: Exception) { promise.reject("ACK_ERROR", e.message) }
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) { promise.resolve(UsageMonitorService.running) }

    @ReactMethod
    fun setUserGoal(goal: String) {
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("userGoal", goal.trim()).apply()
    }

    @ReactMethod
    fun setBackgroundSyncConfig(apiBaseUrl: String, syncToken: String) {
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("apiBaseUrl", apiBaseUrl)
            .putString("syncToken", syncToken)
            .apply()
    }

    @ReactMethod
    fun clearSyncToken() {
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove("syncToken").apply()
    }

    @ReactMethod
    fun getInstagramReelsTest(uid: String, promise: Promise) {
        if (!BuildConfig.IRONMIND_REELS_TEST) {
            promise.resolve(null)
            return
        }
        try {
            val prefs = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            val enabled = isAccessibilityServiceEnabled()
            val reelsPrefs = reactContext.getSharedPreferences("ironmind_reels_test", Context.MODE_PRIVATE)
            val day = TrustedClock.dayKey(reactContext)
            val today = reelsPrefs.getString("day", null) == day
            val countToday = if (today) reelsPrefs.getInt("reminders", 0) else 0
            val sentAt = reelsPrefs.getLong("sentAt", 0L)
            val now = TrustedClock.now(reactContext)
            val cooldownMs = if (sentAt > 0L) maxOf(0L, 300_000L - (now - sentAt)) else 0L
            val maxPerDay = prefs.getFloat("limit", 5f).toInt().coerceIn(1, 20)

            promise.resolve(Arguments.createMap().apply {
                putBoolean("consented", ShortVideoTarget.INSTAGRAM.hasConsent(prefs, uid))
                putBoolean("expandedConsented", prefs.getString(ShortVideoTarget.EXPANDED_CONSENT_UID, null) == uid)
                putBoolean("enabled", enabled)
                putBoolean("connected", ShortVideoTarget.serviceConnected)
                putInt("countToday", countToday)
                putInt("maxPerDay", maxPerDay)
                putDouble("cooldownRemainingMs", cooldownMs.toDouble())
            })
        } catch (error: Exception) {
            promise.reject("REELS_TEST_SETTINGS", error)
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val accessibility = reactContext.getSystemService(AccessibilityManager::class.java)
        return accessibility.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any {
                val service = it.resolveInfo.serviceInfo
                service.packageName == reactContext.packageName &&
                    service.name == "com.anonymous.IRONMIND.InstagramReelsService"
            }
    }

    @ReactMethod
    fun setInstagramReelsTestConsent(uid: String, consented: Boolean, promise: Promise) {
        saveScrollConsent(uid, consented, expand = false, promise)
    }

    @ReactMethod
    fun setShortVideoTestConsent(uid: String, consented: Boolean, promise: Promise) {
        saveScrollConsent(uid, consented, expand = true, promise)
    }

    private fun saveScrollConsent(uid: String, consented: Boolean, expand: Boolean, promise: Promise) {
        if (!BuildConfig.IRONMIND_REELS_TEST || uid.isBlank()) {
            promise.resolve(false)
            return
        }
        try {
            val prefs = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            val editor = prefs.edit()
            if (consented) {
                editor.putString(ShortVideoTarget.INSTAGRAM_CONSENT_UID, uid)
                if (expand) editor.putString(ShortVideoTarget.EXPANDED_CONSENT_UID, uid)
            } else {
                for (key in listOf(ShortVideoTarget.INSTAGRAM_CONSENT_UID, ShortVideoTarget.EXPANDED_CONSENT_UID)) {
                    if (prefs.getString(key, null) == uid) editor.remove(key)
                }
            }
            promise.resolve(editor.commit())
        } catch (error: Exception) {
            promise.reject("REELS_TEST_CONSENT", error)
        }
    }

    @ReactMethod
    fun openUsageAccessSettings() {
        try {
            val args = Bundle().apply { putString(":settings:fragment_args_key", reactContext.packageName) }
            val direct = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                data = android.net.Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(":settings:fragment_args_key", reactContext.packageName)
                putExtra(":settings:show_fragment_args", args)
            }
            reactContext.startActivity(direct)
        } catch (_: Exception) {
            try {
                val args = Bundle().apply { putString(":settings:fragment_args_key", reactContext.packageName) }
                val fallback = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    putExtra(":settings:fragment_args_key", reactContext.packageName)
                    putExtra(":settings:show_fragment_args", args)
                }
                reactContext.startActivity(fallback)
            } catch (_: Exception) {}
        }
    }

    @ReactMethod
    fun openInstagramReelsTestSettings(uid: String, promise: Promise) {
        val prefs = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        if (!BuildConfig.IRONMIND_REELS_TEST || !ShortVideoTarget.INSTAGRAM.hasConsent(prefs, uid)) {
            promise.resolve(false)
            return
        }
        val componentKey = "${reactContext.packageName}/com.anonymous.IRONMIND.InstagramReelsService"
        try {
            val args = Bundle().apply { putString(":settings:fragment_args_key", componentKey) }
            val direct = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(":settings:fragment_args_key", componentKey)
                putExtra(":settings:show_fragment_args", args)
            }
            reactContext.startActivity(direct)
            promise.resolve(true)
        } catch (_: Exception) {
            try {
                reactContext.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                promise.resolve(true)
            } catch (error: Exception) {
                promise.reject("REELS_TEST_SETTINGS", error)
            }
        }
    }

    @ReactMethod
    fun setChallengeTimeZone(timeZoneId: String) {
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("accountTimeZone", timeZoneId).apply()
    }

    @ReactMethod
    fun clearAccountData(uid: String, promise: Promise) {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                val prefs = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
                if (prefs.getString("uid", null) == uid) {
                    check(prefs.edit().clear().commit()) { "Could not clear monitoring settings" }
                    reactContext.stopService(Intent(reactContext, UsageMonitorService::class.java))
                }
                ChallengeStore.clearAccount(reactContext, uid)
                promise.resolve(true)
            } catch (e: Exception) { promise.reject("CLEAR_ERROR", e.message) }
        }
    }

    @ReactMethod
    fun startMonitoring(
        apps: ReadableArray,
        challengeWindowSeconds: Double,
        dailyLimit: Double,
        uid: String?,
        appLimitsJson: String?
    ) {
        if (uid.isNullOrBlank()) return
        val appList = Array(apps.size()) { apps.getString(it) }
        if (appList.isEmpty()) {
            stopMonitoring()
            return
        }
        val intent = Intent(reactContext, UsageMonitorService::class.java).apply {
            putExtra("apps", appList)
            putExtra("challengeWindowSeconds", challengeWindowSeconds)
            putExtra("dailyLimit", dailyLimit)
            putExtra("uid", uid)
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
        reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putStringSet("apps", emptySet()).apply()
        val intent = Intent(reactContext, UsageMonitorService::class.java)
        reactContext.stopService(intent)
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = android.net.Uri.parse("package:${reactContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
        } catch (_: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(fallback)
            } catch (_: Exception) {}
        }
    }

    @ReactMethod
    fun openAutostartSettings(promise: Promise) {
        val targets = listOf(
            android.content.ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            android.content.ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")
        )
        for (target in targets) {
            try {
                val intent = Intent().apply {
                    component = target
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactContext.startActivity(intent)
                promise.resolve(true)
                return
            } catch (_: Exception) {}
        }
        promise.resolve(false)
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
            val prefs = reactContext.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
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
                val candidates = UsageMonitorService.packagesForApp(name) + listOfNotNull(byLabel[name])
                for (pkg in candidates) {
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
                        break
                    } catch (_: Exception) {}
                }
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
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    private fun foregroundTimesFor(startMs: Long, endMs: Long): Map<String, Long> {
        val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        val cutoff = minOf(endMs, System.currentTimeMillis())
        val eventsQuery = usm?.queryEvents(maxOf(0L, startMs - 86_400_000L), cutoff) ?: return emptyMap()
        val timeline = UsageTimeline(startMs, cutoff)
        val event = android.app.usage.UsageEvents.Event()
        while (eventsQuery.hasNextEvent()) {
            eventsQuery.getNextEvent(event)
            timeline.onEvent(event.packageName, event.eventType, event.timeStamp)
        }
        return timeline.totals()
    }

    @ReactMethod
    fun getUsageForRange(startMs: Double, endMs: Double, promise: Promise) {
        try {
            val foregroundTimes = foregroundTimesFor(startMs.toLong(), endMs.toLong())
            val pm = reactContext.packageManager
            val merged = mutableMapOf<String, Long>()
            for ((pkg, timeMs) in foregroundTimes) {
                if (timeMs <= 0L) continue
                val friendlyName = UsageMonitorService.appNameForPackage(pkg) ?: try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                } catch (_: Exception) { continue }
                merged[friendlyName] = (merged[friendlyName] ?: 0L) + timeMs
            }

            val result = Arguments.createArray()
            merged.entries
                .sortedByDescending { it.value }
                .forEach { (name, timeMs) ->
                    val map = Arguments.createMap()
                    map.putString("app", name)
                    map.putDouble("minutes", timeMs / 60_000.0)
                    result.pushMap(map)
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
            val nonAppPackages = setOf("android", "com.android.systemui", launcherPackage)

            val merged = mutableMapOf<String, Long>()
            for ((pkg, timeMs) in foregroundTimes) {
                if (timeMs <= 0L || pkg in nonAppPackages) continue
                if (pm.getLaunchIntentForPackage(pkg) == null) continue
                val friendlyName = UsageMonitorService.appNameForPackage(pkg) ?: try {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                } catch (_: Exception) { continue }
                merged[friendlyName] = (merged[friendlyName] ?: 0L) + timeMs
            }

            val result = Arguments.createArray()
            merged.entries
                .sortedByDescending { it.value }
                .forEach { (name, timeMs) ->
                    val map = Arguments.createMap()
                    map.putString("app", name)
                    map.putDouble("minutes", timeMs / 60_000.0)
                    result.pushMap(map)
                }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_ERROR", e.message)
        }
    }
}
