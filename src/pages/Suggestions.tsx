import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Lightbulb, Send, RefreshCw, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Suggestion {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: 'improvement', label: 'Melhoria' },
  { value: 'feature', label: 'Nova Funcionalidade' },
  { value: 'report', label: 'Novo Relatório' },
  { value: 'bug', label: 'Problema / Bug' },
  { value: 'other', label: 'Outro' },
];
const PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
];
const STATUSES = [
  { value: 'new', label: 'Nova', color: 'bg-blue-500' },
  { value: 'reviewing', label: 'Em análise', color: 'bg-amber-500' },
  { value: 'planned', label: 'Planejada', color: 'bg-purple-500' },
  { value: 'in_progress', label: 'Em desenvolvimento', color: 'bg-cyan-500' },
  { value: 'done', label: 'Concluída', color: 'bg-emerald-600' },
  { value: 'rejected', label: 'Rejeitada', color: 'bg-gray-500' },
];

export default function Suggestions() {
  const { user, profile, isAdmin } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('improvement');
  const [priority, setPriority] = useState('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error('Erro ao carregar: ' + error.message);
    setItems((data as Suggestion[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !description.trim()) {
      toast.error('Preencha título e descrição');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('system_suggestions').insert({
      user_id: user.id,
      company_id: profile?.company_id ?? null,
      category,
      priority,
      title: title.trim(),
      description: description.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Sugestão enviada. Obrigado!');
    setTitle(''); setDescription(''); setCategory('improvement'); setPriority('medium');
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('system_suggestions').update({ status }).eq('id', id);
    if (error) return toast.error('Falha: ' + error.message);
    toast.success('Status atualizado');
    load();
  };

  const updateNotes = async (id: string, admin_notes: string) => {
    const { error } = await supabase.from('system_suggestions').update({ admin_notes }).eq('id', id);
    if (error) return toast.error('Falha: ' + error.message);
    toast.success('Notas salvas');
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir sugestão?')) return;
    const { error } = await supabase.from('system_suggestions').delete().eq('id', id);
    if (error) return toast.error('Falha: ' + error.message);
    toast.success('Excluída');
    load();
  };

  const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;
  const statusMeta = (v: string) => STATUSES.find(s => s.value === v) || STATUSES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Lightbulb className="h-7 w-7 text-amber-500" />
          Sugestões e Feedback
        </h1>
        <p className="text-muted-foreground">
          Envie ideias de melhorias, novas funcionalidades ou relatórios para o PontoMax.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar nova sugestão</CardTitle>
          <CardDescription>Descreva a sua ideia com o máximo de detalhes possível.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridade sugerida</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Exportar relatório em Excel" maxLength={140} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
              placeholder="Descreva o problema/oportunidade, quem se beneficia e como imagina que funcione." />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Enviando...' : 'Enviar sugestão'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {isAdmin ? 'Todas as sugestões' : 'Minhas sugestões'}
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? 'Painel administrativo — visualize, atualize status e adicione notas.'
                : 'Sugestões que você enviou.'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Nenhuma sugestão encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(s => {
                    const st = statusMeta(s.status);
                    return (
                      <TableRow key={s.id} className="align-top">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {format(parseISO(s.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell><Badge variant="outline">{catLabel(s.category)}</Badge></TableCell>
                        <TableCell className="max-w-md">
                          <div className="font-medium">{s.title}</div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">{s.description}</div>
                          {isAdmin && (
                            <div className="mt-2">
                              <Textarea
                                defaultValue={s.admin_notes || ''}
                                placeholder="Notas do administrador..."
                                rows={2}
                                className="text-xs"
                                onBlur={(e) => {
                                  if (e.target.value !== (s.admin_notes || '')) {
                                    updateNotes(s.id, e.target.value);
                                  }
                                }}
                              />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{PRIORITIES.find(p => p.value === s.priority)?.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUSES.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`${st.color} text-white`}>{st.label}</Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Excluir</Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
