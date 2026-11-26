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
  Loader2, MonitorSmartphone, QrCode, Barcode, ScanFace, Delete, KeyRound, CameraOff,
  LogOut, CheckCircle2, Clock, AlertCircle, Wifi, WifiOff, CloudUpload, Wrench,
} from 'lucide-react';
import jsQR from 'jsqr';

import { coarseCoordinate } from "@/lib/privacy";
const STORAGE_KEY = 'pontomax.kiosk.session';
const QUEUE_KEY = 'pontomax.kiosk.queue';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';
type Mode = 'qrcode' | 'barcode' | 'facial' | 'keypad';

const RECORD_LABELS: Record<RecordType, string> = {
  entry: 'Entrada',
  break_start: 'Início do intervalo',
  break_end: 'Fim do intervalo',
  exit: 'Saída',
};

const GENERIC_ERROR = 'Ocorreu um erro. Já registramos o problema e a equipe foi avisada.';

interface KioskSession {
  deviceToken: string;
  terminalName: string;
  companyName: string;
  status?: string;
  activationCode?: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  photo_url: string | null;
}

interface QueuedPunch {
  clientPunchId: string;
  profileId: string;
  recordType: RecordType;
  clientRecordedAt: string;
  employeeName: string;
  latitude: number | null;
  longitude: number | null;
}

