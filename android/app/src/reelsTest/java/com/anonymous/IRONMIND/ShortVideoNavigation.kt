package com.anonymous.IRONMIND

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

internal class ShortVideoNavigation private constructor(
    private val feedTabs: Set<String>,
    private val awayTabs: Set<String>,
    private val feedTabIds: Set<String>,
    private val awayPanelIds: Set<String>,
    private val playerIds: Set<String>,
    private val playerClasses: Set<String>,
    private val requiresDedicatedPager: Boolean = false
) {
    fun screen(root: AccessibilityNodeInfo): ReelsChallenge.Screen {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return ReelsChallenge.Screen.UNKNOWN
        val bounds = Rect()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var selectedFeed = false
        var fullScreenPlayer = false
        var dedicatedPlayer = false
        var examined = 0
        while (queue.isNotEmpty() && examined++ < 500) {
            val node = queue.removeFirst()
            if (!node.isVisibleToUser) continue
            val id = node.resourceName()
            if (id in awayPanelIds || (node.isEditable && node.isFocused)) return ReelsChallenge.Screen.AWAY
            node.getBoundsInScreen(bounds)
            val player = isDedicatedPager(node)
            if (isFullScreen(bounds, window)) {
                dedicatedPlayer = dedicatedPlayer || player
                fullScreenPlayer = fullScreenPlayer || player || isScrollableContainer(node)
            }
            val checked = node.isSelected || node.isChecked
            if (inNavigationBand(bounds, window) && (node.isClickable || checked)) {
                val description = node.contentDescription?.toString()?.lowercase(Locale.ROOT).orEmpty()
                val label = description.substringBefore(',').trim()
                val selected = checked || description.endsWith(", selected")
                if (selected && label in awayTabs) return ReelsChallenge.Screen.AWAY
                if (selected && (label in feedTabs || id in feedTabIds)) selectedFeed = true
            }
            for (i in 0 until node.childCount) {
                if (queue.size + examined >= 500) break
                node.getChild(i)?.let(queue::addLast)
            }
        }
        return if (dedicatedPlayer || (!requiresDedicatedPager && selectedFeed && fullScreenPlayer)) {
            ReelsChallenge.Screen.FEED
        } else {
            ReelsChallenge.Screen.UNKNOWN
        }
    }

    fun pagerHeight(source: AccessibilityNodeInfo, root: AccessibilityNodeInfo): Int? {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return null
        var candidate: AccessibilityNodeInfo? = source
        repeat(3) {
            val node = candidate ?: return null
            val bounds = Rect().also(node::getBoundsInScreen)
            if (node.isVisibleToUser && isFullScreen(bounds, window) &&
                (isDedicatedPager(node) || (!requiresDedicatedPager && isScrollableContainer(node)))
            ) return bounds.height()
            candidate = node.parent
        }
        return null
    }

    private fun isDedicatedPager(node: AccessibilityNodeInfo): Boolean =
        node.resourceName() in playerIds || node.className?.toString()?.substringAfterLast('.') in playerClasses

    private fun isScrollableContainer(node: AccessibilityNodeInfo): Boolean {
        if (!node.isScrollable) return false
        val type = node.className?.toString()?.substringAfterLast('.')
        return type in scrollContainers
    }

    private fun AccessibilityNodeInfo.resourceName(): String? = viewIdResourceName?.substringAfter(":id/")

    private fun inNavigationBand(bounds: Rect, window: Rect): Boolean = !bounds.isEmpty &&
        bounds.height() <= window.height() * .14 &&
        (bounds.centerY() <= window.top + window.height() * .18 || bounds.centerY() >= window.bottom - window.height() * .16)

    private fun isFullScreen(bounds: Rect, window: Rect): Boolean =
        bounds.height() >= window.height() * .60 && bounds.width() >= window.width() * .75

    companion object {
        private val scrollContainers = setOf("ViewPager", "ViewPager2", "VerticalViewPager", "RecyclerView", "ListView", "ViewGroup")

        val facebook = ShortVideoNavigation(
            feedTabs = setOf("reels", "reels tab", "რილსები"),
            awayTabs = setOf("home", "friends", "groups", "marketplace", "notifications", "menu", "search", "messages", "profile"),
            feedTabIds = setOf("reels_tab", "reels_home_tab"),
            awayPanelIds = setOf("message_thread", "thread_view", "conversation_view", "comment_composer", "comments_sheet", "search_box", "profile_header"),
            playerIds = setOf("reels_view_pager", "reels_viewpager", "reels_pager", "reels_player_pager", "fullscreen_reels_pager"),
            playerClasses = setOf("ReelsViewPager", "ReelsPager")
        )

        val tiktok = ShortVideoNavigation(
            feedTabs = setOf("for you", "following", "for you feed", "following feed", "შენთვის"),
            awayTabs = setOf("inbox", "profile", "friends", "shop", "search", "messages", "live"),
            feedTabIds = setOf("for_you_tab", "following_tab", "recommend_tab"),
            awayPanelIds = setOf("chat_room", "chat_container", "message_list", "message_composer", "inbox_container", "comment_panel", "comment_list", "search_box", "profile_header"),
            playerIds = setOf("for_you_pager", "following_pager", "main_feed_pager", "feed_view_pager", "feed_viewpager", "recommend_feed_pager"),
            playerClasses = setOf("MainFeedViewPager", "ForYouViewPager", "FeedSwipeViewPager")
        )

        val youtube = ShortVideoNavigation(
            feedTabs = setOf("shorts"),
            awayTabs = setOf("home", "subscriptions", "you", "library", "search"),
            feedTabIds = setOf("button_shorts_container"),
            awayPanelIds = setOf("comment_dialog_root", "engagement_panel_content", "shorts_creation_player_view", "watch_while_time_bar_view"),
            playerIds = setOf("reel_recycler", "reel_watch_pager_view_pager"),
            playerClasses = emptySet(),
            requiresDedicatedPager = true
        )
    }
}
