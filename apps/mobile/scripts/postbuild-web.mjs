// Injects mobile-web/PWA tags into the exported dist/index.html:
// install-to-home-screen manifest, iOS standalone meta, and touch CSS.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
let html = readFileSync(indexPath, 'utf-8');

// Subpath hosts (GitHub Pages) need every absolute URL prefixed.
const base = process.env.WEB_BASE_URL ?? '';

const inject = `
    <meta name="theme-color" content="#0D1117" />
    <link rel="manifest" href="${base}/manifest.json" />
    <link rel="apple-touch-icon" href="${base}/pwa-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="RPS" />
    <style>
      /* Mobile-web: no rubber-banding, no double-tap zoom, app-like feel. */
      html, body { overscroll-behavior: none; background: #000; }
      body { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    </style>`;

// Game controls beat pinch-zoom: lock the viewport like a native app.
html = html.replace(
  /<meta name="viewport"[^>]*\/>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
);
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${inject}\n  </head>`);
}

writeFileSync(indexPath, html);
// SPA fallback for static hosts (GitHub Pages serves 404.html for unknown
// paths); the game server does its own fallback and ignores this file.
writeFileSync(indexPath.replace(/index\.html$/, '404.html'), html);

if (base) {
  const manifestPath = indexPath.replace(/index\.html$/, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.start_url = `${base}/`;
  manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: `${base}${icon.src}` }));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
console.log(`postbuild-web: PWA tags injected (base "${base || '/'}"), 404.html written`);
