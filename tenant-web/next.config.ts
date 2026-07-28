import path from 'node:path';
import type { NextConfig } from 'next';
import { validateClientEnv } from '@vendorly/env-config';

// Fail fast during Next config evaluation when client Supabase params are invalid.
validateClientEnv(process.env);

/**
 * Production remote image hosts for next/image.
 * Covers Supabase Storage, Mux streaming thumbnails, and AWS S3 buckets.
 */
const remoteImagePatterns: NonNullable<
  NonNullable<NextConfig['images']>['remotePatterns']
> = [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    pathname: '/storage/v1/**',
  },
  {
    protocol: 'https',
    hostname: 'ajedyjbdpjahnhzrxwdj.supabase.co',
    pathname: '/storage/v1/**',
  },
  {
    protocol: 'https',
    hostname: 'image.mux.com',
    pathname: '/**',
  },
  {
    protocol: 'https',
    hostname: 'stream.mux.com',
    pathname: '/**',
  },
  {
    protocol: 'https',
    hostname: '**.amazonaws.com',
    pathname: '/**',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  typedRoutes: true,
  images: {
    remotePatterns: remoteImagePatterns,
  },
};

export default nextConfig;
