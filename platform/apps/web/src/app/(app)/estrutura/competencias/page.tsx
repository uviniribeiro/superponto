'use client';

import { CatalogPage } from '@/components/catalog-page';
import { COMPETENCES_DEF } from '@/content/catalogs';

export default function Page() {
  return <CatalogPage def={COMPETENCES_DEF} />;
}
