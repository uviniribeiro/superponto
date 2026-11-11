package br.camcentral.data

import android.content.Context
import br.camcentral.model.Brand
import br.camcentral.model.Recorder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

/**
 * Guarda os gravadores no armazenamento privado do app (não vai para backup nem para nuvem).
 */
class RecorderRepository(context: Context) {
    private val prefs = context.getSharedPreferences("recorders", Context.MODE_PRIVATE)
    private val _recorders = MutableStateFlow(load())
    val recorders: StateFlow<List<Recorder>> = _recorders

    fun upsert(recorder: Recorder) {
        val list = _recorders.value.toMutableList()
        val idx = list.indexOfFirst { it.id == recorder.id }
        if (idx >= 0) list[idx] = recorder else list.add(recorder)
        save(list)
    }

    fun delete(id: String) = save(_recorders.value.filterNot { it.id == id })

    private fun save(list: List<Recorder>) {
        val arr = JSONArray()
        list.forEach { r ->
            arr.put(
                JSONObject()
                    .put("id", r.id).put("name", r.name).put("brand", r.brand.name)
                    .put("localHost", r.localHost).put("remoteHost", r.remoteHost)
                    .put("localPort", r.localPort).put("remotePort", r.remotePort)
                    .put("username", r.username).put("password", r.password)
                    .put("channels", r.channels).put("customTemplate", r.customTemplate),
            )
        }
        prefs.edit().putString(KEY, arr.toString()).apply()
        _recorders.value = list
    }

    private fun load(): List<Recorder> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                val brand = runCatching { Brand.valueOf(o.getString("brand")) }.getOrDefault(Brand.CUSTOM)
                Recorder(
                    id = o.getString("id"),
                    name = o.getString("name"),
                    brand = brand,
                    localHost = o.optString("localHost"),
                    remoteHost = o.optString("remoteHost"),
                    localPort = o.optInt("localPort", brand.defaultRtspPort),
                    remotePort = o.optInt("remotePort", brand.defaultRtspPort),
                    username = o.optString("username"),
                    password = o.optString("password"),
                    channels = o.optInt("channels", 4),
                    customTemplate = o.optString("customTemplate"),
                )
            }
        }.getOrDefault(emptyList())
    }

    private companion object {
        const val KEY = "list_v1"
    }
}
