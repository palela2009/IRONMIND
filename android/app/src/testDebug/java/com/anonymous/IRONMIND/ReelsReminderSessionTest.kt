package com.anonymous.IRONMIND

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReelsReminderSessionTest {
    @Test
    fun waitsForSeveralDistinctPagesAndEnoughTime() {
        val session = ReelsReminderSession()
        session.observeFeed(1_000)
        assertFalse(session.scrollToPage(0, 2_000))
        assertFalse(session.scrollToPage(1, 4_000))
        assertFalse(session.scrollToPage(1, 6_000))
        assertFalse(session.scrollToPage(2, 8_000))
        assertFalse(session.scrollToPage(3, 10_000))
        assertFalse(session.scrollToPage(3, 16_000))
        assertTrue(session.scrollToPage(4, 16_000))
        session.markReminded()
        assertFalse(session.scrollToPage(5, 30_000))
    }

    @Test
    fun leavingTheFeedDropsTheOldTimeAndSwipeCount() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        session.scrollToPage(0, 1_000)
        session.scrollToPage(1, 2_000)
        session.scrollToPage(2, 3_000)
        session.queueScroll(-1, 600, 1_000)
        session.leaveFeed()
        session.observeFeed(1_200_000)
        assertFalse(session.settleScroll(1_201_000).advanced)
        assertFalse(session.scrollToPage(0, 1_201_000))
        assertFalse(session.scrollToPage(1, 1_220_000))
        assertFalse(session.scrollToPage(2, 1_225_000))
        assertTrue(session.scrollToPage(3, 1_230_000))
    }

    @Test
    fun countsVerticalPageMovementWhenAndroidOmitsThePageIndex() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        session.queueScroll(-1, 270, 1_000)
        session.queueScroll(-1, 290, 1_000)
        val first = session.settleScroll(2_000)
        assertTrue(first.advanced)
        assertFalse(first.shouldRemind)
        session.queueScroll(-1, 850, 1_000)
        assertFalse(session.settleScroll(8_000).shouldRemind)
        session.queueScroll(-1, 800, 1_000)
        assertTrue(session.settleScroll(16_000).shouldRemind)
    }

    @Test
    fun ignoresCanceledMovementAndCountsIndexAndDistanceOnlyOnce() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        assertFalse(session.scrollToPage(0, 1_000))
        session.queueScroll(-1, 650, 1_000)
        session.queueScroll(-1, -510, 1_000)
        assertFalse(session.settleScroll(5_000).advanced)
        session.queueScroll(1, 800, 1_000)
        assertTrue(session.settleScroll(17_000).advanced)
        assertFalse(session.scrollToPage(2, 18_000))
        assertTrue(session.scrollToPage(3, 19_000))
    }

    private fun ReelsReminderSession.scrollToPage(page: Int, now: Long): Boolean {
        queueScroll(page, 0, 0)
        return settleScroll(now).shouldRemind
    }
}
