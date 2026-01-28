import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CategoryHub from '@/components/CategoryHub';
import { categoryHubConfigMap } from '@/config/categoryHubConfigs';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  
  const config = categoryId ? categoryHubConfigMap[categoryId] : undefined;

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">Categoria não encontrada</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={() => navigate('/home')}>
            <Home className="w-4 h-4 mr-2" />
            Início
          </Button>
        </div>
      </div>
    );
  }

  return <CategoryHub config={config} />;
}
