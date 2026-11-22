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
    fun confirmedSwipesWorkWithoutPageIndicesAndResetOnExit() {
        val session = ReelsReminderSession()
        session.observeFeed(0)
        assertFalse(session.observeSwipe(3_000))
        assertFalse(session.observeSwipe(7_000))
        session.leaveFeed()

        session.observeFeed(20_000)
        assertFalse(session.observeSwipe(36_000))
        assertFalse(session.observeSwipe(38_000))
        assertTrue(session.observeSwipe(40_000))
        session.markReminded()
        assertFalse(session.observeSwipe(65_000))
    }
}
