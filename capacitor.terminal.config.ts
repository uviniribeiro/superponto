import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração do app dedicado "Ponto Max Terminal".
 * Abre diretamente a rota /terminal (apenas login do terminal).
 *
 * Build:
 *   npx cap sync android --config capacitor.terminal.config.ts
 *   cd android && ./gradlew assembleRelease
 * Publique o .apk gerado em public/downloads/ponto-max-terminal.apk
 */
const config: CapacitorConfig = {
  appId: 'br.com.pontomax.terminal',
  appName: 'Ponto Max Terminal',
  webDir: 'dist',
  server: {
    url: 'https://superponto.lovable.app/terminal',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
