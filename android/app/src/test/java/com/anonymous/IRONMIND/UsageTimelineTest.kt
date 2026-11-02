package com.anonymous.IRONMIND

import org.junit.Assert.assertEquals
import org.junit.Test

class UsageTimelineTest {
    @Test fun countsSessionThatCrossesMidnight() {
        val usage = UsageTimeline(1000L, 5000L)
        usage.onEvent("video", 1, 500L)
        usage.onEvent("video", 2, 3000L)
        assertEquals(mapOf("video" to 2000L), usage.totals())
    }

    @Test fun screenLockStopsCountingUntilTheNextActiveApp() {
        val usage = UsageTimeline(0L, 10000L)
        usage.onEvent("video", 1, 1000L)
        usage.onEvent(null, 16, 3000L)
        usage.onEvent("video", 1, 4000L)
        usage.onEvent(null, 15, 7000L)
        usage.onEvent("messages", 1, 7500L)
        assertEquals(mapOf("video" to 2000L, "messages" to 2500L), usage.totals())
    }

    @Test fun appSwitchesAndDuplicateResumeEventsDoNotOverlapOrLoseTime() {
        val usage = UsageTimeline(0L, 10000L)
        usage.onEvent("video", 1, 1000L)
        usage.onEvent("video", 1, 2000L)
        usage.onEvent("messages", 1, 4000L)
        usage.onEvent("video", 2, 4500L)
        usage.onEvent("messages", 2, 8000L)
        assertEquals(mapOf("video" to 3000L, "messages" to 4000L), usage.totals())
        assertEquals(7000L, usage.totals().values.sum())
    }

    @Test fun retainsEveryAppWhenMoreThanTenAreUsed() {
        val usage = UsageTimeline(0L, 20000L)
        for (i in 0 until 15) {
            usage.onEvent("app$i", 1, i * 1000L)
            usage.onEvent("app$i", 2, i * 1000L + 500L)
        }
        assertEquals(15, usage.totals().size)
        assertEquals(7500L, usage.totals().values.sum())
    }
}
