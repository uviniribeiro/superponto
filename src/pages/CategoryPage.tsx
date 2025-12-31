import React from 'react';
import { useParams } from 'react-router-dom';
import CategoryOverview from '@/components/CategoryOverview';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  
  return <CategoryOverview categoryId={categoryId || ''} />;
}
