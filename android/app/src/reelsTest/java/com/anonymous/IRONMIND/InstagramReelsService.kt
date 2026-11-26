package com.anonymous.IRONMIND

import android.Manifest
import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.UUID
import org.json.JSONObject

class InstagramReelsService : AccessibilityService() {
    private enum class Surface { REELS, CHAT, SHARED_REEL, AWAY, UNKNOWN }

    private data class Attempt(
        val uid: String,
        val target: ShortVideoTarget,
        val id: String,
        val timestamp: Long,
        val day: String,
        val challenge: ReelsChallenge
    )

    private val handler = Handler(Looper.getMainLooper())
    private val session = ReelsReminderSession()
    private val monitorPrefs by lazy { getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE) }
    private val settingsChanged = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == null || key in EVENT_FILTER_KEYS) updateEventPackages()
    }
    private var lastTraceAt = -5_000L
    private var feedTarget: ShortVideoTarget? = null
    private var feedWindow = -1
    private var lastFeedConfirmedAt = 0L
    private var lastScrollEventAt = 0L
    private var lastVideoHash: Int? = null
    private var lastSignatureScanAt = 0L
    private var unknownFeedSince: Long? = null
    private var lastKnownSurface = Surface.UNKNOWN
    private var lastKnownAt = 0L
    private var attempt: Attempt? = null

    private val settlePage = Runnable {
        val target = feedTarget ?: return@Runnable
        val now = SystemClock.elapsedRealtime()
        val uid = monitoringAccount(target)
        if (uid == null) {
            reset()
            return@Runnable
        }
        val root = activeAppRoot(target)
        val surface = classifySurface(root, target, now)
        val transientUnknown = surface == Surface.UNKNOWN &&
            root?.packageName?.toString() in target.packageIds &&
            now - lastFeedConfirmedAt <= 2_500L
        if (surface != Surface.REELS && !transientUnknown) {
            updateAttempt(uid, surface, now)
            clearFeed()
        } else {
            val nav = target.navigation()
            val newHash = if (root != null && nav != null) nav.videoIdentityHash(root) else null
            val contentChanged = newHash != null && lastVideoHash != null && newHash != lastVideoHash
            if (newHash != null) lastVideoHash = newHash
            val scroll = session.settleScroll(now, contentChanged)
            val wasInChallenge = attempt != null
            updateAttempt(uid, Surface.REELS, now, scroll.advanced)
            if (!wasInChallenge && scroll.shouldRemind && startIfAllowed(uid, target, now)) {
                session.markReminded()
            }
        }
    }

    private val checkAttempt = object : Runnable {
        override fun run() {
            val target = attempt?.target ?: return
            val now = SystemClock.elapsedRealtime()
            val uid = activeAttemptAccount(target)
            if (uid == null) {
                reset()
                return
            }
            val lockedOrOff = getSystemService(KeyguardManager::class.java).isDeviceLocked ||
                !getSystemService(PowerManager::class.java).isInteractive
            val surface = if (lockedOrOff) Surface.AWAY else classifySurface(activeAppRoot(target), target, now)
            updateAttempt(uid, surface, now)
            if (surface != Surface.REELS && surface != Surface.UNKNOWN) clearFeed()
            if (attempt != null) handler.postDelayed(this, 300L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        ShortVideoTarget.serviceConnected = true
        monitorPrefs.registerOnSharedPreferenceChangeListener(settingsChanged)
        updateEventPackages()
    }

    private fun updateEventPackages() {
        val uid = monitorPrefs.getString("uid", null)
        val apps = monitorPrefs.getStringSet("apps", emptySet()).orEmpty()
        val watched = ShortVideoTarget.entries.filter { it.appName in apps && uid != null && it.hasConsent(monitorPrefs, uid) }
        if (attempt?.target?.let { it !in watched } == true) stopAttempt()
        if (feedTarget?.let { it !in watched } == true) clearFeed()
    }

    private fun activeAppRoot(target: ShortVideoTarget): AccessibilityNodeInfo? {
        val direct = rootInActiveWindow
        val directPkg = direct?.packageName?.toString()
        if (direct != null && directPkg != null && !isSystemOverlay(directPkg)) {
            return direct
        }
        try {
            val appWindows = windows.orEmpty()
                .filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
                .sortedByDescending { it.layer }
            val focused = appWindows.firstOrNull { it.isFocused || it.isActive }?.root
            if (focused != null && focused.packageName?.toString()?.let { !isSystemOverlay(it) } == true) {
                return focused
            }
            val targetWin = appWindows.firstOrNull { win ->
                val p = win.root?.packageName?.toString()
                p != null && p in target.packageIds
            }?.root
            if (targetWin != null) return targetWin
            val top = appWindows.firstOrNull()?.root
            if (top != null && top.packageName?.toString()?.let { !isSystemOverlay(it) } == true) {
                return top
            }
        } catch (_: Exception) {}
        return direct
    }

    private fun isSystemOverlay(pkg: String): Boolean =
        pkg == "com.android.systemui" || pkg.contains("inputmethod") || pkg.contains("keyboard")

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val target = ShortVideoTarget.fromPackage(event.packageName?.toString()) ?: return
        if (attempt?.target?.let { it != target } == true) return
        val uid = monitoringAccount(target)
        if (uid == null) {
            reset()
            return
        }

        val now = SystemClock.elapsedRealtime()
        val root = activeAppRoot(target)
        val surface = classifySurface(root, target, now)
        if (surface != Surface.REELS) {
            updateAttempt(uid, surface, now)
            if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) traceScroll(target, event, false)
            if (surface == Surface.UNKNOWN) {
                if (unknownFeedSince == null) unknownFeedSince = now
                if (now - (unknownFeedSince ?: now) >= 3_000L) clearFeed()
            } else {
                clearFeed()
            }
            return
        }
        unknownFeedSince = null
        lastFeedConfirmedAt = now
        val rootWindowId = root?.windowId ?: event.windowId
        if (feedWindow != rootWindowId || feedTarget != target) {
            clearFeed()
            feedWindow = rootWindowId
            feedTarget = target
            lastFeedConfirmedAt = now
        }
        session.observeFeed(now)

        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            val nav = target.navigation()
            if (nav != null && root != null && now - lastScrollEventAt >= 1_200L && now - lastSignatureScanAt >= 650L) {
                lastSignatureScanAt = now
                val currentHash = nav.videoIdentityHash(root)
                if (currentHash != null) {
                    if (lastVideoHash == null) {
                        lastVideoHash = currentHash
                    } else if (currentHash != lastVideoHash) {
                        lastVideoHash = currentHash
                        val outcome = session.observeContentAdvance(now)
                        val wasInChallenge = attempt != null
                        updateAttempt(uid, surface, now, outcome.advanced)
                        if (!wasInChallenge && outcome.shouldRemind && startIfAllowed(uid, target, now)) {
                            session.markReminded()
                        }
                    }
                }
            }
            return
        }

        val source = event.source
        val deltaX = if (Build.VERSION.SDK_INT >= 28) event.scrollDeltaX else -1
        val deltaY = if (Build.VERSION.SDK_INT >= 28) event.scrollDeltaY else -1
        val vertical = ReelsChallenge.hasVerticalScroll(deltaX, deltaY)
        val height = if (target == ShortVideoTarget.INSTAGRAM) {
            val pager = reelsScrollPager(source)
            traceScroll(target, event, pager != null)
            if (pager == null) return
            Rect().also(pager::getBoundsInScreen).height()
        } else {
            val h = if (source == null) {
                val fallback = if (root != null) Rect().also(root::getBoundsInScreen).height().takeIf { it > 0 } else null
                traceScroll(target, event, fallback != null)
                fallback
            } else {
                val sourcePkg = source.packageName?.toString()
                if (sourcePkg == null || sourcePkg !in target.packageIds) return
                val found = if (root != null) target.navigation()?.pagerHeight(source, root) else null
                traceScroll(target, event, found != null)
                found
            }
            h ?: return
        }
        if (attempt?.challenge?.isConfirmingExit == true && vertical) {
            updateAttempt(uid, surface, now, swipedInFeed = true)
            return
        }
        if (deltaX != -1 && deltaX != 0 && !vertical) return
        val offset = event.scrollY.takeIf { it >= 0 && (event.maxScrollY > 0 || it > 0) }
        val page = event.fromIndex.takeIf { it >= 0 } ?: event.toIndex
        val queued = session.queueScroll(page, if (vertical) deltaY else 0, offset, height)
        if (!queued) {
            if (target.navigation() == null) return
            session.markScrolled()
        }
        lastScrollEventAt = now
        handler.removeCallbacks(settlePage)
        handler.postDelayed(settlePage, 350L)
    }

    private fun reelsScrollPager(source: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (source == null || source.packageName?.toString() != INSTAGRAM) return null
        if (source.viewIdResourceName in PAGER_IDS) return source
        if (source.className?.toString()?.endsWith("RecyclerView") != true) return null
        return source.parent?.takeIf { it.viewIdResourceName in PAGER_IDS }
    }

    private fun classifySurface(root: AccessibilityNodeInfo?, target: ShortVideoTarget, now: Long): Surface {
        val pkg = root?.packageName?.toString()
        if (pkg == null || isSystemOverlay(pkg)) {
            val fallback = UsageMonitorService.reelsForegroundPackage
            if (fallback != null && fallback !in target.packageIds && !isSystemOverlay(fallback)) {
                return Surface.AWAY
            }
            if (attempt?.target == target && fallback != null && fallback in target.packageIds && now - lastFeedConfirmedAt <= 15_000L) {
                return Surface.REELS
            }
            return Surface.UNKNOWN
        }
        if (pkg !in target.packageIds) {
            return Surface.AWAY
        }
        target.navigation()?.let { navigation ->
            return when (navigation.screen(root)) {
                ReelsChallenge.Screen.FEED -> Surface.REELS
                ReelsChallenge.Screen.AWAY -> Surface.AWAY
                ReelsChallenge.Screen.UNKNOWN -> Surface.UNKNOWN
            }
        }
        val surface = run {
            val hasConversation = root.hasVisibleNode(CHAT_IDS)
            val hasPager = root.hasVisibleNode(PAGER_IDS)
            val reelsTabSelected = root.hasSelectedTab(TAB_IDS)
            when {
                hasConversation -> Surface.CHAT
                reelsTabSelected && hasPager -> Surface.REELS
                !reelsTabSelected && root.hasSelectedTab(OTHER_TAB_IDS) -> Surface.AWAY
                hasPager && !reelsTabSelected &&
                    (lastKnownSurface == Surface.CHAT || lastKnownSurface == Surface.SHARED_REEL) &&
                    now - lastKnownAt <= 2_500L -> Surface.SHARED_REEL
                else -> Surface.UNKNOWN
            }
        }
        if (surface != Surface.UNKNOWN) {
            lastKnownSurface = surface
            lastKnownAt = now
        }
        return surface
    }

    private fun ShortVideoTarget.navigation(): ShortVideoNavigation? = when (this) {
        ShortVideoTarget.INSTAGRAM -> null
        ShortVideoTarget.FACEBOOK -> ShortVideoNavigation.facebook
        ShortVideoTarget.TIKTOK -> ShortVideoNavigation.tiktok
        ShortVideoTarget.YOUTUBE -> ShortVideoNavigation.youtube
        ShortVideoTarget.SNAPCHAT -> ShortVideoNavigation.snapchat
    }

    private fun AccessibilityNodeInfo.hasVisibleNode(ids: List<String>): Boolean =
        ids.any { resource -> findAccessibilityNodeInfosByViewId(resource).any { it.isVisibleToUser } }

    private fun AccessibilityNodeInfo.hasSelectedTab(ids: List<String>): Boolean =
        ids.any { resource ->
            findAccessibilityNodeInfosByViewId(resource).any {
                it.isVisibleToUser && (it.isSelected || it.isChecked)
            }
        }

    private fun activeAttemptAccount(target: ShortVideoTarget): String? {
        val prefs = monitorPrefs
        if (target.appName !in prefs.getStringSet("apps", emptySet()).orEmpty()) return null
        if (System.currentTimeMillis() < prefs.getLong("pausedUntil", 0L)) return null
        val uid = prefs.getString("uid", null)?.takeIf { it.isNotBlank() } ?: return null
        return uid.takeIf { target.hasConsent(prefs, it) }
    }

    private fun monitoringAccount(target: ShortVideoTarget): String? {
        if (getSystemService(KeyguardManager::class.java).isDeviceLocked ||
            !getSystemService(PowerManager::class.java).isInteractive
        ) return null
        return activeAttemptAccount(target)
    }

    private fun startIfAllowed(uid: String, target: ShortVideoTarget, now: Long): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return false
        if (manager.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL) return false
        if (ChallengeStore.active(this) != null) return false
        val prefs = getSharedPreferences("ironmind_reels_test", MODE_PRIVATE)
        val day = TrustedClock.dayKey(this)
        val dailyLimit = monitorPrefs.getFloat("limit", 5f).toInt().coerceIn(1, 20)
        if (firedCount(day) >= dailyLimit) return false
        val today = prefs.getString("day", null) == day
        val count = if (today) prefs.getInt("reminders", 0) else 0
        val sentAt = prefs.getLong("sentAt", 0)
        val timestamp = TrustedClock.now(this)
        if (count >= dailyLimit || (sentAt != 0L && timestamp - sentAt < SCROLL_COOLDOWN_MS)) return false
        if (monitoringAccount(target) != uid) return false

        val instagram = target == ShortVideoTarget.INSTAGRAM
        val channel = if (instagram) CHANNEL else SHORT_VIDEO_CHANNEL
        manager.createNotificationChannel(NotificationChannel(
            channel,
            if (instagram) "Instagram Reels challenges" else "Short-video challenges",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 200, 250)
        })
        if ((manager.getNotificationChannel(channel)?.importance ?: 0) < NotificationManager.IMPORTANCE_HIGH) return false
        val index = Math.floorMod(prefs.getInt("nextPrompt", 0), PROMPTS.size)
        val (title, question) = PROMPTS[index]
        val windowMs = (monitorPrefs.getFloat("window", 10f) * 1000f).toLong().coerceIn(3_000L, ReelsChallenge.EXIT_WINDOW_MS)
        val seconds = windowMs / 1000
        val goalText = monitorPrefs.getString("userGoal", null)?.takeIf { it.isNotBlank() }
        val instruction = if (goalText != null) {
            "Leave ${target.feedName} within $seconds seconds · Goal: $goalText"
        } else {
            "Leave ${target.feedName} within $seconds seconds to keep your streak."
        }
        val prompt = title.replace("Instagram", target.appName).let {
            when (target) {
                ShortVideoTarget.TIKTOK -> it.replace("Reels", "TikTok").replace("Reel", "video")
                ShortVideoTarget.YOUTUBE -> it.replace("Reels", "Shorts").replace("Reel", "Short")
                ShortVideoTarget.SNAPCHAT -> it.replace("Reels", "Spotlight").replace("Reel", "Spotlight")
                else -> it
            }
        }
        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(prompt)
            .setContentText(instruction)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$question $instruction"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(longArrayOf(0, 250, 200, 250))
            .setWhen(System.currentTimeMillis() + windowMs)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setTimeoutAfter(windowMs)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
        attempt = Attempt(uid, target, UUID.randomUUID().toString(), timestamp, day, ReelsChallenge(now, windowMs, REENTRY_CONFIRM_MS))
        UsageMonitorService.reelsChallengeInProgress = true
        prefs.edit()
            .putString("day", day)
            .putInt("reminders", count + 1)
            .putLong("sentAt", timestamp)
            .putInt("nextPrompt", (index + 1) % PROMPTS.size)
            .apply()
        handler.post(checkAttempt)
        Log.i(TAG, "${target.appName} scroll challenge started")
        return true
    }

    private fun updateAttempt(uid: String?, surface: Surface, now: Long, swipedInFeed: Boolean = false) {
        val current = attempt ?: return
        if (uid != current.uid) {
            stopAttempt()
            return
        }
        val screen = when (surface) {
            Surface.REELS -> ReelsChallenge.Screen.FEED
            Surface.CHAT, Surface.SHARED_REEL, Surface.AWAY -> ReelsChallenge.Screen.AWAY
            Surface.UNKNOWN -> ReelsChallenge.Screen.UNKNOWN
        }
        val wasConfirming = current.challenge.isConfirmingExit
        val outcome = current.challenge.observe(screen, now, swipedInFeed)
        if (!wasConfirming && current.challenge.isConfirmingExit) {
            getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
        }
        if (outcome == null) return
        stopAttempt()
        if (outcome is ReelsChallenge.Outcome.Scored) {
            recordOutcome(current, outcome)
        } else {
            Log.i(TAG, "Short-video challenge canceled: screen unclear")
        }
    }

    private fun recordOutcome(current: Attempt, outcome: ReelsChallenge.Outcome.Scored) {
        val elapsedSec = outcome.elapsedMs / 1000.0
        val result = JSONObject()
            .put("id", current.id)
            .put("uid", current.uid)
            .put("targetApp", current.target.appName)
            .put("challengeKind", current.target.challengeKind)
            .put("elapsedTime", elapsedSec)
            .put("wasSuccessful", outcome.won)
            .put("timestamp", current.timestamp)
        ChallengeStore.finish(this, result, clearActive = false)
        if (current.day == TrustedClock.dayKey(this)) {
            getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE).edit()
                .putString("date", current.day)
                .putInt("count", firedCount(current.day) + 1)
                .apply()
        }
        postOutcomeNotification(current.target, outcome.won, elapsedSec)
        val reactContext = (applicationContext as? ReactApplication)?.reactHost?.currentReactContext
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("IronmindChallengeResult", null)
        Log.i(TAG, if (outcome.won) "${current.target.appName} challenge won" else "${current.target.appName} challenge missed")
    }

    private fun postOutcomeNotification(target: ShortVideoTarget, won: Boolean, elapsedSec: Double) {
        try {
            val manager = getSystemService(NotificationManager::class.java)
            if (!manager.areNotificationsEnabled()) return
            manager.createNotificationChannel(NotificationChannel(
                RESULT_CHANNEL,
                "Challenge results",
                NotificationManager.IMPORTANCE_DEFAULT
            ))
            val title = if (won) {
                "✓ ${target.appName} challenge won (${String.format(Locale.US, "%.1f", elapsedSec)}s)"
            } else {
                "${target.appName} challenge missed"
            }
            val body = if (won) {
                "Streak extended · XP & coins added."
            } else {
                "Open IRONMIND to check your streak shield."
            }
            val notification = NotificationCompat.Builder(this, RESULT_CHANNEL)
                .setSmallIcon(R.drawable.notification_icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setTimeoutAfter(8_000L)
                .build()
            manager.notify(RESULT_NOTIFICATION_ID, notification)
        } catch (_: Exception) {}
    }

    private fun firedCount(day: String): Int {
        val prefs = getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE)
        return if (prefs.getString("date", null) == day) prefs.getInt("count", 0) else 0
    }

    private fun stopAttempt() {
        if (attempt == null) return
        attempt = null
        UsageMonitorService.reelsChallengeInProgress = false
        handler.removeCallbacks(checkAttempt)
        getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }

    private fun traceScroll(target: ShortVideoTarget, event: AccessibilityEvent, eligible: Boolean) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastTraceAt < 2_000L) return
        lastTraceAt = now
        val id = event.source?.viewIdResourceName?.takeIf { SAFE_ID.matches(it) } ?: "unknown"
        Log.i(TAG, "Scroll app=${target.appName} resource=$id pageAvailable=${event.fromIndex >= 0} eligible=$eligible")
    }

    private fun clearFeed() {
        handler.removeCallbacks(settlePage)
        feedTarget = null
        feedWindow = -1
        lastVideoHash = null
        unknownFeedSince = null
        session.leaveFeed()
    }

    private fun reset() {
        stopAttempt()
        clearFeed()
        lastKnownSurface = Surface.UNKNOWN
    }

    override fun onInterrupt() = reset()

    override fun onDestroy() {
        ShortVideoTarget.serviceConnected = false
        monitorPrefs.unregisterOnSharedPreferenceChangeListener(settingsChanged)
        reset()
        super.onDestroy()
    }

    private companion object {
        const val INSTAGRAM = "com.instagram.android"
        const val CHANNEL = "ironmind_instagram_reels_challenges"
        const val SHORT_VIDEO_CHANNEL = "ironmind_short_video_challenges"
        const val RESULT_CHANNEL = "ironmind_challenge_results"
        val EVENT_FILTER_KEYS = setOf("uid", "apps", ShortVideoTarget.INSTAGRAM_CONSENT_UID, ShortVideoTarget.EXPANDED_CONSENT_UID)
        const val NOTIFICATION_ID = 1004
        const val RESULT_NOTIFICATION_ID = 1005
        const val REENTRY_CONFIRM_MS = 10_000L
        const val SCROLL_COOLDOWN_MS = 300_000L
        const val TAG = "IronmindReels"
        val SAFE_ID = Regex("[a-zA-Z0-9_.]+:id/[a-zA-Z0-9_]{1,100}")
        val TAB_IDS = listOf("clips_tab", "clips_home_tab", "reels_tab").map { "$INSTAGRAM:id/$it" }
        val OTHER_TAB_IDS = listOf("feed_tab", "home_tab", "search_tab", "profile_tab").map { "$INSTAGRAM:id/$it" }
        val PAGER_IDS = listOf(
            "clips_viewer_view_pager",
            "clips_viewer_viewpager",
            "clips_viewer_view_pager_container",
            "clips_viewer_pager",
            "clips_viewer_recycler_view",
            "reels_view_pager"
        ).map { "$INSTAGRAM:id/$it" }
        val CHAT_IDS = listOf(
            "direct_inbox", "direct_inbox_recycler_view", "direct_thread",
            "direct_thread_recycler_view", "direct_thread_message_list", "direct_thread_composer"
        ).map { "$INSTAGRAM:id/$it" }
        val PROMPTS = listOf(
            "Did you open Instagram to scroll?" to "Or did you have something else to do?",
            "Still watching Reels?" to "Think about what you came here for.",
            "What did you open Instagram for?" to "Take a second to remember what you meant to do.",
            "Came here to reply?" to "You can get back to that conversation now.",
            "One more Reel?" to "Decide whether this is how you want to spend the next few minutes.",
            "Finished what you came to do?" to "Check in with yourself before the next swipe."
        )
    }
}
