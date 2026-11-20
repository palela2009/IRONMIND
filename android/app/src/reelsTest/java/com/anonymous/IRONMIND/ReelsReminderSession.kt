package com.anonymous.IRONMIND

import kotlin.math.abs

internal class ReelsReminderSession {
    data class ScrollOutcome(val advanced: Boolean, val shouldRemind: Boolean)

    private var firstSeenAt: Long? = null
    private var previousPage: Int? = null
    private var pendingPage: Int? = null
    private var pendingVerticalDistance = 0L
    private var pendingViewportHeight = 0
    private var pageChanges = 0
    private var reminded = false

    fun observeFeed(now: Long) {
        if (firstSeenAt == null) firstSeenAt = now
    }

    fun leaveFeed() {
        firstSeenAt = null
        previousPage = null
        clearPendingScroll()
        pageChanges = 0
        reminded = false
    }

    fun queueScroll(page: Int, verticalDelta: Int, viewportHeight: Int) {
        if (page >= 0) pendingPage = page
        if (verticalDelta != 0 && viewportHeight > 0) {
            pendingVerticalDistance += verticalDelta
            pendingViewportHeight = viewportHeight
        }
    }

    fun settleScroll(now: Long): ScrollOutcome {
        observeFeed(now)
        val page = pendingPage
        val indexChanged = page != null && previousPage != null && previousPage != page
        if (page != null) previousPage = page
        val movedAcrossPage = pendingViewportHeight > 0 &&
            abs(pendingVerticalDistance) * 2 >= pendingViewportHeight
        clearPendingScroll()

        val advanced = indexChanged || movedAcrossPage
        if (advanced && !reminded) pageChanges++
        val shouldRemind = advanced && !reminded && pageChanges >= 3 &&
            now - checkNotNull(firstSeenAt) >= 15_000L
        return ScrollOutcome(advanced, shouldRemind)
    }

    fun markReminded() {
        reminded = true
    }

    private fun clearPendingScroll() {
        pendingPage = null
        pendingVerticalDistance = 0L
        pendingViewportHeight = 0
    }
}
