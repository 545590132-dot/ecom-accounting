'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const loadAllData = useAppStore((s) => s.loadAllData);
  const isLoading = useAppStore((s) => s.isLoading);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAllData().then(() => setLoaded(true));
  }, [loadAllData]);

  if (!loaded || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4" />
          <p className="text-slate-600 text-sm">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
