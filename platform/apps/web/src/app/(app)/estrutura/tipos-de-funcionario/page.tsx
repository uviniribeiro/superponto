'use client';

import { CatalogPage } from '@/components/catalog-page';
import { EMPLOYEE_TYPES_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={EMPLOYEE_TYPES_DEF} />;
}
