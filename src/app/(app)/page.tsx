import { NewsList } from '@/components/NewsList';

// useSearchParams in NewsList und SearchBar erfordert SSR ohne static prerender.
// Dynamic verhindert den Build-Error und passt zu unserem Modell (Live-Daten).
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <NewsList />;
}
