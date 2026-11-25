package com.anonymous.IRONMIND

import android.content.SharedPreferences

internal enum class ShortVideoTarget(
    val appName: String,
    val packageIds: Set<String>,
    val challengeKind: String,
    val feedName: String
) {
    INSTAGRAM("Instagram", setOf("com.instagram.android"), "instagram_reels", "Reels"),
    FACEBOOK("Facebook", setOf("com.facebook.katana"), "facebook_reels", "Reels"),
    TIKTOK("TikTok", setOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill"), "tiktok_feed", "the TikTok feed"),
    YOUTUBE("YouTube", setOf("com.google.android.youtube"), "youtube_shorts", "Shorts");

    val packageId: String get() = packageIds.first()

    fun hasConsent(prefs: SharedPreferences, uid: String): Boolean {
        return prefs.getString(EXPANDED_CONSENT_UID, null) == uid ||
            (this == INSTAGRAM && prefs.getString(INSTAGRAM_CONSENT_UID, null) == uid)
    }

    companion object {
        const val INSTAGRAM_CONSENT_UID = "instagramReelsConsentUid"
        const val EXPANDED_CONSENT_UID = "shortVideoTestConsentUid"
        @Volatile var serviceConnected = false

        fun fromPackage(packageId: String?): ShortVideoTarget? =
            if (packageId.isNullOrBlank()) null else entries.firstOrNull { packageId in it.packageIds }

        fun replacesAppReminder(packageId: String, prefs: SharedPreferences): Boolean {
            if (!serviceConnected) return false
            val target = fromPackage(packageId) ?: return false
            val uid = prefs.getString("uid", null) ?: return false
            return target.hasConsent(prefs, uid)
        }
    }
}
