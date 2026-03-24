import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    FRONTEND_FIREBASE_API_KEY: process.env.FRONTEND_FIREBASE_API_KEY,
    FRONTEND_FIREBASE_AUTH_DOMAIN: process.env.FRONTEND_FIREBASE_AUTH_DOMAIN,
    FRONTEND_FIREBASE_PROJECT_ID: process.env.FRONTEND_FIREBASE_PROJECT_ID,
  },
};

export default nextConfig;
