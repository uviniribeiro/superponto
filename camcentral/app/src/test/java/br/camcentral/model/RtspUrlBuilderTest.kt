package br.camcentral.model

import org.junit.Assert.assertEquals
import org.junit.Test

class RtspUrlBuilderTest {
    private fun rec(brand: Brand, pass: String = "senha123", template: String = "") = Recorder(
        name = "Casa", brand = brand, username = "admin", password = pass, channels = 4,
        customTemplate = template,
    )

    @Test
    fun hikvisionMainAndSub() {
        val r = rec(Brand.HIKVISION)
        assertEquals(
            "rtsp://admin:senha123@192.168.0.10:554/Streaming/Channels/301",
            RtspUrlBuilder.build(r, 3, "192.168.0.10", 554, StreamQuality.MAIN),
        )
        assertEquals(
            "rtsp://admin:senha123@192.168.0.10:554/Streaming/Channels/302",
            RtspUrlBuilder.build(r, 3, "192.168.0.10", 554, StreamQuality.SUB),
        )
    }

    @Test
    fun hikvisionTwoDigitChannel() {
        assertEquals(
            "rtsp://admin:senha123@h:554/Streaming/Channels/1201",
            RtspUrlBuilder.build(rec(Brand.HIKVISION), 12, "h", 554, StreamQuality.MAIN),
        )
    }

    @Test
    fun intelbras() {
        assertEquals(
            "rtsp://admin:senha123@casa.ddns-intelbras.com.br:5540/cam/realmonitor?channel=2&subtype=1",
            RtspUrlBuilder.build(rec(Brand.INTELBRAS), 2, "casa.ddns-intelbras.com.br", 5540, StreamQuality.SUB),
        )
    }

    @Test
    fun positivo() {
        assertEquals(
            "rtsp://10.0.0.5:554/user=admin&password=senha123&channel=1&stream=0.sdp?real_stream",
            RtspUrlBuilder.build(rec(Brand.POSITIVO), 1, "10.0.0.5", 554, StreamQuality.MAIN),
        )
    }

    @Test
    fun specialCharactersInPasswordAreEncoded() {
        assertEquals(
            "rtsp://admin:p%40ss%3Aw%23rd@h:554/Streaming/Channels/101",
            RtspUrlBuilder.build(rec(Brand.HIKVISION, pass = "p@ss:w#rd"), 1, "h", 554, StreamQuality.MAIN),
        )
    }

    @Test
    fun customTemplate() {
        val r = rec(Brand.CUSTOM, template = "rtsp://{user}:{pass}@{host}:{port}/live/ch{channel}/{stream}")
        assertEquals("rtsp://admin:senha123@h:8554/live/ch5/1", RtspUrlBuilder.build(r, 5, "h", 8554, StreamQuality.SUB))
    }

    @Test
    fun ipv6HostGetsBrackets() {
        assertEquals(
            "rtsp://admin:senha123@[fd7a:115c::1]:554/Streaming/Channels/101",
            RtspUrlBuilder.build(rec(Brand.HIKVISION), 1, "fd7a:115c::1", 554, StreamQuality.MAIN),
        )
    }
}
