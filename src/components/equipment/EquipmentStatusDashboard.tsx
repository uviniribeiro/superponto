import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Server, Activity, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { useEquipmentData, getManufacturerLabel, getModelLabel } from '@/hooks/useEquipmentData';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = 'all' | 'online' | 'offline' | 'inactive';

export default function EquipmentStatusDashboard() {
  const { equipments, isLoading, onlineCount, offlineCount, syncAllMutation, testConnectionMutation } = useEquipmentData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredEquipments = equipments.filter(eq => {
    switch (statusFilter) {
      case 'online':
        return eq.is_online && eq.is_active;
      case 'offline':
        return !eq.is_online && eq.is_active;
      case 'inactive':
        return !eq.is_active;
      default:
        return true;
    }
  });

  const activeEquipments = equipments.filter(e => e.is_active).length;
  const onlinePercent = activeEquipments > 0 ? (onlineCount / activeEquipments) * 100 : 0;

  const getTimeWithoutConnection = (lastCommunication: string | null) => {
    if (!lastCommunication) return 'Nunca conectou';
    const lastComm = new Date(lastCommunication);
    return formatDistanceToNow(lastComm, { locale: ptBR, addSuffix: true });
  };

  const getConnectionStatus = (equipment: typeof equipments[0]) => {
    if (!equipment.is_active) {
      return { color: 'bg-muted', text: 'Desativado', icon: Server };
    }
    if (equipment.is_online) {
      return { color: 'bg-green-500', text: 'Online', icon: Wifi };
    }
    
    // Check how long it's been offline
    if (equipment.last_communication) {
      const lastComm = new Date(equipment.last_communication);
      const diffMinutes = (currentTime.getTime() - lastComm.getTime()) / 1000 / 60;
      
      if (diffMinutes < 5) {
        return { color: 'bg-yellow-500', text: 'Reconectando...', icon: RefreshCw };
      }
    }
    
    return { color: 'bg-red-500', text: 'Offline', icon: WifiOff };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipments.length}</div>
            <p className="text-xs text-muted-foreground">{activeEquipments} ativos</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
            <Progress value={onlinePercent} className="h-2 mt-2" />
          </CardContent>
        </Card>
        
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
            {offlineCount > 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                Atenção necessária
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {currentTime.toLocaleTimeString('pt-BR')}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Filtrar por status:</span>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="online">Apenas Online</SelectItem>
            <SelectItem value="offline">Apenas Offline</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Equipment Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Carregando equipamentos...
          </div>
        ) : filteredEquipments.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Nenhum equipamento encontrado com os filtros selecionados
          </div>
        ) : (
          filteredEquipments.map((equipment) => {
            const status = getConnectionStatus(equipment);
            const StatusIcon = status.icon;
            
            return (
              <Card key={equipment.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${status.color}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{equipment.name}</CardTitle>
                    <Badge 
                      variant={equipment.is_online ? 'default' : 'destructive'}
                      className={equipment.is_online ? 'bg-green-500' : ''}
                    >
                      <StatusIcon className={`h-3 w-3 mr-1 ${status.text === 'Reconectando...' ? 'animate-spin' : ''}`} />
                      {status.text}
                    </Badge>
                  </div>
                  <CardDescription>
                    {getManufacturerLabel(equipment.manufacturer)} - {getModelLabel(equipment.manufacturer, equipment.model)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">IP:Porta</p>
                      <p className="font-mono">{equipment.ip_address}:{equipment.port}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Localização</p>
                      <p>{equipment.location || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Última comunicação:</span>
                    <span className={!equipment.is_online ? 'text-red-500' : ''}>
                      {getTimeWithoutConnection(equipment.last_communication)}
                    </span>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => testConnectionMutation.mutate(equipment.id)}
                    disabled={testConnectionMutation.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                    Testar Conexão
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
