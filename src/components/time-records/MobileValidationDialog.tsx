import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Camera, QrCode, Loader2, Check, X } from 'lucide-react';
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
  onSuccess: () => void;
}

export default function MobileValidationDialog({ open, onOpenChange, methods, photoUrl, onSuccess }: Props) {
  const hasFacial = methods.some(m => m.method_type === 'facial' && m.is_active);
  const hasQr = methods.some(m => m.method_type === 'qrcode' && m.is_active);
  const validQrIds = methods.filter(m => m.method_type === 'qrcode' && m.is_active).map(m => m.identifier);

  const [tab, setTab] = useState<string>(hasFacial && photoUrl ? 'facial' : (hasQr ? 'qrcode' : 'facial'));
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setMessage('');
    setTab(hasFacial && photoUrl ? 'facial' : (hasQr ? 'qrcode' : 'facial'));
  }, [open, hasFacial, hasQr, photoUrl]);

  // Start camera when open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const facingMode = tab === 'facial' ? 'user' : 'environment';

    (async () => {
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
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error('camera error', e);
        toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    })();

    return () => {
      cancelled = true;
      if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    };
  }, [open, tab]);

  // Stop stream on close / tab change
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
    }
  }, [open, stream]);

  // QR scanning loop
  useEffect(() => {
    if (!open || tab !== 'qrcode' || !stream || status !== 'idle') return;

    const tick = () => {
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
            if (validQrIds.includes(code.data)) {
              setStatus('success');
              setMessage('QR Code validado');
              setTimeout(() => {
                onSuccess();
                onOpenChange(false);
              }, 600);
              return;
            } else {
              setMessage(`QR não corresponde: ${code.data.substring(0, 20)}…`);
            }
          }
        }
      }
      scanRafRef.current = requestAnimationFrame(tick);
    };
    scanRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    };
  }, [open, tab, stream, status, validQrIds, onSuccess, onOpenChange]);

  const captureFacial = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setValidating(true);
    setMessage('');
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];

      if (!photoUrl) {
        // Selfie proof-of-life only
        setStatus('success');
        setMessage('Selfie capturada');
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 600);
        return;
      }

      const { data, error } = await supabase.functions.invoke('validate-face', {
        body: { selfieBase64: base64, registeredPhotoUrl: photoUrl },
      });
      if (error) throw error;

      if (data?.isMatch) {
        setStatus('success');
        setMessage(`Rosto validado (${data.confidence}%)`);
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
        }, 700);
      } else {
        setStatus('error');
        setMessage(data?.reason || 'Rosto não corresponde ao cadastrado');
      }
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMessage(e?.message || 'Falha na validação');
    } finally {
      setValidating(false);
    }
  };

  const retry = () => {
    setStatus('idle');
    setMessage('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Validação necessária</DialogTitle>
          <DialogDescription>
            Confirme sua identidade para registrar o ponto.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
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
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-success/40">
                  <Check className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
            {message && (
              <p className={`text-sm text-center ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
            )}
            {status === 'error' ? (
              <Button onClick={retry} variant="outline" className="w-full">
                <X className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            ) : (
              <Button onClick={captureFacial} disabled={validating || status === 'success'} className="w-full">
                {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                {photoUrl ? 'Validar rosto' : 'Capturar selfie'}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="qrcode" className="space-y-3">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-8 border-2 border-white/70 rounded-lg pointer-events-none" />
              {status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-success/40">
                  <Check className="h-16 w-16 text-white" />
                </div>
              )}
            </div>
            <p className={`text-sm text-center ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {message || 'Aponte a câmera para o seu QR Code'}
            </p>
          </TabsContent>
        </Tabs>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
