// Leitura de QR Code e códigos de barras (Code 128, EAN, Code 39, ITF, Codabar…) pela câmera,
// com o detector nativo do navegador quando existe e o ZXing como alternativa; e leitores
// USB/Bluetooth que "digitam" o código seguido de Enter.
import { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

const WANTED = ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'code_93', 'itf', 'upc_a', 'upc_e', 'codabar'];
let detector: any | null | undefined;
let zxing: { reader: any; lib: any } | null | undefined;

async function nativeDetector() {
  if (detector !== undefined) return detector;
  const BD = (window as any).BarcodeDetector;
  if (!BD) return (detector = null);
  try {
    const supported: string[] = (await BD.getSupportedFormats?.()) ?? WANTED;
    const formats = WANTED.filter((f) => supported.includes(f));
    detector = formats.length ? new BD({ formats }) : null;
  } catch {
    detector = null;
  }
  return detector;
}

async function zxingReader() {
  if (zxing !== undefined) return zxing;
  try {
    const lib = await import('@zxing/library');
    const hints = new Map();
    hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
      lib.BarcodeFormat.CODE_128, lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8, lib.BarcodeFormat.CODE_39,
      lib.BarcodeFormat.CODE_93, lib.BarcodeFormat.ITF, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.CODABAR, lib.BarcodeFormat.QR_CODE,
    ]);
    hints.set(lib.DecodeHintType.TRY_HARDER, true);
    const reader = new lib.MultiFormatReader();
    reader.setHints(hints);
    zxing = { reader, lib };
  } catch {
    zxing = null;
  }
  return zxing;
}

/** Lê um código no quadro atual do vídeo. `kind: 'qr'` só QR; `'any'` qualquer formato suportado. */
export async function scanVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, kind: 'qr' | 'any'): Promise<string | null> {
  if (!video.videoWidth) return null;
  const det = await nativeDetector();
  if (det) {
    try {
      const found = await det.detect(video);
      const hit = found.find((f: any) => kind === 'any' || f.format === 'qr_code');
      if (hit?.rawValue) return String(hit.rawValue).trim();
      if (kind === 'qr') return null;
    } catch { /* cai para as alternativas */ }
  }
  const scale = Math.min(1, 960 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const qr = jsQR(img.data, img.width, img.height)?.data;
  if (qr) return qr.trim();
  if (kind === 'qr' || det) return null;
  const z = await zxingReader();
  if (!z) return null;
  try {
    const source = new z.lib.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new z.lib.BinaryBitmap(new z.lib.HybridBinarizer(source));
    return String(z.reader.decodeWithState(bitmap).getText()).trim();
  } catch {
    return null;
  } finally {
    z.reader.reset();
  }
}

/**
 * Leitor de código de barras "teclado" (USB/Bluetooth): caracteres digitados muito rápido e
 * terminados em Enter viram uma leitura. Não interfere quando o foco está num campo de texto.
 */
export function useBarcodeWedge(onCode: (code: string) => void, enabled = true) {
  const buf = useRef('');
  const last = useRef(0);
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const now = Date.now();
      if (now - last.current > 60) buf.current = '';
      last.current = now;
      if (e.key === 'Enter') {
        if (buf.current.length >= 4) cb.current(buf.current);
        buf.current = '';
      } else if (e.key.length === 1) {
        buf.current += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
