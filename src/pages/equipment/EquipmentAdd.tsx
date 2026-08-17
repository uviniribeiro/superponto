import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, PlusCircle } from 'lucide-react';
import { useEquipmentData, defaultEquipment } from '@/hooks/useEquipmentData';
import EquipmentFormDialog from '@/components/equipment/EquipmentFormDialog';
import { PageHeader } from '@/components/shared/PageHeader';

export default function EquipmentAdd() {
  const [isDialogOpen, setIsDialogOpen] = useState(true);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <PageHeader
          icon={PlusCircle}
          title="Adicionar Equipamento"
          description="Cadastre um novo relógio de ponto"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
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
