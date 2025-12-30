import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, RefreshCw, Check, X, User, Upload, Smartphone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PhotoCaptureProps {
  onCapture: (blob: Blob) => void;
  capturedImage: string | null;
  onClear: () => void;
  required?: boolean;
}

export function PhotoCapture({ onCapture, capturedImage, onClear, required = false }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
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

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    // Create blob from file and resize if needed
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize to max 640x480 while maintaining aspect ratio
        const maxWidth = 640;
        const maxHeight = 480;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
            toast.success('Foto carregada com sucesso!');
          }
        }, 'image/jpeg', 0.9);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onCapture]);

  const handleClear = useCallback(() => {
    onClear();
    stopCamera();
  }, [onClear, stopCamera]);

  const handleRetake = useCallback(() => {
    onClear();
    startCamera();
  }, [onClear, startCamera]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Card className={`border-2 ${required && !capturedImage ? 'border-destructive/50' : 'border-border'}`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-primary" />
            Foto do Funcionário {required && <span className="text-destructive">*</span>}
          </div>
          
          {/* Alert explaining purpose */}
          <Alert className="bg-primary/5 border-primary/20">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3 w-3" />
                <span>Esta foto será usada <strong>exclusivamente</strong> para validação facial no registro de ponto pelo aplicativo móvel.</span>
              </div>
            </AlertDescription>
          </Alert>
          
          {/* Hidden elements */}
          <canvas ref={canvasRef} className="hidden" />
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
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
            <div className="flex flex-wrap justify-center gap-2">
              {!isStreaming && !capturedImage && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCamera}
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {isLoading ? 'Iniciando...' : 'Usar Câmera'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerFileInput}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Fazer Upload
                  </Button>
                </>
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
                    variant="outline"
                    onClick={triggerFileInput}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Fazer Upload
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
              Envie uma foto com rosto centralizado e bem iluminado para garantir precisão na validação facial.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
