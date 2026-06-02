import type { Platform } from '@/types';
import PlatformRouteClient from './client';

const VALID_PLATFORMS: Platform[] = ['shopee', 'lazada', 'tiktok'];

export function generateStaticParams() {
  return VALID_PLATFORMS.map((platform) => ({ platform }));
}

export default function PlatformRoutePage({
  params,
}: {
  params: Promise<{ platform: string }>;
}) {
  return <PlatformRouteClient params={params} />;
}
