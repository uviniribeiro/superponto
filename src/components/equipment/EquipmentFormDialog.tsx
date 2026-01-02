import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, Shield, FileText } from 'lucide-react';
import { useEquipmentData, EQUIPMENT_CATALOG, Equipment, defaultEquipment, PORTARIA_OPTIONS } from '@/hooks/useEquipmentData';

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Partial<Equipment> | null;
  onClose: () => void;
}

export default function EquipmentFormDialog({ open, onOpenChange, equipment, onClose }: EquipmentFormDialogProps) {
  const { saveMutation } = useEquipmentData();
  const [formData, setFormData] = useState<Partial<Equipment>>(defaultEquipment);

  useEffect(() => {
    if (equipment) {
      setFormData(equipment);
    } else {
      setFormData(defaultEquipment);
    }
  }, [equipment, open]);

  const selectedManufacturer = EQUIPMENT_CATALOG.find(m => m.manufacturer === formData.manufacturer);
  const selectedModel = selectedManufacturer?.models.find(m => m.value === formData.model);

  const handleManufacturerChange = (manufacturerValue: string) => {
    const manufacturer = EQUIPMENT_CATALOG.find(m => m.manufacturer === manufacturerValue);
    setFormData({
      ...formData,
      manufacturer: manufacturerValue,
      model: '',
      port: manufacturer?.models[0]?.port || 80,
      protocol: manufacturer?.models[0]?.protocol || 'http',
      api_endpoint: manufacturer?.models[0]?.endpoint || '',
    });
  };

  const handleModelChange = (modelValue: string) => {
    const model = selectedManufacturer?.models.find(m => m.value === modelValue);
    if (model) {
      setFormData({
        ...formData,
        model: modelValue,
        port: model.port,
        protocol: model.protocol,
        api_endpoint: model.endpoint,
      });
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.ip_address || !formData.manufacturer) {
      return;
    }
    saveMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  const getPortariaDescription = (value: string) => {
    switch (value) {
      case 'portaria_671':
        return 'REP-P (Programa), REP-A (Aplicativo) ou REP-C (Certificado). Obrigatória desde 2021.';
      case 'portaria_1510':
        return 'REP Convencional com memória e impressora fiscal. Regulamentação anterior.';
      case 'portaria_373':
        return 'Sistema alternativo de controle de jornada. Requer acordo coletivo.';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formData.id ? 'Editar Equipamento' : 'Novo Equipamento'}
            <Badge variant="outline" className="ml-2">
              <Shield className="h-3 w-3 mr-1" />
              MTE
            </Badge>
          </DialogTitle>
          <DialogDescription>Configure os dados do relógio de ponto conforme as portarias do Ministério do Trabalho</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Portaria Compliance */}
          <div className="space-y-2">
            <Label htmlFor="portaria" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Conformidade com Portaria *
            </Label>
            <Select 
              value={formData.portaria_compliance || 'portaria_671'} 
              onValueChange={(value: 'portaria_671' | 'portaria_1510' | 'portaria_373') => 
                setFormData({ ...formData, portaria_compliance: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a portaria" />
              </SelectTrigger>
              <SelectContent>
                {PORTARIA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.portaria_compliance && (
              <p className="text-sm text-muted-foreground">
                {getPortariaDescription(formData.portaria_compliance)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Equipamento *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="REP Entrada Principal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep_number">Nº do REP (Registro MTE)</Label>
              <Input
                id="rep_number"
                value={formData.rep_number || ''}
                onChange={(e) => setFormData({ ...formData, rep_number: e.target.value })}
                placeholder="00000000000000000"
                maxLength={17}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante *</Label>
              <Select value={formData.manufacturer || ''} onValueChange={handleManufacturerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fabricante" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CATALOG.map((m) => (
                    <SelectItem key={m.manufacturer} value={m.manufacturer}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Select
                value={formData.model || ''}
                onValueChange={handleModelChange}
                disabled={!formData.manufacturer}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {selectedManufacturer?.models.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial_number">Número de Série</Label>
            <Input
              id="serial_number"
              value={formData.serial_number || ''}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              placeholder="Ex: ABC123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ip_address">Endereço IP do Equipamento *</Label>
              <Input
                id="ip_address"
                value={formData.ip_address || ''}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Portaria Principal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário (se necessário)</Label>
              <Input
                id="username"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (se necessário)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {selectedModel && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Configuração Automática</AlertTitle>
              <AlertDescription>
                Os seguintes parâmetros foram configurados automaticamente:
                <ul className="mt-2 text-sm space-y-1">
                  <li><strong>Porta:</strong> {selectedModel.port}</li>
                  <li><strong>Protocolo:</strong> {selectedModel.protocol.toUpperCase()}</li>
                  <li><strong>Endpoint:</strong> {selectedModel.endpoint}</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {formData.portaria_compliance === 'portaria_671' && (
            <Alert className="border-primary/50 bg-primary/5">
              <Shield className="h-4 w-4 text-primary" />
              <AlertTitle>Portaria 671 - Requisitos</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• Identificação por <strong>Nº de Matrícula</strong>, PIS ou CPF</li>
                  <li>• Geração de arquivos AFD e AFDT</li>
                  <li>• NSR (Número Sequencial de Registro) obrigatório</li>
                  <li>• Registro inviolável e inalterável</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Equipamento Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
