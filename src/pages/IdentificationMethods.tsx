import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, Edit, Fingerprint, QrCode, CreditCard, KeyRound, Scan, Camera, Download } from 'lucide-react';
import QRCode from 'qrcode';

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

interface IdentificationMethod {
  id: string;
  profile_id: string;
  method_type: string;
  identifier: string | null;
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
  qr_valid_days?: number | null;
  profiles?: {
    full_name: string;
    registration_number: string | null;
  };
}

const methodTypes = [
  { value: 'facial', label: 'Biometria Facial', icon: Camera, description: 'Reconhecimento facial para registro de ponto' },
  { value: 'qrcode', label: 'QR Code', icon: QrCode, description: 'Código QR único do funcionário' },
  { value: 'rfid', label: 'RFID/Proximidade', icon: CreditCard, description: 'Cartão de proximidade' },
  { value: 'pin', label: 'PIN/Senha', icon: KeyRound, description: 'Senha numérica pessoal' },
];

export default function IdentificationMethods() {
  const { company, isAdmin } = useAuth();
  const [methods, setMethods] = useState<IdentificationMethod[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    profile_id: '',
    method_type: 'rfid',
    identifier: '',
  });

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-renew QR expirations passing while page is open
  useEffect(() => {
    const expiring = methods.filter(m =>
      m.method_type === 'qrcode' && m.is_active && m.expires_at && new Date(m.expires_at).getTime() <= now
    );
    if (expiring.length === 0) return;
    (async () => {
      for (const m of expiring) {
        const days = m.qr_valid_days || 30;
        const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('employee_identification_methods')
          .update({ expires_at: newExpiry })
          .eq('id', m.id);
      }
      fetchData();
      toast({ title: 'QR renovado', description: `${expiring.length} QR Code(s) expirado(s) foram renovados automaticamente.` });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, methods]);

  const formatCountdown = (iso?: string | null) => {
    if (!iso) return { text: '—', tone: 'muted' as const };
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return { text: 'Expirado — renovando…', tone: 'destructive' as const };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const tone = days < 1 ? 'warning' : 'default';
    if (days > 0) return { text: `${days}d ${hours}h`, tone: tone as any };
    if (hours > 0) return { text: `${hours}h ${mins}m`, tone: tone as any };
    return { text: `${mins}m ${secs}s`, tone: 'warning' as const };
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch methods
    const { data: methodsData, error: methodsError } = await supabase
      .from('employee_identification_methods')
      .select(`
        *,
        profiles:profile_id (full_name, registration_number)
      `)
      .order('created_at', { ascending: false });

    if (methodsError) {
      toast({
        title: 'Erro ao carregar métodos',
        description: methodsError.message,
        variant: 'destructive',
      });
    } else {
      setMethods(methodsData || []);
    }

    // Fetch employees
    const { data: employeesData } = await supabase
      .from('profiles')
      .select('id, full_name, registration_number')
      .eq('is_active', true)
      .order('full_name');
    
    setEmployees(employeesData || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.profile_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um funcionário',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      profile_id: formData.profile_id,
      company_id: company?.id,
      method_type: formData.method_type,
      identifier: formData.identifier || generateIdentifier(formData.method_type),
      is_active: true,
    };

    let error;
    
    if (editingId) {
      const { error: updateError } = await supabase
        .from('employee_identification_methods')
        .update(payload)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('employee_identification_methods')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Método já cadastrado',
          description: 'Este funcionário já possui este tipo de identificação',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao salvar',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: editingId ? 'Método atualizado' : 'Método cadastrado',
        description: 'Operação realizada com sucesso',
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const generateIdentifier = (type: string) => {
    switch (type) {
      case 'qrcode':
        return `QR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      case 'rfid':
        return `${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
      case 'pin':
        return Math.floor(1000 + Math.random() * 9000).toString();
      default:
        return null;
    }
  };

  const handleEdit = (method: IdentificationMethod) => {
    setEditingId(method.id);
    setFormData({
      profile_id: method.profile_id,
      method_type: method.method_type,
      identifier: method.identifier || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('employee_identification_methods')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Método removido',
        description: 'O método de identificação foi removido',
      });
      fetchData();
    }
  };

  const toggleActive = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('employee_identification_methods')
      .update({ is_active: !currentValue })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      profile_id: '',
      method_type: 'rfid',
      identifier: '',
    });
  };

  const getMethodInfo = (type: string) => {
    return methodTypes.find(m => m.value === type) || methodTypes[0];
  };

  const filteredMethods = methods.filter(m => {
    if (selectedEmployee !== 'all' && m.profile_id !== selectedEmployee) return false;
    if (selectedType !== 'all' && m.method_type !== selectedType) return false;
    return true;
  });

  // Count by type
  const countByType = methodTypes.map(type => ({
    ...type,
    count: methods.filter(m => m.method_type === type.value).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Métodos de Identificação</h1>
          <p className="text-muted-foreground">
            Gerencie formas de identificação dos funcionários para registro de ponto
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Método
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Método' : 'Novo Método de Identificação'}
              </DialogTitle>
              <DialogDescription>
                Configure uma forma de identificação para o funcionário
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Funcionário *</Label>
                <Select
                  value={formData.profile_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, profile_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} {emp.registration_number && `(${emp.registration_number})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Identificação *</Label>
                <Select
                  value={formData.method_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, method_type: value, identifier: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methodTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          <div>
                            <div>{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.method_type !== 'facial' && (
                <div className="space-y-2">
                  <Label>
                    {formData.method_type === 'pin' ? 'PIN (4 dígitos)' : 
                     formData.method_type === 'rfid' ? 'Número do Cartão' : 
                     'Identificador'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.identifier}
                      onChange={(e) => setFormData(prev => ({ ...prev, identifier: e.target.value }))}
                      placeholder={
                        formData.method_type === 'pin' ? '1234' :
                        formData.method_type === 'rfid' ? 'Ex: A1B2C3D4' :
                        'Deixe vazio para gerar automaticamente'
                      }
                      maxLength={formData.method_type === 'pin' ? 4 : undefined}
                    />
                    {formData.method_type !== 'pin' && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          identifier: generateIdentifier(prev.method_type) || '' 
                        }))}
                      >
                        Gerar
                      </Button>
                    )}
                  </div>
                  {formData.method_type === 'pin' && (
                    <p className="text-xs text-muted-foreground">
                      Use apenas números. Será gerado automaticamente se não preenchido.
                    </p>
                  )}
                </div>
              )}

              {formData.method_type === 'facial' && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Scan className="h-8 w-8" />
                    <div>
                      <p className="font-medium">Cadastro Facial</p>
                      <p className="text-sm">
                        O cadastro facial será realizado no primeiro registro de ponto do funcionário.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {countByType.map((type) => (
          <Card key={type.value} className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setSelectedType(selectedType === type.value ? 'all' : type.value)}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <type.icon className="h-4 w-4" />
                {type.label}
              </CardDescription>
              <CardTitle className="text-2xl">{type.count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[200px]">
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-[200px]">
              <Label>Tipo</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {methodTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Methods Table */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos Cadastrados</CardTitle>
          <CardDescription>
            {filteredMethods.length} método(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredMethods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum método de identificação cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Validade (QR)</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMethods.map((method) => {
                  const typeInfo = getMethodInfo(method.method_type);
                  return (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">
                        {method.profiles?.full_name}
                        {method.profiles?.registration_number && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({method.profiles.registration_number})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <typeInfo.icon className="h-3 w-3" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {method.method_type === 'pin' 
                          ? '****' 
                          : method.identifier || (method.method_type === 'facial' ? 'Pendente' : '-')}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(method.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {method.method_type === 'qrcode' ? (
                          (() => {
                            const c = formatCountdown(method.expires_at);
                            const cls =
                              c.tone === 'destructive' ? 'text-destructive font-semibold' :
                              c.tone === 'warning' ? 'text-amber-600 font-medium' :
                              c.tone === 'muted' ? 'text-muted-foreground' : '';
                            return <span className={`font-mono text-xs ${cls}`}>{c.text}</span>;
                          })()
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={method.is_active}
                          onCheckedChange={() => toggleActive(method.id, method.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {method.method_type === 'qrcode' && method.identifier && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Baixar QR Code (renova validade)"
                              onClick={async () => {
                                try {
                                  const validDays = (method as any).qr_valid_days || 30;
                                  const newExpiry = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
                                  const { error: upErr } = await supabase
                                    .from('employee_identification_methods')
                                    .update({ expires_at: newExpiry })
                                    .eq('id', method.id);
                                  if (upErr) throw upErr;

                                  const url = await QRCode.toDataURL(method.identifier!, { width: 512, margin: 2 });
                                  const a = document.createElement('a');
                                  a.href = url;
                                  const name = method.profiles?.full_name?.replace(/\s+/g, '_') || 'funcionario';
                                  a.download = `qrcode_${name}.png`;
                                  a.click();
                                  toast({
                                    title: 'QR Code gerado',
                                    description: `Válido por ${validDays} dias (até ${new Date(newExpiry).toLocaleDateString('pt-BR')}).`,
                                  });
                                  fetchData();
                                } catch (e) {
                                  toast({ title: 'Erro', description: 'Falha ao gerar QR Code', variant: 'destructive' });
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(method)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(method.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
