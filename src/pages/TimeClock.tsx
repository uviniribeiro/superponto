import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Clock, MapPin, LogIn, Coffee, LogOut, Loader2, Check, FileText, Fingerprint, Hash } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeRecordReceipt from '@/components/time-records/TimeRecordReceipt';
import { generateTimeRecordHash } from '@/lib/transactionHash';

type RecordType = 'entry' | 'break_start' | 'break_end' | 'exit';

interface Location {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export default function TimeClock() {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<Location>({ latitude: null, longitude: null, address: null });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [todayRecords, setTodayRecords] = useState<{ id?: string; nsr?: number; record_type: string; recorded_at: string; latitude?: number | null; longitude?: number | null; address?: string | null; transaction_hash?: string | null }[]>([]);
  
  // Swipe button states
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

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
      .select('id, nsr, record_type, recorded_at, latitude, longitude, address, transaction_hash')
      .eq('profile_id', profile.id)
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay)
      .order('recorded_at', { ascending: true });

    setTodayRecords(data || []);
  };

  const recordTimeEntry = async () => {
    const nextRecordType = getNextRecordType();
    
    if (!profile || !nextRecordType) {
      toast.error('Todos os registros do dia já foram feitos');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('Localização é obrigatória para registrar o ponto');
      return;
    }

    setIsRecording(true);

    try {
      const recordedAt = new Date();
      
      // Generate transaction hash
      const transactionHash = await generateTimeRecordHash(
        profile.id,
        nextRecordType,
        recordedAt,
        location.latitude || undefined,
        location.longitude || undefined
      );

      const { data: newRecord, error } = await supabase.from('time_records').insert({
        profile_id: profile.id,
        record_type: nextRecordType,
        recorded_at: recordedAt.toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        device_info: navigator.userAgent,
        transaction_hash: transactionHash,
      }).select('id, nsr, recorded_at, record_type, latitude, longitude, address, transaction_hash').single();

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
          address: newRecord.address,
          transaction_hash: newRecord.transaction_hash
        });
        setShowReceipt(true);
      }
      
      fetchTodayRecords();
    } catch (error) {
      console.error('Error recording time:', error);
      toast.error('Erro ao registrar ponto');
    } finally {
      setIsRecording(false);
      setDragProgress(0);
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
    entry: { label: 'Entrada', icon: <LogIn className="h-6 w-6" />, color: 'bg-success' },
    break_start: { label: 'Início Intervalo', icon: <Coffee className="h-6 w-6" />, color: 'bg-warning' },
    break_end: { label: 'Fim Intervalo', icon: <Coffee className="h-6 w-6" />, color: 'bg-info' },
    exit: { label: 'Saída', icon: <LogOut className="h-6 w-6" />, color: 'bg-destructive' }
  };

  const nextRecordType = getNextRecordType();

  // Swipe/drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isRecording || !nextRecordType) return;
    setIsDragging(true);
  }, [isRecording, nextRecordType]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !buttonRef.current || !sliderRef.current) return;
    
    const sliderRect = sliderRef.current.getBoundingClientRect();
    const buttonRect = buttonRef.current.getBoundingClientRect();
    
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    const maxDrag = sliderRect.width - buttonRect.width - 8;
    const currentDrag = Math.max(0, Math.min(clientX - sliderRect.left - buttonRect.width / 2, maxDrag));
    const progress = (currentDrag / maxDrag) * 100;
    
    setDragProgress(progress);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (dragProgress >= 90) {
      recordTimeEntry();
    } else {
      setDragProgress(0);
    }
  }, [isDragging, dragProgress]);

  // Double-click handler
  const handleClick = useCallback(() => {
    if (isRecording || !nextRecordType) return;
    
    setClickCount(prev => {
      const newCount = prev + 1;
      
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      
      if (newCount === 2) {
        recordTimeEntry();
        return 0;
      }
      
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 400);
      
      return newCount;
    });
  }, [isRecording, nextRecordType]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove as any);
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove as any);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const recordTypeLabels: Record<string, string> = {
    entry: 'Entrada',
    break_start: 'Início Intervalo',
    break_end: 'Fim Intervalo',
    exit: 'Saída'
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Fingerprint className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Registro de Ponto</h1>
        </div>
        <p className="text-muted-foreground">Olá, {profile?.full_name?.split(' ')[0]}</p>
      </div>

      {/* Clock Display */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6 text-center">
          <div className="text-6xl font-bold tracking-tight text-primary font-mono">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <p className="text-lg text-muted-foreground mt-2">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </CardContent>
      </Card>

      {/* Location Status */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${location.latitude ? 'bg-success/20' : 'bg-warning/20'}`}>
              {isLoadingLocation ? (
                <Loader2 className="h-5 w-5 text-warning animate-spin" />
              ) : (
                <MapPin className={`h-5 w-5 ${location.latitude ? 'text-success' : 'text-warning'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {isLoadingLocation ? 'Obtendo localização...' : location.latitude ? 'Localização identificada' : 'Localização não disponível'}
              </p>
              {location.address && (
                <p className="text-xs text-muted-foreground truncate">
                  {location.address}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Swipe to Register Button */}
      {nextRecordType ? (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 text-center">
            <CardDescription>
              Próximo registro: <span className="font-medium text-foreground">{recordTypeConfig[nextRecordType].label}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              ref={sliderRef}
              className={`relative h-16 rounded-full ${recordTypeConfig[nextRecordType].color} overflow-hidden cursor-pointer select-none`}
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              onClick={handleClick}
            >
              {/* Background progress */}
              <div 
                className="absolute inset-0 bg-white/30 transition-all duration-100"
                style={{ width: `${dragProgress}%` }}
              />
              
              {/* Slider button */}
              <div
                ref={buttonRef}
                className={`absolute top-1 left-1 bottom-1 w-14 rounded-full bg-white shadow-lg flex items-center justify-center transition-transform ${isDragging ? '' : 'duration-300'}`}
                style={{ transform: `translateX(${(dragProgress / 100) * (buttonRef.current?.parentElement ? buttonRef.current.parentElement.clientWidth - 64 : 0)}px)` }}
              >
                {isRecording ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : dragProgress >= 90 ? (
                  <Check className="h-6 w-6 text-success" />
                ) : (
                  recordTypeConfig[nextRecordType].icon
                )}
              </div>
              
              {/* Text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white font-medium text-sm ml-14">
                  {isRecording 
                    ? 'Registrando...' 
                    : dragProgress > 10 
                      ? 'Continue arrastando...' 
                      : 'Segure e arraste, ou clique 2x'}
                </span>
              </div>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              Deslize até o final ou dê um duplo clique para registrar
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <Check className="h-12 w-12 mx-auto text-success mb-2" />
            <p className="font-medium">Todos os registros do dia concluídos</p>
            <p className="text-sm text-muted-foreground">Você já registrou entrada, intervalo e saída hoje</p>
          </CardContent>
        </Card>
      )}

      {/* Today's Records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Registros de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              Nenhum registro realizado hoje
            </p>
          ) : (
            <div className="space-y-2">
              {todayRecords.map((record, index) => (
                <div 
                  key={record.id || index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${
                      record.record_type === 'entry' ? 'bg-success/20 text-success' :
                      record.record_type === 'exit' ? 'bg-destructive/20 text-destructive' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {record.record_type === 'entry' ? <LogIn className="h-4 w-4" /> :
                       record.record_type === 'exit' ? <LogOut className="h-4 w-4" /> :
                       <Coffee className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{recordTypeLabels[record.record_type]}</p>
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {record.nsr && <span>NSR: {record.nsr}</span>}
                        {record.transaction_hash && (
                          <span className="flex items-center gap-0.5" title={record.transaction_hash}>
                            <Hash className="h-3 w-3" />
                            {record.transaction_hash.split('-').pop()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-lg font-mono font-semibold">
                    {format(new Date(record.recorded_at), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Comprovante de Registro
            </DialogTitle>
          </DialogHeader>
          {lastRecord && (
            <TimeRecordReceipt
              record={lastRecord}
              employee={{
                full_name: profile?.full_name || '',
                pis: profile?.pis,
                cpf: profile?.cpf,
                registration_number: profile?.registration_number
              }}
              company={{
                company_name: companySettings?.company_name || '',
                cnpj: companySettings?.cnpj,
                address: companySettings?.address
              }}
              onClose={() => setShowReceipt(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="timeclock" />
    </div>
  );
}
