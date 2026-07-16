import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Clock, MapPin, LogIn, Coffee, LogOut, Loader2, Check, FileText, Fingerprint, Hash, FlaskConical, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { HelpButton } from '@/components/HelpButton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeRecordReceipt from '@/components/time-records/TimeRecordReceipt';
import { generateTimeRecordHash } from '@/lib/transactionHash';
import MobileValidationDialog, { type IdentificationMethod } from '@/components/time-records/MobileValidationDialog';

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
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Receipt states
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastRecord, setLastRecord] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Mobile validation
  const [identMethods, setIdentMethods] = useState<IdentificationMethod[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  // Test mode + error state
  const [testMode, setTestMode] = useState(false);
  const [lastError, setLastError] = useState<{ title: string; message: string; hint?: string } | null>(null);
  const [divergenceOpen, setDivergenceOpen] = useState(false);
  const [divergenceJustification, setDivergenceJustification] = useState('');
  const [divergenceAck, setDivergenceAck] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ title: string; message: string; details: string[] } | null>(null);


  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getLocation();
    if (profile) {
      fetchTodayRecords();
      fetchCompanySettings();
      fetchIdentificationMethods();
      runFieldDiagnostic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const runFieldDiagnostic = () => {
    if (!profile) return;
    const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    const key = 'sp_tc_signature';
    const details: string[] = [];
    let title = '';
    let message = '';

    if (!profile.company_id) {
      title = 'Empresa não vinculada';
      message = 'Seu perfil não possui empresa vinculada. O registro de ponto será bloqueado até que o RH corrija.';
      details.push(`profile_id: ${profile.id}`);
      details.push('company_id: (vazio)');
      details.push(`timezone: ${currentTz}`);
      setDiagnostic({ title, message, details });
      return;
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const prev = JSON.parse(raw) as { profile_id?: string; company_id?: string; timezone?: string };
        const diffs: string[] = [];
        if (prev.profile_id && prev.profile_id !== profile.id) diffs.push(`profile_id anterior: ${prev.profile_id} → atual: ${profile.id}`);
        if (prev.company_id && prev.company_id !== profile.company_id) diffs.push(`company_id anterior: ${prev.company_id} → atual: ${profile.company_id}`);
        if (prev.timezone && prev.timezone !== currentTz) diffs.push(`timezone anterior: ${prev.timezone} → atual: ${currentTz}`);
        if (diffs.length > 0) {
          setDiagnostic({
            title: 'Divergência entre dispositivos detectada',
            message: 'Os campos enviados por este dispositivo diferem do último dispositivo utilizado. Isso pode causar falhas ou marcações inconsistentes.',
            details: diffs,
          });
          return;
        }
      }
    } catch { /* ignore */ }

    localStorage.setItem(key, JSON.stringify({
      profile_id: profile.id,
      company_id: profile.company_id,
      timezone: currentTz,
    }));
    setDiagnostic(null);
  };


  const fetchIdentificationMethods = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('employee_identification_methods')
      .select('id, method_type, identifier, is_active')
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .in('method_type', ['facial', 'qrcode']);
    setIdentMethods((data as IdentificationMethod[]) || []);
  };

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

  const parseInsertError = (error: any): { title: string; message: string; hint?: string } => {
    const msg = String(error?.message || '');
    const code = error?.code || '';
    if (msg.includes('row-level security') || code === '42501') {
      return {
        title: 'Bloqueado pela política de segurança (RLS)',
        message: 'Seu usuário não tem permissão para registrar ponto nesta empresa. Isso costuma acontecer quando o perfil está sem empresa vinculada ou fora do horário/local permitido.',
        hint: 'Peça ao RH/administrador para conferir seu perfil (empresa e cargo). Se acabou de ser criado, faça logout e login novamente.',
      };
    }
    if (code === '23505') {
      return { title: 'Registro duplicado', message: 'Já existe uma marcação idêntica registrada.', hint: 'Aguarde alguns segundos antes de tentar novamente.' };
    }
    if (code === '23503') {
      return { title: 'Vínculo inválido', message: 'Perfil ou empresa não encontrados no banco.', hint: 'Faça logout e login novamente.' };
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return { title: 'Sem conexão', message: 'Não foi possível contatar o servidor.', hint: 'Verifique sua internet e tente de novo.' };
    }
    return { title: 'Erro ao registrar ponto', message: msg || 'Erro desconhecido.', hint: 'Tente novamente. Se persistir, contate o suporte com este horário.' };
  };

  const recordTimeEntry = async () => {
    setLastError(null);
    const nextRecordType = getNextRecordType();

    if (!profile || !nextRecordType) {
      toast.error('Todos os registros do dia já foram feitos');
      return;
    }

    if (!profile.company_id) {
      const err = { title: 'Empresa não vinculada', message: 'Seu perfil não está vinculado a uma empresa.', hint: 'Contate o administrador para vincular seu perfil à empresa.' };
      setLastError(err);
      toast.error(err.title);
      return;
    }

    if (diagnostic && !divergenceAck) {
      setDivergenceOpen(true);
      return;
    }


    if (!location.latitude || !location.longitude) {
      const err = { title: 'Localização não disponível', message: 'Precisamos da localização para registrar seu ponto.', hint: 'Permita o acesso à localização no navegador (ícone de cadeado) e tente novamente.' };
      setLastError(err);
      toast.error(err.title);
      return;
    }

    setIsRecording(true);

    // TEST MODE: simulate everything, do not insert
    if (testMode) {
      await new Promise(r => setTimeout(r, 600));
      toast.success(`Modo teste: validação e permissões OK para "${recordTypeConfig[nextRecordType].label}"`);
      setIsRecording(false);
      setDragProgress(0);
      return;
    }

    try {
      const recordedAt = new Date();
      const transactionHash = await generateTimeRecordHash(
        profile.id,
        nextRecordType,
        recordedAt,
        location.latitude || undefined,
        location.longitude || undefined
      );

      const { data: newRecord, error } = await supabase.from('time_records').insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        record_type: nextRecordType,
        recorded_at: recordedAt.toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        device_info: divergenceJustification
          ? `${navigator.userAgent} | Divergência confirmada: ${divergenceJustification}`
          : navigator.userAgent,
        transaction_hash: transactionHash,
      }).select('id, nsr, recorded_at, record_type, latitude, longitude, address, transaction_hash').single();

      if (error) throw error;

      toast.success('Ponto registrado com sucesso!');

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
    } catch (error: any) {
      console.error('Error recording time:', error);
      const parsed = parseInsertError(error);
      setLastError(parsed);
      toast.error(parsed.title, { description: parsed.message });
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

  const triggerRecord = useCallback(() => {
    if (identMethods.length > 0) {
      setShowValidation(true);
    } else {
      recordTimeEntry();
    }
  }, [identMethods]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (dragProgress >= 90) {
      triggerRecord();
    } else {
      setDragProgress(0);
    }
  }, [isDragging, dragProgress, triggerRecord]);

  // Double-click handler
  const handleClick = useCallback(() => {
    if (isRecording || !nextRecordType) return;
    
    setClickCount(prev => {
      const newCount = prev + 1;
      
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      
      if (newCount === 2) {
        triggerRecord();
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

      {/* Test mode toggle */}
      <Card className={testMode ? 'border-amber-500/60 bg-amber-500/5' : ''}>
        <CardContent className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className={`h-4 w-4 ${testMode ? 'text-amber-600' : 'text-muted-foreground'}`} />
            <div>
              <Label htmlFor="test-mode" className="text-sm font-medium cursor-pointer">Modo de teste</Label>
              <p className="text-xs text-muted-foreground">Simula a validação e a permissão sem gravar o ponto.</p>
            </div>
          </div>
          <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} />
        </CardContent>
      </Card>

      {/* Diagnostic alert (field divergence) */}
      {diagnostic && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{diagnostic.title}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{diagnostic.message}</p>
            <ul className="text-xs list-disc pl-4 opacity-90">
              {diagnostic.details.map((d, i) => <li key={i} className="font-mono">{d}</li>)}
            </ul>
            <p className="text-xs">Faça logout/login neste dispositivo, ou contate o RH se o vínculo estiver incorreto.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Error alert */}
      {lastError && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{lastError.title}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{lastError.message}</p>
            {lastError.hint && <p className="text-xs opacity-90"><AlertTriangle className="inline h-3 w-3 mr-1" />{lastError.hint}</p>}
            <p className="text-xs">
              Veja detalhes técnicos em{' '}
              <Link to="/validation-audit" className="underline">Auditoria de Validações</Link>.
            </p>
          </AlertDescription>
        </Alert>
      )}

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

      <MobileValidationDialog
        open={showValidation}
        onOpenChange={setShowValidation}
        methods={identMethods}
        photoUrl={profile?.photo_url}
        profileId={profile?.id}
        companyId={profile?.company_id}
        onSuccess={recordTimeEntry}
        testMode={testMode}
      />

      <Dialog open={divergenceOpen} onOpenChange={(o) => { setDivergenceOpen(o); if (!o) { setDivergenceJustification(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Divergência de dispositivo detectada
            </DialogTitle>
            <DialogDescription>
              Os campos deste dispositivo (funcionário, empresa ou fuso horário) diferem do último dispositivo utilizado. Por segurança, a marcação está bloqueada até você justificar.
            </DialogDescription>
          </DialogHeader>

          {diagnostic && (
            <ul className="text-xs list-disc pl-5 space-y-0.5 rounded-md border p-3 bg-muted/40">
              {diagnostic.details.map((d, i) => <li key={i} className="font-mono">{d}</li>)}
            </ul>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Justificativa (obrigatória)</label>
            <Textarea
              value={divergenceJustification}
              onChange={(e) => setDivergenceJustification(e.target.value)}
              placeholder="Ex.: Estou usando um dispositivo novo / celular emprestado / trabalho remoto autorizado…"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">A justificativa será registrada junto ao ponto para fins de auditoria.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDivergenceOpen(false)}>Cancelar</Button>
            <Button
              disabled={divergenceJustification.trim().length < 5}
              onClick={() => {
                setDivergenceAck(true);
                setDivergenceOpen(false);
                setTimeout(() => recordTimeEntry(), 0);
              }}
            >
              Confirmar e registrar ponto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="timeclock" />

    </div>
  );
}
