// App de terminal de ponto (independente do sistema): atende clientes da v1 e da v2 — a versão é
// identificada pelo CNPJ na ativação. Espera com data e hora; a câmera percebe quem se aproxima e abre
// a escolha do método. Toda marcação é conferida (rosto, ou duas verificações quando a v2 não tem foto).
// Sem internet, a marcação fica guardada no aparelho e é conferida e enviada quando a conexão voltar.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { toast } from 'sonner';
import {
  Loader2, MonitorSmartphone, QrCode, Barcode, ScanFace, Delete, KeyRound, CameraOff, IdCard, Hash,
  LogOut, CheckCircle2, AlertCircle, Wifi, WifiOff, Wrench, ArrowLeft, CloudUpload, ShieldCheck,
} from 'lucide-react';
import {
  backendFor, flushQueue, OfflineError, readQueue, readRejected, resolveVersion, writeQueue, clearRejected, receiptUrl,
  type QueuedPunch, type SystemVersion, type TerminalMethod, type TerminalResult,
} from '@/lib/terminalBackend';
import { scanVideoFrame, useBarcodeWedge } from '@/lib/barcodeScan';
import QRCode from 'qrcode';

/** Desafios aleatórios da prova de vida (a câmera é espelhada: "esquerda" na tela). */
const CHALLENGES: { key: string; text: string }[] = [
  { key: 'left', text: 'Vire levemente o rosto para o seu lado ESQUERDO' },
  { key: 'right', text: 'Vire levemente o rosto para o seu lado DIREITO' },
  { key: 'closer', text: 'Aproxime o rosto da câmera' },
  { key: 'up', text: 'Levante levemente o queixo' },
];
const NEXT_LABEL: Record<string, string> = { entry: 'Início do intervalo', break_start: 'Fim do intervalo', break_end: 'Saída' };

const STORAGE_KEY = 'pontomax.kiosk.session';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';
type Stage = 'idle' | 'select' | 'scan' | 'keypad' | 'face' | 'second';
type Method = TerminalMethod;

const RECORD_LABELS: Record<RecordType, string> = {
  entry: 'Entrada',
  break_start: 'Início do intervalo',
  break_end: 'Fim do intervalo',
  exit: 'Saída',
};

const METHODS: { key: Method; label: string; icon: typeof QrCode }[] = [
  { key: 'facial', label: 'Reconhecimento facial', icon: ScanFace },
  { key: 'qrcode', label: 'QR Code', icon: QrCode },
  { key: 'barcode', label: 'Código de barras', icon: Barcode },
  { key: 'pin', label: 'PIN', icon: KeyRound },
  { key: 'registration', label: 'Matrícula', icon: Hash },
  { key: 'cpf', label: 'CPF', icon: IdCard },
];
const LABEL: Record<Method, string> = Object.fromEntries(METHODS.map((m) => [m.key, m.label])) as Record<Method, string>;
const KEYPAD_LABEL: Partial<Record<Method, string>> = { pin: 'Digite o seu PIN', registration: 'Digite a sua matrícula', cpf: 'Digite o seu CPF' };

interface KioskSession {
  deviceToken: string;
  terminalName: string;
  companyName: string;
  status?: string;
  activationCode?: string | null;
  version?: SystemVersion;
  /** 'meal' = terminal do refeitório */
  purpose?: string;
}

const IDLE_AFTER_MS = 25_000;

/** Manifesto próprio: instalado, o terminal vira um app separado ("SuperPonto Terminal"). */
function useTerminalManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.href;
    if (link) link.href = '/terminal.webmanifest';
    document.title = 'SuperPonto Terminal';
    return () => { if (link && prev) link.href = prev; };
  }, []);
}

