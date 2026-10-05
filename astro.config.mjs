import { readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import {
  rehypeLegacyHeadingIds,
  rehypeLegacyHtmlBlocks,
  rehypeLegacyTableAlign,
  remarkLegacyHtmlBlocks,
  smartypantsOptions,
} from './src/blog-core/markdown.ts';

// The legacy build.py copied only these static/ subtrees into dist/. Anything
// else at the top of static/ (robots.txt, llms.txt today) is not published by
// the live site, so the Astro build drops it too. Add a name here to ship it.
const PUBLISHED_STATIC = new Set(['styles', 'img', 'media', 'assets']);

function legacyStaticAllowlist() {
  return {
    name: 'claude-do:legacy-static-allowlist',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const publicDir = fileURLToPath(new URL('./static/', import.meta.url));
        for (const name of await readdir(publicDir)) {
          if (PUBLISHED_STATIC.has(name)) continue;
          await rm(new URL(name, dir), { recursive: true, force: true });
          logger.info(`not published (legacy static allowlist): ${name}`);
        }
      },
    },
  };
}

export default defineConfig({
  site: 'https://claude.do',
  output: 'static',
  publicDir: './static',
  outDir: './dist',
  trailingSlash: 'always',
  markdown: {
    // python-markdown emitted plain <pre><code class="language-x">.
    syntaxHighlight: false,
    processor: unified({
      gfm: true,
      smartypants: smartypantsOptions,
      remarkPlugins: [remarkLegacyHtmlBlocks],
      rehypePlugins: [rehypeLegacyHtmlBlocks, rehypeLegacyHeadingIds, rehypeLegacyTableAlign],
    }),
  },
  integrations: [legacyStaticAllowlist()],
});
