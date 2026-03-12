import { defineConfig } from 'vite';

// In CI (GitHub Actions), set the base to the repo sub-path for GitHub Pages.
// Locally, use '/' so the dev server works without a sub-path.
const base = process.env.CI ? '/shoutmate/' : '/';

export default defineConfig({
  base,
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
});
