import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, CheckCircle2, XCircle, FileWarning, User, Shield, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipmentData } from '@/hooks/useEquipmentData';
import { PageHeader } from '@/components/shared/PageHeader';

export default function EquipmentPendingRecords() {
  const { 
    pendingRecords, 
    employees, 
    pendingWithoutEmployee,
    pendingProcessed,
    linkEmployeeMutation,
    deletePendingRecordMutation
  } = useEquipmentData();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
          title="Registros Pendentes"
          description="Registros importados dos relógios de ponto - Portaria 671" icon={Shield}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />

      {/* Informação sobre ordem de vinculação */}
      <Alert className="border-primary/50 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle>Ordem de Identificação (Portaria 671)</AlertTitle>
        <AlertDescription>
          Os registros são vinculados automaticamente na seguinte ordem de prioridade:
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li><strong>Número de Matrícula</strong> - Identificador principal do funcionário</li>
            <li><strong>Número do PIS</strong> - Programa de Integração Social</li>
            <li><strong>Número do CPF</strong> - Cadastro de Pessoa Física</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Registros</p>
                <p className="text-2xl font-bold">{pendingRecords.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processados</p>
                <p className="text-2xl font-bold text-green-600">{pendingProcessed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem Funcionário</p>
                <p className="text-2xl font-bold text-orange-600">{pendingWithoutEmployee}</p>
              </div>
              <XCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingWithoutEmployee > 0 && (
        <Alert variant="destructive">
          <User className="h-4 w-4" />
          <AlertTitle>Registros sem funcionário vinculado</AlertTitle>
          <AlertDescription>
            Existem <strong>{pendingWithoutEmployee}</strong> registros que não foram vinculados automaticamente. 
            Verifique se os funcionários possuem <strong>Matrícula</strong>, <strong>PIS</strong> ou <strong>CPF</strong> cadastrados corretamente.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5" />
            Lista de Registros Pendentes
          </CardTitle>
          <CardDescription>
            Vincule funcionários manualmente aos registros não identificados. 
            Registros processados são enviados para a folha de ponto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Nenhum registro pendente encontrado</p>
              <p className="text-sm">Todos os registros foram processados com sucesso.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecords.map((record) => (
                  <TableRow key={record.id} className={!record.profile_id && !record.is_processed ? 'bg-orange-50 dark:bg-orange-950/30' : ''}>
                    <TableCell>
                      {record.is_processed ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Processado
                        </Badge>
                      ) : record.profile_id ? (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Aguardando
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Sem Funcionário
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.time_clock_equipment?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm">{record.employee_identifier}</span>
                        <span className="text-xs text-muted-foreground">
                          {record.employee_identifier.length === 11 ? 'PIS/CPF' : 
                           record.employee_identifier.length <= 10 ? 'Matrícula' : 'Identificador'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.recorded_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {record.profiles ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{record.profiles.full_name}</span>
                          {record.profiles.registration_number && (
                            <span className="text-xs text-muted-foreground">
                              Matrícula: {record.profiles.registration_number}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Não identificado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        {!record.profile_id && !record.is_processed && (
                          <div className="w-[200px]">
                            <Select
                              onValueChange={(value) => {
                                linkEmployeeMutation.mutate({ recordId: record.id, profileId: value });
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Vincular funcionário" />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    <div className="flex flex-col">
                                      <span>{emp.full_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {emp.registration_number ? `Mat: ${emp.registration_number}` : ''}
                                        {emp.pis ? ` | PIS: ${emp.pis}` : ''}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Remover este registro pendente?')) {
                              deletePendingRecordMutation.mutate(record.id);
                            }
                          }}
                          className="text-destructive"
                        >
                          Remover
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
    </div>
  );
}
