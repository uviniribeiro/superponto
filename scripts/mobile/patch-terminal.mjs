#!/usr/bin/env node
/**
 * Aplica ao projeto Android gerado pelo Capacitor (android-terminal/, fora do Git) a configuração
 * de terminal em tela cheia guardada em mobile/terminal/android. Idempotente: pode rodar a cada build.
 *
 *   node scripts/mobile/patch-terminal.mjs [pasta-do-projeto-android]
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const project = resolve(root, process.argv[2] ?? 'android-terminal');
const main = join(project, 'app/src/main');
if (!existsSync(main)) {
  console.error(`Projeto Android não encontrado em ${project}. Rode "npx cap add android" com PONTOMAX_APP=terminal antes.`);
  process.exit(1);
}

// 1) Código nativo: MainActivity (imersivo, tela ligada, quiosque), BootReceiver e administrador do dispositivo.
cpSync(join(root, 'mobile/terminal/android/java'), join(main, 'java'), { recursive: true });
cpSync(join(root, 'mobile/terminal/android/res'), join(main, 'res'), { recursive: true });

function patch(file, steps) {
  const path = join(main, file);
  let s = readFileSync(path, 'utf8');
  for (const [marker, find, replace] of steps) {
    if (s.includes(marker)) continue; // já aplicado
    if (!s.includes(find)) throw new Error(`${file}: trecho esperado não encontrado (${find.slice(0, 60)}…). O modelo do Capacitor mudou?`);
    s = s.replace(find, replace);
  }
  writeFileSync(path, s);
}

// 2) Manifesto: atividade em tela cheia/quiosque, opção de tela inicial e abertura ao ligar.
patch('AndroidManifest.xml', [
  ['android:lockTaskMode', 'android:launchMode="singleTask"', `android:launchMode="singleTask"
            android:screenOrientation="fullUser"
            android:keepScreenOn="true"
            android:lockTaskMode="if_whitelisted"
            android:resizeableActivity="false"`],
  ['android.intent.category.HOME', `<category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>`, `<category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- Permite escolher o terminal como tela inicial do tablet (quiosque sem MDM). -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.HOME" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>`],
  ['.KioskAdminReceiver', '<provider', `<receiver
            android:name=".KioskAdminReceiver"
            android:permission="android.permission.BIND_DEVICE_ADMIN"
            android:exported="true">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/kiosk_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>

        <provider`],
  ['.BootReceiver', '<provider', `<receiver
            android:name=".BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

        <provider`],
  ['RECEIVE_BOOT_COMPLETED', '<uses-permission android:name="android.permission.INTERNET" />', `<uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />`],
]);

// 3) Tema: sem barras, ocupando a área do entalhe da câmera.
patch('res/values/styles.xml', [
  ['windowLayoutInDisplayCutoutMode', '<item name="android:background">@null</item>', `<item name="android:background">@null</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>`],
  ['@drawable/splash</item>\n        <item name="android:windowFullscreen">', '<item name="android:background">@drawable/splash</item>', `<item name="android:background">@drawable/splash</item>
        <item name="android:windowFullscreen">true</item>`],
]);

console.log(`Terminal em tela cheia aplicado em ${project}`);
