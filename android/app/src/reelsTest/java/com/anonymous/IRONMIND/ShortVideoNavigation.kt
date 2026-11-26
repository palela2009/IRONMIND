package com.anonymous.IRONMIND

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

internal class ShortVideoNavigation private constructor(
    private val feedTabs: Set<String>,
    private val awayTabs: Set<String>,
    private val feedTabIds: Set<String>,
    private val awayPanelIds: Set<String>,
    private val awayLabelHints: Set<String>,
    private val playerIds: Set<String>,
    private val playerClasses: Set<String>,
    private val feedMarkerIds: Set<String> = emptySet(),
    private val feedLabelHints: Set<String> = emptySet(),
    private val rightRailHints: Set<String> = emptySet(),
    private val topFeedLabels: Set<String> = emptySet(),
    private val selectedFeedTabIsSufficient: Boolean = false
) {
    fun screen(root: AccessibilityNodeInfo): ReelsChallenge.Screen {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return ReelsChallenge.Screen.UNKNOWN
        val portrait = window.height() >= window.width()
        val bounds = Rect()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var selectedFeed = false
        var fullScreenPlayer = false
        var dedicatedPlayer = false
        var feedMarkerVisible = false
        var topFeedHeaderVisible = false
        val rightRailMatched = mutableSetOf<String>()
        var examined = 0

        while (queue.isNotEmpty() && examined++ < 900) {
            val node = queue.removeFirst()
            if (!node.isVisibleToUser) continue
            node.getBoundsInScreen(bounds)
            val id = node.resourceName()
            val hasRealBounds = !bounds.isEmpty && bounds.height() >= 24 && bounds.width() >= window.width() * .25
            if ((id in awayPanelIds && hasRealBounds) || (node.isEditable && node.isFocused && !bounds.isEmpty)) {
                return ReelsChallenge.Screen.AWAY
            }

            val rawDesc = node.contentDescription?.toString()?.trim().orEmpty()
            val rawText = node.text?.toString()?.trim().orEmpty()
            val descLower = rawDesc.lowercase(Locale.ROOT)
            val textLower = rawText.lowercase(Locale.ROOT)
            val shortLabel = descLower.length <= 48 && textLower.length <= 40

            if (!bounds.isEmpty && shortLabel && awayLabelHints.isNotEmpty()) {
                if (awayLabelHints.any { hint -> matchesPhrase(descLower, hint) || matchesPhrase(textLower, hint) }) {
                    return ReelsChallenge.Screen.AWAY
                }
            }

            if (id in feedMarkerIds && !bounds.isEmpty && bounds.height() > 0 && bounds.width() > 0) {
                feedMarkerVisible = true
            }
            if (!bounds.isEmpty && shortLabel && feedLabelHints.isNotEmpty()) {
                if (feedLabelHints.any { hint -> matchesPhrase(descLower, hint) || matchesPhrase(textLower, hint) }) {
                    feedMarkerVisible = true
                }
            }
            if (!bounds.isEmpty && shortLabel && topFeedLabels.isNotEmpty() && bounds.centerY() <= window.top + window.height() * .16) {
                if (descLower in topFeedLabels || textLower in topFeedLabels) {
                    topFeedHeaderVisible = true
                }
            }
            if (!bounds.isEmpty && shortLabel && rightRailHints.isNotEmpty() &&
                bounds.centerX() >= window.left + window.width() * .70 &&
                bounds.centerY() >= window.top + window.height() * .25 &&
                bounds.centerY() <= window.bottom - window.height() * .10
            ) {
                for (hint in rightRailHints) {
                    if (matchesPhrase(descLower, hint) || matchesPhrase(textLower, hint)) {
                        rightRailMatched.add(hint)
                    }
                }
            }

            val player = isDedicatedPager(node)
            if (isFullScreen(bounds, window)) {
                dedicatedPlayer = dedicatedPlayer || player
                fullScreenPlayer = fullScreenPlayer || player || isScrollableContainer(node) || node.isScrollable
            }

            val checked = node.isSelected || node.isChecked || (node.parent?.isSelected == true && node.childCount == 0)
            if (inNavigationBand(bounds, window) && (node.isClickable || checked)) {
                val description = node.tabLabel()
                val label = description.substringBefore(',').trim()
                val selected = checked || description.endsWith(", selected") || description.contains("არჩეული")
                if (selected && label in awayTabs) return ReelsChallenge.Screen.AWAY
                if (selected && (label in feedTabs || id in feedTabIds)) selectedFeed = true
            }

            for (i in 0 until node.childCount) {
                if (queue.size + examined >= 900) break
                node.getChild(i)?.let(queue::addLast)
            }
        }

        val strongRail = portrait && rightRailMatched.size >= 3
        val confirmedFeed = dedicatedPlayer ||
            (portrait && selectedFeed && (fullScreenPlayer || selectedFeedTabIsSufficient)) ||
            (portrait && feedMarkerVisible && (fullScreenPlayer || strongRail)) ||
            (portrait && topFeedHeaderVisible && (fullScreenPlayer || strongRail)) ||
            strongRail

        return if (confirmedFeed) ReelsChallenge.Screen.FEED else ReelsChallenge.Screen.UNKNOWN
    }

    fun pagerHeight(source: AccessibilityNodeInfo, root: AccessibilityNodeInfo): Int? {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return null
        var candidate: AccessibilityNodeInfo? = source
        repeat(6) {
            val node = candidate ?: return null
            val bounds = Rect().also(node::getBoundsInScreen)
            if (node.isVisibleToUser && isFullScreen(bounds, window) &&
                (isDedicatedPager(node) || isScrollableContainer(node) || node.isScrollable)
            ) return bounds.height()
            candidate = node.parent
        }
        val sourceBounds = Rect().also(source::getBoundsInScreen)
        return if (sourceBounds.isEmpty || sourceBounds.height() >= window.height() * .50) {
            window.height()
        } else {
            null
        }
    }

    fun videoIdentityHash(root: AccessibilityNodeInfo): Int? {
        val window = Rect().also(root::getBoundsInScreen)
        if (window.isEmpty) return null
        val bounds = Rect()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val tokens = mutableListOf<String>()
        var examined = 0
        while (queue.isNotEmpty() && examined++ < 700 && tokens.size < 6) {
            val node = queue.removeFirst()
            if (!node.isVisibleToUser) continue
            node.getBoundsInScreen(bounds)
            if (!bounds.isEmpty && bounds.centerY() >= window.top + window.height() * .12 && bounds.centerY() <= window.bottom - window.height() * .06) {
                val id = node.resourceName().orEmpty()
                val text = node.text?.toString()?.trim().orEmpty()
                val desc = node.contentDescription?.toString()?.trim().orEmpty()
                val candidate = when {
                    text.startsWith("@") && text.length in 2..48 -> text.lowercase(Locale.ROOT)
                    desc.lowercase(Locale.ROOT).startsWith("go to channel") -> desc.lowercase(Locale.ROOT)
                    desc.lowercase(Locale.ROOT).startsWith("subscribe to ") -> desc.lowercase(Locale.ROOT)
                    desc.lowercase(Locale.ROOT).contains("original sound") || desc.lowercase(Locale.ROOT).contains("original audio") -> desc.lowercase(Locale.ROOT)
                    id in IDENTITY_IDS && text.length in 2..60 -> text.lowercase(Locale.ROOT)
                    id in IDENTITY_IDS && desc.length in 2..60 -> desc.lowercase(Locale.ROOT)
                    else -> null
                }
                if (candidate != null && candidate !in tokens) tokens.add(candidate)
            }
            for (i in 0 until node.childCount) {
                if (queue.size + examined >= 700) break
                node.getChild(i)?.let(queue::addLast)
            }
        }
        if (tokens.isEmpty()) return null
        return tokens.joinToString("|").hashCode()
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

    private fun matchesPhrase(source: String, phrase: String): Boolean {
        if (source.isEmpty()) return false
        if (source == phrase) return true
        var start = source.indexOf(phrase)
        while (start >= 0) {
            val beforeOk = start == 0 || !source[start - 1].isLetterOrDigit()
            val end = start + phrase.length
            val afterOk = end == source.length || !source[end].isLetterOrDigit()
            if (beforeOk && afterOk) return true
            start = source.indexOf(phrase, start + 1)
        }
        return false
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
        bounds.height() >= window.height() * .60 && bounds.width() >= window.width() * .80

    companion object {
        private val scrollContainers = setOf("ViewPager", "ViewPager2", "VerticalViewPager", "RecyclerView", "ListView", "NestedScrollView")
        private val IDENTITY_IDS = setOf(
            "reel_channel_bar", "reel_player_header", "reel_main_title", "reel_channel_name",
            "title", "author", "username", "creator_name", "music_title"
        )

        val facebook = ShortVideoNavigation(
            feedTabs = setOf("reels", "reels tab", "რილსები", "рилс"),
            awayTabs = setOf(
                "home", "friends", "groups", "marketplace", "notifications", "menu", "search", "messages", "profile",
                "მთავარი", "მეგობრები", "ჯგუფები", "შეტყობინებები", "მენიუ", "ძებნა", "პროფილი"
            ),
            feedTabIds = setOf("reels_tab", "reels_home_tab"),
            awayPanelIds = setOf("message_thread", "thread_view", "conversation_view", "comment_composer", "comments_sheet", "search_box", "profile_header"),
            awayLabelHints = setOf("what's on your mind", "create post", "search facebook"),
            playerIds = setOf("reels_view_pager", "reels_viewpager", "reels_pager", "reels_player_pager", "fullscreen_reels_pager"),
            playerClasses = setOf("ReelsViewPager", "ReelsPager"),
            rightRailHints = setOf("like", "comment", "share", "send"),
            topFeedLabels = setOf("reels", "რილსები", "рилс"),
            selectedFeedTabIsSufficient = true
        )

        val tiktok = ShortVideoNavigation(
            feedTabs = setOf("for you", "following", "for you feed", "following feed", "შენთვის", "გამოწერილი", "рекомендации"),
            awayTabs = setOf(
                "inbox", "profile", "friends", "shop", "search", "messages", "live",
                "შემოსულები", "პროფილი", "მეგობრები", "მაღაზია", "ძებნა", "შეტყობინებები"
            ),
            feedTabIds = setOf("for_you_tab", "following_tab", "recommend_tab"),
            awayPanelIds = setOf("chat_room", "chat_container", "message_list", "message_composer", "inbox_container", "comment_panel", "comment_list", "search_box", "profile_header"),
            awayLabelHints = setOf("send a message", "direct messages"),
            playerIds = setOf("for_you_pager", "following_pager", "main_feed_pager", "feed_view_pager", "feed_viewpager", "recommend_feed_pager"),
            playerClasses = setOf("MainFeedViewPager", "ForYouViewPager", "FeedSwipeViewPager"),
            rightRailHints = setOf("like", "comment", "favorite", "bookmark", "share"),
            selectedFeedTabIsSufficient = true
        )

        val youtube = ShortVideoNavigation(
            feedTabs = setOf("shorts", "შორტსი", "шортс"),
            awayTabs = setOf(
                "home", "subscriptions", "you", "library", "search",
                "მთავარი", "გამოწერები", "თქვენ", "ბიბლიოთეკა", "ძებნა"
            ),
            feedTabIds = setOf("button_shorts_container", "pivot_bar_shorts_tab"),
            awayPanelIds = setOf("comment_dialog_root", "shorts_creation_player_view", "watch_while_time_bar_view", "next_gen_watch_layout", "miniplayer_bar"),
            awayLabelHints = setOf("enter fullscreen", "exit fullscreen", "seek slider", "miniplayer"),
            playerIds = setOf(
                "reel_recycler",
                "reel_watch_pager_view_pager",
                "reel_watch_fragment_root",
                "reel_player_page_container",
                "reel_watch_player",
                "reel_watch_player_view",
                "shorts_player_view",
                "reel_player_overlay_container",
                "shorts_container"
            ),
            playerClasses = setOf("ReelRecyclerView", "ShortsViewPager"),
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
            feedLabelHints = setOf("use this sound", "shorts pivot", "remix this short"),
            rightRailHints = setOf("like", "dislike", "comment", "share", "remix"),
            topFeedLabels = setOf("shorts", "შორტსი", "шортс"),
            selectedFeedTabIsSufficient = true
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
            awayLabelHints = setOf("send a chat", "take a snap", "snap map", "my stories"),
            playerIds = setOf("spotlight_view_pager", "spotlight_pager", "spotlight_feed_recycler_view", "spotlight_recycler_view"),
            playerClasses = setOf("SpotlightViewPager", "OperaViewPager"),
            rightRailHints = setOf("like", "comment", "share", "favorite", "remix"),
            topFeedLabels = setOf("spotlight", "სპოტლაითი"),
            selectedFeedTabIsSufficient = true
        )
    }
}
