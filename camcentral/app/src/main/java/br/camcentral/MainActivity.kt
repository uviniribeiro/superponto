package br.camcentral

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.camcentral.data.RecorderRepository
import br.camcentral.model.Camera
import br.camcentral.model.Recorder
import br.camcentral.net.Endpoint
import br.camcentral.net.EndpointResolver
import br.camcentral.ui.CamCentralTheme
import br.camcentral.ui.FullscreenScreen
import br.camcentral.ui.HomeScreen
import br.camcentral.ui.MosaicScreen
import br.camcentral.ui.RecorderFormScreen
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay

private sealed interface Screen {
    data object Home : Screen
    data class Form(val recorderId: String?) : Screen
    data class Mosaic(val recorderId: String?) : Screen
    data class Full(val recorderId: String, val channel: Int, val from: Screen) : Screen
}

class MainActivity : ComponentActivity() {
    private lateinit var repo: RecorderRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repo = RecorderRepository(applicationContext)
        // Mantém a tela ligada enquanto estiver assistindo.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContent { CamCentralTheme { App(repo) } }
    }
}

@Composable
private fun App(repo: RecorderRepository) {
    val recorders by repo.recorders.collectAsStateWithLifecycle()
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    var endpoints by remember { mutableStateOf<Map<String, Endpoint?>>(emptyMap()) }
    var resolving by remember { mutableStateOf(false) }
    var refreshTick by remember { mutableIntStateOf(0) }

    // Quando o celular troca de rede (Wi-Fi de casa <-> 4G <-> outro Wi-Fi),
    // refaz a escolha entre endereço local e remoto.
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { refreshTick++ }
            override fun onLost(network: Network) { refreshTick++ }
        }
        cm.registerDefaultNetworkCallback(cb)
        onDispose { cm.unregisterNetworkCallback(cb) }
    }

    LaunchedEffect(recorders, refreshTick) {
        delay(300) // agrupa eventos de rede seguidos
        resolving = true
        endpoints = coroutineScope {
            recorders.map { r -> async { r.id to EndpointResolver.resolve(r) } }.awaitAll().toMap()
        }
        resolving = false
    }

    fun recorder(id: String?): Recorder? = recorders.firstOrNull { it.id == id }

    BackHandler(enabled = screen != Screen.Home) {
        screen = when (val s = screen) {
            is Screen.Full -> s.from
            else -> Screen.Home
        }
    }

    when (val s = screen) {
        Screen.Home -> HomeScreen(
            recorders = recorders,
            endpoints = endpoints,
            resolving = resolving,
            onAdd = { screen = Screen.Form(null) },
            onEdit = { screen = Screen.Form(it.id) },
            onOpenRecorder = { screen = Screen.Mosaic(it.id) },
            onOpenAll = { screen = Screen.Mosaic(null) },
            onRefresh = { refreshTick++ },
        )

        is Screen.Form -> RecorderFormScreen(
            initial = recorder(s.recorderId),
            onSave = { repo.upsert(it); screen = Screen.Home },
            onDelete = { repo.delete(it.id); screen = Screen.Home },
            onBack = { screen = Screen.Home },
        )

        is Screen.Mosaic -> {
            val r = s.recorderId?.let(::recorder)
            val cams: List<Camera> = r?.cameras() ?: recorders.flatMap { it.cameras() }
            MosaicScreen(
                title = r?.name ?: "Todas as câmeras",
                cameras = cams,
                endpoints = endpoints,
                onBack = { screen = Screen.Home },
                onOpenCamera = { screen = Screen.Full(it.recorder.id, it.channel, s) },
            )
        }

        is Screen.Full -> {
            val r = recorder(s.recorderId)
            if (r == null) {
                screen = Screen.Home
            } else {
                FullscreenScreen(
                    camera = Camera(r, s.channel),
                    endpoint = endpoints[r.id],
                    resolved = endpoints.containsKey(r.id),
                    onBack = { screen = s.from },
                )
            }
        }
    }
}
