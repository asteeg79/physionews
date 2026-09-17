import { NewsList } from '@/components/NewsList';
import { isKnownCategory } from '@/lib/categories';
import type { NewsCategory } from '@/data/types';

// useSearchParams (q, tag) erfordert dynamic Rendering.
export const dynamic = 'force-dynamic';

/**
 * Dynamische Kategorie-Seite. Akzeptiert sowohl die drei sichtbaren
 * Kategorien (fachlich/gesetz/politik) als auch die alten Werte aus
 * früheren Versionen — alte Bookmarks bleiben so funktional.
 */
export default async function KategoriePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = isKnownCategory(slug) ? (slug as NewsCategory) : undefined;
  return <NewsList category={category} />;
}
