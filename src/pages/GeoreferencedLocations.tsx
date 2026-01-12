import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Trash2, Search, Navigation, Users } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface GeoreferencedLocation {
  id: string;
  description: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  full_name: string;
}

interface EmployeeLocation {
  id: string;
  profile_id: string;
  location_id: string;
  profiles: {
    full_name: string;
  };
}

export default function GeoreferencedLocations() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<GeoreferencedLocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<GeoreferencedLocation | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GeoreferencedLocation | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    radius_meters: '100',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [locRes, empRes] = await Promise.all([
        supabase.from('georeferenced_locations').select('*').order('description'),
        supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
      ]);

      if (locRes.error) throw locRes.error;
      setLocations(locRes.data || []);
      setEmployees(empRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeLocations = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('employee_georeferenced_locations')
        .select('id, profile_id, location_id, profiles!employee_georeferenced_locations_profile_id_fkey(full_name)')
        .eq('location_id', locationId);

      if (error) throw error;
      setEmployeeLocations(data || []);
      setSelectedEmployees((data || []).map(el => el.profile_id));
    } catch (error) {
      console.error('Error fetching employee locations:', error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
          toast.success('Localização obtida!');
        },
        (error) => {
          toast.error('Erro ao obter localização');
        }
      );
    } else {
      toast.error('Geolocalização não suportada');
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim() || formData.description.length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      toast.error('Latitude e longitude são obrigatórias');
      return;
    }

    try {
      const data = {
        description: formData.description.trim(),
        address: formData.address.trim() || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radius_meters) || 100,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingLocation) {
        const { error } = await supabase
          .from('georeferenced_locations')
          .update(data)
          .eq('id', editingLocation.id);
        if (error) throw error;
        toast.success('Local atualizado!');
      } else {
        const { error } = await supabase.from('georeferenced_locations').insert(data);
        if (error) throw error;
        toast.success('Local criado!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      console.error('Error saving location:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe um local com essa descrição');
      } else {
        toast.error('Erro ao salvar local');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este local?')) return;

    try {
      const { error } = await supabase.from('georeferenced_locations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Local excluído!');
      fetchData();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Erro ao excluir local');
    }
  };

  const openEditDialog = (location: GeoreferencedLocation) => {
    setEditingLocation(location);
    setFormData({
      description: location.description,
      address: location.address || '',
      latitude: location.latitude?.toString() || '',
      longitude: location.longitude?.toString() || '',
      radius_meters: location.radius_meters.toString(),
      is_active: location.is_active,
    });
    setIsDialogOpen(true);
  };

  const openEmployeeDialog = (location: GeoreferencedLocation) => {
    setSelectedLocation(location);
    fetchEmployeeLocations(location.id);
    setIsEmployeeDialogOpen(true);
  };

  const saveEmployeeAssignments = async () => {
    if (!selectedLocation) return;

    try {
      // Remove all existing assignments
      await supabase
        .from('employee_georeferenced_locations')
        .delete()
        .eq('location_id', selectedLocation.id);

      // Add new assignments
      if (selectedEmployees.length > 0) {
        const assignments = selectedEmployees.map(empId => ({
          profile_id: empId,
          location_id: selectedLocation.id,
          company_id: profile?.company_id,
        }));

        const { error } = await supabase
          .from('employee_georeferenced_locations')
          .insert(assignments);

        if (error) throw error;
      }

      toast.success('Funcionários vinculados!');
      setIsEmployeeDialogOpen(false);
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Erro ao vincular funcionários');
    }
  };

  const resetForm = () => {
    setEditingLocation(null);
    setFormData({
      description: '',
      address: '',
      latitude: '',
      longitude: '',
      radius_meters: '100',
      is_active: true,
    });
  };

  const filteredLocations = locations.filter(l =>
    l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleEmployee = (empId: string) => {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Locais Georreferenciados
          </h1>
          <p className="text-muted-foreground">Configure locais com coordenadas para validação de ponto mobile</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Novo Local
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Locais</CardTitle>
            <CardDescription>{locations.length} locais cadastrados</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredLocations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Coordenadas</TableHead>
                  <TableHead>Raio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.description}</TableCell>
                    <TableCell>{location.address || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{location.radius_meters}m</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? 'default' : 'secondary'}>
                        {location.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEmployeeDialog(location)} title="Funcionários">
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(location)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(location.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum local cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Editar' : 'Novo'} Local</DialogTitle>
            <DialogDescription>Configure o local georreferenciado</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nome do local"
                maxLength={150}
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Endereço completo"
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={getCurrentLocation}>
                <Navigation className="h-4 w-4 mr-2" />
                Obter Localização Atual
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude *</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="-23.550520"
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude *</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="-46.633309"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Raio (metros) *</Label>
              <Input
                type="number"
                min="50"
                value={formData.radius_meters}
                onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">Mínimo 50 metros</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Funcionários Vinculados</DialogTitle>
            <DialogDescription>
              {selectedLocation?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {employees.map((emp) => (
              <div 
                key={emp.id}
                onClick={() => toggleEmployee(emp.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedEmployees.includes(emp.id) 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={() => {}}
                    className="rounded"
                  />
                  <span>{emp.full_name}</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEmployeeAssignments} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton 
        title="Locais Georreferenciados"
        description="Configure locais com coordenadas GPS para validar marcações de ponto mobile. Funcionários vinculados terão suas marcações validadas automaticamente quando dentro do raio."
      />
    </div>
  );
}
