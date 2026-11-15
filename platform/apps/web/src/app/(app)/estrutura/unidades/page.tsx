'use client';

import { CatalogPage } from '@/components/catalog-page';
import { UNITS_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={UNITS_DEF} />;
}
