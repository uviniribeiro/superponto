import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileText, Plus, Edit, Trash2, Search, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useSEO from '@/hooks/useSEO';

interface CustomText {
  id: string;
  text_key: string;
  text_value: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CustomTexts() {
  useSEO({
    title: 'Textos Customizados | SuperPonto',
    description: 'Gerenciamento de textos personalizados do sistema.',
  });

  const [texts, setTexts] = useState<CustomText[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState<CustomText | null>(null);
  const [formData, setFormData] = useState({
    text_key: '',
    text_value: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchTexts();
  }, []);

  const fetchTexts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_texts')
        .select('*')
        .order('text_key', { ascending: true });

      if (error) throw error;
      setTexts(data || []);
    } catch (error) {
      console.error('Error fetching custom texts:', error);
      toast.error('Erro ao carregar textos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.text_key || !formData.text_value) {
      toast.error('Preencha a chave e o valor do texto');
      return;
    }

    try {
      if (editingText) {
        const { error } = await supabase
          .from('custom_texts')
          .update({
            text_key: formData.text_key,
            text_value: formData.text_value,
            description: formData.description || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingText.id);

        if (error) throw error;
        toast.success('Texto atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('custom_texts')
          .insert({
            text_key: formData.text_key,
            text_value: formData.text_value,
            description: formData.description || null,
            is_active: formData.is_active
          });

        if (error) throw error;
        toast.success('Texto criado com sucesso!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchTexts();
    } catch (error: any) {
      console.error('Error saving custom text:', error);
      toast.error(error.message || 'Erro ao salvar texto');
    }
  };

  const handleEdit = (text: CustomText) => {
    setEditingText(text);
    setFormData({
      text_key: text.text_key,
      text_value: text.text_value,
      description: text.description || '',
      is_active: text.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este texto?')) return;

    try {
      const { error } = await supabase
        .from('custom_texts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Texto excluído com sucesso!');
      fetchTexts();
    } catch (error) {
      console.error('Error deleting custom text:', error);
      toast.error('Erro ao excluir texto');
    }
  };

  const resetForm = () => {
    setFormData({
      text_key: '',
      text_value: '',
      description: '',
      is_active: true
    });
    setEditingText(null);
  };

  const filteredTexts = texts.filter(text =>
    text.text_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    text.text_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (text.description?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando textos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Textos Customizados
          </h1>
          <p className="text-muted-foreground">
            Personalize textos e mensagens do sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />
              Novo Texto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingText ? 'Editar Texto' : 'Novo Texto Customizado'}
              </DialogTitle>
              <DialogDescription>
                Configure textos personalizados para o sistema
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="text_key">Chave (Identificador) *</Label>
                <Input
                  id="text_key"
                  value={formData.text_key}
                  onChange={(e) => setFormData({ ...formData, text_key: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  placeholder="EX: MENSAGEM_BOAS_VINDAS"
                />
                <p className="text-xs text-muted-foreground">
                  Use letras maiúsculas e underscores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="text_value">Valor (Texto) *</Label>
                <Textarea
                  id="text_value"
                  value={formData.text_value}
                  onChange={(e) => setFormData({ ...formData, text_value: e.target.value })}
                  placeholder="Escreva o texto aqui..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Onde este texto é usado"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Ativo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Textos Cadastrados ({texts.length})</CardTitle>
              <CardDescription>Mensagens e textos personalizados</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar textos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTexts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum texto customizado encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTexts.map((text) => (
                  <TableRow key={text.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {text.text_key}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {text.text_value}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {text.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={text.is_active ? 'default' : 'secondary'}>
                        {text.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(text)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(text.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
