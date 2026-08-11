import { useState, useEffect, lazy, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import BottomNav from '@/components/BottomNav';
import SideNav from '@/components/SideNav';
import type { ViewKey } from '@/types';

const HomeView = lazy(() => import('@/components/HomeView'));
const QuranView = lazy(() => import('@/components/QuranView'));
const AIAssistant = lazy(() => import('@/components/AIAssistant'));
const ChallengesView = lazy(() => import('@/components/ChallengesView'));
const SettingsView = lazy(() => import('@/components/SettingsView'));
const LoginPage = lazy(() => import('@/components/LoginPage'));

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
    </div>
  );
}

function App() {
  const { authenticated, authLoading } = useApp();
  const [view, setView] = useState<ViewKey>('home');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-deep via-emerald to-emerald-deep flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
          <p className="text-sm text-emerald-100">جارٍ تحميل التطبيق...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-emerald-deep" dir="rtl">
      <div className="mx-auto flex max-w-7xl">
        <SideNav current={view} onChange={setView} />
        <main className={`w-full max-w-md mx-auto lg:mx-0 lg:flex-1 xl:max-w-4xl ${view === 'assistant' ? 'max-w-none !mx-0 lg:max-w-none' : 'lg:max-w-2xl'}`}>
          <Suspense fallback={<ViewFallback />}>
            {view === 'home' && <HomeView />}
            {view === 'quran' && <QuranView />}
            {view === 'assistant' && <AIAssistant />}
            {view === 'challenges' && <ChallengesView />}
            {view === 'settings' && <SettingsView />}
          </Suspense>
        </main>
      </div>
      <BottomNav current={view} onChange={setView} />
    </div>
  );
}

export default App;
