package br.camcentral.net

import br.camcentral.model.Recorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket

data class Endpoint(val host: String, val port: Int, val isLocal: Boolean)

/**
 * Escolhe automaticamente por onde falar com o gravador:
 * se o IP de casa responde (você está no Wi-Fi de casa), usa a rede local;
 * caso contrário, usa o endereço externo (DDNS / IP público / Tailscale).
 * Assim funciona em qualquer internet: Wi-Fi de casa, 4G/5G ou Wi-Fi de terceiros.
 */
object EndpointResolver {
    private const val LOCAL_TIMEOUT_MS = 800
    private const val REMOTE_TIMEOUT_MS = 4000

    suspend fun resolve(r: Recorder): Endpoint? = withContext(Dispatchers.IO) {
        val local = r.localHost.trim()
        val remote = r.remoteHost.trim()
        if (local.isNotEmpty() && reachable(local, r.localPort, LOCAL_TIMEOUT_MS)) {
            return@withContext Endpoint(local, r.localPort, true)
        }
        if (remote.isNotEmpty() && reachable(remote, r.remotePort, REMOTE_TIMEOUT_MS)) {
            return@withContext Endpoint(remote, r.remotePort, false)
        }
        // Nenhum respondeu ao teste: tenta mesmo assim o externo (ou o local, se for o único).
        when {
            remote.isNotEmpty() -> Endpoint(remote, r.remotePort, false)
            local.isNotEmpty() -> Endpoint(local, r.localPort, true)
            else -> null
        }
    }

    private fun reachable(host: String, port: Int, timeoutMs: Int): Boolean = try {
        Socket().use { it.connect(InetSocketAddress(host, port), timeoutMs); true }
    } catch (_: Exception) {
        false
    }
}
