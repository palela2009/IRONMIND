package com.anonymous.IRONMIND

import android.Manifest
import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
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
import org.json.JSONObject

class InstagramReelsService : AccessibilityService() {
    private enum class Surface { REELS, CHAT, SHARED_REEL, AWAY, UNKNOWN }

    private data class Attempt(
        val uid: String,
        val id: String,
        val timestamp: Long,
        val day: String,
        val challenge: ReelsChallenge
    )

    private val handler = Handler(Looper.getMainLooper())
    private val session = ReelsReminderSession()
    private var pendingPage = -1
    private var previousPage: Int? = null
    private var lastTraceAt = -5_000L
    private var feedWindow = -1
    private var lastKnownSurface = Surface.UNKNOWN
    private var lastKnownAt = 0L
    private var attempt: Attempt? = null

    private val settlePage = Runnable {
        val now = SystemClock.elapsedRealtime()
        val uid = monitoringAccount()
        val root = rootInActiveWindow
        val surface = classifySurface(root, now)
        if (uid == null || surface != Surface.REELS || root?.windowId != feedWindow) {
            updateAttempt(uid, surface, now)
            clearFeed()
        } else {
            val page = pendingPage
            val earlier = previousPage
            previousPage = page
            val wasInChallenge = attempt != null
            updateAttempt(uid, surface, now, earlier != null && earlier != page)
            if (!wasInChallenge && session.observePage(page, now) && startIfAllowed(uid, now)) {
                session.markReminded()
            }
        }
    }

    private val checkAttempt = object : Runnable {
        override fun run() {
            val now = SystemClock.elapsedRealtime()
            val uid = monitoringAccount()
            val surface = classifySurface(rootInActiveWindow, now)
            updateAttempt(uid, surface, now)
            if (surface != Surface.REELS) clearFeed()
            if (attempt != null) handler.postDelayed(this, 300L)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.packageName?.toString() != INSTAGRAM) return
        val uid = monitoringAccount()
        if (uid == null) {
            stopAttempt()
            clearFeed()
            return
        }

        val now = SystemClock.elapsedRealtime()
        val root = rootInActiveWindow
        val surface = classifySurface(root, now)
        if (surface != Surface.REELS) {
            updateAttempt(uid, surface, now)
            if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) traceScroll(event, false)
            clearFeed()
            return
        }
        if (root?.windowId != event.windowId) return
        if (feedWindow != event.windowId) {
            clearFeed()
            feedWindow = event.windowId
        }
        session.observeFeed(now)
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return

