package com.anonymous.IRONMIND

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OverLimitTrackerTest {
    @Test
    fun alertsEveryTimeUserReentersOverLimitApp() {
        val tracker = OverLimitTracker()
        tracker.onForegroundChanged("com.android.launcher")

        assertTrue(tracker.shouldAlertOnForeground("com.instagram.android", "Instagram", 20, 15, "2026-11-27"))
        assertFalse(tracker.shouldAlertOnForeground("com.instagram.android", "Instagram", 20, 15, "2026-11-27"))
        assertFalse(tracker.shouldAlertOnForeground("com.android.systemui", "Instagram", 20, 15, "2026-11-27"))
        assertFalse(tracker.shouldAlertOnForeground("com.instagram.android", "Instagram", 21, 15, "2026-11-27"))

        tracker.onForegroundChanged("com.android.launcher")
        assertTrue(tracker.shouldAlertOnForeground("com.instagram.android", "Instagram", 21, 15, "2026-11-27"))

        tracker.onForegroundChanged("__screen_off__")
        assertTrue(tracker.shouldAlertOnForeground("com.instagram.android", "Instagram", 22, 15, "2026-11-27"))
    }

    @Test
    fun alertsImmediatelyWhenCrossingLimitMidSession() {
        val tracker = OverLimitTracker()
        tracker.onForegroundChanged("com.android.launcher")

        assertFalse(tracker.shouldAlertOnForeground("com.google.android.youtube", "YouTube", 14, 15, "2026-11-27"))
        assertTrue(tracker.shouldAlertOnForeground("com.google.android.youtube", "YouTube", 15, 15, "2026-11-27"))
        assertFalse(tracker.shouldAlertOnForeground("com.google.android.youtube", "YouTube", 16, 15, "2026-11-27"))

        tracker.onForegroundChanged("com.palelastudio.ironmind")
        assertTrue(tracker.shouldAlertOnForeground("com.google.android.youtube", "YouTube", 16, 15, "2026-11-27"))
    }

    @Test
    fun ignoresAppsWithoutLimitAndResetsAcrossDays() {
        val tracker = OverLimitTracker()
        assertFalse(tracker.shouldAlertOnForeground("com.zhiliaoapp.musically", "TikTok", 50, 0, "2026-11-27"))
        assertTrue(tracker.shouldAlertOnForeground("com.zhiliaoapp.musically", "TikTok", 30, 30, "2026-11-27"))
        assertFalse(tracker.shouldAlertOnForeground("com.zhiliaoapp.musically", "TikTok", 31, 30, "2026-11-27"))
        assertTrue(tracker.shouldAlertOnForeground("com.zhiliaoapp.musically", "TikTok", 30, 30, "2026-11-28"))
    }
}
