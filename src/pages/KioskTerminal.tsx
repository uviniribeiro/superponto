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
import { Loader2, MonitorSmartphone, QrCode, CameraOff, LogOut, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import jsQR from 'jsqr';

const STORAGE_KEY = 'pontomax.kiosk.session';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';

const RECORD_LABELS: Record<RecordType, string> = {
  entry: 'Entrada',
  break_start: 'Início do intervalo',
  break_end: 'Fim do intervalo',
  exit: 'Saída',
};

interface KioskSession {
  deviceToken: string;
  terminalName: string;
  companyName: string;
}

interface Employee {
  id: string;
  full_name: string;
  registration_number: string | null;
  department: string | null;
  position: string | null;
  photo_url: string | null;
}

export default function KioskTerminal() {
  const [session, setSession] = useState<KioskSession | null>(null);
  const [booting, setBooting] = useState(true);

  // Ativação
  const [cnpj, setCnpj] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Identificação / registro
  const [identifier, setIdentifier] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [nextRecordType, setNextRecordType] = useState<RecordType | null>(null);
  const [todayRecords, setTodayRecords] = useState<{ record_type: RecordType; recorded_at: string }[]>([]);
  const [punching, setPunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ label: string; time: string; nsr: number; name: string } | null>(null);

  // Câmera QR
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke('kiosk-terminal', { body: payload });
    if (fnError) throw new Error('Não foi possível falar com o servidor. Verifique a internet do terminal.');
    return data as any;
  }, []);

  // Sessão persistente do terminal
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setBooting(false); return; }
    try {
      const saved = JSON.parse(raw) as KioskSession;
      call({ action: 'session', deviceToken: saved.deviceToken })
        .then((res) => {
          if (res?.success) {
            setSession({ ...saved, terminalName: res.terminal.name, companyName: res.company.name });
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        })
        .catch(() => setSession(saved))
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
      const res = await call({ action: 'activate', cnpj, terminalName });
      if (!res?.success) {
        setActivationError(res?.error || 'Não foi possível ativar o terminal.');
        return;
      }
      const newSession: KioskSession = {
        deviceToken: res.deviceToken,
        terminalName: res.terminal.name,
        companyName: res.company.name,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Terminal ativado para ${res.company.name}`);
    } catch (e: any) {
      setActivationError(e.message);
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

  const handleIdentify = useCallback(async (value: string) => {
    const raw = value.trim();
    if (!raw || !session) return;
    setIdentifying(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await call({ action: 'identify', deviceToken: session.deviceToken, identifier: raw });
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
      if (!res.nextRecordType) {
        setError('Todos os registros do dia já foram feitos para este funcionário.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIdentifying(false);
      setIdentifier('');
    }
  }, [call, session]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
        tick();
      });
    } catch (e: any) {
      setCameraError(
        e?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Libere o acesso à câmera nas configurações do navegador do terminal.'
          : 'Não foi possível acessar a câmera deste terminal.'
      );
    }
  };

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) {
          stopCamera();
          handleIdentify(code.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const handlePunch = async () => {
    if (!session || !employee || !nextRecordType) return;
    setPunching(true);
    setError(null);
    try {
      const coords = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });

      const res = await call({
        action: 'punch',
        deviceToken: session.deviceToken,
        profileId: employee.id,
        recordType: nextRecordType,
        latitude: coords?.coords.latitude ?? null,
        longitude: coords?.coords.longitude ?? null,
        userAgent: navigator.userAgent,
      });

      if (!res?.success) {
        setError(res?.error || 'Não foi possível registrar o ponto.');
        return;
      }

      setSuccess({
        label: RECORD_LABELS[nextRecordType],
        time: new Date(res.record.recorded_at).toLocaleTimeString('pt-BR'),
        nsr: res.record.nsr,
        name: res.employeeName,
      });
      resetEmployee();
      setTimeout(() => setSuccess(null), 8000);
    } catch (e: any) {
      setError(e.message);
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
              Ative este dispositivo com o CNPJ da empresa. Depois de ativado, ele permanece conectado
              e serve apenas para registrar ponto.
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

  // ---------------- Terminal ativo ----------------
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{session.companyName}</p>
            <h1 className="text-xl font-semibold">{session.terminalName}</h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">{clock.toLocaleTimeString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">{clock.toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
          </div>
        </div>

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{success.label} registrada</AlertTitle>
            <AlertDescription>
              {success.name} — {success.time} · NSR {success.nsr}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!employee ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identifique-se para registrar</CardTitle>
              <CardDescription>Use o QR Code, PIN, cartão, matrícula ou CPF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={(e) => { e.preventDefault(); handleIdentify(identifier); }}
                className="flex gap-2"
              >
                <Input
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="QR Code, PIN, matrícula ou CPF"
                  className="h-12 text-lg"
                />
                <Button type="submit" className="h-12" disabled={identifying || !identifier.trim()}>
                  {identifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
                </Button>
              </form>

              {scanning ? (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full rounded-lg" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button variant="outline" className="w-full" onClick={stopCamera}>
                    <CameraOff className="mr-2 h-4 w-4" /> Parar leitura
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-12" onClick={startCamera}>
                  <QrCode className="mr-2 h-4 w-4" /> Ler QR Code com a câmera
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
            <CardHeader>
              <CardTitle className="text-base">{employee.full_name}</CardTitle>
              <CardDescription>
                {[employee.registration_number && `Matrícula ${employee.registration_number}`, employee.department, employee.position]
                  .filter(Boolean).join(' · ') || 'Funcionário identificado'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {todayRecords.length === 0 && (
                  <span className="text-sm text-muted-foreground">Nenhum registro hoje.</span>
                )}
                {todayRecords.map((r, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {RECORD_LABELS[r.record_type]} {new Date(r.recorded_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                ))}
              </div>

              {nextRecordType ? (
                <Button className="w-full h-16 text-lg" onClick={handlePunch} disabled={punching}>
                  {punching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Registrar {RECORD_LABELS[nextRecordType]}
                </Button>
              ) : (
                <Alert>
                  <AlertTitle>Jornada completa</AlertTitle>
                  <AlertDescription>Todos os registros do dia já foram feitos.</AlertDescription>
                </Alert>
              )}

              <Button variant="ghost" className="w-full" onClick={resetEmployee}>
                Cancelar e voltar
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="ghost" size="sm" onClick={handleExitTerminal}>
            <LogOut className="mr-2 h-4 w-4" /> Desativar este terminal
          </Button>
        </div>
      </div>
    </div>
  );
}
