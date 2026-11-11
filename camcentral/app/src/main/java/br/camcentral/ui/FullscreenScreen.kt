package br.camcentral.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Hd
import androidx.compose.material.icons.filled.Sd
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import br.camcentral.model.Camera
import br.camcentral.model.RtspUrlBuilder
import br.camcentral.model.StreamQuality
import br.camcentral.net.Endpoint

@Composable
fun FullscreenScreen(camera: Camera, endpoint: Endpoint?, resolved: Boolean, onBack: () -> Unit) {
    var hd by rememberSaveable { mutableStateOf(true) }
    val url = endpoint?.let {
        RtspUrlBuilder.build(
            camera.recorder, camera.channel, it.host, it.port,
            if (hd) StreamQuality.MAIN else StreamQuality.SUB,
        )
    }
    Box(Modifier.fillMaxSize()) {
        if (resolved) CameraPlayer(url, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().safeDrawingPadding()) {
            IconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar", tint = Color.White)
            }
            Text(
                camera.title + if (endpoint?.isLocal == false) " · remoto" else "",
                color = Color.White,
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 14.dp),
            )
            IconButton(onClick = { hd = !hd }, modifier = Modifier.align(Alignment.TopEnd)) {
                Icon(
                    if (hd) Icons.Filled.Hd else Icons.Filled.Sd,
                    if (hd) "Mudar para qualidade leve" else "Mudar para alta qualidade",
                    tint = Color.White,
                )
            }
        }
    }
}
