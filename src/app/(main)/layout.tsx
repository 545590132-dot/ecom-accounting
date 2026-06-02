'use client';

import React from 'react';
import { AppSidebar } from '@/components/features/app-sidebar';
import { DataProvider } from '@/components/data-provider';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </DataProvider>
  );
}
