package br.camcentral.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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

/**
 * Mosaico unificado: câmeras de todos os gravadores, de todas as marcas, na mesma tela.
 * Usa o fluxo "extra" (leve) para economizar dados; toque numa câmera para ver em alta.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MosaicScreen(
    title: String,
    cameras: List<Camera>,
    endpoints: Map<String, Endpoint?>,
    onBack: () -> Unit,
    onOpenCamera: (Camera) -> Unit,
) {
    var perPage by rememberSaveable { mutableIntStateOf(4) }
    var page by rememberSaveable { mutableIntStateOf(0) }
    val pages = maxOf(1, (cameras.size + perPage - 1) / perPage)
    if (page >= pages) page = pages - 1
    val visible = cameras.drop(page * perPage).take(perPage)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf(1, 4, 9).forEach { n ->
                    FilterChip(
                        selected = perPage == n,
                        onClick = { perPage = n; page = 0 },
                        label = { Text(if (n == 1) "1" else "${n}") },
                    )
                }
                Box(Modifier.weight(1f))
                IconButton(onClick = { if (page > 0) page-- }, enabled = page > 0) {
                    Icon(Icons.Filled.ChevronLeft, "Anterior")
                }
                Text("${page + 1}/$pages")
                IconButton(onClick = { if (page < pages - 1) page++ }, enabled = page < pages - 1) {
                    Icon(Icons.Filled.ChevronRight, "Próxima")
                }
            }
            val columns = when (perPage) { 1 -> 1; 4 -> 2; else -> 3 }
            LazyVerticalGrid(
                columns = GridCells.Fixed(columns),
                modifier = Modifier.fillMaxSize().padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(visible, key = { it.key }) { cam ->
                    val ep = endpoints[cam.recorder.id]
                    val quality = if (perPage == 1) StreamQuality.MAIN else StreamQuality.SUB
                    val url = ep?.let { RtspUrlBuilder.build(cam.recorder, cam.channel, it.host, it.port, quality) }
                    Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clickable { onOpenCamera(cam) }) {
                        if (endpoints.containsKey(cam.recorder.id)) {
                            CameraPlayer(url, Modifier.fillMaxSize())
                        }
                        Text(
                            cam.title,
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.align(Alignment.TopStart)
                                .padding(4.dp),
                        )
                    }
                }
            }
        }
    }
}
