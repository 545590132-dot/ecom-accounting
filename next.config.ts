import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export' as const, basePath: '/ecommerce-accounting' } : {}),
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*.dev.coze.site'],
};

export default nextConfig;
