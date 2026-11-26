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
    private var pendingScrollHint = false
    private var pageChanges = 0
    private var lastAdvanceAt = 0L
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
        lastAdvanceAt = 0L
        reminded = false
    }

    fun queueScroll(page: Int, verticalDelta: Int, offset: Int?, viewportHeight: Int): Boolean {
        if (page < 0 && verticalDelta == 0 && offset == null) return false
        if (page >= 0) pendingPage = page
        if (offset != null) pendingOffset = offset
        pendingDistance += verticalDelta
        if (viewportHeight > 0) pendingViewportHeight = viewportHeight
        pendingScrollHint = true
        return true
    }

    fun markScrolled() {
        pendingScrollHint = true
    }

    fun settleScroll(now: Long, contentChanged: Boolean = false): ScrollOutcome {
        observeFeed(now)
        val page = pendingPage
        val changedPage = page != null && previousPage?.let { it != page } == true
        if (page != null) previousPage = page
        val offset = pendingOffset
        val offsetDistance = if (offset != null) previousOffset?.let { abs(offset.toLong() - it) } ?: 0L else 0L
        if (offset != null) previousOffset = offset
        val movedAcrossPage = pendingViewportHeight > 0 &&
            maxOf(abs(pendingDistance), offsetDistance) >= pendingViewportHeight * .45
        val scrolledNewItem = pendingScrollHint && contentChanged
        clearPendingScroll()

        val advanced = changedPage || movedAcrossPage || scrolledNewItem
        if (advanced && !reminded) {
            pageChanges++
            lastAdvanceAt = now
        }
        val shouldRemind = advanced && !reminded && pageChanges >= 3 &&
            now - checkNotNull(firstSeenAt) >= 15_000L
        return ScrollOutcome(advanced, shouldRemind)
    }

    fun observeContentAdvance(now: Long): ScrollOutcome {
        observeFeed(now)
        if (reminded || (lastAdvanceAt != 0L && now - lastAdvanceAt < 1_500L)) {
            return ScrollOutcome(advanced = false, shouldRemind = false)
        }
        pageChanges++
        lastAdvanceAt = now
        val shouldRemind = pageChanges >= 3 && now - checkNotNull(firstSeenAt) >= 15_000L
        return ScrollOutcome(advanced = true, shouldRemind = shouldRemind)
    }

    fun markReminded() {
        reminded = true
    }

    private fun clearPendingScroll() {
        pendingPage = null
        pendingOffset = null
        pendingDistance = 0
        pendingViewportHeight = 0
        pendingScrollHint = false
    }
}
