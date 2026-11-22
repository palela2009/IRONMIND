package com.anonymous.IRONMIND

import android.content.SharedPreferences

internal enum class ShortVideoTarget(
    val appName: String,
    val packageId: String,
    val challengeKind: String,
    val feedName: String
) {
    INSTAGRAM("Instagram", "com.instagram.android", "instagram_reels", "Reels"),
    FACEBOOK("Facebook", "com.facebook.katana", "facebook_reels", "Reels"),
    TIKTOK("TikTok", "com.zhiliaoapp.musically", "tiktok_feed", "the TikTok feed"),
    YOUTUBE("YouTube", "com.google.android.youtube", "youtube_shorts", "Shorts");

    fun hasConsent(prefs: SharedPreferences, uid: String): Boolean {
        return prefs.getString(EXPANDED_CONSENT_UID, null) == uid ||
            (this == INSTAGRAM && prefs.getString(INSTAGRAM_CONSENT_UID, null) == uid)
    }

    companion object {
        const val INSTAGRAM_CONSENT_UID = "instagramReelsConsentUid"
        const val EXPANDED_CONSENT_UID = "shortVideoTestConsentUid"

        fun fromPackage(packageId: String?): ShortVideoTarget? = entries.firstOrNull { it.packageId == packageId }

        fun replacesAppReminder(packageId: String, prefs: SharedPreferences): Boolean {
            val target = fromPackage(packageId) ?: return false
            if (target == INSTAGRAM) return true
            val uid = prefs.getString("uid", null) ?: return false
            return target.hasConsent(prefs, uid)
        }
    }
}
