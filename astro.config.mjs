// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Automatically detect Vercel environment (VERCEL=1 is set by Vercel)
const isVercel = process.env.VERCEL === '1' || process.env.DEPLOY_TARGET === 'vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: isVercel
    ? vercel()
    : node({
        mode: 'standalone',
      }),
  security: {
    checkOrigin: false,
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
