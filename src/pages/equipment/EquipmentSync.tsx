import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { useEquipmentData } from '@/hooks/useEquipmentData';

export default function EquipmentSync() {
  const { equipments, syncAllMutation, testConnectionMutation } = useEquipmentData();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sincronizar Equipamentos</h1>
          <p className="text-muted-foreground">Execute a sincronização manual dos relógios de ponto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sincronização em Massa</CardTitle>
          <CardDescription>
            Sincronize todos os equipamentos ativos de uma vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            size="lg"
            className="w-full md:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
            {syncAllMutation.isPending ? 'Sincronizando...' : 'Sincronizar Todos os Equipamentos'}
          </Button>
          
          <p className="text-sm text-muted-foreground">
            A sincronização automática ocorre a cada 60 segundos. Use este botão para forçar uma sincronização imediata.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sincronização Individual</CardTitle>
          <CardDescription>
            Teste a conexão com equipamentos específicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {equipments.filter(e => e.is_active).map(equipment => (
              <Card key={equipment.id} className="bg-muted/30">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{equipment.name}</p>
                    <p className="text-xs text-muted-foreground">{equipment.ip_address}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnectionMutation.mutate(equipment.id)}
                    disabled={testConnectionMutation.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
                    Testar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
