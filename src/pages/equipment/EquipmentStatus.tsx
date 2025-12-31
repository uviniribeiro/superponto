import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useEquipmentData } from '@/hooks/useEquipmentData';
import EquipmentStatusDashboard from '@/components/equipment/EquipmentStatusDashboard';

export default function EquipmentStatus() {
  const { syncAllMutation } = useEquipmentData();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Status de Comunicação</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real dos equipamentos</p>
        </div>
        <Button
          onClick={() => syncAllMutation.mutate()}
          disabled={syncAllMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
          Sincronizar Todos
        </Button>
      </div>

      <EquipmentStatusDashboard />
    </div>
  );
}
