import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Building2, Plus, Pencil, Search, Loader2, Network } from 'lucide-react';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { ValidatedInput } from '@/components/shared/ValidatedInput';
import {
import { PageHeader } from '@/components/shared/PageHeader';
  BRAZILIAN_STATES, cleanCNPJ, formatCNPJ, validateCNPJ, validateAddress,
} from '@/lib/validators';

export type UnitType = 'matriz' | 'filial';

export interface CompanyUnit {
  id: string;
  company_id: string;
  unit_name: string;
  trade_name: string | null;
  cnpj: string;
  unit_type: UnitType;
  parent_unit_id: string | null;
  cei: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

const emptyUnit = (companyId: string): Partial<CompanyUnit> => ({
  company_id: companyId,
  unit_name: '',
  trade_name: '',
  cnpj: '',
  unit_type: 'filial',
  parent_unit_id: null,
  cei: '',
  street: '',
  number: '',
  district: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  email: '',
  is_active: true,
});

export default function CompanyUnits() {
  const { company } = useAuth();
  const [units, setUnits] = useState<CompanyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<CompanyUnit>>(emptyUnit(''));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchUnits = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('company_units')
      .select('*')
      .eq('company_id', company.id)
      .order('unit_type', { ascending: true })
      .order('unit_name', { ascending: true });

    if (error) {
      toast.error('Não foi possível carregar as unidades', { description: error.message });
    } else {
      setUnits((data || []) as CompanyUnit[]);
    }
    setLoading(false);
  }, [company?.id]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const headquarters = useMemo(() => units.find((u) => u.unit_type === 'matriz'), [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) =>
      [u.unit_name, u.trade_name, u.cnpj, u.city].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [units, search]);

  const openNew = () => {
    setForm({ ...emptyUnit(company?.id || ''), unit_type: headquarters ? 'filial' : 'matriz', parent_unit_id: headquarters?.id ?? null });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (unit: CompanyUnit) => {
    setForm({ ...unit });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!form.unit_name || form.unit_name.trim().length < 3) {
      next.unit_name = 'Informe a razão social da unidade (mínimo 3 caracteres)';
    }

    const cnpj = validateCNPJ(form.cnpj || '');
    if (!cnpj.valid) next.cnpj = cnpj.message;

    const duplicate = units.find(
      (u) => cleanCNPJ(u.cnpj) === cleanCNPJ(form.cnpj || '') && u.id !== form.id,
    );
    if (duplicate) next.cnpj = `Este CNPJ já está cadastrado na unidade "${duplicate.unit_name}"`;

    if (form.unit_type === 'matriz' && headquarters && headquarters.id !== form.id) {
      next.unit_type = `Já existe uma matriz cadastrada ("${headquarters.unit_name}"). Cada base permite apenas uma matriz.`;
    }
    if (form.unit_type === 'filial' && !form.parent_unit_id) {
      next.parent_unit_id = 'Selecione a matriz à qual esta filial está vinculada';
    }

    const address = validateAddress({
      street: form.street || '',
      number: form.number || '',
      district: form.district || '',
      city: form.city || '',
      state: form.state || '',
      zipCode: form.zip_code || '',
    });
    Object.assign(next, address.errors);

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!company?.id) return;
    if (!validate()) {
      toast.error('Corrija os campos destacados antes de salvar');
      return;
    }
    setSaving(true);

    const payload = {
      company_id: company.id,
      unit_name: (form.unit_name || '').trim(),
      trade_name: (form.trade_name || '').trim() || null,
      cnpj: cleanCNPJ(form.cnpj || ''),
      unit_type: form.unit_type,
      parent_unit_id: form.unit_type === 'matriz' ? null : form.parent_unit_id,
      cei: (form.cei || '').trim() || null,
      street: form.street, number: form.number, district: form.district,
      city: form.city, state: form.state, zip_code: form.zip_code,
      phone: form.phone || null, email: form.email || null,
      is_active: form.is_active ?? true,
    };

    const query = form.id
      ? (supabase as any).from('company_units').update(payload).eq('id', form.id)
      : (supabase as any).from('company_units').insert(payload);

