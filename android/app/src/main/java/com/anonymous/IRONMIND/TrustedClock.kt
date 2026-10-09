package com.anonymous.IRONMIND

import android.content.Context
import android.os.SystemClock
import java.util.Calendar
import java.util.TimeZone

object TrustedClock {
    private const val CLOCK_TOLERANCE_MS = 5 * 60 * 1000L
    private const val ANCHOR_REFRESH_MS = 60 * 60 * 1000L
    private const val TZ_CHANGE_MS = 24 * 60 * 60 * 1000L

    fun now(context: Context): Long {
        val prefs = context.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        val wall = System.currentTimeMillis()
        val elapsed = SystemClock.elapsedRealtime()
        val anchorWall = prefs.getLong("anchorWall", 0L)
        val anchorElapsed = prefs.getLong("anchorElapsed", -1L)

        if (anchorElapsed < 0L || elapsed < anchorElapsed) {
            prefs.edit().putLong("anchorWall", wall).putLong("anchorElapsed", elapsed).apply()
            return wall
        }

        val expected = anchorWall + (elapsed - anchorElapsed)
        if (kotlin.math.abs(wall - expected) > CLOCK_TOLERANCE_MS) return expected
        if (wall - anchorWall > ANCHOR_REFRESH_MS) {
            prefs.edit().putLong("anchorWall", wall).putLong("anchorElapsed", elapsed).apply()
        }
        return wall
    }

    private fun timeZone(context: Context, now: Long): TimeZone {
        val prefs = context.getSharedPreferences(UsageMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        val current = TimeZone.getDefault().id
        val pinned = prefs.getString("tzId", null)
        val pinnedAt = prefs.getLong("tzPinnedAt", 0L)
        if (pinned == null || (pinned != current && now - pinnedAt > TZ_CHANGE_MS)) {
            prefs.edit().putString("tzId", current).putLong("tzPinnedAt", now).apply()
            return TimeZone.getTimeZone(current)
        }
        return TimeZone.getTimeZone(pinned)
    }

    fun dayKey(context: Context): String {
        val now = now(context)
        val cal = Calendar.getInstance(timeZone(context, now))
        cal.timeInMillis = now
        return "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.DAY_OF_YEAR)}"
    }
}
