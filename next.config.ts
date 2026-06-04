import type { NextConfig } from 'next';
import { writeFileSync } from 'fs';
import { join } from 'path';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  ...(isProd ? { output: 'export' as const, basePath: '/ecom-accounting' } : {}),
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*.dev.coze.site'],
};

// GitHub Pages 需要此文件来避免 Jekyll 忽略 _next 目录
if (isProd) {
  writeFileSync(join(process.cwd(), 'out', '.nojekyll'), '');
}

export default nextConfig;
