// Bundles the React app with esbuild into dist/. Supabase URL + anon key are public by design
// (Row Level Security protects the data); the Groq key is only read by the /api function.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

// load .env.local / .env for local builds (Vercel injects env vars itself)
for (const f of ['.env.local', '.env']) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'assets'), { recursive: true });
cpSync(resolve(root, 'public'), out, { recursive: true });

const stamp = Date.now().toString(36);
const html = readFileSync(resolve(root, 'src/index.html'), 'utf8').replaceAll('__V__', stamp);
writeFileSync(resolve(out, 'index.html'), html);

const options = {
  entryPoints: { app: resolve(root, 'src/main.jsx'), styles: resolve(root, 'src/styles.css') },
  outdir: resolve(out, 'assets'),
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.js': 'jsx' },
  external: ['/*.jpg', '/*.png', '/*.svg', '/*.webp'], // images in public/ are served as-is
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [],
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL || ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
  },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
