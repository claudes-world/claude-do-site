import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://claude.do',
  output: 'static',
  publicDir: './static',
  outDir: './dist',
  trailingSlash: 'always',
});
