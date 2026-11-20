package com.anonymous.IRONMIND

import com.anonymous.IRONMIND.ReelsChallenge.Outcome
import com.anonymous.IRONMIND.ReelsChallenge.Screen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReelsChallengeTest {
    @Test
    fun exitTimeExcludesTheTwentySecondConfirmation() {
        val challenge = ReelsChallenge(1_000)
        assertNull(challenge.observe(Screen.AWAY, 5_280))
        assertTrue(challenge.isConfirmingExit)
        assertNull(challenge.observe(Screen.AWAY, 25_279))
        assertEquals(Outcome.Scored(true, 4_280), challenge.observe(Screen.AWAY, 25_280))
    }

    @Test
    fun confirmedSwipingAfterAShortExitMissesTheSameChallenge() {
        val challenge = ReelsChallenge(0)
        assertNull(challenge.observe(Screen.AWAY, 4_000))
        assertNull(challenge.observe(Screen.FEED, 5_000))
        assertEquals(Outcome.Scored(false, 6_000), challenge.observe(Screen.FEED, 6_000, swipedInFeed = true))
    }

    @Test
    fun firstVerticalPagerScrollAfterExitFailsWithoutASecondPageIndex() {
        val challenge = ReelsChallenge(0)
        challenge.observe(Screen.AWAY, 4_000)
        assertFalse(ReelsChallenge.hasVerticalScroll(-1, -1))
        assertFalse(ReelsChallenge.hasVerticalScroll(80, 20))
        assertFalse(ReelsChallenge.hasVerticalScroll(0, 0))
        val scrolled = ReelsChallenge.hasVerticalScroll(0, -180)
        assertEquals(Outcome.Scored(false, 5_000), challenge.observe(Screen.FEED, 5_000, scrolled))
    }

    @Test
    fun remainingInTheConfirmedFeedAtTheEndOfTheCheckRecordsAFailure() {
        val challenge = ReelsChallenge(0)
        challenge.observe(Screen.AWAY, 4_000)
        assertNull(challenge.observe(Screen.FEED, 23_999))
        assertEquals(Outcome.Scored(false, 24_000), challenge.observe(Screen.FEED, 24_000))
    }

    @Test
    fun firstFeedObservationAfterTheCheckCannotProveAnEarlyReturn() {
        val challenge = ReelsChallenge(0)
        challenge.observe(Screen.AWAY, 4_000)
        assertNull(challenge.observe(Screen.AWAY, 23_999))
        assertEquals(Outcome.Canceled, challenge.observe(Screen.FEED, 24_001, swipedInFeed = true))
    }

    @Test
    fun aBriefFeedVisitWithoutSwipingDoesNotCountAsReturningToScroll() {
        val challenge = ReelsChallenge(0)
        challenge.observe(Screen.AWAY, 3_000)
        assertNull(challenge.observe(Screen.FEED, 4_000))
        assertNull(challenge.observe(Screen.AWAY, 5_000))
        assertEquals(Outcome.Scored(true, 3_000), challenge.observe(Screen.AWAY, 23_000))
    }

    @Test
    fun stayingInTheFeedPastTheCountdownIsAMiss() {
        val challenge = ReelsChallenge(1_000)
        assertNull(challenge.observe(Screen.FEED, 15_999))
        assertEquals(Outcome.Scored(false, 15_000), challenge.observe(Screen.FEED, 16_000))
    }

    @Test
    fun anUnclearScreenAtTheDeadlineCancelsWithoutScoring() {
        val challenge = ReelsChallenge(0)
        assertNull(challenge.observe(Screen.UNKNOWN, 14_999))
        assertEquals(Outcome.Canceled, challenge.observe(Screen.UNKNOWN, 15_000))
    }

    @Test
    fun prolongedUncertaintyDuringExitConfirmationCancels() {
        val challenge = ReelsChallenge(0)
        challenge.observe(Screen.AWAY, 3_000)
        assertNull(challenge.observe(Screen.UNKNOWN, 5_000))
        assertEquals(Outcome.Canceled, challenge.observe(Screen.UNKNOWN, 7_500))
    }

    @Test
    fun uncertainLateExitDoesNotBecomeWinOrLoss() {
        val challenge = ReelsChallenge(0)
        assertEquals(Outcome.Canceled, challenge.observe(Screen.AWAY, 15_001))
    }
}
