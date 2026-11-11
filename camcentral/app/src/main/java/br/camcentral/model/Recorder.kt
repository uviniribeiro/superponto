package br.camcentral.model

import java.util.UUID

/** Marcas suportadas e o formato de URL RTSP de cada uma. */
enum class Brand(val label: String, val defaultRtspPort: Int, val template: String) {
    HIKVISION(
        "Hikvision", 554,
        "rtsp://{user}:{pass}@{host}:{port}/Streaming/Channels/{channel}0{hikStream}",
    ),
    INTELBRAS(
        "Intelbras", 554,
        "rtsp://{user}:{pass}@{host}:{port}/cam/realmonitor?channel={channel}&subtype={stream}",
    ),

    /**
     * A maioria dos gravadores Positivo (linha Positivo Seg / Casa Inteligente) usa
     * firmware Xiongmai (XMEye). Se o seu modelo usar outro padrão, troque para
     * "Personalizado" e informe o modelo de URL manualmente.
     */
    POSITIVO(
        "Positivo", 554,
        "rtsp://{host}:{port}/user={user}&password={pass}&channel={channel}&stream={stream}.sdp?real_stream",
    ),
    CUSTOM("Personalizado (ONVIF/RTSP)", 554, "rtsp://{user}:{pass}@{host}:{port}/");
}

/** Qualidade do fluxo: principal (alta resolução) ou extra (leve, ideal para 4G/mosaico). */
enum class StreamQuality { MAIN, SUB }

data class Recorder(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val brand: Brand,
    /** IP na rede de casa, ex.: 192.168.0.50. Opcional. */
    val localHost: String = "",
    /** Endereço de fora de casa: DDNS, IP público ou IP do Tailscale/VPN. Opcional. */
    val remoteHost: String = "",
    val localPort: Int = brand.defaultRtspPort,
    val remotePort: Int = brand.defaultRtspPort,
    val username: String,
    val password: String,
    val channels: Int,
    /** Usado apenas quando brand == CUSTOM. */
    val customTemplate: String = "",
) {
    val template: String
        get() = if (brand == Brand.CUSTOM && customTemplate.isNotBlank()) customTemplate else brand.template

    fun cameras(): List<Camera> = (1..channels).map { Camera(this, it) }
}

data class Camera(val recorder: Recorder, val channel: Int) {
    val key: String get() = "${recorder.id}#$channel"
    val title: String get() = "${recorder.name} · Câmera $channel"
}

object RtspUrlBuilder {
    fun build(recorder: Recorder, channel: Int, host: String, port: Int, quality: StreamQuality): String {
        val stream = if (quality == StreamQuality.MAIN) 0 else 1
        val hikStream = if (quality == StreamQuality.MAIN) 1 else 2
        return recorder.template
            .replace("{user}", encode(recorder.username))
            .replace("{pass}", encode(recorder.password))
            .replace("{host}", formatHost(host.trim()))
            .replace("{port}", port.toString())
            .replace("{channel}", channel.toString())
            .replace("{hikStream}", hikStream.toString())
            .replace("{stream}", stream.toString())
    }

    /** IPv6 precisa de colchetes na URL. */
    private fun formatHost(host: String): String =
        if (host.contains(':') && !host.startsWith("[")) "[$host]" else host

    /** Percent-encoding de usuário/senha (senhas com @, #, : etc. quebrariam a URL). */
    fun encode(value: String): String {
        val unreserved = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
        val sb = StringBuilder()
        for (b in value.toByteArray(Charsets.UTF_8)) {
            val c = (b.toInt() and 0xFF).toChar()
            if (c in unreserved) sb.append(c) else sb.append('%').append("%02X".format(b.toInt() and 0xFF))
        }
        return sb.toString()
    }
}
