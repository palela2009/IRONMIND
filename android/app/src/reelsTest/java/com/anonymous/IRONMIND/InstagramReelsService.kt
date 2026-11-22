package com.anonymous.IRONMIND

import android.Manifest
import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID
import kotlin.math.abs
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
    private var pendingPage = -1
    private var previousPage: Int? = null
    private var pendingDelta = 0L
    private var pendingPagerHeight = 0
    private var pendingScrollY: Int? = null
    private var previousScrollY: Int? = null
    private var lastTraceAt = -5_000L
    private var feedTarget: ShortVideoTarget? = null
    private var feedWindow = -1
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
        val root = rootInActiveWindow
        val surface = classifySurface(root, target, now)
        if (surface != Surface.REELS || root?.windowId != feedWindow) {
            updateAttempt(uid, surface, now)
            clearFeed()
        } else {
            val page = pendingPage
            val earlier = previousPage
            if (page >= 0) previousPage = page
            val changedPage = page >= 0 && earlier != null && earlier != page
            val scrollY = pendingScrollY
            val offsetChange = if (scrollY != null) previousScrollY?.let { abs(scrollY.toLong() - it) } ?: 0 else 0
            if (scrollY != null) previousScrollY = scrollY
            val swiped = changedPage || (pendingPagerHeight > 0 &&
                maxOf(abs(pendingDelta), offsetChange) >= pendingPagerHeight * .45)
            clearPendingPage()
            val wasInChallenge = attempt != null
            updateAttempt(uid, surface, now, swiped)
            if (wasInChallenge) return@Runnable
            val shouldRemind = if (target == ShortVideoTarget.INSTAGRAM) session.observePage(page, now)
                else swiped && session.observeSwipe(now)
            if (shouldRemind && startIfAllowed(uid, target, now)) {
                session.markReminded()
            }
        }
    }

    private val checkAttempt = object : Runnable {
        override fun run() {
            val target = attempt?.target ?: return
            val now = SystemClock.elapsedRealtime()
            val uid = monitoringAccount(target)
            if (uid == null) {
                reset()
                return
            }
            val surface = classifySurface(rootInActiveWindow, target, now)
            updateAttempt(uid, surface, now)
            if (surface != Surface.REELS) clearFeed()
            if (attempt != null) handler.postDelayed(this, 300L)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        monitorPrefs.registerOnSharedPreferenceChangeListener(settingsChanged)
        updateEventPackages()
    }

    private fun updateEventPackages() {
        val uid = monitorPrefs.getString("uid", null)
        val apps = monitorPrefs.getStringSet("apps", emptySet()).orEmpty()
        val watched = ShortVideoTarget.entries.filter { it.appName in apps && uid != null && it.hasConsent(monitorPrefs, uid) }
        serviceInfo?.let { info ->
            info.packageNames = watched.map { it.packageId }.ifEmpty { listOf(packageName) }.toTypedArray()
            serviceInfo = info
        }
        if (attempt?.target?.let { it !in watched } == true) stopAttempt()
        if (feedTarget?.let { it !in watched } == true) clearFeed()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val target = ShortVideoTarget.fromPackage(event.packageName?.toString()) ?: return
        if (attempt?.target?.let { it != target } == true) return
        val uid = monitoringAccount(target)
        if (uid == null) {
            reset()
            return
        }

        val now = SystemClock.elapsedRealtime()
        val root = rootInActiveWindow
        val surface = classifySurface(root, target, now)
        if (surface != Surface.REELS) {
            updateAttempt(uid, surface, now)
            if (target == ShortVideoTarget.INSTAGRAM && event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) traceScroll(event, false)
            clearFeed()
            return
        }
        if (root?.windowId != event.windowId) return
        if (feedWindow != event.windowId || feedTarget != target) {
            clearFeed()
            feedWindow = event.windowId
            feedTarget = target
        }
        session.observeFeed(now)
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return

        val source = event.source
        val vertical = Build.VERSION.SDK_INT >= 28 && ReelsChallenge.hasVerticalScroll(event.scrollDeltaX, event.scrollDeltaY)
        if (target == ShortVideoTarget.INSTAGRAM) {
            val fromPager = isPagerScroll(source)
            traceScroll(event, fromPager)
            if (!fromPager) return
            if (attempt?.challenge?.isConfirmingExit == true && vertical) {
                updateAttempt(uid, surface, now, swipedInFeed = true)
                return
            }
            if (event.fromIndex < 0) return
        } else {
            if (source?.packageName?.toString() != target.packageId) return
            val height = target.navigation()?.pagerHeight(source, root) ?: return
            if (Build.VERSION.SDK_INT >= 28 && event.scrollDeltaX != 0 && !vertical) return
            pendingPagerHeight = height
            if (vertical) {
                val delta = event.scrollDeltaY.toLong()
                pendingDelta = if (pendingDelta * delta < 0) delta else pendingDelta + delta
            }
            if (event.maxScrollY > 0 && event.scrollY >= 0) pendingScrollY = event.scrollY
            if (!vertical && pendingScrollY == null && event.fromIndex < 0) return
        }
        if (event.fromIndex >= 0) pendingPage = event.fromIndex
        handler.removeCallbacks(settlePage)
        handler.postDelayed(settlePage, 350L)
    }

    private fun isPagerScroll(source: AccessibilityNodeInfo?): Boolean {
        if (source == null || source.packageName?.toString() != INSTAGRAM) return false
        if (source.viewIdResourceName in PAGER_IDS) return true
        return source.className?.toString()?.endsWith("RecyclerView") == true &&
            source.parent?.viewIdResourceName in PAGER_IDS
    }

    private fun classifySurface(root: AccessibilityNodeInfo?, target: ShortVideoTarget, now: Long): Surface {
        val pkg = root?.packageName?.toString() ?: return Surface.UNKNOWN
        if (pkg != target.packageId) {
            return if (pkg == packageName || ShortVideoTarget.fromPackage(pkg) != null ||
                (pkg != "com.android.systemui" && pkg == UsageMonitorService.reelsForegroundPackage)
            ) Surface.AWAY else Surface.UNKNOWN
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
    }

    private fun AccessibilityNodeInfo.hasVisibleNode(ids: List<String>): Boolean =
        ids.any { resource -> findAccessibilityNodeInfosByViewId(resource).any { it.isVisibleToUser } }

    private fun AccessibilityNodeInfo.hasSelectedTab(ids: List<String>): Boolean =
        ids.any { resource ->
            findAccessibilityNodeInfosByViewId(resource).any {
                it.isVisibleToUser && (it.isSelected || it.isChecked)
            }
        }

    private fun monitoringAccount(target: ShortVideoTarget): String? {
        if (!UsageMonitorService.running || getSystemService(KeyguardManager::class.java).isDeviceLocked ||
            !getSystemService(PowerManager::class.java).isInteractive
        ) return null
        val prefs = monitorPrefs
        if (target.appName !in prefs.getStringSet("apps", emptySet()).orEmpty()) return null
        if (System.currentTimeMillis() < prefs.getLong("pausedUntil", 0L)) return null
        val uid = prefs.getString("uid", null)?.takeIf { it.isNotBlank() } ?: return null
        return uid.takeIf { target.hasConsent(prefs, it) }
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
        if (firedCount(day) >= monitorPrefs.getFloat("limit", 5f).toInt()) return false
        val today = prefs.getString("day", null) == day
        val count = if (today) prefs.getInt("reminders", 0) else 0
        val sentAt = prefs.getLong("sentAt", 0)
        val timestamp = TrustedClock.now(this)
        if (count >= 3 || (sentAt != 0L && timestamp - sentAt < 600_000L)) return false
        if (monitoringAccount(target) != uid) return false

        val instagram = target == ShortVideoTarget.INSTAGRAM
        val channel = if (instagram) CHANNEL else SHORT_VIDEO_CHANNEL
        manager.createNotificationChannel(NotificationChannel(
            channel,
            if (instagram) "Instagram Reels challenges" else "Short-video challenges",
            NotificationManager.IMPORTANCE_HIGH
        ))
        if ((manager.getNotificationChannel(channel)?.importance ?: 0) < NotificationManager.IMPORTANCE_HIGH) return false
        val index = Math.floorMod(prefs.getInt("nextPrompt", 0), PROMPTS.size)
        val (title, question) = PROMPTS[index]
        val seconds = ReelsChallenge.EXIT_WINDOW_MS / 1000
        val instruction = "Leave ${target.feedName} within $seconds seconds to keep your streak."
        val prompt = title.replace("Instagram", target.appName).let {
            when (target) {
                ShortVideoTarget.TIKTOK -> it.replace("Reels", "TikTok").replace("Reel", "video")
                ShortVideoTarget.YOUTUBE -> it.replace("Reels", "Shorts").replace("Reel", "Short")
                else -> it
            }
        }
        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(prompt)
            .setContentText(instruction)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$question $instruction"))
            .setWhen(System.currentTimeMillis() + ReelsChallenge.EXIT_WINDOW_MS)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setTimeoutAfter(ReelsChallenge.EXIT_WINDOW_MS)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
        attempt = Attempt(uid, target, UUID.randomUUID().toString(), timestamp, day, ReelsChallenge(now))
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
            Log.i(TAG, "Reels challenge canceled: screen unclear")
        }
    }

    private fun recordOutcome(current: Attempt, outcome: ReelsChallenge.Outcome.Scored) {
        val result = JSONObject()
            .put("id", current.id)
            .put("uid", current.uid)
            .put("targetApp", current.target.appName)
            .put("challengeKind", current.target.challengeKind)
            .put("elapsedTime", outcome.elapsedMs / 1000.0)
            .put("wasSuccessful", outcome.won)
            .put("timestamp", current.timestamp)
        ChallengeStore.finish(this, result, clearActive = false)
        if (current.day == TrustedClock.dayKey(this)) {
            getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE).edit()
                .putString("date", current.day)
                .putInt("count", firedCount(current.day) + 1)
                .apply()
        }
        val reactContext = (applicationContext as? ReactApplication)?.reactHost?.currentReactContext
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("IronmindChallengeResult", null)
        Log.i(TAG, if (outcome.won) "Reels challenge won" else "Reels challenge missed")
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

    private fun traceScroll(event: AccessibilityEvent, eligible: Boolean) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastTraceAt < 2_000L) return
        lastTraceAt = now
        val id = event.source?.viewIdResourceName?.takeIf { SAFE_ID.matches(it) } ?: "unknown"
        Log.i(TAG, "Scroll resource=$id pageAvailable=${event.fromIndex >= 0} eligible=$eligible")
    }

    private fun clearFeed() {
        handler.removeCallbacks(settlePage)
        feedTarget = null
        feedWindow = -1
        previousPage = null
        previousScrollY = null
        clearPendingPage()
        session.leaveFeed()
    }

    private fun clearPendingPage() {
        pendingPage = -1
        pendingDelta = 0
        pendingPagerHeight = 0
        pendingScrollY = null
    }

    private fun reset() {
        stopAttempt()
        clearFeed()
        lastKnownSurface = Surface.UNKNOWN
    }

    override fun onInterrupt() = reset()

    override fun onDestroy() {
        monitorPrefs.unregisterOnSharedPreferenceChangeListener(settingsChanged)
        reset()
        super.onDestroy()
    }

    private companion object {
        const val INSTAGRAM = "com.instagram.android"
        const val CHANNEL = "ironmind_instagram_reels_challenges"
        const val SHORT_VIDEO_CHANNEL = "ironmind_short_video_challenges"
        val EVENT_FILTER_KEYS = setOf("uid", "apps", ShortVideoTarget.INSTAGRAM_CONSENT_UID, ShortVideoTarget.EXPANDED_CONSENT_UID)
        const val NOTIFICATION_ID = 1004
        const val TAG = "IronmindReels"
        val SAFE_ID = Regex("com\\.instagram\\.android:id/[a-zA-Z0-9_]{1,100}")
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
