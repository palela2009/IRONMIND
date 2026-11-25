package com.anonymous.IRONMIND

import kotlin.math.abs

internal class ReelsChallenge(
    private val startedAt: Long,
    private val exitWindowMs: Long = EXIT_WINDOW_MS
) {
    enum class Screen { FEED, AWAY, UNKNOWN }

    sealed interface Outcome {
        data class Scored(val won: Boolean, val elapsedMs: Long) : Outcome
        data object Canceled : Outcome
    }

    private var leftAt: Long? = null
    private var uncertainSince: Long? = null
    private var lastClearScreen: Screen? = null
    val isConfirmingExit: Boolean get() = leftAt != null

    fun observe(screen: Screen, now: Long, swipedInFeed: Boolean = false): Outcome? {
        val exit = leftAt
        val deadline = if (exit == null) startedAt + exitWindowMs else exit + REENTRY_WINDOW_MS
        val uncertain = uncertainSince
        if (screen == Screen.UNKNOWN) {
            if (uncertain == null) uncertainSince = now
            val graceExpired = uncertain != null && now - uncertain >= UNKNOWN_GRACE_MS
            return if (graceExpired || (now >= deadline && lastClearScreen == null)) {
                Outcome.Canceled
            } else null
        }
        if (uncertain != null && (now - uncertain >= UNKNOWN_GRACE_MS ||
                (now > deadline && screen != lastClearScreen))
        ) return Outcome.Canceled
        uncertainSince = null

        if (exit == null) {
            if (screen == Screen.AWAY) {
                if (now > deadline) return Outcome.Canceled
                leftAt = now
                lastClearScreen = Screen.AWAY
            } else if (now >= deadline) {
                return Outcome.Scored(won = false, elapsedMs = exitWindowMs)
            } else {
                lastClearScreen = Screen.FEED
            }
            return null
        }

        if (now <= deadline && screen == Screen.FEED && swipedInFeed) {
            return Outcome.Scored(won = false, elapsedMs = now - startedAt)
        }
        if (now < deadline) {
            lastClearScreen = screen
            return null
        }
        return when (screen) {
            Screen.AWAY -> Outcome.Scored(won = true, elapsedMs = exit - startedAt)
            Screen.FEED -> if (lastClearScreen == Screen.FEED) {
                Outcome.Scored(won = false, elapsedMs = deadline - startedAt)
            } else Outcome.Canceled
            Screen.UNKNOWN -> Outcome.Canceled
        }
    }

    companion object {
        const val EXIT_WINDOW_MS = 15_000L
        const val REENTRY_WINDOW_MS = 20_000L
        private const val UNKNOWN_GRACE_MS = 2_500L

        fun hasVerticalScroll(deltaX: Int, deltaY: Int): Boolean =
            abs(deltaY.toLong()) > maxOf(abs(deltaX.toLong()), 1L)
    }
}
