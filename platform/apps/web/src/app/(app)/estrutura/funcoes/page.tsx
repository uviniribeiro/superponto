'use client';

import { CatalogPage } from '@/components/catalog-page';
import { FUNCTIONS_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={FUNCTIONS_DEF} />;
}
