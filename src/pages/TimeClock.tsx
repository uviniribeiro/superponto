import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Clock, MapPin, LogIn, Coffee, LogOut, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [todayRecords, setTodayRecords] = useState<{ record_type: string; recorded_at: string }[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getLocation();
    if (profile) fetchTodayRecords();
  }, [profile]);

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
        
        // Try to get address from coordinates
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
      .select('record_type, recorded_at')
      .eq('profile_id', profile.id)
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay)
      .order('recorded_at', { ascending: true });

    setTodayRecords(data || []);
  };

  const recordTime = async (recordType: RecordType) => {
    if (!profile) {
      toast.error('Perfil não encontrado');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('Localização é obrigatória para registrar o ponto');
      return;
    }

    setIsRecording(true);

    try {
      const { error } = await supabase.from('time_records').insert({
        profile_id: profile.id,
        record_type: recordType,
        recorded_at: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        device_info: navigator.userAgent
      });

      if (error) throw error;

      toast.success('Ponto registrado com sucesso!');
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

  return (
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
            Clique no botão para registrar seu ponto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextRecordType ? (
            <Button
              size="lg"
              className={`w-full h-20 text-lg ${recordTypeConfig[nextRecordType].color} text-white`}
              onClick={() => recordTime(nextRecordType)}
              disabled={isRecording || isLoadingLocation || !location.latitude}
            >
              {isRecording ? (
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              ) : (
                recordTypeConfig[nextRecordType].icon
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
  );
}