package com.anonymous.IRONMIND

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReelsReminderSessionTest {
    @Test
    fun waitsForSeveralDistinctPagesAndEnoughTime() {
        val session = ReelsReminderSession()
        session.observeFeed(1_000)
        assertFalse(session.observePage(0, 2_000))
        assertFalse(session.observePage(1, 4_000))
        assertFalse(session.observePage(1, 6_000))
        assertFalse(session.observePage(2, 8_000))
        assertFalse(session.observePage(3, 10_000))
        assertFalse(session.observePage(3, 16_000))
        assertTrue(session.observePage(4, 16_000))
        session.markReminded()
        assertFalse(session.observePage(5, 30_000))
    }

    @Test
    fun leavingTheFeedDropsTheOldTimeAndSwipeCount() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        session.observePage(0, 1_000)
        session.observePage(1, 2_000)
        session.observePage(2, 3_000)
        session.leaveFeed()
        session.observeFeed(1_200_000)
        assertFalse(session.observePage(0, 1_201_000))
        assertFalse(session.observePage(1, 1_220_000))
        assertFalse(session.observePage(2, 1_225_000))
        assertTrue(session.observePage(3, 1_230_000))
    }

    @Test
    fun fullSwipesWithoutPageIndicesTriggerAfterFifteenSeconds() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        assertFalse(session.queueScroll(-1, 0, null, 1000))
        assertFalse(session.swipe(3_000, 200).advanced)
        session.queueScroll(-1, 220, null, 1000)
        session.queueScroll(-1, 250, null, 1000)
        val first = session.settleScroll(4_000)
        assertTrue(first.advanced)
        assertFalse(first.shouldRemind)
        assertFalse(session.swipe(8_000, -470).shouldRemind)
        assertTrue(session.swipe(15_000, 470).shouldRemind)
        session.markReminded()
        assertFalse(session.swipe(18_000, 470).shouldRemind)
    }

    @Test
    fun matchingIndexAndMovementCountAsOneSwipeAndResetOnExit() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        session.observePage(0, 1_000)
        assertFalse(session.swipe(16_000, 470, page = 1).shouldRemind)
        assertFalse(session.swipe(18_000, 470, page = 2).shouldRemind)
        session.leaveFeed()

        session.observeFeed(20_000)
        assertFalse(session.swipe(36_000, 470).shouldRemind)
        assertFalse(session.swipe(38_000, 470).shouldRemind)
        assertTrue(session.swipe(40_000, 470).shouldRemind)
    }

    private fun ReelsReminderSession.observePage(page: Int, now: Long): Boolean =
        swipe(now, 0, page).shouldRemind

    private fun ReelsReminderSession.swipe(now: Long, delta: Int, page: Int = -1): ReelsReminderSession.ScrollOutcome {
        assertTrue(queueScroll(page, delta, null, 1000))
        return settleScroll(now)
    }
}
