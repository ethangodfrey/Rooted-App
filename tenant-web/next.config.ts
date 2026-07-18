import path from 'node:path';
import type { NextConfig } from 'next';
import { validateClientEnv } from '@vendorly/env-config';

// Fail fast during Next config evaluation when client Supabase params are invalid.
validateClientEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  typedRoutes: true,
};

export default nextConfig;
