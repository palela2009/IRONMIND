package com.anonymous.IRONMIND

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object ChallengeStore {
    private fun prefs(context: Context) = context.getSharedPreferences("ironmind_results", Context.MODE_PRIVATE)

    @Synchronized
    fun saveActive(context: Context, state: JSONObject?) {
        val editor = prefs(context).edit()
        if (state == null) editor.remove("active") else editor.putString("active", state.toString())
        check(editor.commit()) { "Could not save challenge state" }
    }

    @Synchronized
    fun active(context: Context): JSONObject? = prefs(context).getString("active", null)?.let { JSONObject(it) }

    @Synchronized
    fun finish(context: Context, result: JSONObject) {
        val store = prefs(context)
        val queue = JSONArray(store.getString("pending", "[]"))
        val exists = (0 until queue.length()).any { queue.getJSONObject(it).getString("id") == result.getString("id") }
        if (!exists) queue.put(result)
        check(store.edit().putString("pending", queue.toString()).remove("active").commit()) { "Could not save challenge result" }
    }

    @Synchronized
    fun pending(context: Context, uid: String): String {
        val queue = JSONArray(prefs(context).getString("pending", "[]"))
        val result = JSONArray()
        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            if (item.optString("uid") == uid) result.put(item)
        }
        return result.toString()
    }

    @Synchronized
    fun acknowledge(context: Context, uid: String, id: String) {
        val store = prefs(context)
        val queue = JSONArray(store.getString("pending", "[]"))
        val keep = JSONArray()
        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            if (item.optString("uid") != uid || item.optString("id") != id) keep.put(item)
        }
        check(store.edit().putString("pending", keep.toString()).commit()) { "Could not acknowledge result" }
    }

    @Synchronized
    fun clearAccount(context: Context, uid: String) {
        val store = prefs(context)
        val queue = JSONArray(store.getString("pending", "[]"))
        val keep = JSONArray()
        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            if (item.optString("uid") != uid) keep.put(item)
        }
        val editor = store.edit().putString("pending", keep.toString())
        val state = active(context)
        if (state?.optString("uid") == uid) editor.remove("active")
        check(editor.commit()) { "Could not clear account results" }
    }
}
