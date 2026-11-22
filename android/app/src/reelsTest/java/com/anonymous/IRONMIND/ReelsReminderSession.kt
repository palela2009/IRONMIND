package com.anonymous.IRONMIND

import kotlin.math.abs

internal class ReelsReminderSession {
    data class ScrollOutcome(val advanced: Boolean, val shouldRemind: Boolean)

    private var firstSeenAt: Long? = null
    private var previousPage: Int? = null
    private var previousOffset: Int? = null
    private var pendingPage: Int? = null
    private var pendingOffset: Int? = null
    private var pendingDistance = 0L
    private var pendingViewportHeight = 0
    private var pageChanges = 0
    private var reminded = false

    fun observeFeed(now: Long) {
        if (firstSeenAt == null) firstSeenAt = now
    }

    fun leaveFeed() {
        firstSeenAt = null
        previousPage = null
        previousOffset = null
        clearPendingScroll()
        pageChanges = 0
        reminded = false
    }

    fun queueScroll(page: Int, verticalDelta: Int, offset: Int?, viewportHeight: Int): Boolean {
        if (page < 0 && verticalDelta == 0 && offset == null) return false
        if (page >= 0) pendingPage = page
        if (offset != null) pendingOffset = offset
        pendingDistance += verticalDelta
        if (viewportHeight > 0) pendingViewportHeight = viewportHeight
        return true
    }

    fun settleScroll(now: Long): ScrollOutcome {
        observeFeed(now)
        val page = pendingPage
        val changedPage = page != null && previousPage?.let { it != page } == true
        if (page != null) previousPage = page
        val offset = pendingOffset
        val offsetDistance = if (offset != null) previousOffset?.let { abs(offset.toLong() - it) } ?: 0L else 0L
        if (offset != null) previousOffset = offset
        val movedAcrossPage = pendingViewportHeight > 0 &&
            maxOf(abs(pendingDistance), offsetDistance) >= pendingViewportHeight * .45
        clearPendingScroll()

        val advanced = changedPage || movedAcrossPage
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
        pendingOffset = null
        pendingDistance = 0
        pendingViewportHeight = 0
    }
}
