import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Camera,
  QrCode,
  Loader2,
  Check,
  X,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsQR from 'jsqr';

export interface IdentificationMethod {
  id: string;
  method_type: string;
  identifier: string | null;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: IdentificationMethod[];
  photoUrl?: string | null;
  profileId?: string;
  companyId?: string | null;
  onSuccess: () => void;
}

type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable' | 'error';
type ValidationStatus = 'idle' | 'validating' | 'success' | 'error';

async function logAttempt(params: {
  profileId?: string;
  companyId?: string | null;
  methodType: 'facial' | 'qrcode';
  success: boolean;
  reason?: string;
  identifierMatched?: string | null;
  confidence?: number | null;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    await supabase.from('identification_validation_attempts').insert({
      user_id: userId,
      profile_id: params.profileId ?? null,
      company_id: params.companyId ?? null,
      method_type: params.methodType,
      success: params.success,
      reason: params.reason ?? null,
      identifier_matched: params.identifierMatched ?? null,
      confidence: params.confidence ?? null,
      user_agent: navigator.userAgent,
    });
  } catch (e) {
    console.warn('Falha ao registrar tentativa de validação', e);
  }
}

export default function MobileValidationDialog({
  open,
  onOpenChange,
  methods,
  photoUrl,
  profileId,
  companyId,
  onSuccess,
}: Props) {
  const hasFacial = methods.some(m => m.method_type === 'facial' && m.is_active);
  const hasQr = methods.some(m => m.method_type === 'qrcode' && m.is_active);

  const [tab, setTab] = useState<string>(hasFacial && photoUrl ? 'facial' : hasQr ? 'qrcode' : 'facial');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string>('');
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRafRef = useRef<number | null>(null);
  const lastQrToastRef = useRef<string>('');

  const resetValidation = () => {
    setStatus('idle');
    setMessage('');
    setNextSteps([]);
  };

  useEffect(() => {
    if (!open) return;
    resetValidation();
    setAttemptCount(0);
    setTab(hasFacial && photoUrl ? 'facial' : hasQr ? 'qrcode' : 'facial');
  }, [open, hasFacial, hasQr, photoUrl]);

  // Camera lifecycle
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const facingMode = tab === 'facial' ? 'user' : 'environment';

    const startCamera = async () => {
      setCameraState('starting');
      setCameraError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setCameraError('Este navegador não suporta acesso à câmera. Use um navegador atualizado (Chrome, Edge, Safari) ou o aplicativo mobile.');
        return;
      }

      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(s);
        setCameraState('ready');
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraState('denied');
          setCameraError('Permissão de câmera negada. Libere o acesso nas configurações do navegador (ícone de cadeado na barra de endereço) e tente novamente.');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraState('unavailable');
          setCameraError('Nenhuma câmera encontrada no dispositivo.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          setCameraState('error');
          setCameraError('A câmera está sendo usada por outro aplicativo. Feche outros programas que usam a câmera e tente novamente.');
        } else {
          setCameraState('error');
          setCameraError(err?.message || 'Não foi possível iniciar a câmera.');
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    };
  }, [open, tab]);

  // Stop stream when tab changes or dialog closes
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  useEffect(() => {
    if (!open && stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
      setCameraState('idle');
    }
  }, [open, stream]);

  const retryCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    resetValidation();
    // Toggle tab to re-run the effect
    const current = tab;
    setTab('__reset__');
    setTimeout(() => setTab(current), 30);
  };

  // QR scanning loop
  useEffect(() => {
    if (!open || tab !== 'qrcode' || !stream || cameraState !== 'ready' || status !== 'idle') return;

    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            // Server-side validation with expiration check
            setStatus('validating');
            setMessage('Validando QR Code...');
            const scanned = code.data;
            try {
              const { data, error } = await supabase.rpc('validate_qrcode_identifier', {
                _identifier: scanned,
              });
              if (error) throw error;
              const row = Array.isArray(data) ? data[0] : data;
              if (row?.is_valid && (!profileId || row.profile_id === profileId)) {
                await logAttempt({
                  profileId,
                  companyId,
                  methodType: 'qrcode',
                  success: true,
                  identifierMatched: scanned,
                });
                setStatus('success');
                setMessage('QR Code validado com sucesso');
                setNextSteps([]);
                toast.success('QR Code validado');
                setTimeout(() => {
                  onSuccess();
                  onOpenChange(false);
                }, 700);
                return;
              }
              const reason =
                row?.is_valid && profileId && row.profile_id !== profileId
                  ? 'Este QR Code pertence a outro funcionário.'
                  : row?.reason || 'QR Code inválido';
              await logAttempt({
                profileId,
                companyId,
                methodType: 'qrcode',
                success: false,
                reason,
                identifierMatched: scanned,
              });
              setAttemptCount(c => c + 1);
              setStatus('error');
              setMessage(reason);
              setNextSteps(
                reason.toLowerCase().includes('expirado')
                  ? [
                      'Peça ao RH ou gestor para baixar um novo QR Code atualizado.',
                      'Você pode alternar para validação facial enquanto isso.',
                    ]
                  : [
                      'Confirme se o QR Code é o seu.',
                      'Verifique a iluminação e aproxime o código da câmera.',
                      'Se persistir, use a validação facial ou procure o RH.',
                    ]
              );
              if (lastQrToastRef.current !== reason) {
                lastQrToastRef.current = reason;
                toast.error(reason);
              }
            } catch (e: any) {
              console.error(e);
              setStatus('error');
              setMessage('Falha ao validar QR no servidor.');
              setNextSteps(['Verifique sua conexão de internet e tente novamente.']);
            }
            return;
          }
        }
      }
      scanRafRef.current = requestAnimationFrame(tick);
    };
    scanRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    };
  }, [open, tab, stream, cameraState, status, profileId, companyId, onSuccess, onOpenChange]);

  const captureFacial = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setStatus('validating');
    setMessage('Comparando com foto cadastrada...');
    setNextSteps([]);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Falha na captura');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      if (!photoUrl) {
        await logAttempt({
          profileId,
          companyId,
          methodType: 'facial',
          success: true,
          reason: 'Selfie sem foto cadastrada (proof-of-life)',
        });
        setStatus('success');
        setMessage('Selfie capturada');
        toast.success('Selfie capturada');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 700);
        return;
      }

      const { data, error } = await supabase.functions.invoke('validate-face', {
        body: { selfieBase64: base64, registeredPhotoUrl: photoUrl },
      });
      if (error) throw error;

      if (data?.isMatch) {
        await logAttempt({
          profileId,
          companyId,
          methodType: 'facial',
          success: true,
          confidence: data.confidence ?? null,
          reason: data.reason ?? null,
        });
        setStatus('success');
        setMessage(`Rosto validado (${data.confidence}%)`);
        toast.success('Rosto validado com sucesso');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 800);
      } else {
        const reason = data?.reason || 'O rosto não corresponde ao cadastrado.';
        await logAttempt({
          profileId,
          companyId,
          methodType: 'facial',
          success: false,
          confidence: data?.confidence ?? null,
          reason,
        });
        setAttemptCount(c => c + 1);
        setStatus('error');
        setMessage(reason);
        setNextSteps([
          'Fique de frente para a câmera, com boa iluminação e sem óculos escuros/máscara.',
          'Remova acessórios que cubram o rosto e tente novamente.',
          attemptCount >= 1 && hasQr
            ? 'Você pode alternar para validação por QR Code na aba ao lado.'
            : 'Se persistir, procure o RH para atualizar sua foto cadastrada.',
        ]);
        toast.error('Validação facial não aprovada');
      }
    } catch (e: any) {
      console.error(e);
      const reason = e?.message || 'Erro na validação facial';
      await logAttempt({
        profileId,
        companyId,
        methodType: 'facial',
        success: false,
        reason,
      });
      setStatus('error');
      setMessage(reason);
      setNextSteps(['Verifique sua conexão e tente novamente.']);
      toast.error(reason);
    }
  };

  const renderCameraArea = (isQr: boolean) => (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
      {cameraState === 'ready' && (
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      )}
      {(cameraState === 'starting' || cameraState === 'idle') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Iniciando câmera...</span>
        </div>
      )}
      {cameraState === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
          <ShieldAlert className="h-10 w-10 text-warning" />
          <span className="text-sm font-medium">Permissão de câmera necessária</span>
        </div>
      )}
      {(cameraState === 'error' || cameraState === 'unavailable') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <span className="text-sm">Câmera indisponível</span>
        </div>
      )}
      {isQr && cameraState === 'ready' && status !== 'success' && (
        <div className="absolute inset-8 border-2 border-white/70 rounded-lg pointer-events-none" />
      )}
      {status === 'success' && (
        <div className="absolute inset-0 flex items-center justify-center bg-success/40">
          <Check className="h-16 w-16 text-white" />
        </div>
      )}
    </div>
  );

  const renderFeedback = () => {
    if (cameraState === 'denied' || cameraState === 'error' || cameraState === 'unavailable') {
      return (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Não foi possível acessar a câmera</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{cameraError}</p>
            <Button size="sm" variant="outline" onClick={retryCamera}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    if (status === 'error') {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validação não aprovada</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{message}</p>
            {nextSteps.length > 0 && (
              <div>
                <p className="font-medium mt-1">Próximos passos:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={resetValidation}>
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
              {hasFacial && hasQr && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetValidation();
                    setTab(tab === 'facial' ? 'qrcode' : 'facial');
                  }}
                >
                  Alternar para {tab === 'facial' ? 'QR Code' : 'Facial'}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (status === 'validating') {
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Validando...</AlertTitle>
          <AlertDescription>{message || 'Aguarde um instante.'}</AlertDescription>
        </Alert>
      );
    }

    if (status === 'success') {
      return (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>Aprovado</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {tab === 'facial'
            ? 'Fique de frente para a câmera, com boa iluminação, e toque em "Validar rosto".'
            : 'Aponte a câmera para o seu QR Code — a leitura é automática.'}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Validação necessária</DialogTitle>
          <DialogDescription>Confirme sua identidade para registrar o ponto.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab === '__reset__' ? (hasFacial ? 'facial' : 'qrcode') : tab}
          onValueChange={v => {
            resetValidation();
            setTab(v);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="facial" disabled={!hasFacial}>
              <Camera className="h-4 w-4 mr-2" />
              Facial
            </TabsTrigger>
            <TabsTrigger value="qrcode" disabled={!hasQr}>
              <QrCode className="h-4 w-4 mr-2" />
              QR Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facial" className="space-y-3">
            {renderCameraArea(false)}
            {renderFeedback()}
            {cameraState === 'ready' && status !== 'error' && status !== 'success' && (
              <Button
                onClick={captureFacial}
                disabled={status === 'validating'}
                className="w-full"
              >
                {status === 'validating' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {photoUrl ? 'Validar rosto' : 'Capturar selfie'}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="qrcode" className="space-y-3">
            {renderCameraArea(true)}
            {renderFeedback()}
          </TabsContent>
        </Tabs>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" /> Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
