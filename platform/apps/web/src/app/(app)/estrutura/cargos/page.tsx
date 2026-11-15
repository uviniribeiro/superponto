'use client';

import { CatalogPage } from '@/components/catalog-page';
import { POSITIONS_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={POSITIONS_DEF} />;
}
