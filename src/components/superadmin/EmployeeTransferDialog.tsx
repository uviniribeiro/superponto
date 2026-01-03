import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, History, Users, UserCheck, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  cpf: string | null;
  position: string | null;
  department: string | null;
  company_id: string;
}

interface Sector {
  id: string;
  name: string;
}

interface Transfer {
  id: string;
  profile_id: string;
  from_company_id: string;
  to_company_id: string;
  transfer_date: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  profile?: { full_name: string };
  from_company?: { name: string };
  to_company?: { name: string };
}

interface EmployeeTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cityHallId: string;
  cityHallName: string;
  sectors: Sector[];
  onTransferComplete: () => void;
}

export function EmployeeTransferDialog({
  open,
  onOpenChange,
  cityHallId,
  cityHallName,
  sectors,
  onTransferComplete,
}: EmployeeTransferDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedFromSector, setSelectedFromSector] = useState<string>("");
  const [selectedToSector, setSelectedToSector] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferResults, setTransferResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  // Get all sector IDs including the city hall itself
  const allSectorIds = [cityHallId, ...sectors.map(s => s.id)];

  useEffect(() => {
    if (open) {
      fetchEmployees();
      fetchTransferHistory();
      setSelectedEmployees([]);
      setTransferProgress(0);
      setTransferResults({ success: 0, failed: 0 });
    }
  }, [open, selectedFromSector]);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const companyId = selectedFromSector || cityHallId;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, cpf, position, department, company_id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
      setSelectedEmployees([]);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error("Erro ao carregar funcionários");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("employee_transfers")
        .select("*")
        .or(`from_company_id.in.(${allSectorIds.join(",")}),to_company_id.in.(${allSectorIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const profileIds = [...new Set(data.map(t => t.profile_id))];
        const companyIds = [...new Set([...data.map(t => t.from_company_id), ...data.map(t => t.to_company_id)])];

        const [profilesRes, companiesRes] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", profileIds),
          supabase.from("companies").select("id, name").in("id", companyIds)
        ]);

        const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
        const companiesMap = new Map(companiesRes.data?.map(c => [c.id, c]) || []);

        const enrichedTransfers = data.map(t => ({
          ...t,
          profile: profilesMap.get(t.profile_id),
          from_company: companiesMap.get(t.from_company_id),
          to_company: companiesMap.get(t.to_company_id)
        }));

        setTransfers(enrichedTransfers);
      } else {
        setTransfers([]);
      }
    } catch (error: any) {
      console.error("Error fetching transfer history:", error);
    }
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map(e => e.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const transferSingleEmployee = async (employee: Employee, userId: string): Promise<boolean> => {
    try {
      // 1. Create transfer record
      const { error: transferError } = await supabase
        .from("employee_transfers")
        .insert({
          profile_id: employee.id,
          from_company_id: employee.company_id,
          to_company_id: selectedToSector,
          transferred_by: userId,
          reason: reason || null,
          notes: notes || null
        });

      if (transferError) throw transferError;

      // 2. Update employee's company_id
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ company_id: selectedToSector })
        .eq("id", employee.id);

      if (updateError) throw updateError;

      // 3. Update employee schedules
      await supabase
        .from("employee_schedules")
        .update({ company_id: selectedToSector })
        .eq("profile_id", employee.id);

      // 4. Update employee scale assignments
      await supabase
        .from("employee_scale_assignments")
        .update({ company_id: selectedToSector })
        .eq("profile_id", employee.id);

      // 5. Update employee off days
      await supabase
        .from("employee_off_days")
        .update({ company_id: selectedToSector })
        .eq("profile_id", employee.id);

      return true;
    } catch (error) {
      console.error(`Error transferring employee ${employee.full_name}:`, error);
      return false;
    }
  };

  const handleBulkTransfer = async () => {
    if (selectedEmployees.length === 0 || !selectedToSector) {
      toast.error("Selecione ao menos um funcionário e o setor de destino");
      return;
    }

    const employeesToTransfer = employees.filter(e => selectedEmployees.includes(e.id));
    
    // Check if any employee is already in the destination sector
    const invalidEmployees = employeesToTransfer.filter(e => e.company_id === selectedToSector);
    if (invalidEmployees.length > 0) {
      toast.error(`${invalidEmployees.length} funcionário(s) já estão no setor de destino`);
      return;
    }

    setIsTransferring(true);
    setTransferProgress(0);
    setTransferResults({ success: 0, failed: 0 });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < employeesToTransfer.length; i++) {
        const employee = employeesToTransfer[i];
        const success = await transferSingleEmployee(employee, user.id);
        
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
        
        setTransferProgress(((i + 1) / employeesToTransfer.length) * 100);
        setTransferResults({ success: successCount, failed: failedCount });
      }

      const toSectorName = sectors.find(s => s.id === selectedToSector)?.name || 
                          (selectedToSector === cityHallId ? cityHallName : "Setor desconhecido");

      if (failedCount === 0) {
        toast.success(`${successCount} funcionário(s) transferido(s) para ${toSectorName}`);
      } else {
        toast.warning(`Transferência concluída: ${successCount} sucesso, ${failedCount} falha(s)`);
      }
      
      // Reset form
      setSelectedEmployees([]);
      setReason("");
      setNotes("");
      
      // Refresh data
      fetchEmployees();
      fetchTransferHistory();
      onTransferComplete();
    } catch (error: any) {
      console.error("Error in bulk transfer:", error);
      toast.error("Erro na transferência em massa: " + error.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const allOptions = [
    { id: cityHallId, name: `${cityHallName} (Sede)` },
    ...sectors.map(s => ({ id: s.id, name: s.name }))
  ];

  const isAllSelected = employees.length > 0 && selectedEmployees.length === employees.length;
  const isSomeSelected = selectedEmployees.length > 0 && selectedEmployees.length < employees.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Transferência de Funcionários - {cityHallName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bulk" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Transferência em Massa
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bulk" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Setor de Origem</Label>
                <Select value={selectedFromSector} onValueChange={(value) => {
                  setSelectedFromSector(value);
                  setSelectedEmployees([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Setor de Destino</Label>
                <Select value={selectedToSector} onValueChange={setSelectedToSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOptions
                      .filter(o => o.id !== selectedFromSector)
                      .map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Funcionários ({selectedEmployees.length} selecionado(s))</Label>
                {employees.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSelectAll(!isAllSelected)}
                  >
                    {isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                )}
              </div>
              
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-4">Carregando funcionários...</div>
              ) : employees.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  {selectedFromSector ? "Nenhum funcionário encontrado neste setor" : "Selecione um setor de origem"}
                </div>
              ) : (
                <ScrollArea className="h-[250px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={isAllSelected}
                            ref={(ref) => {
                              if (ref) {
                                (ref as any).indeterminate = isSomeSelected;
                              }
                            }}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Departamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow 
                          key={employee.id}
                          className={selectedEmployees.includes(employee.id) ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <Checkbox 
                              checked={selectedEmployees.includes(employee.id)}
                              onCheckedChange={(checked) => handleSelectEmployee(employee.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{employee.full_name}</TableCell>
                          <TableCell>{employee.cpf || "—"}</TableCell>
                          <TableCell>{employee.position || "—"}</TableCell>
                          <TableCell>{employee.department || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Motivo da Transferência</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Remanejamento, reorganização setorial..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={2}
                />
              </div>
            </div>

            {isTransferring && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso da transferência</span>
                  <span>{Math.round(transferProgress)}%</span>
                </div>
                <Progress value={transferProgress} className="h-2" />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="text-green-600">✓ {transferResults.success} sucesso</span>
                  {transferResults.failed > 0 && (
                    <span className="text-destructive">✗ {transferResults.failed} falha(s)</span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Importante:</strong> Os registros de ponto dos funcionários permanecerão vinculados ao setor anterior 
                  para manter o histórico. Novas marcações serão registradas no novo setor.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isTransferring}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBulkTransfer} 
                disabled={selectedEmployees.length === 0 || !selectedToSector || isTransferring}
              >
                {isTransferring 
                  ? `Transferindo ${transferResults.success + transferResults.failed}/${selectedEmployees.length}...` 
                  : `Transferir ${selectedEmployees.length} Funcionário(s)`}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transferência registrada
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell>
                          {format(new Date(transfer.transfer_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {transfer.profile?.full_name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transfer.from_company?.name || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {transfer.to_company?.name || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {transfer.reason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