const readQueue = (): QueuedPunch[] => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const writeQueue = (q: QueuedPunch[]) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

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
  const [queue, setQueue] = useState<QueuedPunch[]>(readQueue());
  const offlineSince = useRef<number | null>(null);
  const flushing = useRef(false);

  // Identificação / registro
  const [mode, setMode] = useState<Mode>('keypad');
  const [identifier, setIdentifier] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [nextRecordType, setNextRecordType] = useState<RecordType | null>(null);
  const [todayRecords, setTodayRecords] = useState<{ record_type: RecordType; recorded_at: string }[]>([]);
  const [punching, setPunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ label: string; time: string; nsr: number | string; name: string } | null>(null);

  // Câmera
  const [scanning, setScanning] = useState(false);
  const [faceHint, setFaceHint] = useState('Posicione o rosto no centro');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>('keypad');
  const busyRef = useRef(false);

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
            pendingPunches: readQueue().length,
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

  // ---------------- Fila offline ----------------
  const flushQueue = useCallback(async () => {
    if (flushing.current || !session) return;
    const pending = readQueue();
    if (!pending.length) return;
    flushing.current = true;
    const remaining: QueuedPunch[] = [];
    for (const item of pending) {
      try {
        const res = await rawCall({
          action: 'punch',
          deviceToken: session.deviceToken,
          profileId: item.profileId,
          recordType: item.recordType,
          clientPunchId: item.clientPunchId,
          clientRecordedAt: item.clientRecordedAt,
          latitude: item.latitude,
          longitude: item.longitude,
          userAgent: navigator.userAgent,
        });
        if (!res?.success) remaining.push(item);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setQueue(remaining);
    flushing.current = false;
    const sent = pending.length - remaining.length;
    if (sent > 0) toast.success(`${sent} registro(s) da fila enviados ao servidor.`);
  }, [rawCall, session]);

  useEffect(() => {
    if (online && session) flushQueue();
  }, [online, session, flushQueue]);

  useEffect(() => {
    const t = setInterval(() => { if (online) flushQueue(); }, 45_000);
    const back = () => flushQueue();
    window.addEventListener('online', back);
    return () => { clearInterval(t); window.removeEventListener('online', back); };
  }, [online, flushQueue]);

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

  const resetEmployee = useCallback(() => {
    setEmployee(null);
    setNextRecordType(null);
    setTodayRecords([]);
    setIdentifier('');
    setError(null);
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleIdentify = useCallback(async (value: string, method: Mode = 'keypad') => {
    const raw = value.trim();
    if (!raw || !session) return;
    setIdentifying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await call({ action: 'identify', deviceToken: session.deviceToken, identifier: raw, method });
      if (!res?.success) {
        if (res?.code === 'terminal_invalid') {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
        }
        setError(res?.error || 'Identificação não reconhecida.');
        return;
      }
      setEmployee(res.employee);
      setTodayRecords(res.todayRecords || []);
      setNextRecordType(res.nextRecordType);
      if (!res.nextRecordType) setError('Todos os registros do dia já foram feitos para este funcionário.');
    } catch {
      setError('Sem conexão com o servidor no momento. Estamos reconectando — tente novamente em instantes.');
    } finally {
      setIdentifying(false);
      setIdentifier('');
    }
  }, [call, session]);

  // ---------------- Reconhecimento facial quase instantâneo ----------------
  const captureFrame = (maxWidth = 480) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    canvas.width = Math.round((video.videoWidth || maxWidth) * scale);
    canvas.height = Math.round((video.videoHeight || maxWidth) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const submitFace = useCallback(async (selfieBase64: string) => {
    if (!session) return;
    busyRef.current = true;
    setIdentifying(true);
    setFaceHint('Confirmando identidade...');
    try {
      const res = await call({ action: 'identify-face', deviceToken: session.deviceToken, selfieBase64 }, 2);
      if (res?.success) {
        stopCamera();
        setEmployee(res.employee);
        setTodayRecords(res.todayRecords || []);
        setNextRecordType(res.nextRecordType);
      } else {
        setFaceHint(res?.error || 'Rosto não reconhecido. Aproxime-se e tente novamente.');
      }
    } catch {
      setFaceHint('Sem conexão para confirmar o rosto. Use o QR Code ou o teclado.');
    } finally {
      setIdentifying(false);
      busyRef.current = false;
    }
  }, [call, session, stopCamera]);

  /** Detecção local de pontos do rosto: usa FaceDetector nativo quando disponível
   *  e, caso contrário, detecta a presença estável de um rosto pelo contraste central. */
  const faceDetectorRef = useRef<any>(null);
  const stableFrames = useRef(0);

  const faceTick = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (!busyRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
      let detected = false;
      try {
        const FD = (window as any).FaceDetector;
        if (FD) {
          if (!faceDetectorRef.current) faceDetectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 1 });
          const faces = await faceDetectorRef.current.detect(video);
          detected = faces.length > 0;
        } else {
          // Heurística: variação de luminância na região central (indica um rosto enquadrado)
          const ctx = canvas.getContext('2d');
          canvas.width = 160; canvas.height = 120;
          ctx?.drawImage(video, 0, 0, 160, 120);
          const img = ctx?.getImageData(40, 20, 80, 80);
          if (img) {
            let sum = 0, sumSq = 0;
            for (let i = 0; i < img.data.length; i += 4) {
              const l = (img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114);
              sum += l; sumSq += l * l;
            }
            const n = img.data.length / 4;
            const mean = sum / n;
            const variance = sumSq / n - mean * mean;
            detected = variance > 350 && mean > 40 && mean < 225;
          }
        }
      } catch {
        detected = false;
      }

      if (detected) {
        stableFrames.current += 1;
        setFaceHint(stableFrames.current < 3 ? 'Rosto detectado, mantenha-se parado...' : 'Reconhecendo...');
        if (stableFrames.current >= 3) {
          stableFrames.current = 0;
          const frame = captureFrame();
          if (frame) { await submitFace(frame); }
        }
      } else {
        stableFrames.current = 0;
        setFaceHint('Posicione o rosto no centro');
      }
    }
    rafRef.current = requestAnimationFrame(() => { faceTick(); });
  }, [submitFace]);

  const codeTick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (!busyRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) {
          stopCamera();
          handleIdentify(code.data, modeRef.current);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(codeTick);
  }, [handleIdentify, stopCamera]);

  const startCamera = useCallback(async (target: Mode) => {
    setCameraError(null);
    setError(null);
    stopCamera();
    modeRef.current = target;
    stableFrames.current = 0;
    setFaceHint('Posicione o rosto no centro');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: target === 'facial' ? 'user' : 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        if (target === 'facial') faceTick(); else codeTick();
      });
    } catch (e: any) {
      setCameraError(
        e?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere o acesso à câmera nas configurações do navegador do terminal.'
          : 'Não foi possível acessar a câmera deste terminal.'
      );
    }
  }, [codeTick, faceTick, stopCamera]);

  const selectMode = (m: Mode) => {
    setMode(m);
    setError(null);
    if (m === 'keypad') stopCamera();
    else startCamera(m);
  };

  const handlePunch = async () => {
    if (!session || !employee || !nextRecordType) return;
    setPunching(true);
    setError(null);
    const coords = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
    });

    const punch: QueuedPunch = {
      clientPunchId: crypto.randomUUID(),
      profileId: employee.id,
      recordType: nextRecordType,
      clientRecordedAt: new Date().toISOString(),
      employeeName: employee.full_name,
      latitude: coarseCoordinate(coords?.coords.latitude),
      longitude: coarseCoordinate(coords?.coords.longitude),

    };

    try {
      const res = await call({
        action: 'punch',
        deviceToken: session.deviceToken,
        profileId: punch.profileId,
        recordType: punch.recordType,
        clientPunchId: punch.clientPunchId,
        clientRecordedAt: punch.clientRecordedAt,
        latitude: punch.latitude,
        longitude: punch.longitude,
        userAgent: navigator.userAgent,
      });

      if (!res?.success) {
        setError(res?.error || GENERIC_ERROR);
        return;
      }

      setSuccess({
        label: RECORD_LABELS[nextRecordType],
        time: new Date(res.record.recorded_at).toLocaleTimeString('pt-BR'),
        nsr: res.record.nsr,
        name: res.employeeName,
      });
      resetEmployee();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      // Fila offline: o registro nunca é perdido, mesmo durante a manutenção
      const q = [...readQueue(), punch];
      writeQueue(q);
      setQueue(q);
      setSuccess({
        label: RECORD_LABELS[nextRecordType],
        time: new Date(punch.clientRecordedAt).toLocaleTimeString('pt-BR'),
        nsr: 'na fila',
        name: punch.employeeName,
      });
      toast.info('Registro salvo no terminal e será enviado assim que a conexão voltar.');
      resetEmployee();
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setPunching(false);
    }
  };

  const handleExitTerminal = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    resetEmployee();
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

  const MODES: { key: Mode; label: string; icon: typeof QrCode }[] = [
    { key: 'qrcode', label: 'QR Code', icon: QrCode },
    { key: 'barcode', label: 'Código de barras', icon: Barcode },
    { key: 'facial', label: 'Reconhecimento facial', icon: ScanFace },
    { key: 'keypad', label: 'Teclado', icon: KeyRound },
  ];

  // ---------------- Terminal ativo ----------------
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-muted/50 p-3 md:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl" />
      </div>
      {/* Confirmação em tela cheia (estilo "verificado"): some sozinha */}
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
      <header className="relative z-10 mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur-xl md:p-5">
        <div>
          <p className="text-sm text-muted-foreground">{session.companyName}</p>
          <h1 className="text-xl font-semibold">{session.terminalName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={online ? 'secondary' : 'destructive'} className="gap-1">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? 'Conectado' : 'Reconectando...'}
            </Badge>
            {queue.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <CloudUpload className="h-3 w-3" /> {queue.length} na fila
              </Badge>
            )}
            {maintenance && (
              <Badge variant="outline" className="gap-1">
                <Wrench className="h-3 w-3" /> Manutenção — registro liberado
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums md:text-6xl">{clock.toLocaleTimeString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{clock.toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-4 w-full max-w-4xl flex-1 space-y-4">
        {pendingApproval && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aguardando liberação do administrador</AlertTitle>
            <AlertDescription>
              Informe o código <strong>{session.activationCode}</strong> ao administrador para liberar este terminal.
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{success.label} registrada</AlertTitle>
            <AlertDescription>{success.name} — {success.time} · NSR {success.nsr}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Ícones de identificação — sempre visíveis, sem rolagem */}
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => selectMode(key)}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-2 rounded-3xl border p-3 transition-all duration-200 active:scale-95 md:p-5 ${
                mode === key ? 'border-transparent bg-foreground text-background shadow-lg' : 'border-border/60 bg-background/70 backdrop-blur-xl hover:bg-muted'
              }`}
            >
              <Icon className={`h-8 w-8 md:h-10 md:w-10 ${mode === key ? 'text-background' : 'text-muted-foreground'}`} />
              <span className="text-center text-[11px] font-medium leading-tight md:text-sm">{label}</span>
            </button>
          ))}
        </div>

        {!employee ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {mode === 'facial' ? 'Reconhecimento facial' : mode === 'keypad' ? 'Digite sua identificação' : 'Aproxime o código da câmera'}
              </CardTitle>
              <CardDescription>
                {mode === 'facial'
                  ? 'Olhe para a câmera — o reconhecimento é automático.'
                  : mode === 'keypad'
                    ? 'Use o PIN, a matrícula ou o CPF.'
                    : 'Mantenha o crachá a cerca de 20 cm da câmera.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanning && (
                <div className="relative overflow-hidden rounded-xl border">
                  <video ref={videoRef} className="w-full max-h-[38vh] object-cover" muted playsInline />
                  {mode === 'facial' && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-40 w-40 rounded-full border-4 border-primary/70 md:h-56 md:w-56" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 p-2 text-center text-sm">
                    {identifying ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {faceHint}</span>
                      : mode === 'facial' ? faceHint : 'Procurando código...'}
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />

              <form onSubmit={(e) => { e.preventDefault(); handleIdentify(identifier, 'keypad'); }} className="flex gap-2">
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="PIN, matrícula ou CPF"
                  inputMode="numeric"
                  className="h-14 text-lg"
                />
                <Button type="submit" className="h-14 px-6" disabled={identifying || !identifier.trim()}>
                  {identifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
                </Button>
              </form>

              {mode === 'keypad' && (
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
                    <Button
                      key={k}
                      variant={k === 'C' || k === '⌫' ? 'outline' : 'secondary'}
                      className="h-14 text-xl"
                      onClick={() => {
                        if (k === 'C') setIdentifier('');
                        else if (k === '⌫') setIdentifier(v => v.slice(0, -1));
                        else setIdentifier(v => v + k);
                      }}
                    >
                      {k === '⌫' ? <Delete className="h-5 w-5" /> : k}
                    </Button>
                  ))}
                </div>
              )}

              {scanning && (
                <Button variant="outline" className="w-full" onClick={stopCamera}>
                  <CameraOff className="mr-2 h-4 w-4" /> Parar câmera
                </Button>
              )}

              {cameraError && (
                <Alert variant="destructive">
                  <CameraOff className="h-4 w-4" />
                  <AlertTitle>Câmera indisponível</AlertTitle>
                  <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {employee.photo_url
                  ? <img src={employee.photo_url} alt={`Foto de ${employee.full_name}`} className="h-16 w-16 rounded-full object-cover" />
                  : null}
                <div>
                  <CardTitle className="text-lg">{employee.full_name}</CardTitle>
                  <CardDescription>
                    {[employee.registration_number && `Matrícula ${employee.registration_number}`, employee.department, employee.position]
                      .filter(Boolean).join(' · ') || 'Funcionário identificado'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {todayRecords.length === 0 && <span className="text-sm text-muted-foreground">Nenhum registro hoje.</span>}
                {todayRecords.map((r, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {RECORD_LABELS[r.record_type]} {new Date(r.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                ))}
              </div>

              {nextRecordType ? (
                <Button className="h-20 w-full text-xl" onClick={handlePunch} disabled={punching}>
                  {punching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Registrar {RECORD_LABELS[nextRecordType]}
                </Button>
              ) : (
                <Alert>
                  <AlertTitle>Jornada completa</AlertTitle>
                  <AlertDescription>Todos os registros do dia já foram feitos.</AlertDescription>
                </Alert>
              )}

              <Button variant="ghost" className="w-full" onClick={resetEmployee}>Cancelar e voltar</Button>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mx-auto w-full max-w-4xl pt-3 text-center">
        <Button variant="ghost" size="sm" onClick={handleExitTerminal}>
          <LogOut className="mr-2 h-4 w-4" /> Desativar este terminal
        </Button>
      </footer>
    </div>
  );
}
