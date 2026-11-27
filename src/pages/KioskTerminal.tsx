import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  LogOut, CheckCircle2, AlertCircle, Wifi, WifiOff, Wrench, ArrowLeft,
} from 'lucide-react';
import jsQR from 'jsqr';

const STORAGE_KEY = 'pontomax.kiosk.session';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';
/** Etapas do terminal: espera (data e hora) → escolha do método → identificação → rosto → resultado. */
type Stage = 'idle' | 'select' | 'scan' | 'keypad' | 'face';
type Method = 'facial' | 'qrcode' | 'barcode' | 'pin' | 'registration' | 'cpf';

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
const KEYPAD_LABEL: Partial<Record<Method, string>> = { pin: 'Digite o seu PIN', registration: 'Digite a sua matrícula', cpf: 'Digite o seu CPF' };

interface KioskSession {
  deviceToken: string;
  terminalName: string;
  companyName: string;
  status?: string;
  activationCode?: string | null;
}

const IDLE_AFTER_MS = 25_000;

export default function KioskTerminal() {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [booting, setBooting] = useState(true);

  // Ativação
  const [cnpj, setCnpj] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Conexão
  const [online, setOnline] = useState(true);
  const [maintenance, setMaintenance] = useState<{ reason?: string | null; expected_end_at?: string | null } | null>(null);
  const offlineSince = useRef<number | null>(null);

  // Fluxo
  const [stage, setStageState] = useState<Stage>('idle');
  const stageRef = useRef<Stage>('idle');
  const [method, setMethod] = useState<Method>('facial');
  const methodRef = useRef<Method>('facial');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ label: string; time: string; nsr: number | string; name: string } | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const pendingRef = useRef<{ identifier: string; name: string } | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
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

  const rawCall = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke('kiosk-terminal', { body: payload });
    if (fnError) throw new Error('offline');
    return data as any;
  }, []);

  /** Chamada com reconexão automática (3 tentativas com espera progressiva). */
  const call = useCallback(async (payload: Record<string, unknown>, attempts = 3) => {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await rawCall(payload);
        if (offlineSince.current) {
          const offlineSeconds = Math.round((Date.now() - offlineSince.current) / 1000);
          offlineSince.current = null;
          rawCall({
            action: 'report-issue',
            deviceToken: (payload as { deviceToken?: string }).deviceToken,
            detail: 'O terminal perdeu a comunicação e reconectou automaticamente.',
            offlineSeconds,
          }).catch(() => undefined);
        }
        setOnline(true);
        return res;
      } catch (e) {
        lastError = e;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 800 * (i + 1)));
      }
    }
    setOnline(false);
    if (!offlineSince.current) offlineSince.current = Date.now();
    throw lastError;
  }, [rawCall]);

  // ---------------- Health-check contínuo ----------------
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await rawCall({ action: 'health' });
        if (cancelled) return;
        setOnline(true);
        setMaintenance(res?.maintenance ?? null);
        if (offlineSince.current) offlineSince.current = null;
      } catch {
        if (cancelled) return;
        setOnline(false);
        if (!offlineSince.current) offlineSince.current = Date.now();
      }
    };
    ping();
    const t = setInterval(ping, 20_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [rawCall]);

  // ---------------- Sessão persistente ----------------
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setBooting(false); return; }
    try {
      const saved = JSON.parse(raw) as KioskSession;
      setSession(saved);
      call({ action: 'session', deviceToken: saved.deviceToken })
        .then((res) => {
          if (res?.success) {
            const updated = {
              ...saved,
              terminalName: res.terminal.name,
              companyName: res.company.name,
              status: res.terminal.status,
              activationCode: res.terminal.activationCode,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            setSession(updated);
          }
        })
        .catch(() => undefined) // offline: mantém o terminal operando com a sessão salva
        .finally(() => setBooting(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setBooting(false);
    }
  }, [call]);

  const handleActivate = async () => {
    setActivationError(null);
    setActivating(true);
    try {
      const coords = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });
      const res = await call({
        action: 'activate',
        cnpj,
        terminalName,
        latitude: coords?.coords.latitude ?? null,
        longitude: coords?.coords.longitude ?? null,
      });
      if (!res?.success) {
        setActivationError(res?.error || 'Não foi possível ativar o terminal.');
        return;
      }
      const newSession: KioskSession = {
        deviceToken: res.deviceToken,
        terminalName: res.terminal.name,
        companyName: res.company.name,
        status: res.status,
        activationCode: res.activationCode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Solicitação enviada para ${res.company.name}`);
    } catch {
      setActivationError(
        'Não foi possível falar com o servidor agora. O terminal tentará reconectar automaticamente — confira a internet e tente novamente em instantes.'
      );
    } finally {
      setActivating(false);
    }
  };

  const setStage = useCallback((s: Stage) => { stageRef.current = s; setStageState(s); lastActivity.current = Date.now(); }, []);
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

  const scanCode = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !videoReady()) return null;
    const scale = Math.min(1, 800 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height)?.data ?? null;
  };

  // ---------------- Fluxo ----------------
  const goIdle = useCallback(async () => {
    pendingRef.current = null;
    setPendingName(null);
    setIdentifier('');
    setError(null);
    setHint('');
    stableFrames.current = 0;
    setStage('idle');
    await openCamera('user');
  }, [openCamera, setStage]);

  const showError = useCallback((msg: string) => {
    setError(msg);
    pendingRef.current = null;
    setPendingName(null);
    setTimeout(() => { if (stageRef.current !== 'idle') { setError(null); setStage('select'); } }, 3000);
    setStage('select');
  }, [setStage]);

  const handleResult = useCallback((res: any) => {
    if (res?.success && res.record) {
      setSuccess({
        label: RECORD_LABELS[res.record.record_type as RecordType] ?? 'Marcação',
        time: new Date(res.record.recorded_at).toLocaleTimeString('pt-BR'),
        nsr: res.record.nsr,
        name: res.employeeName,
      });
      setTimeout(() => { setSuccess(null); goIdle(); }, 2600);
      stageRef.current = 'idle';
      return;
    }
    if (res?.code === 'face_mismatch') {
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

  /** Identificação concluída (QR, crachá, PIN, matrícula ou CPF): pede o rosto do dono. */
  const identify = useCallback(async (raw: string) => {
    if (!session || !raw.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call({ action: 'identify', deviceToken: session.deviceToken, identifier: raw.trim(), method: methodRef.current });
      if (!res?.success || !res.requireFace) return handleResult(res);
      const first = String(res.employee?.full_name || '').split(' ')[0] || 'Funcionário';
      pendingRef.current = { identifier: raw.trim(), name: first };
      setPendingName(res.employee?.full_name || first);
      setHint(`${first}, olhe para a câmera`);
      stableFrames.current = 0;
      faceSince.current = Date.now();
      await openCamera('user');
      setStage('face');
    } catch {
      showError('Sem conexão com o servidor no momento. Tente novamente em instantes.');
    } finally {
      setBusy(false);
      setIdentifier('');
    }
  }, [call, handleResult, openCamera, session, setStage, showError]);

  const submitFace = useCallback(async (selfie: string) => {
    if (!session) return;
    const pending = pendingRef.current;
    setHint(pending ? 'Conferindo o rosto com a identificação…' : 'Reconhecendo…');
    try {
      const res = pending
        ? await call({ action: 'verify-face', deviceToken: session.deviceToken, identifier: pending.identifier, selfieBase64: selfie, clientPunchId: crypto.randomUUID(), userAgent: navigator.userAgent }, 2)
        : await call({ action: 'identify-face', deviceToken: session.deviceToken, selfieBase64: selfie, clientPunchId: crypto.randomUUID(), userAgent: navigator.userAgent }, 2);
      if (res?.code === 'no_face') { cooldownUntil.current = Date.now() + 800; setHint(pending ? `${pending.name}, olhe para a câmera` : 'Posicione o rosto no centro'); return; }
      if (!pending && !res?.success && !res?.record && res?.error && !res?.code) {
        // 1:N sem correspondência: continua tentando até o tempo acabar
        setHint(res.error);
        cooldownUntil.current = Date.now() + 1500;
        return;
      }
      handleResult(res);
    } catch {
      showError('Sem conexão para conferir o rosto. Tente novamente em instantes.');
    }
  }, [call, handleResult, session, showError]);

  const chooseMethod = useCallback(async (m: Method) => {
    touch();
    setMethod(m);
    methodRef.current = m;
    setError(null);
    pendingRef.current = null;
    setPendingName(null);
    stableFrames.current = 0;
    if (m === 'facial') {
      setHint('Posicione o rosto no centro');
      faceSince.current = Date.now();
      await openCamera('user');
      setStage('face');
    } else if (m === 'qrcode' || m === 'barcode') {
      setHint(m === 'qrcode' ? 'Mostre o QR Code para a câmera' : 'Aproxime o crachá da câmera');
      await openCamera(m === 'barcode' ? 'environment' : 'user');
      setStage('scan');
    } else {
      setIdentifier('');
      setStage('keypad');
    }
  }, [openCamera, setStage]);

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
          const code = scanCode();
          if (code) await identify(code);
        } else if (st === 'face') {
          if (Date.now() - faceSince.current > 20_000) { showError('Tempo esgotado para a verificação facial.'); return; }
          if (Date.now() < cooldownUntil.current) return;
          if (await faceInFrame()) {
            stableFrames.current += 1;
            if (stableFrames.current >= 2) {
              stableFrames.current = 0;
              const frame = captureFrame();
              if (frame) await submitFace(frame);
            }
          } else {
            stableFrames.current = 0;
            setHint(pendingRef.current ? `${pendingRef.current.name}, olhe para a câmera` : 'Posicione o rosto no centro');
          }
        }
      } finally {
        busyRef.current = false;
      }
    }, 250);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, goIdle, identify, submitFace, openCamera, setStage, showError]);

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
              Ative este dispositivo com o CNPJ da empresa. Após a liberação do administrador ele permanece
              conectado e serve apenas para registrar ponto.
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
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-[0_12px_40px_-8px_rgba(16,185,129,.7)] animate-in zoom-in-50 spin-in-12 duration-500">
              <CheckCircle2 className="h-11 w-11" />
            </div>
            <p className="text-2xl font-bold">{success.label} registrada</p>
            <p className="text-lg">{success.name}</p>
            <p className="text-sm text-muted-foreground tabular-nums">{success.time} · NSR {success.nsr}</p>
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
          <p className="text-lg text-muted-foreground">{session.companyName} · {session.terminalName}</p>
          <p className="text-[18vw] font-bold leading-none tabular-nums tracking-tight md:text-[12rem]">{timeStr}</p>
          <p className="text-4xl font-semibold tabular-nums md:text-6xl">{dateStr}</p>
          <p className="mt-6 flex items-center gap-2 text-muted-foreground"><ScanFace className="h-5 w-5" /> Aproxime-se da câmera para registrar o ponto</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Badge variant={online ? 'secondary' : 'destructive'} className="gap-1">{online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{online ? 'Conectado' : 'Reconectando...'}</Badge>
            {maintenance && <Badge variant="outline" className="gap-1"><Wrench className="h-3 w-3" /> Manutenção — registro liberado</Badge>}
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
                <p className="text-center text-xs text-muted-foreground">Em todos os métodos o rosto é conferido com a foto do cadastro.</p>
              </>
            )}

            {/* Vídeo sempre montado (a detecção de presença usa o mesmo elemento) */}
            <Card className={showVideo ? '' : 'hidden'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {stage === 'face' ? (pendingName ? `Confirme o seu rosto, ${pendingName}` : 'Reconhecimento facial') : method === 'qrcode' ? 'Leitura do QR Code' : 'Leitura do código de barras'}
                </CardTitle>
                <CardDescription>{stage === 'face' ? 'Olhe para a câmera — a conferência é automática.' : 'Depois da leitura, o terminal pede o seu rosto.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border">
                  <video ref={videoRef} className={`w-full max-h-[45vh] object-cover ${facingRef.current === 'user' ? '-scale-x-100' : ''}`} muted playsInline autoPlay />
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
                  <CardDescription>Em seguida, olhe para a câmera para a conferência do rosto.</CardDescription>
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
              <Button variant="ghost" className="w-full" onClick={() => { pendingRef.current = null; setPendingName(null); setError(null); setStage('select'); }}>
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
