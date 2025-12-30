import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, RefreshCw, Check, X, User } from 'lucide-react';
import { toast } from 'sonner';

interface SelfieCaptureProps {
  onCapture: (blob: Blob) => void;
  capturedImage: string | null;
  onClear: () => void;
  required?: boolean;
}

export function SelfieCapture({ onCapture, capturedImage, onClear, required = false }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        // Simple validation: check if the image has reasonable content
        if (blob.size < 5000) {
          toast.error('Imagem muito pequena. Posicione seu rosto corretamente.');
          return;
        }
        
        onCapture(blob);
        stopCamera();
        toast.success('Foto capturada com sucesso!');
      }
    }, 'image/jpeg', 0.9);
  }, [onCapture, stopCamera]);

  const handleClear = useCallback(() => {
    onClear();
    stopCamera();
  }, [onClear, stopCamera]);

  const handleRetake = useCallback(() => {
    onClear();
    startCamera();
  }, [onClear, startCamera]);

  return (
    <Card className={`border-2 ${required && !capturedImage ? 'border-destructive/50' : 'border-border'}`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-primary" />
            Foto do Funcionário {required && <span className="text-destructive">*</span>}
          </div>
          
          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="flex flex-col items-center gap-4">
            {/* Preview area */}
            <div className="relative w-48 h-48 bg-muted rounded-full overflow-hidden border-4 border-primary/20">
              {capturedImage ? (
                <img 
                  src={capturedImage} 
                  alt="Foto capturada" 
                  className="w-full h-full object-cover"
                />
              ) : isStreaming ? (
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="h-20 w-20 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Video element (hidden when not in preview) */}
            {!isStreaming && !capturedImage && (
              <video ref={videoRef} className="hidden" />
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {!isStreaming && !capturedImage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCamera}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {isLoading ? 'Iniciando...' : 'Abrir Câmera'}
                </Button>
              )}

              {isStreaming && !capturedImage && (
                <>
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="gap-2 gradient-primary"
                  >
                    <Check className="h-4 w-4" />
                    Capturar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopCamera}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              )}

              {capturedImage && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRetake}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tirar Outra
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleClear}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Remover
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Posicione o rosto centralizado e bem iluminado. Esta foto será usada para validação de identidade.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
