'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const loadAllData = useAppStore((s) => s.loadAllData);
  const isLoading = useAppStore((s) => s.isLoading);
  const dbConnected = useAppStore((s) => s.dbConnected);
  const retryConnection = useAppStore((s) => s.retryConnection);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted && !loaded) {
        console.warn('数据加载超时，使用本地缓存数据');
        setLoaded(true);
      }
    }, 8000);

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
          setLoaded(true);
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
          <p className="text-slate-400 text-xs mt-1">首次加载可能需要数秒</p>
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

  return (
    <>
      {!dbConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
          <span className="text-amber-700 text-xs">
            云端数据库暂未连接，数据仅保存在本地浏览器。请前往 Supabase 控制台重启 PostgREST 服务后刷新页面。
          </span>
          <button
            className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors ml-3 shrink-0"
            onClick={() => retryConnection()}
          >
            重试连接
          </button>
        </div>
      )}
      {children}
    </>
  );
}
