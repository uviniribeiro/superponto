import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw, Trash2, Edit, Activity, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipmentData, getManufacturerLabel, getModelLabel, PORTARIA_OPTIONS } from '@/hooks/useEquipmentData';
import EquipmentFormDialog from '@/components/equipment/EquipmentFormDialog';

export default function EquipmentList() {
  const { 
    equipments, 
    isLoading, 
    deleteMutation, 
    testConnectionMutation,
    syncAllMutation 
  } = useEquipmentData();
  
  const [editingEquipment, setEditingEquipment] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getPortariaLabel = (value: string | null | undefined) => {
    return PORTARIA_OPTIONS.find(p => p.value === value)?.label || 'Portaria 671';
  };

  const getPortariaBadgeVariant = (value: string | null | undefined) => {
    switch (value) {
      case 'portaria_671': return 'default';
      case 'portaria_1510': return 'secondary';
      case 'portaria_373': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lista de Equipamentos</h1>
          <p className="text-muted-foreground">Relógios de ponto cadastrados conforme Portarias MTE</p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncAllMutation.mutate()}
          disabled={syncAllMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
          Sincronizar Todos
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Equipamentos Cadastrados
          </CardTitle>
          <CardDescription>
            Equipamentos homologados conforme Portarias 671, 1510 e 373 do MTE. 
            Sincronização automática a cada minuto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : equipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum equipamento cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Portaria</TableHead>
                  <TableHead>Fabricante / Modelo</TableHead>
                  <TableHead>IP:Porta</TableHead>
                  <TableHead>Última Comunicação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipments.map((equipment) => (
                  <TableRow key={equipment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {equipment.is_online ? (
                          <Badge variant="default" className="bg-green-500">
                            <Wifi className="h-3 w-3 mr-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </Badge>
                        )}
                        {!equipment.is_active && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{equipment.name}</span>
                        {equipment.rep_number && (
                          <span className="text-xs text-muted-foreground font-mono">
                            REP: {equipment.rep_number}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPortariaBadgeVariant((equipment as any).portaria_compliance)}>
                        {getPortariaLabel((equipment as any).portaria_compliance)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{getManufacturerLabel(equipment.manufacturer)}</span>
                        <span className="text-sm text-muted-foreground">
                          {getModelLabel(equipment.manufacturer, equipment.model)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {equipment.ip_address}:{equipment.port}
                    </TableCell>
                    <TableCell>
                      {equipment.last_communication ? (
                        <span className="text-sm">
                          {format(new Date(equipment.last_communication), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Nunca</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testConnectionMutation.mutate(equipment.id)}
                          disabled={testConnectionMutation.isPending}
                          title="Testar Conexão"
                        >
                          <Activity className={`h-4 w-4 ${testConnectionMutation.isPending ? 'animate-pulse' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEquipment(equipment);
                            setIsDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Tem certeza que deseja remover este equipamento?')) {
                              deleteMutation.mutate(equipment.id);
                            }
                          }}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EquipmentFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        equipment={editingEquipment}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingEquipment(null);
        }}
      />
    </div>
  );
}
