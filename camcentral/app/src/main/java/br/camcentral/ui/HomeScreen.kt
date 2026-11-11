package br.camcentral.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.camcentral.model.Recorder
import br.camcentral.net.Endpoint

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    recorders: List<Recorder>,
    endpoints: Map<String, Endpoint?>,
    resolving: Boolean,
    onAdd: () -> Unit,
    onEdit: (Recorder) -> Unit,
    onOpenRecorder: (Recorder) -> Unit,
    onOpenAll: () -> Unit,
    onRefresh: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("CamCentral") },
                actions = {
                    IconButton(onClick = onRefresh) { Icon(Icons.Filled.Refresh, "Atualizar conexões") }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAdd,
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text("Gravador") },
            )
        },
    ) { padding ->
        if (recorders.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding).padding(32.dp), contentAlignment = Alignment.Center) {
                Text(
                    "Nenhum gravador ainda.\nToque em \"+ Gravador\" para adicionar seu Hikvision, Intelbras ou Positivo.",
                    textAlign = TextAlign.Center,
                )
            }
            return@Scaffold
        }
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Button(onClick = onOpenAll, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.GridView, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Ver todas as câmeras (${recorders.sumOf { it.channels }})")
                }
            }
            items(recorders, key = { it.id }) { r ->
                Card(Modifier.fillMaxWidth().clickable { onOpenRecorder(r) }) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(r.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            Text("${r.brand.label} · ${r.channels} canais", style = MaterialTheme.typography.bodySmall)
                            val (label, color) = connectionLabel(endpoints, r, resolving)
                            Text(label, color = color, style = MaterialTheme.typography.bodySmall)
                        }
                        IconButton(onClick = { onEdit(r) }) { Icon(Icons.Filled.Edit, "Editar") }
                    }
                }
            }
        }
    }
}

private fun connectionLabel(endpoints: Map<String, Endpoint?>, r: Recorder, resolving: Boolean): Pair<String, Color> {
    if (!endpoints.containsKey(r.id)) {
        return (if (resolving) "Verificando conexão…" else "—") to Color.Gray
    }
    val e = endpoints[r.id] ?: return "Sem endereço configurado" to Color(0xFFEF5350)
    return if (e.isLocal) "● Rede local (${e.host})" to Color(0xFF81C784)
    else "● Acesso remoto (${e.host})" to Color(0xFF64B5F6)
}
