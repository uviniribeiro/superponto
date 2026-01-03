import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, History, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedFromSector, setSelectedFromSector] = useState<string>("");
  const [selectedToSector, setSelectedToSector] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Get all sector IDs including the city hall itself
  const allSectorIds = [cityHallId, ...sectors.map(s => s.id)];

  useEffect(() => {
    if (open) {
      fetchEmployees();
      fetchTransferHistory();
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
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error("Erro ao carregar funcionários");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      // Fetch transfers for all sectors of this city hall
      const { data, error } = await supabase
        .from("employee_transfers")
        .select("*")
        .or(`from_company_id.in.(${allSectorIds.join(",")}),to_company_id.in.(${allSectorIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch additional data for display
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

  const handleTransfer = async () => {
    if (!selectedEmployee || !selectedToSector) {
      toast.error("Selecione o funcionário e o setor de destino");
      return;
    }

    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;

    if (employee.company_id === selectedToSector) {
      toast.error("O funcionário já está neste setor");
      return;
    }

    setIsTransferring(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Start a transaction-like operation
      // 1. Create transfer record
      const { error: transferError } = await supabase
        .from("employee_transfers")
        .insert({
          profile_id: selectedEmployee,
          from_company_id: employee.company_id,
          to_company_id: selectedToSector,
          transferred_by: user.id,
          reason: reason || null,
          notes: notes || null
        });

      if (transferError) throw transferError;

      // 2. Update employee's company_id
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ company_id: selectedToSector })
        .eq("id", selectedEmployee);

      if (updateError) throw updateError;

      // 3. Update employee schedules to new company
      await supabase
        .from("employee_schedules")
        .update({ company_id: selectedToSector })
        .eq("profile_id", selectedEmployee);

      // 4. Update employee scale assignments
      await supabase
        .from("employee_scale_assignments")
        .update({ company_id: selectedToSector })
        .eq("profile_id", selectedEmployee);

      // 5. Update employee off days
      await supabase
        .from("employee_off_days")
        .update({ company_id: selectedToSector })
        .eq("profile_id", selectedEmployee);

      // Note: time_records are NOT transferred - they stay with the original company
      // This maintains the historical record

      const toSectorName = sectors.find(s => s.id === selectedToSector)?.name || 
                          (selectedToSector === cityHallId ? cityHallName : "Setor desconhecido");

      toast.success(`Funcionário ${employee.full_name} transferido para ${toSectorName}`);
      
      // Reset form
      setSelectedEmployee("");
      setSelectedToSector("");
      setReason("");
      setNotes("");
      
      // Refresh data
      fetchEmployees();
      fetchTransferHistory();
      onTransferComplete();
    } catch (error: any) {
      console.error("Error transferring employee:", error);
      toast.error("Erro ao transferir funcionário: " + error.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const getSectorName = (id: string) => {
    if (id === cityHallId) return cityHallName;
    return sectors.find(s => s.id === id)?.name || "Setor desconhecido";
  };

  const allOptions = [
    { id: cityHallId, name: `${cityHallName} (Sede)` },
    ...sectors.map(s => ({ id: s.id, name: s.name }))
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Transferência de Funcionários - {cityHallName}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="transfer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Nova Transferência
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Setor de Origem</Label>
                <Select value={selectedFromSector} onValueChange={(value) => {
                  setSelectedFromSector(value);
                  setSelectedEmployee("");
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
              <Label>Funcionário</Label>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando funcionários...</div>
              ) : employees.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {selectedFromSector ? "Nenhum funcionário encontrado neste setor" : "Selecione um setor de origem"}
                </div>
              ) : (
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.full_name} {employee.cpf ? `(${employee.cpf})` : ""} 
                        {employee.position ? ` - ${employee.position}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Motivo da Transferência</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Remanejamento, promoção, necessidade do setor..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais sobre a transferência..."
                rows={2}
              />
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Importante:</strong> Os registros de ponto do funcionário permanecerão vinculados ao setor anterior 
                para manter o histórico. Novas marcações serão registradas no novo setor.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleTransfer} 
                disabled={!selectedEmployee || !selectedToSector || isTransferring}
              >
                {isTransferring ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {transfers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma transferência registrada
              </div>
            ) : (
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
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