export default function KioskTerminal() {
  useTerminalManifest();
  const [session, setSession] = useState<KioskSession | null>(null);
  const [booting, setBooting] = useState(true);

  // Ativação
  const [cnpj, setCnpj] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Conexão e fila offline
  const [online, setOnline] = useState(true);
  const [maintenance] = useState<{ reason?: string | null } | null>(null);
  const [queueSize, setQueueSize] = useState(readQueue().length);
  const [rejected, setRejected] = useState(readRejected());
  const flushing = useRef(false);
  const backend = backendFor(session?.version);

  // Fluxo
  const [stage, setStageState] = useState<Stage>('idle');
  const stageRef = useRef<Stage>('idle');
  const [method, setMethod] = useState<Method>('facial');
  const methodRef = useRef<Method>('facial');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ label: string; time: string; nsr: number | string; name: string; offline?: boolean; qr?: string; next?: string } | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  /** Primeira identificação (aguardando rosto ou segunda verificação). */
  const pendingRef = useRef<{ method: Method; value: string; name: string; offline?: boolean } | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [secondOptions, setSecondOptions] = useState<Method[]>([]);
  const secondRef = useRef(false);
  const lastActivity = useRef(Date.now());

  // Câmera
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<'user' | 'environment' | null>(null);
  const busyRef = useRef(false);
  const stableFrames = useRef(0);
  const prevFrame = useRef<Uint8ClampedArray | null>(null);
  const faceDetectorRef = useRef<any>(null);
  const faceSince = useRef(0);
  const cooldownUntil = useRef(0);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---------------- Conexão ----------------
  const sync = useCallback(async () => {
    if (!session || flushing.current || session.status !== 'approved') return;
    flushing.current = true;
    try {
      await backend.health();
      setOnline(true);
      if (readQueue().length) {
        const r = await flushQueue(backend, session.deviceToken);
        if (r.sent) toast.success(`${r.sent} marcação(ões) offline conferida(s) e enviada(s).`);
        if (r.rejected) toast.error(`${r.rejected} marcação(ões) offline recusada(s) na conferência.`);
      }
    } catch (e) {
      if (e instanceof OfflineError) setOnline(false);
    } finally {
      setQueueSize(readQueue().length);
      setRejected(readRejected());
      flushing.current = false;
    }
  }, [backend, session]);

  useEffect(() => {
    sync();
    const t = setInterval(sync, 20_000);
    const back = () => sync();
    window.addEventListener('online', back);
    return () => { clearInterval(t); window.removeEventListener('online', back); };
  }, [sync]);

  // ---------------- Sessão persistente ----------------
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setBooting(false); return; }
    try {
      const saved = JSON.parse(raw) as KioskSession;
      setSession(saved);
      backendFor(saved.version).session(saved.deviceToken)
        .then((res) => {
          if (res?.success) {
            const t = res.terminal as any, c = res.company as any;
            const updated = { ...saved, terminalName: t?.name ?? saved.terminalName, companyName: c?.name ?? saved.companyName, status: t?.status, activationCode: t?.activationCode, purpose: t?.purpose ?? saved.purpose };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setSession(updated);
          } else if (res?.code === 'terminal_invalid') {
            localStorage.removeItem(STORAGE_KEY);
            setSession(null);
          }
        })
        .catch(() => undefined) // offline: segue com a sessão salva
        .finally(() => setBooting(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setBooting(false);
    }
  }, []);

  // Enquanto aguarda liberação, confere a cada 15 s
  useEffect(() => {
    if (!session || session.status === 'approved') return;
    const t = setInterval(() => {
      backendFor(session.version).session(session.deviceToken).then((res) => {
        const st = (res.terminal as any)?.status;
        if (res.success && st && st !== session.status) {
          const updated = { ...session, status: st, activationCode: (res.terminal as any)?.activationCode, purpose: (res.terminal as any)?.purpose ?? session.purpose };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          setSession(updated);
        }
      }).catch(() => undefined);
    }, 15_000);
    return () => clearInterval(t);
  }, [session]);

  const handleActivate = async () => {
    setActivationError(null);
    setActivating(true);
    try {
      const version = await resolveVersion(cnpj);
      if (!version) {
        setActivationError('CNPJ não encontrado ou não liberado. Confira o número ou fale com o administrador.');
        return;
      }
      const coords = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });
      const res = await backendFor(version).activate(cnpj, terminalName, { latitude: coords?.coords.latitude ?? null, longitude: coords?.coords.longitude ?? null });
      if (!res?.success) {
        setActivationError(res?.error || 'Não foi possível ativar o terminal.');
        return;
      }
      const t = res.terminal as any, c = res.company as any;
      const newSession: KioskSession = {
        deviceToken: String(res.deviceToken), terminalName: t?.name ?? terminalName, companyName: c?.name ?? '',
        status: String(res.status ?? 'pending'), activationCode: (res.activationCode as string) ?? null, version,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Terminal cadastrado em ${newSession.companyName} (${version === 'v2' ? 'SuperPonto v2' : 'SuperPonto v1'}).`);
    } catch {
      setActivationError('Não foi possível falar com o servidor agora. Confira a internet e tente novamente.');
    } finally {
      setActivating(false);
    }
  };

  const setStage = useCallback((st: Stage) => { stageRef.current = st; setStageState(st); lastActivity.current = Date.now(); }, []);
  const touch = () => { lastActivity.current = Date.now(); };

  // ---------------- Câmera ----------------
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    facingRef.current = null;
    prevFrame.current = null;
  }, []);

  const openCamera = useCallback(async (facing: 'user' | 'environment') => {
    if (streamRef.current && facingRef.current === facing) return true;
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      facingRef.current = facing;
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      return true;
    } catch (e: any) {
      setCameraError(e?.name === 'NotAllowedError'
        ? 'Permissão de câmera negada. Libere o acesso à câmera nas configurações do navegador do terminal.'
        : 'Não foi possível acessar a câmera deste terminal.');
      return false;
    }
  }, [stopCamera]);

  // O <video> fica sempre montado; reconecta o stream se o elemento for recriado.
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  });

  useEffect(() => () => stopCamera(), [stopCamera]);

  const videoReady = () => {
    const v = videoRef.current;
    return !!v && v.readyState >= v.HAVE_CURRENT_DATA && v.videoWidth > 0;
  };

  const captureFrame = (maxWidth = 480) => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !videoReady()) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  };

  /** Há um rosto enquadrado? FaceDetector nativo quando existe; senão, contraste na região central. */
  const faceInFrame = async () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !videoReady()) return false;
    try {
      const FD = (window as any).FaceDetector;
      if (FD) {
        if (!faceDetectorRef.current) faceDetectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 1 });
        return (await faceDetectorRef.current.detect(video)).length > 0;
      }
    } catch { /* usa a heurística */ }
    const ctx = canvas.getContext('2d');
    canvas.width = 160; canvas.height = 120;
    ctx?.drawImage(video, 0, 0, 160, 120);
    const img = ctx?.getImageData(40, 20, 80, 80);
    if (!img) return false;
    let sum = 0, sumSq = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const l = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
      sum += l; sumSq += l * l;
    }
    const n = img.data.length / 4, mean = sum / n;
    return sumSq / n - mean * mean > 350 && mean > 40 && mean < 225;
  };

  /** Presença diante do terminal: rosto detectado ou movimento significativo perto da câmera. */
  const presence = async () => {
    const FD = (window as any).FaceDetector;
    if (FD) return faceInFrame();
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !videoReady()) return false;
    const ctx = canvas.getContext('2d');
    canvas.width = 48; canvas.height = 36;
    ctx?.drawImage(video, 0, 0, 48, 36);
    const data = ctx?.getImageData(0, 0, 48, 36).data;
    if (!data) return false;
    const gray = new Uint8ClampedArray(48 * 36);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) gray[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const prev = prevFrame.current;
    prevFrame.current = gray;
    if (!prev) return false;
    let diff = 0;
    for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
    return diff / gray.length > 12;
  };


  // ---------------- Fluxo ----------------
  const reset = () => {
    pendingRef.current = null;
    secondRef.current = false;
    setPendingName(null);
    setSecondOptions([]);
    setIdentifier('');
  };

  const goIdle = useCallback(async () => {
    reset();
    setError(null);
    setHint('');
    stableFrames.current = 0;
    setStage('idle');
    await openCamera('user');
  }, [openCamera, setStage]);

  const showError = useCallback((msg: string) => {
    setError(msg);
    reset();
    setStage('select');
    setTimeout(() => { if (stageRef.current === 'select') setError(null); }, 3500);
  }, [setStage]);

  const queueOffline = useCallback((item: Omit<QueuedPunch, 'id' | 'at'>, name?: string) => {
    const at = new Date();
    const ok = writeQueue([...readQueue(), { ...item, id: crypto.randomUUID(), at: at.toISOString() }]);
    setQueueSize(readQueue().length);
    if (!ok) return showError('Memória do terminal cheia: conecte à internet para enviar as marcações guardadas.');
    setOnline(false);
    setSuccess({ label: 'Marcação guardada', time: at.toLocaleTimeString('pt-BR'), nsr: 'offline', name: name || 'Será conferida quando a internet voltar', offline: true });
    stageRef.current = 'idle';
    setTimeout(() => { setSuccess(null); goIdle(); }, 2600);
  }, [goIdle, showError]);

  const handleResult = useCallback((res: TerminalResult) => {
    if (res?.success && res.meal) {
      setSuccess({ label: `${res.meal.meal_name} registrado`, time: new Date(res.meal.recorded_at).toLocaleTimeString('pt-BR'), nsr: 'refeitório', name: res.employeeName || '' });
      stageRef.current = 'idle';
      setTimeout(() => { setSuccess(null); goIdle(); }, 2600);
      return;
    }
    if (res?.code === 'meal_limit') {
      setRefused(res.error || 'Refeição já registrada hoje.');
      stageRef.current = 'idle';
      setTimeout(() => { setRefused(null); goIdle(); }, 3500);
      return;
    }
    if (res?.success && res.record) {
      const rec = res.record;
      const base = {
        label: rec.record_type ? `${RECORD_LABELS[rec.record_type as RecordType] ?? 'Marcação'} registrada` : 'Ponto registrado',
        time: new Date(rec.recorded_at).toLocaleTimeString('pt-BR'),
        nsr: rec.nsr,
        name: res.employeeName || '',
        next: rec.record_type ? NEXT_LABEL[rec.record_type] : undefined,
      };
      setSuccess(base);
      // Comprovante: QR Code para o funcionário abrir no celular
      if (rec.transaction_hash) {
        QRCode.toDataURL(receiptUrl(session?.version, rec.transaction_hash), { width: 220, margin: 1 }).then((qr) => setSuccess((s) => (s ? { ...s, qr } : s))).catch(() => undefined);
      }
      stageRef.current = 'idle';
      setTimeout(() => { setSuccess(null); goIdle(); }, rec.transaction_hash ? 6000 : 2600);
      return;
    }
    if (res?.code === 'liveness_failed') {
      setRefused(res.error || 'Registro recusado: prova de vida não confirmada.');
      stageRef.current = 'idle';
      setTimeout(() => { setRefused(null); goIdle(); }, 3500);
      return;
    }
    if (res?.code === 'face_mismatch' || res?.code === 'factor_mismatch') {
      setRefused(res.error || 'Registro recusado, pessoa divergente da identificação.');
      stageRef.current = 'idle';
      setTimeout(() => { setRefused(null); goIdle(); }, 3500);
      return;
    }
    if (res?.code === 'terminal_invalid') {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      return;
    }
    showError(res?.error || 'Não foi possível concluir o registro.');
  }, [goIdle, showError]);

  /** Identificação (QR, código de barras, PIN, matrícula ou CPF). */
  const identify = useCallback(async (raw: string) => {
    if (!session || !raw.trim()) return;
    const value = raw.trim();
    const m = methodRef.current;
    // Segunda verificação (v2, funcionário sem foto)
    if (secondRef.current && pendingRef.current) {
      const first = pendingRef.current;
      if (m === first.method) return showError('Use uma verificação diferente da primeira.');
      setBusy(true);
      try {
        handleResult(await backend.verifyTwoFactor(session.deviceToken, { method: first.method, value: first.value }, { method: m, value }));
      } catch (e) {
        if (e instanceof OfflineError) queueOffline({ kind: 'twoFactor', method: first.method, value: first.value, second: { method: m, value }, label: `${first.name} (${LABEL[first.method]} + ${LABEL[m]})` }, first.name);
        else showError('Erro ao registrar.');
      } finally {
        setBusy(false);
        setIdentifier('');
      }
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await backend.identify(session.deviceToken, m, value);
      if (!res?.success) return handleResult(res);
      const full = res.employee?.full_name || 'Funcionário';
      const first = full.split(' ')[0];
      pendingRef.current = { method: m, value, name: first };
      setPendingName(full);
      if (res.requireSecond) {
        // Sem foto cadastrada (v2): pede uma segunda verificação diferente.
        secondRef.current = true;
        setSecondOptions((res.options ?? []).filter((o) => o !== m));
        setStage('second');
        return;
      }
      setHint(`${first}, olhe para a câmera`);
      stableFrames.current = 0;
      faceSince.current = Date.now();
      await openCamera('user');
      setStage('face');
    } catch (e) {
      if (e instanceof OfflineError) {
        // Sem internet: guarda a identificação e a foto do rosto; a conferência acontece ao reconectar.
        pendingRef.current = { method: m, value, name: '', offline: true };
        setPendingName(null);
        setHint('Sem internet: olhe para a câmera para guardar a marcação');
        stableFrames.current = 0;
        faceSince.current = Date.now();
        await openCamera('user');
        setStage('face');
      } else showError('Erro ao identificar.');
    } finally {
      setBusy(false);
      setIdentifier('');
    }
  }, [backend, handleResult, openCamera, queueOffline, session, setStage, showError]);

  const submitFace = useCallback(async (selfie: string, live: { selfie2?: string; challenge?: string } = {}) => {
    if (!session) return;
    const pending = pendingRef.current;
    if (pending?.offline) {
      return queueOffline({ kind: 'face', method: pending.method, value: pending.value, selfie, ...live, label: `${LABEL[pending.method]} ${pending.method === 'pin' ? '••••' : pending.value}` });
    }
    setHint(pending ? 'Conferindo o rosto com a identificação…' : 'Reconhecendo…');
    try {
      const res = pending
        ? await backend.verifyFace(session.deviceToken, pending.method, pending.value, selfie, { clientPunchId: crypto.randomUUID(), ...live })
        : await backend.identifyFace(session.deviceToken, selfie, { clientPunchId: crypto.randomUUID(), ...live });
      if (res?.code === 'liveness_retry') { cooldownUntil.current = Date.now() + 600; setHint(res.error || 'Siga a instrução na tela.'); return; }
      if (res?.code === 'no_face') { cooldownUntil.current = Date.now() + 800; setHint(pending ? `${pending.name}, olhe para a câmera` : 'Posicione o rosto no centro'); return; }
      if (!pending && !res?.success && (res?.code === 'not_recognized' || (!res?.code && res?.error))) {
        setHint(res.error || 'Rosto não reconhecido.');
        cooldownUntil.current = Date.now() + 1500;
        return;
      }
      handleResult(res);
    } catch (e) {
      if (e instanceof OfflineError) {
        queueOffline(pending ? { kind: 'face', method: pending.method, value: pending.value, selfie, ...live, label: pending.name } : { kind: 'faceN', selfie, ...live, label: 'Reconhecimento facial' }, pending?.name);
      } else showError('Erro ao conferir o rosto.');
    }
  }, [backend, handleResult, queueOffline, session, showError]);

  const chooseMethod = useCallback(async (m: Method) => {
    touch();
    setMethod(m);
    methodRef.current = m;
    setError(null);
    stableFrames.current = 0;
    if (!secondRef.current) { pendingRef.current = null; setPendingName(null); }
    if (m === 'facial') {
      setHint('Posicione o rosto no centro');
      faceSince.current = Date.now();
      await openCamera('user');
      setStage('face');
    } else if (m === 'qrcode' || m === 'barcode') {
      setHint(m === 'qrcode' ? 'Mostre o QR Code para a câmera' : 'Mostre o código de barras do crachá para a câmera (ou passe no leitor)');
      await openCamera(m === 'barcode' && facingRef.current !== 'user' ? 'environment' : 'user');
      setStage('scan');
    } else {
      setIdentifier('');
      setStage('keypad');
    }
  }, [openCamera, setStage]);

  // Leitor de código de barras USB/Bluetooth: funciona na espera, na escolha e na leitura.
  useBarcodeWedge((code) => {
    if (!session || session.status !== 'approved') return;
    const st = stageRef.current;
    if (st !== 'idle' && st !== 'select' && st !== 'scan' && st !== 'second') return;
    methodRef.current = code.startsWith('SPQR') ? 'qrcode' : 'barcode';
    setMethod(methodRef.current);
    identify(code);
  }, !!session);

  // Laço único: presença na espera, leitura de código e captura do rosto.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(async () => {
      if (busyRef.current) return;
      const st = stageRef.current;
      if (st !== 'idle' && st !== 'face' && Date.now() - lastActivity.current > IDLE_AFTER_MS) { goIdle(); return; }
      busyRef.current = true;
      try {
        if (st === 'idle') {
          if (!streamRef.current) { await openCamera('user'); return; }
          if (await presence()) {
            stableFrames.current += 1;
            if (stableFrames.current >= 2) { stableFrames.current = 0; setStage('select'); }
          } else stableFrames.current = 0;
        } else if (st === 'scan') {
          const v = videoRef.current, c = canvasRef.current;
          const code = v && c ? await scanVideoFrame(v, c, methodRef.current === 'qrcode' ? 'qr' : 'any') : null;
          if (code) await identify(code);
        } else if (st === 'face') {
          if (Date.now() - faceSince.current > 20_000) { showError('Tempo esgotado para a verificação facial.'); return; }
          if (Date.now() < cooldownUntil.current) return;
          if (await faceInFrame()) {
            stableFrames.current += 1;
            if (stableFrames.current >= 2) {
              stableFrames.current = 0;
              const width = pendingRef.current?.offline || !online ? 360 : 480;
              const frame = captureFrame(width);
              if (frame) {
                // Prova de vida: desafio aleatório e segunda foto ~1,2 s depois
                const ch = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
                setChallenge(ch.text);
                await new Promise((r) => setTimeout(r, 1200));
                const frame2 = captureFrame(width);
                setChallenge(null);
                await submitFace(frame, frame2 ? { selfie2: frame2, challenge: ch.key } : {});
              }
            }
          } else {
            stableFrames.current = 0;
            setHint(pendingRef.current?.name ? `${pendingRef.current.name}, olhe para a câmera` : pendingRef.current?.offline ? 'Sem internet: olhe para a câmera para guardar a marcação' : 'Posicione o rosto no centro');
          }
        }
      } finally {
        busyRef.current = false;
      }
    }, 250);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, goIdle, identify, submitFace, openCamera, setStage, showError, online]);

  // Câmera ligada desde a espera (detecção de presença)
  useEffect(() => {
    if (session && session.status === 'approved') openCamera('user');
  }, [session, openCamera]);

  const handleExitTerminal = () => {
    stopCamera();
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---------------- Ativação por CNPJ ----------------
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <MonitorSmartphone className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Terminal de Ponto</CardTitle>
            <CardDescription>
              Ative este aparelho com o CNPJ da empresa. O app identifica sozinho se a empresa usa a v1 ou a v2 e,
              depois da liberação do administrador, fica conectado e serve só para registrar ponto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kiosk-cnpj">CNPJ da empresa</Label>
              <CnpjInput id="kiosk-cnpj" value={cnpj} onChange={setCnpj} showHintWhenEmpty />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terminal-name">Nome do terminal (opcional)</Label>
              <Input
                id="terminal-name"
                placeholder="Ex.: Recepção — Portaria 1"
                value={terminalName}
                onChange={(e) => setTerminalName(e.target.value)}
              />
            </div>

            {activationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível ativar</AlertTitle>
                <AlertDescription>{activationError}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full" onClick={handleActivate} disabled={activating}>
              {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ativar terminal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingApproval = session.status && session.status !== 'approved';
  const dateStr = clock.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const showVideo = stage === 'scan' || stage === 'face';

  // ---------------- Terminal ativo ----------------
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-muted/50 p-3 md:p-6" onPointerDown={touch} onKeyDown={touch}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md animate-in fade-in-0 duration-200" role="status" aria-live="assertive">
          <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/40 bg-background/80 px-10 py-9 text-center shadow-2xl animate-in zoom-in-90 duration-300">
            <div className={`flex h-20 w-20 items-center justify-center rounded-3xl text-white animate-in zoom-in-50 spin-in-12 duration-500 ${success.offline ? 'bg-amber-500 shadow-[0_12px_40px_-8px_rgba(245,158,11,.7)]' : 'bg-emerald-500 shadow-[0_12px_40px_-8px_rgba(16,185,129,.7)]'}`}>
              {success.offline ? <CloudUpload className="h-11 w-11" /> : <CheckCircle2 className="h-11 w-11" />}
            </div>
            <p className="text-2xl font-bold">{success.label}</p>
            <p className="text-lg">{success.name}</p>
            <p className="text-sm text-muted-foreground tabular-nums">{success.offline ? `${success.time} · sem internet — será conferida e enviada ao reconectar` : success.nsr === 'refeitório' ? `${success.time} · refeitório` : `${success.time} · NSR ${success.nsr}`}</p>
            {success.next && <p className="text-sm">Próxima marcação: <strong>{success.next}</strong></p>}
            {success.qr && (
              <div className="mt-1 flex flex-col items-center gap-1">
                <img src={success.qr} alt="QR Code do comprovante" className="h-36 w-36 rounded-xl bg-white p-1" />
                <p className="text-xs text-muted-foreground">Aponte a câmera do celular para baixar o comprovante</p>
              </div>
            )}
          </div>
        </div>
      )}
      {refused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md animate-in fade-in-0 duration-200" role="alert" aria-live="assertive">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-[32px] border border-destructive/40 bg-background/90 px-10 py-9 text-center shadow-2xl animate-in zoom-in-90 duration-300">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive text-destructive-foreground shadow-[0_12px_40px_-8px_rgba(239,68,68,.7)]">
              <AlertCircle className="h-11 w-11" />
            </div>
            <p className="text-2xl font-bold text-destructive">Registro recusado</p>
            <p className="text-lg">{refused.replace(/^Registro recusado,\s*/i, '').replace(/^./, (c) => c.toUpperCase())}</p>
          </div>
        </div>
      )}

      {stage === 'idle' ? (
        // ---------------- Espera: data e hora; a câmera detecta quem se aproxima ----------------
        <button type="button" onClick={() => setStage('select')} className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 text-center outline-none" aria-label="Iniciar registro de ponto">
          <p className="text-lg text-muted-foreground">{session.companyName} · {session.terminalName}{session.purpose === 'meal' ? ' · Refeitório' : ''}</p>
          <p className="text-[18vw] font-bold leading-none tabular-nums tracking-tight md:text-[12rem]">{timeStr}</p>
          <p className="text-4xl font-semibold tabular-nums md:text-6xl">{dateStr}</p>
          <p className="mt-6 flex items-center gap-2 text-muted-foreground"><ScanFace className="h-5 w-5" /> {session.purpose === 'meal' ? 'Aproxime-se da câmera para registrar a refeição' : 'Aproxime-se da câmera para registrar o ponto'}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Badge variant={online ? 'secondary' : 'destructive'} className="gap-1">{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? 'Conectado' : 'Reconectando...'}</Badge>
            {maintenance && <Badge variant="outline" className="gap-1"><Wrench className="h-3 w-3" /> Manutenção — registro liberado</Badge>}
            {queueSize > 0 && <Badge variant="outline" className="gap-1"><CloudUpload className="h-3 w-3" /> {queueSize} offline aguardando envio</Badge>}
            <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> {session.version === 'v2' ? 'SuperPonto v2' : 'SuperPonto v1'}</Badge>
          </div>
          {pendingApproval && <p className="text-sm text-amber-600">Aguardando liberação do administrador — código <strong>{session.activationCode}</strong></p>}
          {cameraError && <p className="flex items-center gap-2 text-sm text-destructive"><CameraOff className="h-4 w-4" /> {cameraError} Toque na tela para registrar.</p>}
          {/* Câmera da detecção de presença (invisível) */}
          <video ref={videoRef} className="pointer-events-none fixed bottom-0 right-0 h-4 w-4 opacity-0" muted playsInline autoPlay aria-hidden />
        </button>
      ) : (
        <>
          <header className="relative z-10 mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur-xl md:p-5">
            <div>
              <p className="text-sm text-muted-foreground">{session.companyName}</p>
              <h1 className="text-xl font-semibold">{session.terminalName}</h1>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant={online ? 'secondary' : 'destructive'} className="gap-1">{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? 'Conectado' : 'Sem internet — marcações ficam guardadas'}</Badge>
                {queueSize > 0 && <Badge variant="outline" className="gap-1"><CloudUpload className="h-3 w-3" /> {queueSize} na fila</Badge>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums md:text-5xl">{timeStr}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{dateStr}</p>
            </div>
          </header>

          <main className="relative z-10 mx-auto mt-4 w-full max-w-4xl flex-1 space-y-4">
            {pendingApproval && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Aguardando liberação do administrador</AlertTitle>
                <AlertDescription>Informe o código <strong>{session.activationCode}</strong> ao administrador para liberar este terminal.</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível continuar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {stage === 'second' && (
              <>
                <p className="text-center text-xl font-semibold">{pendingName}, confirme com uma segunda verificação</p>
                <p className="text-center text-sm text-muted-foreground">Seu cadastro não tem foto: use também uma destas opções.</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {METHODS.filter((m) => secondOptions.includes(m.key)).map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => chooseMethod(key)} aria-label={label}
                      className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/60 bg-background/70 p-6 backdrop-blur-xl transition-all duration-200 hover:bg-muted active:scale-95 md:p-8">
                      <Icon className="h-10 w-10 text-primary md:h-12 md:w-12" />
                      <span className="text-center text-sm font-semibold md:text-base">{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === 'select' && (
              <>
                <p className="text-center text-xl font-semibold">Como você quer se identificar?</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {METHODS.map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => chooseMethod(key)} aria-label={label}
                      className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/60 bg-background/70 p-6 backdrop-blur-xl transition-all duration-200 hover:bg-muted active:scale-95 md:p-8">
                      <Icon className="h-10 w-10 text-primary md:h-12 md:w-12" />
                      <span className="text-center text-sm font-semibold md:text-base">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground">Em todos os métodos o rosto é conferido com a foto do cadastro{session.version === 'v2' ? ' (sem foto: duas verificações)' : ''}.</p>
                {rejected.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{rejected.length} marcação(ões) offline recusada(s) na conferência</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 space-y-0.5 text-xs">{rejected.slice(-5).map((r, i) => <li key={i}>{new Date(r.at).toLocaleString('pt-BR')} — {r.label}: {r.reason}</li>)}</ul>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => { clearRejected(); setRejected([]); }}>Dispensar</Button>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Vídeo sempre montado (a detecção de presença usa o mesmo elemento) */}
            <Card className={showVideo ? '' : 'hidden'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {stage === 'face' ? (pendingName ? `Confirme o seu rosto, ${pendingName}` : pendingRef.current?.offline ? 'Sem internet — foto para conferência' : 'Reconhecimento facial') : method === 'qrcode' ? 'Leitura do QR Code' : 'Leitura do código de barras'}
                </CardTitle>
                <CardDescription>{stage === 'face' ? 'Olhe para a câmera — a conferência é automática.' : secondRef.current ? 'Segunda verificação.' : 'Depois da leitura, o terminal pede o seu rosto.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border">
                  <video ref={videoRef} className={`w-full max-h-[45vh] object-cover ${facingRef.current === 'user' ? '-scale-x-100' : ''}`} muted playsInline autoPlay />
                  {stage === 'face' && challenge && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-primary/90 p-3 text-center text-lg font-bold text-primary-foreground animate-in fade-in-0 slide-in-from-top-2">{challenge}</div>
                  )}
                  {stage === 'face' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-40 rounded-full border-4 border-primary/70 md:h-56 md:w-56" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 p-2 text-center text-sm">
                    {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Identificando…</span> : hint}
                  </div>
                </div>
              </CardContent>
            </Card>

            {stage === 'keypad' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{KEYPAD_LABEL[method]}</CardTitle>
                  <CardDescription>{secondRef.current ? 'Segunda verificação.' : 'Em seguida, olhe para a câmera para a conferência do rosto.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={(e) => { e.preventDefault(); identify(identifier); }} className="flex gap-2">
                    <Input value={identifier} onChange={(e) => { touch(); setIdentifier(e.target.value); }} inputMode="numeric" autoFocus
                      type={method === 'pin' ? 'password' : 'text'} className="h-14 text-center text-2xl tracking-widest" aria-label={KEYPAD_LABEL[method]} />
                    <Button type="submit" className="h-14 px-6" disabled={busy || !identifier}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}</Button>
                  </form>
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
                      <Button key={k} variant={k === 'C' || k === '⌫' ? 'outline' : 'secondary'} className="h-14 text-xl"
                        onClick={() => { touch(); if (k === 'C') setIdentifier(''); else if (k === '⌫') setIdentifier(v => v.slice(0, -1)); else setIdentifier(v => v + k); }}>
                        {k === '⌫' ? <Delete className="h-5 w-5" /> : k}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {cameraError && showVideo && (
              <Alert variant="destructive">
                <CameraOff className="h-4 w-4" />
                <AlertTitle>Câmera indisponível</AlertTitle>
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}

            {stage !== 'select' && (
              <Button variant="ghost" className="w-full" onClick={() => { reset(); setError(null); setStage('select'); }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
            )}
          </main>

          <footer className="mx-auto w-full max-w-4xl pt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => { if (confirm('Desativar este terminal?')) handleExitTerminal(); }}>
              <LogOut className="mr-2 h-4 w-4" /> Desativar este terminal
            </Button>
          </footer>
        </>
      )}
    </div>
  );
}
