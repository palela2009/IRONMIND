package com.anonymous.IRONMIND

internal class OverLimitTracker {
    private var lastStableForeground: String? = null
    private var crossedDate: String = ""
    private var crossedToday: MutableSet<String> = mutableSetOf()

    fun resetForAccountSwitch() {
        lastStableForeground = null
        crossedDate = ""
        crossedToday.clear()
    }

    fun onForegroundChanged(foreground: String) {
        if (!isTransientOverlay(foreground)) {
            lastStableForeground = foreground
        }
    }

    fun shouldAlertOnForeground(
        foreground: String,
        appName: String,
        usedMinutes: Int,
        limitMinutes: Int,
        dayKey: String
    ): Boolean {
        val overlay = isTransientOverlay(foreground)
        val previousStable = lastStableForeground
        if (!overlay) {
            lastStableForeground = foreground
        }
        if (crossedDate != dayKey) {
            crossedDate = dayKey
            crossedToday.clear()
        }
        if (limitMinutes <= 0 || usedMinutes < limitMinutes) {
            return false
        }
        val justEntered = !overlay && previousStable != foreground
        val justCrossed = crossedToday.add(appName)
        return justEntered || justCrossed
    }

    private fun isTransientOverlay(pkg: String): Boolean =
        pkg == "com.android.systemui" || pkg.contains("inputmethod") || pkg.contains("keyboard")
}
