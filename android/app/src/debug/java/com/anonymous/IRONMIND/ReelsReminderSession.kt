package com.anonymous.IRONMIND

internal class ReelsReminderSession {
    private var firstSeenAt: Long? = null
    private var previousPage: Int? = null
    private var pageChanges = 0
    private var reminded = false

    fun observeFeed(now: Long) {
        if (firstSeenAt == null) firstSeenAt = now
    }

    fun leaveFeed() {
        firstSeenAt = null
        previousPage = null
        pageChanges = 0
        reminded = false
    }

    fun observePage(page: Int, now: Long): Boolean {
        if (page < 0 || reminded) return false
        observeFeed(now)
        val lastPage = previousPage
        previousPage = page
        if (lastPage == null || lastPage == page) return false
        pageChanges++
        return pageChanges >= 3 && now - checkNotNull(firstSeenAt) >= 15_000L
    }

    fun markReminded() {
        reminded = true
    }
}
