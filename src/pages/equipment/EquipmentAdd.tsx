import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useEquipmentData, defaultEquipment } from '@/hooks/useEquipmentData';
import EquipmentFormDialog from '@/components/equipment/EquipmentFormDialog';

export default function EquipmentAdd() {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Adicionar Equipamento</h1>
          <p className="text-muted-foreground">Cadastre um novo relógio de ponto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Equipamento REP</CardTitle>
          <CardDescription>
            Configure os dados do novo relógio de ponto para iniciar a sincronização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Equipamento
          </Button>
        </CardContent>
      </Card>

      <EquipmentFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        equipment={null}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
