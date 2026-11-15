'use client';

import { CatalogPage } from '@/components/catalog-page';
import { COST_CENTERS_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={COST_CENTERS_DEF} />;
}
