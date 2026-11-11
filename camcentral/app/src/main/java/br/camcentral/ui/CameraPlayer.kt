package br.camcentral.ui

import android.view.LayoutInflater
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay

/**
 * Toca um fluxo RTSP ao vivo. Reconecta sozinho em caso de queda
 * (troca de Wi-Fi para 4G, gravador reiniciando etc.).
 */
@OptIn(UnstableApi::class)
@Composable
fun CameraPlayer(url: String?, modifier: Modifier = Modifier, fill: Boolean = false) {
    val context = LocalContext.current
    var status by remember(url) { mutableStateOf("Conectando…") }
    var retry by remember(url) { mutableIntStateOf(0) }

    val player = remember(url) {
        // Buffer curto = menos atraso em relação ao vivo.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(500, 3000, 250, 500)
            .build()
        ExoPlayer.Builder(context).setLoadControl(loadControl).build().apply {
            volume = 0f
            playWhenReady = true
        }
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                status = when (state) {
                    Player.STATE_READY -> ""
                    Player.STATE_BUFFERING -> "Conectando…"
                    Player.STATE_ENDED -> "Transmissão encerrada"
                    else -> status
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                status = "Sem sinal (${error.errorCodeName.removePrefix("ERROR_CODE_")}). Tentando de novo…"
                retry++
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(player, retry) {
        if (url == null) {
            status = "Gravador sem endereço configurado"
            return@LaunchedEffect
        }
        if (retry > 0) delay(4000)
        val source = RtspMediaSource.Factory()
            .setForceUseRtpTcp(true) // TCP atravessa NAT/4G muito melhor que UDP
            .setTimeoutMs(10_000)
            .createMediaSource(MediaItem.fromUri(url))
        player.setMediaSource(source)
        player.prepare()
    }

    // Pausa quando o app vai para segundo plano, retoma ao voltar.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP -> player.stop()
                Lifecycle.Event.ON_START -> if (url != null) retry++
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Box(modifier.background(Color.Black)) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                (LayoutInflater.from(ctx).inflate(br.camcentral.R.layout.player_view, null) as PlayerView)
            },
            update = { view ->
                view.player = player
                view.resizeMode = if (fill) AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                else AspectRatioFrameLayout.RESIZE_MODE_FIT
            },
        )
        if (status.isNotEmpty()) {
            Box(Modifier.fillMaxSize().padding(8.dp), contentAlignment = Alignment.Center) {
                if (status.startsWith("Conectando")) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                } else {
                    Text(status, color = Color.White, textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}
