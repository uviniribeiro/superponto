import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, MapPin, Users, Building2 } from 'lucide-react';

interface WorkStation {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  group_name: string | null;
  is_active: boolean;
}

export default function WorkStations() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<WorkStation | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: '',
    longitude: '',
    radius_meters: '100',
    group_name: ''
  });

  // Fetch work stations
  const { data: workStations = [], isLoading } = useQuery({
    queryKey: ['work-stations', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_stations')
        .select('*')
        .eq('company_id', profile?.company_id)
        .order('name');

      if (error) throw error;
      return data as WorkStation[];
    },
    enabled: !!profile?.company_id
  });

  // Fetch employee assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['employee-work-stations', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_work_stations')
        .select(`
          *,
          profiles:profile_id(full_name),
          work_stations:work_station_id(name)
        `)
        .eq('company_id', profile?.company_id)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: profile?.company_id,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        radius_meters: parseInt(formData.radius_meters) || 100,
        group_name: formData.group_name || null
      };

      if (editingStation) {
        const { error } = await supabase
          .from('work_stations')
          .update(payload)
          .eq('id', editingStation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('work_stations')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: editingStation ? 'Posto atualizado' : 'Posto criado' });
      queryClient.invalidateQueries({ queryKey: ['work-stations'] });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao salvar posto de trabalho', variant: 'destructive' });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('work_stations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Posto removido' });
      queryClient.invalidateQueries({ queryKey: ['work-stations'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao remover posto', variant: 'destructive' });
    }
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStation(null);
    setFormData({
      name: '',
      description: '',
      category: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      latitude: '',
      longitude: '',
      radius_meters: '100',
      group_name: ''
    });
  };

  const handleEdit = (station: WorkStation) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      description: station.description || '',
      category: station.category || '',
      address: station.address || '',
      city: station.city || '',
      state: station.state || '',
      zip_code: station.zip_code || '',
      latitude: station.latitude?.toString() || '',
      longitude: station.longitude?.toString() || '',
      radius_meters: station.radius_meters.toString(),
      group_name: station.group_name || ''
    });
    setIsDialogOpen(true);
  };

  const getEmployeeCount = (stationId: string) => {
    return assignments.filter(a => a.work_station_id === stationId).length;
  };

  // Fetch address by CEP
  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: data.logradouro || '',
          city: data.localidade || '',
          state: data.uf || ''
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Postos de Trabalho</h1>
          <p className="text-muted-foreground">Gerencie as áreas georreferenciadas para registro de ponto</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Posto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingStation ? 'Editar' : 'Novo'} Posto de Trabalho</DialogTitle>
              <DialogDescription>
                Configure a área georreferenciada para registro de ponto
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Sede Administrativa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Escritório"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do posto"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input 
                    value={formData.zip_code} 
                    onChange={(e) => {
                      setFormData({ ...formData, zip_code: e.target.value });
                      if (e.target.value.replace(/\D/g, '').length === 8) {
                        fetchAddressByCep(e.target.value);
                      }
                    }}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Input 
                    value={formData.group_name} 
                    onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                    placeholder="Ex: Centro"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input 
                  value={formData.address} 
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input 
                    value={formData.city} 
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input 
                    value={formData.state} 
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input 
                    type="number"
                    step="0.000001"
                    value={formData.latitude} 
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="-23.5505"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input 
                    type="number"
                    step="0.000001"
                    value={formData.longitude} 
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="-46.6333"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Raio (metros)</Label>
                  <Input 
                    type="number"
                    value={formData.radius_meters} 
                    onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                    placeholder="100"
                  />
                </div>
              </div>

              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || !formData.name}
                className="mt-4"
              >
                {editingStation ? 'Atualizar' : 'Criar'} Posto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total de Postos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workStations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Com Geolocalização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {workStations.filter(s => s.latitude && s.longitude).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Servidores Alocados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{assignments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Work Stations List */}
      <Card>
        <CardHeader>
          <CardTitle>Postos Cadastrados</CardTitle>
          <CardDescription>Áreas de trabalho com cercamento geográfico</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : workStations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum posto de trabalho cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Geolocalização</TableHead>
                  <TableHead>Raio</TableHead>
                  <TableHead>Servidores</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workStations.map((station) => (
                  <TableRow key={station.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{station.name}</div>
                        {station.group_name && (
                          <Badge variant="outline" className="text-xs mt-1">{station.group_name}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{station.category || '-'}</TableCell>
                    <TableCell>
                      {station.address ? (
                        <div className="text-sm">
                          <div>{station.address}</div>
                          <div className="text-muted-foreground">{station.city}/{station.state}</div>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {station.latitude && station.longitude ? (
                        <Badge className="bg-green-500">
                          <MapPin className="h-3 w-3 mr-1" />
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>{station.radius_meters}m</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEmployeeCount(station.id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(station)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (confirm('Confirma a remoção deste posto?')) {
                              deleteMutation.mutate(station.id);
                            }
                          }}
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
    </div>
  );
}
