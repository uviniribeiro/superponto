import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, UserMinus, Info } from 'lucide-react';
import { useEquipmentData } from '@/hooks/useEquipmentData';
import { toast } from 'sonner';

export default function EquipmentEmployees() {
  const { 
    equipments, 
    employees, 
    sendEmployeesMutation, 
    receiveEmployeesMutation,
    deleteFromDeviceMutation 
  } = useEquipmentData();
  
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedEmployeesToSend, setSelectedEmployeesToSend] = useState<string[]>([]);
  const [deviceEmployees, setDeviceEmployees] = useState<any[]>([]);

  const handleReceiveEmployees = async () => {
    if (!selectedEquipmentId) return;
    
    const result = await receiveEmployeesMutation.mutateAsync(selectedEquipmentId);
    if (result.success) {
      setDeviceEmployees(result.employees || []);
      toast.success(`Recebidos ${result.employees?.length || 0} funcionários do dispositivo`);
    } else {
      toast.error(result.error || 'Erro ao receber funcionários');
    }
  };

  const handleDeleteFromDevice = async (identifier: string) => {
    if (!selectedEquipmentId) return;
    
    if (confirm(`Tem certeza que deseja remover este funcionário do dispositivo?`)) {
      const result = await deleteFromDeviceMutation.mutateAsync({
        equipmentId: selectedEquipmentId,
        identifier,
      });
      if (result.success) {
        toast.success('Funcionário removido do dispositivo');
        handleReceiveEmployees();
      } else {
        toast.error(result.error || 'Erro ao remover funcionário');
      }
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Funcionários no REP</h1>
        <p className="text-muted-foreground">Envie e gerencie funcionários nos relógios de ponto</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Selecione o Equipamento</label>
        <Select
          value={selectedEquipmentId || ''}
          onValueChange={(value) => {
            setSelectedEquipmentId(value);
            setDeviceEmployees([]);
          }}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Selecione um equipamento" />
          </SelectTrigger>
          <SelectContent>
            {equipments.filter(e => e.is_active).map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                {eq.name} ({eq.ip_address})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedEquipmentId ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Selecione um equipamento para gerenciar os funcionários.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Send Employees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Enviar Funcionários para o REP
              </CardTitle>
              <CardDescription>
                Selecione os funcionários para enviar ao relógio de ponto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmployeesToSend(employees.map(e => e.id))}
                >
                  Selecionar Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmployeesToSend([])}
                >
                  Limpar
                </Button>
              </div>
              
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedEmployeesToSend.includes(emp.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEmployeesToSend([...selectedEmployeesToSend, emp.id]);
                        } else {
                          setSelectedEmployeesToSend(selectedEmployeesToSend.filter(id => id !== emp.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.registration_number ? `Mat: ${emp.registration_number}` : ''}
                        {emp.pis ? ` | PIS: ${emp.pis}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => {
                  if (selectedEquipmentId && selectedEmployeesToSend.length > 0) {
                    sendEmployeesMutation.mutate({
                      equipmentId: selectedEquipmentId,
                      profileIds: selectedEmployeesToSend,
                    }, {
                      onSuccess: () => {
                        setSelectedEmployeesToSend([]);
                      }
                    });
                  }
                }}
                disabled={sendEmployeesMutation.isPending || selectedEmployeesToSend.length === 0}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {sendEmployeesMutation.isPending ? 'Enviando...' : `Enviar ${selectedEmployeesToSend.length} Funcionário(s)`}
              </Button>
            </CardContent>
          </Card>

          {/* Receive/Delete Employees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Funcionários no Dispositivo
              </CardTitle>
              <CardDescription>
                Visualize e remova funcionários do relógio de ponto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleReceiveEmployees}
                disabled={receiveEmployeesMutation.isPending}
                variant="outline"
                className="w-full"
              >
                <Download className={`h-4 w-4 mr-2 ${receiveEmployeesMutation.isPending ? 'animate-spin' : ''}`} />
                {receiveEmployeesMutation.isPending ? 'Buscando...' : 'Buscar Funcionários do Dispositivo'}
              </Button>

              {deviceEmployees.length > 0 ? (
                <div className="border rounded-lg max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deviceEmployees.map((emp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{emp.identifier}</TableCell>
                          <TableCell>{emp.name || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFromDevice(emp.identifier)}
                              disabled={deleteFromDeviceMutation.isPending}
                            >
                              <UserMinus className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  Clique em "Buscar Funcionários" para listar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
