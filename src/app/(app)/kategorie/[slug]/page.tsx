import { NewsList } from '@/components/NewsList';
import type { NewsCategory } from '@/db/schema';

const VALID_CATEGORIES: NewsCategory[] = [
  'berufspolitik', 'recht', 'evidenz', 'fortbildung', 'leitlinien', 'allgemein',
];

export default async function KategoriePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = VALID_CATEGORIES.includes(slug as NewsCategory)
    ? (slug as NewsCategory)
    : null;

  return <NewsList category={category ?? undefined} />;
}
