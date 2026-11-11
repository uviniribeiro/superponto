package br.camcentral.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import br.camcentral.model.Brand
import br.camcentral.model.Recorder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecorderFormScreen(
    initial: Recorder?,
    onSave: (Recorder) -> Unit,
    onDelete: (Recorder) -> Unit,
    onBack: () -> Unit,
) {
    var name by rememberSaveable { mutableStateOf(initial?.name ?: "") }
    var brand by rememberSaveable { mutableStateOf(initial?.brand ?: Brand.HIKVISION) }
    var localHost by rememberSaveable { mutableStateOf(initial?.localHost ?: "") }
    var localPort by rememberSaveable { mutableStateOf((initial?.localPort ?: 554).toString()) }
    var remoteHost by rememberSaveable { mutableStateOf(initial?.remoteHost ?: "") }
    var remotePort by rememberSaveable { mutableStateOf((initial?.remotePort ?: 554).toString()) }
    var user by rememberSaveable { mutableStateOf(initial?.username ?: "admin") }
    var pass by rememberSaveable { mutableStateOf(initial?.password ?: "") }
    var showPass by rememberSaveable { mutableStateOf(false) }
    var channels by rememberSaveable { mutableStateOf((initial?.channels ?: 4).toString()) }
    var template by rememberSaveable { mutableStateOf(initial?.customTemplate ?: "") }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }

    val lp = localPort.toIntOrNull()
    val rp = remotePort.toIntOrNull()
    val ch = channels.toIntOrNull()
    val valid = name.isNotBlank() &&
        (localHost.isNotBlank() || remoteHost.isNotBlank()) &&
        lp != null && lp in 1..65535 && rp != null && rp in 1..65535 &&
        ch != null && ch in 1..64 &&
        (brand != Brand.CUSTOM || template.startsWith("rtsp://"))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (initial == null) "Novo gravador" else "Editar gravador") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar") }
                },
                actions = {
                    if (initial != null) {
                        IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Filled.Delete, "Excluir") }
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding()
                .verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(name, { name = it }, label = { Text("Nome (ex.: Casa, Loja)") },
                singleLine = true, modifier = Modifier.fillMaxWidth())

            Text("Marca", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(Brand.HIKVISION, Brand.INTELBRAS, Brand.POSITIVO).forEach { b ->
                    FilterChip(selected = brand == b, onClick = { brand = b }, label = { Text(b.label) })
                }
            }
            FilterChip(selected = brand == Brand.CUSTOM, onClick = { brand = Brand.CUSTOM },
                label = { Text(Brand.CUSTOM.label) })
            if (brand == Brand.CUSTOM) {
                OutlinedTextField(
                    template, { template = it },
                    label = { Text("Modelo da URL RTSP") },
                    supportingText = {
                        Text("Use {user} {pass} {host} {port} {channel} {stream}. Ex.: rtsp://{user}:{pass}@{host}:{port}/ch{channel}/{stream}")
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Text("Em casa (rede local)", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(localHost, { localHost = it.trim() }, label = { Text("IP local") },
                    placeholder = { Text("192.168.0.50") }, singleLine = true, modifier = Modifier.weight(2f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                OutlinedTextField(localPort, { localPort = it.filter(Char::isDigit) }, label = { Text("Porta RTSP") },
                    singleLine = true, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }

            Text("Fora de casa (4G / outro Wi-Fi)", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(remoteHost, { remoteHost = it.trim() }, label = { Text("DDNS, IP público ou Tailscale") },
                    placeholder = { Text("minhacasa.ddns.net") }, singleLine = true, modifier = Modifier.weight(2f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
                OutlinedTextField(remotePort, { remotePort = it.filter(Char::isDigit) }, label = { Text("Porta") },
                    singleLine = true, modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
            Text(
                "O app testa primeiro o IP local; se não responder, usa o endereço externo automaticamente.",
                style = MaterialTheme.typography.bodySmall,
            )

            OutlinedTextField(user, { user = it }, label = { Text("Usuário do gravador") },
                singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                pass, { pass = it }, label = { Text("Senha do gravador") }, singleLine = true,
                visualTransformation = if (showPass) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { showPass = !showPass }) {
                        Icon(if (showPass) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, "Mostrar senha")
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(channels, { channels = it.filter(Char::isDigit) }, label = { Text("Quantidade de câmeras (canais)") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))

            Button(
                enabled = valid,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val base = initial ?: Recorder(name = name, brand = brand, username = user, password = pass, channels = ch!!)
                    onSave(
                        base.copy(
                            name = name.trim(), brand = brand,
                            localHost = localHost, localPort = lp!!,
                            remoteHost = remoteHost, remotePort = rp!!,
                            username = user, password = pass, channels = ch!!,
                            customTemplate = if (brand == Brand.CUSTOM) template.trim() else "",
                        ),
                    )
                },
            ) { Text("Salvar") }
        }
    }

    if (confirmDelete && initial != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Excluir ${initial.name}?") },
            text = { Text("As câmeras deste gravador sairão do app. O gravador em si não é alterado.") },
            confirmButton = { TextButton(onClick = { onDelete(initial) }) { Text("Excluir") } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancelar") } },
        )
    }
}
