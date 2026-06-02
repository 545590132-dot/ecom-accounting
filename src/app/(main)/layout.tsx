'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/features/app-sidebar';
import { DataProvider } from '@/components/data-provider';
import { LoginPage, isAuthenticated, clearAuth } from '@/components/features/login-page';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthenticated(isAuthenticated());
  }, []);

  const handleAuthenticated = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthenticated(false);
  };

  // Avoid hydration mismatch — render nothing until client-side mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <DataProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </DataProvider>
  );
}
