import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { PushPermissionBanner } from '@/components/PushPermissionBanner';
import { InstallPrompt } from '@/components/InstallPrompt';
import { RefreshOnOpen } from '@/components/RefreshOnOpen';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <CategoryTabs />
      <InstallPrompt />
      <PushPermissionBanner />
      <RefreshOnOpen />
      <main className="flex-1 container max-w-2xl mx-auto px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
