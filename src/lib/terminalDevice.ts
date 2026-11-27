// Recursos do aparelho do terminal (plugin nativo "TerminalDevice" no APK Android):
// rede local e busca da catraca, leitura de cartão NFC (MIFARE / ISO 14443) e atalhos do sistema.
// No navegador, o NFC usa o Web NFC (Chrome no Android) quando disponível; a busca na rede não existe.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface TerminalDevicePlugin {
  getNetworkInfo(): Promise<{ ip: string | null; model: string; android: string; nfc: boolean }>;
  scanLan(opts?: { timeoutMs?: number }): Promise<{ ip: string; devices: { ip: string; kind: 'controlid' | 'http' }[] }>;
  startNfc(): Promise<void>;
  stopNfc(): Promise<void>;
  openWifiSettings(): Promise<void>;
  openSystemSettings(): Promise<void>;
  exitKiosk(): Promise<void>;
  addListener(event: 'nfcTag', cb: (tag: { uid: string; decimal: string; tech: string[] }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<TerminalDevicePlugin>('TerminalDevice');
export const isNativeTerminal = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function deviceInfo() {
  if (!isNativeTerminal()) return { ip: null, model: navigator.userAgent.split(')')[0].split('(')[1] ?? 'Navegador', android: '', nfc: 'NDEFReader' in window };
  try { return await Native.getNetworkInfo(); } catch { return { ip: null, model: 'Android', android: '', nfc: false }; }
}

export async function scanLan() {
  if (!isNativeTerminal()) throw new Error('A busca na rede funciona no app do terminal (APK).');
  return Native.scanLan({ timeoutMs: 350 });
}

/** Começa a ler cartões; devolve a função para parar. */
export async function startCardReader(onCard: (uid: string, decimal?: string) => void): Promise<() => void> {
  if (isNativeTerminal()) {
    const h = await Native.addListener('nfcTag', (t) => onCard(t.uid, t.decimal));
    await Native.startNfc();
    return () => { h.remove(); Native.stopNfc().catch(() => undefined); };
  }
  const NDEF = (window as any).NDEFReader;
  if (!NDEF) throw new Error('Sem NFC neste aparelho');
  const reader = new NDEF();
  const ctl = new AbortController();
  await reader.scan({ signal: ctl.signal });
  reader.onreading = (e: any) => { const sn = String(e.serialNumber ?? '').replace(/:/g, '').toUpperCase(); if (sn) onCard(sn); };
  return () => ctl.abort();
}

export const openWifiSettings = () => (isNativeTerminal() ? Native.openWifiSettings() : Promise.resolve());
export const openSystemSettings = () => (isNativeTerminal() ? Native.openSystemSettings() : Promise.resolve());
export const exitKiosk = () => (isNativeTerminal() ? Native.exitKiosk() : Promise.resolve());

/** Senha do administrador do terminal (guardada só como hash no aparelho). */
export async function hashPin(pin: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`superponto-terminal|${pin}`));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
