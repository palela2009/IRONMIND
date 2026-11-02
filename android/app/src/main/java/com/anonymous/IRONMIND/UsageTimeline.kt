package com.anonymous.IRONMIND

class UsageTimeline(private val startMs: Long, private val endMs: Long) {
    private val durations = mutableMapOf<String, Long>()
    private var activePackage: String? = null
    private var activeSince = startMs
    private var interactive = true

    private fun finish(at: Long) {
        val pkg = activePackage ?: return
        val elapsed = minOf(at, endMs) - maxOf(activeSince, startMs)
        if (elapsed > 0) durations[pkg] = (durations[pkg] ?: 0L) + elapsed
        activePackage = null
    }

    fun onEvent(pkg: String?, type: Int, timestamp: Long) {
        if (timestamp > endMs) return
        when (type) {
            1 -> {
                if (!interactive || pkg.isNullOrBlank() || activePackage == pkg) return
                finish(timestamp)
                activePackage = pkg
                activeSince = timestamp
            }
            2, 23 -> if (activePackage == pkg) finish(timestamp)
            15, 18 -> interactive = true
            16, 17, 26 -> { finish(timestamp); interactive = false }
        }
    }

    fun totals(): Map<String, Long> {
        val result = durations.toMutableMap()
        activePackage?.let { pkg ->
            val elapsed = endMs - maxOf(activeSince, startMs)
            if (interactive && elapsed > 0) result[pkg] = (result[pkg] ?: 0L) + elapsed
        }
        return result
    }
}
