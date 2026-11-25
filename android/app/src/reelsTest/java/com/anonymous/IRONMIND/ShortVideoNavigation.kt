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
    private val feedMarkerIds: Set<String> = emptySet(),
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
        var feedMarkerVisible = false
        var examined = 0
        while (queue.isNotEmpty() && examined++ < 500) {
            val node = queue.removeFirst()
            if (!node.isVisibleToUser) continue
            node.getBoundsInScreen(bounds)
            val id = node.resourceName()
            val hasRealBounds = !bounds.isEmpty && bounds.height() >= 24 && bounds.width() >= window.width() * .25
            if ((id in awayPanelIds && hasRealBounds) || (node.isEditable && node.isFocused && !bounds.isEmpty)) {
                return ReelsChallenge.Screen.AWAY
            }
            if (id in feedMarkerIds && !bounds.isEmpty && bounds.height() > 0 && bounds.width() > 0) {
                feedMarkerVisible = true
            }
            val player = isDedicatedPager(node)
            if (isFullScreen(bounds, window)) {
                dedicatedPlayer = dedicatedPlayer || player
                fullScreenPlayer = fullScreenPlayer || player || isScrollableContainer(node)
            }
            val checked = node.isSelected || node.isChecked
            if (inNavigationBand(bounds, window) && (node.isClickable || checked)) {
                val description = node.tabLabel()
                val label = description.substringBefore(',').trim()
                val selected = checked || description.endsWith(", selected") || description.contains("არჩეული")
                if (selected && label in awayTabs) return ReelsChallenge.Screen.AWAY
                if (selected && (label in feedTabs || id in feedTabIds)) selectedFeed = true
            }
            for (i in 0 until node.childCount) {
                if (queue.size + examined >= 500) break
                node.getChild(i)?.let(queue::addLast)
            }
        }
        return if (
            dedicatedPlayer ||
            (feedMarkerVisible && fullScreenPlayer) ||
            (!requiresDedicatedPager && selectedFeed && fullScreenPlayer)
        ) {
            ReelsChallenge.Screen.FEED
        } else {
            ReelsChallenge.Screen.UNKNOWN
        }
    }

    fun pagerHeight(source: AccessibilityNodeInfo, root: AccessibilityNodeInfo): Int? {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return null
        var candidate: AccessibilityNodeInfo? = source
        repeat(5) {
            val node = candidate ?: return null
            val bounds = Rect().also(node::getBoundsInScreen)
            if (node.isVisibleToUser && isFullScreen(bounds, window) &&
                (isDedicatedPager(node) || (!requiresDedicatedPager && (isScrollableContainer(node) || node.isScrollable)))
            ) return bounds.height()
            candidate = node.parent
        }
        return null
    }

    private fun AccessibilityNodeInfo.tabLabel(): String {
        val desc = contentDescription?.toString()?.trim().orEmpty()
        if (desc.isNotEmpty()) return desc.lowercase(Locale.ROOT)
        val direct = text?.toString()?.trim().orEmpty()
        if (direct.isNotEmpty()) return direct.lowercase(Locale.ROOT)
        for (i in 0 until minOf(childCount, 4)) {
            val child = getChild(i) ?: continue
            val childText = child.contentDescription?.toString()?.trim().takeIf { !it.isNullOrEmpty() }
                ?: child.text?.toString()?.trim().takeIf { !it.isNullOrEmpty() }
            if (childText != null) return childText.lowercase(Locale.ROOT)
        }
        return ""
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
        bounds.height() <= window.height() * .16 &&
        (bounds.centerY() <= window.top + window.height() * .18 || bounds.centerY() >= window.bottom - window.height() * .18)

    private fun isFullScreen(bounds: Rect, window: Rect): Boolean =
        bounds.height() >= window.height() * .62 && bounds.width() >= window.width() * .80

    companion object {
        private val scrollContainers = setOf("ViewPager", "ViewPager2", "VerticalViewPager", "RecyclerView", "ListView", "NestedScrollView")

        val facebook = ShortVideoNavigation(
            feedTabs = setOf("reels", "reels tab", "რილსები", "рилс"),
            awayTabs = setOf(
                "home", "friends", "groups", "marketplace", "notifications", "menu", "search", "messages", "profile",
                "მთავარი", "მეგობრები", "ჯგუფები", "შეტყობინებები", "მენიუ", "ძებნა", "პროფილი"
            ),
            feedTabIds = setOf("reels_tab", "reels_home_tab"),
            awayPanelIds = setOf("message_thread", "thread_view", "conversation_view", "comment_composer", "comments_sheet", "search_box", "profile_header"),
            playerIds = setOf("reels_view_pager", "reels_viewpager", "reels_pager", "reels_player_pager", "fullscreen_reels_pager"),
            playerClasses = setOf("ReelsViewPager", "ReelsPager")
        )

        val tiktok = ShortVideoNavigation(
            feedTabs = setOf("for you", "following", "for you feed", "following feed", "შენთვის", "გამოწერილი", "рекомендации"),
            awayTabs = setOf(
                "inbox", "profile", "friends", "shop", "search", "messages", "live",
                "შემოსულები", "პროფილი", "მეგობრები", "მაღაზია", "ძებნა", "შეტყობინებები"
            ),
            feedTabIds = setOf("for_you_tab", "following_tab", "recommend_tab"),
            awayPanelIds = setOf("chat_room", "chat_container", "message_list", "message_composer", "inbox_container", "comment_panel", "comment_list", "search_box", "profile_header"),
            playerIds = setOf("for_you_pager", "following_pager", "main_feed_pager", "feed_view_pager", "feed_viewpager", "recommend_feed_pager"),
            playerClasses = setOf("MainFeedViewPager", "ForYouViewPager", "FeedSwipeViewPager")
        )

        val youtube = ShortVideoNavigation(
            feedTabs = setOf("shorts", "შორტსი", "шортс"),
            awayTabs = setOf(
                "home", "subscriptions", "you", "library", "search",
                "მთავარი", "გამოწერები", "თქვენ", "ბიბლიოთეკა", "ძებნა"
            ),
            feedTabIds = setOf("button_shorts_container", "pivot_bar_shorts_tab"),
            awayPanelIds = setOf("comment_dialog_root", "shorts_creation_player_view", "watch_while_time_bar_view"),
            playerIds = setOf(
                "reel_recycler",
                "reel_watch_pager_view_pager",
                "reel_watch_fragment_root",
                "reel_player_page_container",
                "reel_watch_player",
                "reel_watch_player_view",
                "shorts_player_view",
                "reel_player_overlay_container"
            ),
            playerClasses = emptySet(),
            feedMarkerIds = setOf(
                "reel_dyn_like",
                "reel_dyn_dislike",
                "reel_dyn_comment",
                "reel_dyn_share",
                "reel_dyn_remix",
                "reel_progress_bar",
                "shorts_pivot_button",
                "reel_multi_format_link",
                "reel_vod_link",
                "reel_player_header",
                "reel_channel_bar"
            ),
            requiresDedicatedPager = false
        )

        val snapchat = ShortVideoNavigation(
            feedTabs = setOf("spotlight", "spotlight tab", "სპოტლაითი"),
            awayTabs = setOf(
                "map", "snap map", "chat", "chats", "camera", "stories", "discover", "memories", "profile", "friends", "search",
                "რუკა", "ჩატი", "კამერა", "სთორები", "პროფილი", "მეგობრები", "ძებნა"
            ),
            feedTabIds = setOf("ngs_spotlight_icon_container", "hova_nav_spotlight_icon", "spotlight_tab", "spotlight_feed_tab"),
            awayPanelIds = setOf(
                "chat_input_text_field", "chat_message_list", "conversation_view", "camera_capture_button",
                "camera_page", "memories_grid", "stories_list", "map_view", "comments_tray", "comment_input"
            ),
            playerIds = setOf("spotlight_view_pager", "spotlight_pager", "spotlight_feed_recycler_view", "spotlight_recycler_view"),
            playerClasses = setOf("SpotlightViewPager")
        )
    }
}
