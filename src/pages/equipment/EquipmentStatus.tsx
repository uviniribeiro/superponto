import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useEquipmentData } from '@/hooks/useEquipmentData';
import EquipmentStatusDashboard from '@/components/equipment/EquipmentStatusDashboard';
import { PageHeader } from '@/components/shared/PageHeader';

export default function EquipmentStatus() {
  const { syncAllMutation } = useEquipmentData();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Status de Comunicação"
          description="Monitoramento em tempo real dos equipamentos"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
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
