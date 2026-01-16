import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Info, Shield, FileText, Wifi, Fingerprint, ScanFace, CreditCard, QrCode } from 'lucide-react';
import { useEquipmentData, Equipment, defaultEquipment, PORTARIA_OPTIONS } from '@/hooks/useEquipmentData';
import { EQUIPMENT_CATALOG_FULL, PORTARIA_OPTIONS as CATALOG_PORTARIA_OPTIONS, REP_TYPES, getModelDetails, EquipmentModel } from '@/hooks/useEquipmentCatalog';

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: Partial<Equipment> | null;
  onClose: () => void;
}

export default function EquipmentFormDialog({ open, onOpenChange, equipment, onClose }: EquipmentFormDialogProps) {
  const { saveMutation } = useEquipmentData();
  const [formData, setFormData] = useState<Partial<Equipment>>(defaultEquipment);
  const [is671Compliant, setIs671Compliant] = useState(false);

  useEffect(() => {
    if (equipment) {
      setFormData(equipment);
      setIs671Compliant(equipment.portaria_compliance === 'portaria_671');
    } else {
      setFormData(defaultEquipment);
      setIs671Compliant(true);
    }
  }, [equipment, open]);

  const selectedManufacturer = EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === formData.manufacturer);
  const selectedModel = selectedManufacturer?.models.find(m => m.value === formData.model);

  const handleManufacturerChange = (manufacturerValue: string) => {
    const manufacturer = EQUIPMENT_CATALOG_FULL.find(m => m.manufacturer === manufacturerValue);
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
        portaria_compliance: model.portaria as 'portaria_671' | 'portaria_1510' | 'portaria_373',
      });
      setIs671Compliant(model.portaria === 'portaria_671');
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

  const getPortariaBadgeVariant = (portaria: string) => {
    switch (portaria) {
      case 'portaria_671': return 'default';
      case 'portaria_1510': return 'secondary';
      case 'portaria_373': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formData.id ? 'Editar Equipamento' : 'Novo Equipamento REP'}
            <Badge variant="outline" className="ml-2">
              <Shield className="h-3 w-3 mr-1" />
              MTE
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Configure o relógio de ponto conforme as portarias do Ministério do Trabalho
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
            <TabsTrigger value="connection">Conexão</TabsTrigger>
            <TabsTrigger value="compliance">Conformidade</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
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
                <Label htmlFor="manufacturer">Fabricante *</Label>
                <Select value={formData.manufacturer || ''} onValueChange={handleManufacturerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fabricante" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {EQUIPMENT_CATALOG_FULL.map((m) => (
                      <SelectItem key={m.manufacturer} value={m.manufacturer}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          <span className="text-xs text-muted-foreground">({m.country})</span>
                        </div>
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
                  <SelectContent className="max-h-[300px]">
                    {selectedManufacturer?.models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          <Badge variant={getPortariaBadgeVariant(m.portaria)} className="text-[10px] px-1">
                            {m.repType || 'REP'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedModel && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getPortariaBadgeVariant(selectedModel.portaria)}>
                      {CATALOG_PORTARIA_OPTIONS.find(p => p.value === selectedModel.portaria)?.label}
                    </Badge>
                    {selectedModel.repType && (
                      <Badge variant="outline">{REP_TYPES[selectedModel.repType as keyof typeof REP_TYPES] || selectedModel.repType}</Badge>
                    )}
                    {selectedModel.hasWebservice && (
                      <Badge variant="secondary" className="gap-1">
                        <Wifi className="h-3 w-3" /> Webservice
                      </Badge>
                    )}
                    {selectedModel.hasFacialRecognition && (
                      <Badge variant="secondary" className="gap-1">
                        <ScanFace className="h-3 w-3" /> Facial
                      </Badge>
                    )}
                    {selectedModel.hasBiometric && (
                      <Badge variant="secondary" className="gap-1">
                        <Fingerprint className="h-3 w-3" /> Biometria
                      </Badge>
                    )}
                    {selectedModel.hasRFID && (
                      <Badge variant="secondary" className="gap-1">
                        <CreditCard className="h-3 w-3" /> RFID
                      </Badge>
                    )}
                    {selectedModel.hasQRCode && (
                      <Badge variant="secondary" className="gap-1">
                        <QrCode className="h-3 w-3" /> QR Code
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serial_number">Número de Série</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number || ''}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="Ex: ABC123456"
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
          </TabsContent>

          <TabsContent value="connection" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ip_address">Endereço IP *</Label>
                <Input
                  id="ip_address"
                  value={formData.ip_address || ''}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port || 80}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 80 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocolo</Label>
                <Select 
                  value={formData.protocol || 'http'} 
                  onValueChange={(value) => setFormData({ ...formData, protocol: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_endpoint">Endpoint da API</Label>
                <Input
                  id="api_endpoint"
                  value={formData.api_endpoint || ''}
                  onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
                  placeholder="/api/v1/records"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={formData.username || ''}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
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
                  Os parâmetros foram configurados com base no modelo selecionado:
                  <ul className="mt-2 text-sm space-y-1">
                    <li><strong>Porta:</strong> {selectedModel.port}</li>
                    <li><strong>Protocolo:</strong> {selectedModel.protocol.toUpperCase()}</li>
                    <li><strong>Endpoint:</strong> {selectedModel.endpoint}</li>
                    <li><strong>Webservice:</strong> {selectedModel.hasWebservice ? 'Disponível' : 'Indisponível (requer agente local)'}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {selectedModel && !selectedModel.hasWebservice && (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertTitle>Agente Local Necessário</AlertTitle>
                <AlertDescription>
                  Este modelo não possui webservice nativo. Para sincronização automática, 
                  é necessário instalar o agente local em um computador na mesma rede do equipamento.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="portaria" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Conformidade com Portaria
              </Label>
              <Select 
                value={formData.portaria_compliance || 'portaria_671'} 
                onValueChange={(value: 'portaria_671' | 'portaria_1510' | 'portaria_373') => {
                  setFormData({ ...formData, portaria_compliance: value });
                  setIs671Compliant(value === 'portaria_671');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a portaria" />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_PORTARIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">- {option.description}</span>
                      </div>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="is_671"
                checked={is671Compliant}
                onCheckedChange={(checked) => {
                  setIs671Compliant(checked);
                  if (checked) {
                    setFormData({ ...formData, portaria_compliance: 'portaria_671' });
                  }
                }}
              />
              <Label htmlFor="is_671">Equipamento é 671 (Portaria 671/2021)</Label>
            </div>

            {is671Compliant && (
              <Alert className="border-primary/50 bg-primary/5">
                <Shield className="h-4 w-4 text-primary" />
                <AlertTitle>Portaria 671 - Requisitos</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 text-sm space-y-1">
                    <li>• Identificação por <strong>Nº de Matrícula</strong>, PIS ou CPF</li>
                    <li>• Geração de arquivos AFD e AFDT</li>
                    <li>• NSR (Número Sequencial de Registro) obrigatório</li>
                    <li>• Registro inviolável e inalterável</li>
                    <li>• REP-P, REP-A ou REP-C certificados</li>
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
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
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
