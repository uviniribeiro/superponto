import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CategoryHub from '@/components/CategoryHub';
import { categoryHubConfigMap } from '@/config/categoryHubConfigs';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  
  const config = categoryId ? categoryHubConfigMap[categoryId] : undefined;

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">Categoria não encontrada</p>
        <Button onClick={() => navigate('/home')}>
          <Home className="w-4 h-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>
    );
  }

  return <CategoryHub config={config} />;
}