        val source = event.source
        val fromPager = source != null && source.packageName?.toString() == INSTAGRAM && source.viewIdResourceName in PAGER_IDS
        traceScroll(event, fromPager)
        if (!fromPager || event.fromIndex < 0) return
        pendingPage = event.fromIndex
        handler.removeCallbacks(settlePage)
        handler.postDelayed(settlePage, 350L)
    }

    private fun classifySurface(root: AccessibilityNodeInfo?, now: Long): Surface {
        val pkg = root?.packageName?.toString() ?: return Surface.UNKNOWN
        val surface = if (pkg == INSTAGRAM) {
            val hasConversation = root.hasVisibleNode(CHAT_IDS)
            val hasPager = root.hasVisibleNode(PAGER_IDS)
            val reelsTabSelected = root.hasSelectedTab(TAB_IDS)
            when {
                hasConversation -> Surface.CHAT
                reelsTabSelected && hasPager -> Surface.REELS
                hasPager && !reelsTabSelected &&
                    (lastKnownSurface == Surface.CHAT || lastKnownSurface == Surface.SHARED_REEL) &&
                    now - lastKnownAt <= 2_500L -> Surface.SHARED_REEL
                !hasPager && root.hasSelectedTab(OTHER_TAB_IDS) -> Surface.AWAY
                else -> Surface.UNKNOWN
            }
        } else if (pkg != "com.android.systemui" && pkg == UsageMonitorService.debugForegroundPackage) {
            Surface.AWAY
        } else {
            Surface.UNKNOWN
        }
        if (surface != Surface.UNKNOWN) {
            lastKnownSurface = surface
            lastKnownAt = now
        }
        return surface
    }

    private fun AccessibilityNodeInfo.hasVisibleNode(ids: List<String>): Boolean =
        ids.any { resource -> findAccessibilityNodeInfosByViewId(resource).any { it.isVisibleToUser } }

    private fun AccessibilityNodeInfo.hasSelectedTab(ids: List<String>): Boolean =
        ids.any { resource ->
            findAccessibilityNodeInfosByViewId(resource).any {
                it.isVisibleToUser && (it.isSelected || it.isChecked)
            }
        }

    private fun monitoringAccount(): String? {
        if (!UsageMonitorService.running || getSystemService(KeyguardManager::class.java).isDeviceLocked ||
            !getSystemService(PowerManager::class.java).isInteractive
        ) return null
        val prefs = getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE)
        if ("Instagram" !in prefs.getStringSet("apps", emptySet()).orEmpty()) return null
        if (System.currentTimeMillis() < prefs.getLong("pausedUntil", 0L)) return null
        return prefs.getString("uid", null)?.takeIf { it.isNotBlank() }
    }

    private fun startIfAllowed(uid: String, now: Long): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return false
        if (manager.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL) return false
        if (ChallengeStore.active(this) != null) return false
        val prefs = getSharedPreferences("ironmind_reels_test", MODE_PRIVATE)
        val day = TrustedClock.dayKey(this)
        val monitorPrefs = getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE)
        if (firedCount(day) >= monitorPrefs.getFloat("limit", 5f).toInt()) return false
        val today = prefs.getString("day", null) == day
        val count = if (today) prefs.getInt("reminders", 0) else 0
        val sentAt = prefs.getLong("sentAt", 0)
        val timestamp = TrustedClock.now(this)
        if (count >= 3 || (sentAt != 0L && timestamp - sentAt < 600_000L)) return false
        if (monitoringAccount() != uid) return false

        manager.createNotificationChannel(NotificationChannel(
            CHANNEL,
            "Instagram Reels challenges",
            NotificationManager.IMPORTANCE_HIGH
        ))
        if ((manager.getNotificationChannel(CHANNEL)?.importance ?: 0) < NotificationManager.IMPORTANCE_HIGH) return false
        val index = Math.floorMod(prefs.getInt("nextPrompt", 0), PROMPTS.size)
        val (title, question) = PROMPTS[index]
        val seconds = ReelsChallenge.EXIT_WINDOW_MS / 1000
        val instruction = "Leave Reels within $seconds seconds to keep your streak."
        val notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(title)
            .setContentText(instruction)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$question $instruction"))
            .setWhen(System.currentTimeMillis() + ReelsChallenge.EXIT_WINDOW_MS)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setTimeoutAfter(ReelsChallenge.EXIT_WINDOW_MS)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
        attempt = Attempt(uid, UUID.randomUUID().toString(), timestamp, day, ReelsChallenge(now))
        UsageMonitorService.reelsChallengeInProgress = true
        prefs.edit()
            .putString("day", day)
            .putInt("reminders", count + 1)
            .putLong("sentAt", timestamp)
            .putInt("nextPrompt", (index + 1) % PROMPTS.size)
            .apply()
        handler.post(checkAttempt)
        Log.i(TAG, "Reels challenge started")
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
            .put("targetApp", "Instagram")
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
        feedWindow = -1
        pendingPage = -1
        previousPage = null
        session.leaveFeed()
    }

    override fun onInterrupt() {
        stopAttempt()
        clearFeed()
        lastKnownSurface = Surface.UNKNOWN
    }

    override fun onDestroy() {
        onInterrupt()
        super.onDestroy()
    }

    private companion object {
        const val INSTAGRAM = "com.instagram.android"
        const val CHANNEL = "ironmind_instagram_reels_challenges"
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
