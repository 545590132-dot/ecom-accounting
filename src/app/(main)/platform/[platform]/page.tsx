'use client';

import { PlatformPage } from '@/components/features/platform-page';
import type { Platform } from '@/types';
import { notFound } from 'next/navigation';

const VALID_PLATFORMS: Platform[] = ['shopee', 'lazada', 'tiktok'];

export default function PlatformRoutePage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  // We need to unwrap the promise - using React 19 convention
  // For simplicity we'll handle it in a client component wrapper
  return <PlatformRouteContent params={params} />;
}

function PlatformRouteContent({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  // This is a workaround since we can't use async in client components directly
  // We'll use a state-based approach
  return <PlatformRouteLoader params={params} />;
}

import { useState, useEffect } from 'react';

function PlatformRouteLoader({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setPlatform(p.platform));
  }, [params]);

  if (platform === null) return null;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    notFound();
  }

  return <PlatformPage platform={platform as Platform} />;
}
