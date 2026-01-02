import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, MapPin, LogIn, Coffee, LogOut, Loader2, Camera, X, ShieldCheck, ShieldAlert, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import TimeRecordReceipt from '@/components/time-records/TimeRecordReceipt';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';

interface Location {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface FaceValidationResult {
  isMatch: boolean;
  confidence: number;
  reason: string;
  error?: string;
}

export default function TimeClock() {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<Location>({ latitude: null, longitude: null, address: null });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [todayRecords, setTodayRecords] = useState<{ id?: string; nsr?: number; record_type: string; recorded_at: string; latitude?: number | null; longitude?: number | null; address?: string | null }[]>([]);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [pendingRecordType, setPendingRecordType] = useState<RecordType | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Face validation states
  const [isValidatingFace, setIsValidatingFace] = useState(false);
  const [faceValidation, setFaceValidation] = useState<FaceValidationResult | null>(null);

  // Receipt states
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastRecord, setLastRecord] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getLocation();
    if (profile) {
      fetchTodayRecords();
      fetchCompanySettings();
    }
  }, [profile]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();
    setCompanySettings(data);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const getLocation = () => {
    setIsLoadingLocation(true);
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador');
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude, address: null });
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          if (data.display_name) {
            setLocation(prev => ({ ...prev, address: data.display_name }));
          }
        } catch (error) {
          console.error('Error getting address:', error);
        }
        
        setIsLoadingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Não foi possível obter sua localização. Por favor, permita o acesso.');
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchTodayRecords = async () => {
    if (!profile) return;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data } = await supabase
      .from('time_records')
      .select('id, nsr, record_type, recorded_at, latitude, longitude, address')
      .eq('profile_id', profile.id)
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay)
      .order('recorded_at', { ascending: true });

    setTodayRecords(data || []);
  };

  const startCamera = async (recordType: RecordType) => {
    setPendingRecordType(recordType);
    setShowCamera(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Não foi possível acessar a câmera');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      stopCamera();
    }
  };

  const retakePhoto = async () => {
    setCapturedPhoto(null);
    setFaceValidation(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const cancelCamera = () => {
    stopCamera();
    setShowCamera(false);
    setCapturedPhoto(null);
    setPendingRecordType(null);
    setFaceValidation(null);
  };

  const validateFace = async (selfieDataUrl: string): Promise<FaceValidationResult> => {
    if (!profile?.photo_url) {
      return {
        isMatch: false,
        confidence: 0,
        reason: "Funcionário não possui foto cadastrada. Contate o administrador.",
        error: "NO_REGISTERED_PHOTO"
      };
    }

    try {
      // Extract base64 from data URL
      const selfieBase64 = selfieDataUrl.split(',')[1];
      
      const { data, error } = await supabase.functions.invoke('validate-face', {
        body: {
          selfieBase64,
          registeredPhotoUrl: profile.photo_url
        }
      });

      if (error) {
        console.error('Face validation error:', error);
        return {
          isMatch: false,
          confidence: 0,
          reason: "Erro ao validar face. Tente novamente.",
          error: error.message
        };
      }

      return data as FaceValidationResult;
    } catch (error) {
      console.error('Face validation error:', error);
      return {
        isMatch: false,
        confidence: 0,
        reason: "Erro de conexão. Verifique sua internet.",
        error: String(error)
      };
    }
  };

  const uploadPhoto = async (dataUrl: string): Promise<string | null> => {
    if (!profile) return null;

    try {
      const base64Data = dataUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `${profile.id}/${Date.now()}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('time-clock-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('time-clock-photos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handleCaptureAndValidate = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      stopCamera();
      
      // Validate face if employee has a registered photo
      if (profile?.photo_url) {
        setIsValidatingFace(true);
        setFaceValidation(null);
        
        try {
          const result = await validateFace(dataUrl);
          setFaceValidation(result);
          
          if (result.isMatch) {
            toast.success(`Identidade confirmada! (${result.confidence}% de confiança)`);
          } else if (result.error === "NO_REGISTERED_PHOTO") {
            toast.warning('Você não possui foto cadastrada. Contate o administrador.');
          } else {
            toast.error(`Validação facial falhou: ${result.reason}`);
          }
        } catch (error) {
          console.error('Face validation error:', error);
          setFaceValidation({
            isMatch: false,
            confidence: 0,
            reason: "Erro ao validar face",
            error: String(error)
          });
        } finally {
          setIsValidatingFace(false);
        }
      } else {
        // No registered photo - show warning but allow to proceed
        setFaceValidation({
          isMatch: false,
          confidence: 0,
          reason: "Sem foto cadastrada",
          error: "NO_REGISTERED_PHOTO"
        });
        toast.warning('Você não possui foto cadastrada. O ponto será registrado sem validação facial.');
      }
    }
  };

  const confirmAndRecord = async () => {
    if (!profile || !pendingRecordType || !capturedPhoto) {
      toast.error('Dados incompletos');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('Localização é obrigatória para registrar o ponto');
      return;
    }

    // Block if face validation failed (unless no registered photo)
    if (profile.photo_url && faceValidation && !faceValidation.isMatch && faceValidation.error !== "NO_REGISTERED_PHOTO") {
      toast.error('Validação facial falhou. Tire uma nova foto.');
      return;
    }

    setIsRecording(true);

    try {
      const photoUrl = await uploadPhoto(capturedPhoto);
      const recordedAt = new Date().toISOString();

      const { data: newRecord, error } = await supabase.from('time_records').insert({
        profile_id: profile.id,
        record_type: pendingRecordType,
        recorded_at: recordedAt,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        device_info: navigator.userAgent,
        photo_url: photoUrl
      }).select('id, nsr, recorded_at, record_type, latitude, longitude, address').single();

      if (error) throw error;

      toast.success('Ponto registrado com sucesso!');
      
      // Show receipt
      if (newRecord) {
        setLastRecord({
          id: newRecord.id,
          nsr: newRecord.nsr,
          recorded_at: newRecord.recorded_at,
          record_type: newRecord.record_type,
          latitude: newRecord.latitude,
          longitude: newRecord.longitude,
          address: newRecord.address
        });
        setShowReceipt(true);
      }
      
      cancelCamera();
      fetchTodayRecords();
    } catch (error) {
      console.error('Error recording time:', error);
      toast.error('Erro ao registrar ponto');
    } finally {
      setIsRecording(false);
    }
  };

  const getNextRecordType = (): RecordType | null => {
    if (todayRecords.length === 0) return 'entry';
    
    const lastRecord = todayRecords[todayRecords.length - 1];
    switch (lastRecord.record_type) {
      case 'entry':
        return 'break_start';
      case 'break_start':
        return 'break_end';
      case 'break_end':
        return 'exit';
      case 'exit':
        return null;
      default:
        return 'entry';
    }
  };

  const recordTypeConfig: Record<RecordType, { label: string; icon: React.ReactNode; color: string }> = {
    entry: { label: 'Entrada', icon: <LogIn className="h-6 w-6" />, color: 'bg-success hover:bg-success/90' },
    break_start: { label: 'Início Intervalo', icon: <Coffee className="h-6 w-6" />, color: 'bg-warning hover:bg-warning/90' },
    break_end: { label: 'Fim Intervalo', icon: <Coffee className="h-6 w-6" />, color: 'bg-info hover:bg-info/90' },
    exit: { label: 'Saída', icon: <LogOut className="h-6 w-6" />, color: 'bg-destructive hover:bg-destructive/90' }
  };

  const nextRecordType = getNextRecordType();

  if (showCamera) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Captura de Foto
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={cancelCamera}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <CardDescription>
              Tire uma foto para confirmar sua identidade
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {capturedPhoto ? (
                <img 
                  src={capturedPhoto} 
                  alt="Foto capturada" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Face Validation Status */}
            {capturedPhoto && (
              <div className="space-y-2">
                {isValidatingFace ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Validando identidade...</p>
                      <p className="text-xs text-muted-foreground">Comparando com foto cadastrada</p>
                    </div>
                  </div>
                ) : faceValidation ? (
                  <div className={`p-4 rounded-lg ${
                    faceValidation.isMatch 
                      ? 'bg-success/10 border border-success/30' 
                      : faceValidation.error === 'NO_REGISTERED_PHOTO'
                        ? 'bg-warning/10 border border-warning/30'
                        : 'bg-destructive/10 border border-destructive/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {faceValidation.isMatch ? (
                        <ShieldCheck className="h-6 w-6 text-success" />
                      ) : faceValidation.error === 'NO_REGISTERED_PHOTO' ? (
                        <ShieldAlert className="h-6 w-6 text-warning" />
                      ) : (
                        <ShieldAlert className="h-6 w-6 text-destructive" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${
                          faceValidation.isMatch 
                            ? 'text-success' 
                            : faceValidation.error === 'NO_REGISTERED_PHOTO'
                              ? 'text-warning'
                              : 'text-destructive'
                        }`}>
                          {faceValidation.isMatch 
                            ? 'Identidade Confirmada' 
                            : faceValidation.error === 'NO_REGISTERED_PHOTO'
                              ? 'Sem foto cadastrada'
                              : 'Validação Falhou'}
                        </p>
                        <p className="text-xs text-muted-foreground">{faceValidation.reason}</p>
                      </div>
                      {faceValidation.confidence > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold">{faceValidation.confidence}%</p>
                          <p className="text-xs text-muted-foreground">confiança</p>
                        </div>
                      )}
                    </div>
                    {faceValidation.confidence > 0 && (
                      <div className="mt-2">
                        <Progress 
                          value={faceValidation.confidence} 
                          className={`h-2 ${faceValidation.isMatch ? '[&>div]:bg-success' : '[&>div]:bg-destructive'}`}
                        />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="flex gap-3">
              {capturedPhoto ? (
                <>
                  <Button variant="outline" onClick={retakePhoto} className="flex-1" disabled={isValidatingFace}>
                    <Camera className="mr-2 h-4 w-4" />
                    Tirar Novamente
                  </Button>
                  <Button 
                    onClick={confirmAndRecord} 
                    disabled={isRecording || isValidatingFace || (profile?.photo_url && faceValidation && !faceValidation.isMatch && faceValidation.error !== "NO_REGISTERED_PHOTO")}
                    className={`flex-1 ${pendingRecordType ? recordTypeConfig[pendingRecordType].color : ''} text-white`}
                  >
                    {isRecording ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      pendingRecordType && recordTypeConfig[pendingRecordType].icon
                    )}
                    <span className="ml-2">Confirmar {pendingRecordType && recordTypeConfig[pendingRecordType].label}</span>
                  </Button>
                </>
              ) : (
                <Button onClick={handleCaptureAndValidate} className="w-full gradient-primary" size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Capturar Foto
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Clock Display */}
      <Card className="text-center overflow-hidden">
        <div className="gradient-primary py-8">
          <p className="text-primary-foreground/80 text-lg mb-2">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <div className="text-6xl md:text-8xl font-mono font-bold text-primary-foreground tracking-wider">
            {format(currentTime, 'HH:mm:ss')}
          </div>
        </div>
      </Card>

      {/* Location Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            Localização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLocation ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Obtendo localização...
            </div>
          ) : location.latitude && location.longitude ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-success">✓ Localização obtida</p>
              {location.address && (
                <p className="text-sm text-muted-foreground">{location.address}</p>
              )}
              <p className="text-xs text-muted-foreground font-mono">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">✗ Localização não disponível</p>
              <Button variant="outline" size="sm" onClick={getLocation}>
                Tentar novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar Ponto</CardTitle>
          <CardDescription>
            Clique no botão para tirar uma foto e registrar seu ponto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextRecordType ? (
            <Button
              size="lg"
              className={`w-full h-20 text-lg ${recordTypeConfig[nextRecordType].color} text-white`}
              onClick={() => startCamera(nextRecordType)}
              disabled={isRecording || isLoadingLocation || !location.latitude}
            >
              {isRecording ? (
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Camera className="mr-2 h-6 w-6" />
                  {recordTypeConfig[nextRecordType].icon}
                </>
              )}
              <span className="ml-3">{recordTypeConfig[nextRecordType].label}</span>
            </Button>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Todos os registros do dia foram feitos</p>
            </div>
          )}

          {/* Today's Records */}
          {todayRecords.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">Registros de hoje</h4>
              <div className="grid grid-cols-2 gap-2">
                {todayRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 text-sm"
                  >
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {recordTypeConfig[record.record_type as RecordType]?.label}
                    </span>
                    <span className="text-muted-foreground ml-auto font-mono">
                      {format(new Date(record.recorded_at), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Receipt Dialog */}
    <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Comprovante de Registro de Ponto</DialogTitle>
        </DialogHeader>
        {lastRecord && profile && companySettings && (
          <TimeRecordReceipt
            record={lastRecord}
            employee={{
              full_name: profile.full_name,
              pis: profile.pis,
              cpf: profile.cpf,
              registration_number: profile.registration_number
            }}
            company={{
              company_name: companySettings?.company_name || 'Empresa',
              cnpj: companySettings?.cnpj,
              address: companySettings?.address
            }}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}