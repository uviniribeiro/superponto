import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração dos dois apps móveis do PontoMax, escolhidos por PONTOMAX_APP no build:
 *
 *   funcionario  app do celular do funcionário (registro de ponto com GPS e selfie)
 *   terminal     app do tablet/terminal fixo da empresa (QR Code, teclado e facial)
 *
 * A interface vai empacotada dentro do app; ele só fala com a API da VPS
 * (VITE_SUPABASE_URL definido no build). Use scripts/build-mobile.sh para gerar os APKs.
 */
const app = process.env.PONTOMAX_APP === 'terminal' ? 'terminal' : 'funcionario';

const variants = {
  funcionario: {
    appId: 'br.com.pontomax.app',
    appName: 'PontoMax',
    androidPath: 'android-funcionario',
    iosPath: 'ios-funcionario',
    color: '#0f172a',
  },
  terminal: {
    appId: 'br.com.pontomax.terminal',
    appName: 'SuperPonto Terminal',
    androidPath: 'android-terminal',
    iosPath: 'ios-terminal',
    color: '#0f172a',
  },
} as const;

const v = variants[app];

const config: CapacitorConfig = {
  appId: v.appId,
  appName: v.appName,
  webDir: 'dist',
  server: {
    // Origem do app: https://localhost (Android) e capacitor://localhost (iOS),
    // liberadas no CORS da VPS pelo instalador.
    androidScheme: 'https',
    // Terminal: libera HTTP só para falar com a catraca na rede local (o app e a API seguem em HTTPS).
    cleartext: app === 'terminal',
  },
  android: {
    path: v.androidPath,
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    path: v.iosPath,
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: v.color,
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: v.color,
    },
  },
};

export default config;
