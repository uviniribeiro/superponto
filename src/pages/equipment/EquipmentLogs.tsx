import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipmentData, useAllEquipmentLogs } from '@/hooks/useEquipmentData';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function EquipmentLogs() {
  const { equipments } = useEquipmentData();
  const { logs } = useAllEquipmentLogs();
  const [filterEquipment, setFilterEquipment] = useState<string>('all');

  const filteredLogs = filterEquipment === 'all' 
    ? logs 
    : logs.filter(log => log.equipment_id === filterEquipment);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logs de Comunicação</h1>
        <p className="text-muted-foreground">Histórico de comunicação com os relógios de ponto</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Filtrar por equipamento:</span>
        <Select value={filterEquipment} onValueChange={setFilterEquipment}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os equipamentos</SelectItem>
            {equipments.map(eq => (
              <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Comunicação</CardTitle>
          <CardDescription>
            Últimos 100 registros de comunicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registros Sincronizados</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{log.time_clock_equipment?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.request_type || 'sync'}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-center">{log.records_synced || 0}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {log.message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
