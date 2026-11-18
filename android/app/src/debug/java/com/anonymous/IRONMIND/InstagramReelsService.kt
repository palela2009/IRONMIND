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
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.app.NotificationCompat

class InstagramReelsService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val session = ReelsReminderSession()
    private var pendingPage = -1
    private var lastTraceAt = -5_000L
    private var feedWindow = -1

    private val settlePage = Runnable {
        val uid = monitoringAccount()
        if (uid == null || !isReelsFeed(rootInActiveWindow)) {
            clearFeed()
        } else if (session.observePage(pendingPage, SystemClock.elapsedRealtime()) && notifyIfAllowed(uid)) {
            session.markReminded()
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.packageName?.toString() != INSTAGRAM || monitoringAccount() == null) {
            clearFeed()
            return
        }

        val root = rootInActiveWindow
        if (!isReelsFeed(root)) {
            if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) traceScroll(event, false)
            clearFeed()
            return
        }
        if (feedWindow != event.windowId) {
            clearFeed()
            feedWindow = event.windowId
        }
        session.observeFeed(SystemClock.elapsedRealtime())
        if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return

        val source = event.source
        val fromPager = source != null && source.packageName?.toString() == INSTAGRAM && source.viewIdResourceName in PAGER_IDS
        traceScroll(event, fromPager)
        if (!fromPager || event.fromIndex < 0) return
        pendingPage = event.fromIndex
        handler.removeCallbacks(settlePage)
        handler.postDelayed(settlePage, 350L)
    }

    private fun isReelsFeed(root: AccessibilityNodeInfo?): Boolean {
        if (root == null || root.packageName?.toString() != INSTAGRAM) return false
        val hasConversation = CHAT_IDS.any { resource ->
            root.findAccessibilityNodeInfosByViewId(resource).any { it.isVisibleToUser }
        }
        if (hasConversation) return false
        val reelsTabSelected = TAB_IDS.any { resource ->
            root.findAccessibilityNodeInfosByViewId(resource).any {
                it.isVisibleToUser && (it.isSelected || it.isChecked)
            }
        }
        return reelsTabSelected && PAGER_IDS.any { resource ->
            root.findAccessibilityNodeInfosByViewId(resource).any { it.isVisibleToUser }
        }
    }

    private fun monitoringAccount(): String? {
        if (!UsageMonitorService.running || getSystemService(KeyguardManager::class.java).isDeviceLocked) return null
        val prefs = getSharedPreferences(UsageMonitorService.PREFS_NAME, MODE_PRIVATE)
        if ("Instagram" !in prefs.getStringSet("apps", emptySet()).orEmpty()) return null
        if (System.currentTimeMillis() < prefs.getLong("pausedUntil", 0L)) return null
        return prefs.getString("uid", null)?.takeIf { it.isNotBlank() }
    }

    private fun notifyIfAllowed(uid: String): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val manager = getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return false
        val prefs = getSharedPreferences("ironmind_reels_test", MODE_PRIVATE)
        val day = TrustedClock.dayKey(this)
        val today = prefs.getString("day", null) == day
        val count = if (today) prefs.getInt("reminders", 0) else 0
        val sentAt = prefs.getLong("sentAt", 0)
        val now = System.currentTimeMillis()
        if (count >= 3 || (sentAt != 0L && now - sentAt < 600_000L)) return false
        if (monitoringAccount() != uid) return false

        manager.createNotificationChannel(NotificationChannel(
            CHANNEL,
            "Instagram Reels reminders",
            NotificationManager.IMPORTANCE_HIGH
        ))
        if (manager.getNotificationChannel(CHANNEL).importance == NotificationManager.IMPORTANCE_NONE) return false
        val reminder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle("Still watching Reels?")
            .setContentText("Take a break whenever you're ready.")
            .setAutoCancel(true)
            .setTimeoutAfter(60_000L)
            .build()
        manager.notify(1004, reminder)
        prefs.edit().putString("day", day).putInt("reminders", count + 1).putLong("sentAt", now).apply()
        Log.i(TAG, "Reels reminder sent")
        return true
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
        session.leaveFeed()
    }

    override fun onInterrupt() = clearFeed()

    override fun onDestroy() {
        clearFeed()
        super.onDestroy()
    }

    private companion object {
        const val INSTAGRAM = "com.instagram.android"
        const val CHANNEL = "ironmind_instagram_reels_test"
        const val TAG = "IronmindReels"
        val SAFE_ID = Regex("com\\.instagram\\.android:id/[a-zA-Z0-9_]{1,100}")
        val TAB_IDS = listOf("clips_tab", "clips_home_tab", "reels_tab").map { "$INSTAGRAM:id/$it" }
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
    }
}
