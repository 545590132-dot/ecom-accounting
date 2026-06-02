'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const loadAllData = useAppStore((s) => s.loadAllData);
  const isLoading = useAppStore((s) => s.isLoading);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted && !loaded) {
        console.warn('数据加载超时，跳过加载直接进入');
        setLoaded(true);
      }
    }, 10000); // 10秒超时

    loadAllData()
      .then(() => {
        if (mounted) {
          clearTimeout(timeout);
          setLoaded(true);
        }
      })
      .catch((err) => {
        console.error('DataProvider loadAllData failed:', err);
        if (mounted) {
          clearTimeout(timeout);
          setError(String(err?.message || err));
          setLoaded(true); // 即使失败也进入应用
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
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

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center max-w-md px-4">
          <p className="text-red-500 text-sm mb-2">数据加载出现问题</p>
          <p className="text-slate-500 text-xs mb-4">{error}</p>
          <button
            className="px-4 py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
