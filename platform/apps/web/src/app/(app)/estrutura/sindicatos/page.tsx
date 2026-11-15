'use client';

import { CatalogPage } from '@/components/catalog-page';
import { UNIONS_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={UNIONS_DEF} />;
}
