import React from 'react';
import CategoryHub from '@/components/CategoryHub';
import { relatoriosHubConfig } from '@/config/categoryHubConfigs';

export default function NewReports() {
  return <CategoryHub config={relatoriosHubConfig} />;
}
