import { validateClientEnv } from '@vendorly/env-config';

/** Runtime guard for App Router server entry — uppercase failures only. */
validateClientEnv(process.env);

export {};
