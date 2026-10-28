import { defineConfig, fontProviders } from 'astro/config';
import { SITE } from './src/site.ts';

export default defineConfig({
  site: SITE.url,
  devToolbar: { enabled: false },
  // The wall script bundles three.js (about 155 kB gzipped), which is expected.
  vite: { build: { chunkSizeWarningLimit: 700 } },
  image: {
    // Large renders are allowed; the site makes its own smaller copies.
    service: { entrypoint: 'astro/assets/services/sharp', config: { limitInputPixels: false } },
  },
  // One typeface for the whole site: light for large type, regular for text, medium for small labels.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'DM Sans',
      cssVariable: '--font-sans',
      weights: ['300 500'],   // one variable file covers light to medium
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'Segoe UI', 'sans-serif'],
    },
  ],
});
