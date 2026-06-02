'use client';

import { PlatformPage } from '@/components/features/platform-page';
import type { Platform } from '@/types';
import { useState, useEffect } from 'react';

const VALID_PLATFORMS: Platform[] = ['shopee', 'lazada', 'tiktok'];

export default function PlatformRouteClient({
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
    return <div className="p-8 text-center text-muted-foreground">平台不存在</div>;
  }

  return <PlatformPage platform={platform as Platform} />;
}