    const { error } = await query;
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar unidade', { description: error.message });
      return;
    }
    toast.success(form.id ? 'Unidade atualizada' : 'Unidade cadastrada');
    setOpen(false);
    fetchUnits();
  };

  const toggleActive = async (unit: CompanyUnit) => {
    const { error } = await (supabase as any)
      .from('company_units')
      .update({ is_active: !unit.is_active })
      .eq('id', unit.id);
    if (error) {
      toast.error('Não foi possível alterar o status', { description: error.message });
      return;
    }
    fetchUnits();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Unidades (Matriz e Filiais)"
          description="Cadastre vários CNPJs para a mesma base: uma matriz e quantas filiais forem necessárias." icon={Network}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Nova unidade
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Unidades cadastradas</CardTitle>
              <CardDescription>
                {headquarters ? `Matriz: ${headquarters.unit_name}` : 'Nenhuma matriz cadastrada ainda'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, CNPJ ou cidade"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando unidades...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
              <Button variant="outline" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar a matriz
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>
                        <div className="font-medium">{unit.unit_name}</div>
                        {unit.trade_name && (
                          <div className="text-xs text-muted-foreground">{unit.trade_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={unit.unit_type === 'matriz' ? 'default' : 'secondary'}>
                          {unit.unit_type === 'matriz' ? 'Matriz' : 'Filial'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{formatCNPJ(unit.cnpj)}</TableCell>
                      <TableCell className="text-sm">
                        {unit.city ? `${unit.city}/${unit.state ?? ''}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Switch checked={unit.is_active} onCheckedChange={() => toggleActive(unit)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
            <DialogDescription>
              Cada unidade possui CNPJ próprio. Defina se é a matriz ou uma filial vinculada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Razão social <span className="text-destructive">*</span></Label>
              <Input
                value={form.unit_name || ''}
                onChange={(e) => setForm({ ...form, unit_name: e.target.value })}
                placeholder="Razão social da unidade"
              />
              {errors.unit_name && <p className="text-xs text-destructive">{errors.unit_name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input
                value={form.trade_name || ''}
                onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de unidade <span className="text-destructive">*</span></Label>
              <Select
                value={form.unit_type}
                onValueChange={(v: UnitType) =>
                  setForm({ ...form, unit_type: v, parent_unit_id: v === 'matriz' ? null : headquarters?.id ?? null })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="matriz">Matriz</SelectItem>
                  <SelectItem value="filial">Filial</SelectItem>
                </SelectContent>
              </Select>
              {errors.unit_type && <p className="text-xs text-destructive">{errors.unit_type}</p>}
            </div>

            {form.unit_type === 'filial' && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Matriz vinculada <span className="text-destructive">*</span></Label>
                <Select
                  value={form.parent_unit_id || ''}
                  onValueChange={(v) => setForm({ ...form, parent_unit_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a matriz" /></SelectTrigger>
                  <SelectContent>
                    {units.filter((u) => u.unit_type === 'matriz').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.parent_unit_id && <p className="text-xs text-destructive">{errors.parent_unit_id}</p>}
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>CNPJ da unidade <span className="text-destructive">*</span></Label>
              <CnpjInput
                value={form.cnpj || ''}
                onChange={(v) => setForm({ ...form, cnpj: v })}
              />
              {errors.cnpj && <p className="text-xs text-destructive mt-1">{errors.cnpj}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>CEI/CAEPF</Label>
              <Input value={form.cei || ''} onChange={(e) => setForm({ ...form, cei: e.target.value })} />
            </div>

            <ValidatedInput
              kind="cep"
              label="CEP"
              value={form.zip_code || ''}
              onChange={(v) => setForm({ ...form, zip_code: v })}
            />

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Logradouro <span className="text-destructive">*</span></Label>
              <Input value={form.street || ''} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Número <span className="text-destructive">*</span></Label>
              <Input
                value={form.number || ''}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder='Número ou "S/N"'
              />
              {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Bairro <span className="text-destructive">*</span></Label>
              <Input value={form.district || ''} onChange={(e) => setForm({ ...form, district: e.target.value })} />
              {errors.district && <p className="text-xs text-destructive">{errors.district}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Cidade <span className="text-destructive">*</span></Label>
              <Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>UF <span className="text-destructive">*</span></Label>
              <Select value={form.state || ''} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>

            <ValidatedInput
              kind="phone"
              label="Telefone"
              optional
              value={form.phone || ''}
              onChange={(v) => setForm({ ...form, phone: v })}
            />

            <ValidatedInput
              kind="email"
              label="E-mail"
              optional
              value={form.email || ''}
              onChange={(v) => setForm({ ...form, email: v })}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar unidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
