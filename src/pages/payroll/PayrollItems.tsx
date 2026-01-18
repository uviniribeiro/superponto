import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface PayrollItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  item_type: 'earning' | 'deduction' | 'informative';
  calculation_type: string | null;
  default_value: number | null;
  percentage: number | null;
  affects_inss: boolean;
  affects_irrf: boolean;
  affects_fgts: boolean;
  is_mandatory: boolean;
  is_active: boolean;
}

export default function PayrollItems() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PayrollItem | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    item_type: 'earning' as 'earning' | 'deduction' | 'informative',
    calculation_type: 'fixed',
    default_value: '',
    percentage: '',
    affects_inss: true,
    affects_irrf: true,
    affects_fgts: true,
    is_mandatory: false,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payroll_items')
        .select('*')
        .order('code');
      if (error) throw error;
      setItems((data || []) as PayrollItem[]);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      code: '',
      name: '',
      description: '',
      item_type: 'earning',
      calculation_type: 'fixed',
      default_value: '',
      percentage: '',
      affects_inss: true,
      affects_irrf: true,
      affects_fgts: true,
      is_mandatory: false,
    });
    setEditingItem(null);
  };

  const openEdit = (item: PayrollItem) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description || '',
      item_type: item.item_type,
      calculation_type: item.calculation_type || 'fixed',
      default_value: item.default_value?.toString() || '',
      percentage: item.percentage?.toString() || '',
      affects_inss: item.affects_inss,
      affects_irrf: item.affects_irrf,
      affects_fgts: item.affects_fgts,
      is_mandatory: item.is_mandatory,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Código e nome são obrigatórios');
      return;
    }

    try {
      const data = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        item_type: form.item_type,
        calculation_type: form.calculation_type,
        default_value: form.default_value ? parseFloat(form.default_value) : null,
        percentage: form.percentage ? parseFloat(form.percentage) : null,
        affects_inss: form.affects_inss,
        affects_irrf: form.affects_irrf,
        affects_fgts: form.affects_fgts,
        is_mandatory: form.is_mandatory,
        company_id: profile?.company_id,
      };

      if (editingItem) {
        const { error } = await supabase.from('payroll_items').update(data).eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Rubrica atualizada!');
      } else {
        const { error } = await supabase.from('payroll_items').insert(data);
        if (error) throw error;
        toast.success('Rubrica criada!');
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta rubrica?')) return;
    try {
      const { error } = await supabase.from('payroll_items').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rubrica excluída!');
      fetchItems();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' }> = {
      'earning': { label: 'Provento', variant: 'default' },
      'deduction': { label: 'Desconto', variant: 'destructive' },
      'informative': { label: 'Informativo', variant: 'secondary' },
    };
    const t = map[type] || { label: type, variant: 'secondary' };
    return <Badge variant={t.variant}>{t.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Rubrica
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>INSS</TableHead>
                <TableHead>IRRF</TableHead>
                <TableHead>FGTS</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{getTypeBadge(item.item_type)}</TableCell>
                  <TableCell>{item.affects_inss ? '✓' : '-'}</TableCell>
                  <TableCell>{item.affects_irrf ? '✓' : '-'}</TableCell>
                  <TableCell>{item.affects_fgts ? '✓' : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma rubrica cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Rubrica' : 'Nova Rubrica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="001" />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.item_type} onValueChange={(v: any) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Provento</SelectItem>
                    <SelectItem value="deduction">Desconto</SelectItem>
                    <SelectItem value="informative">Informativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Salário Base" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Padrão</Label>
                <Input type="number" value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Percentual</Label>
                <Input type="number" step="0.01" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.affects_inss} onCheckedChange={(c) => setForm({ ...form, affects_inss: c })} />
                <Label>Incide INSS</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.affects_irrf} onCheckedChange={(c) => setForm({ ...form, affects_irrf: c })} />
                <Label>Incide IRRF</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.affects_fgts} onCheckedChange={(c) => setForm({ ...form, affects_fgts: c })} />
                <Label>Incide FGTS</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}