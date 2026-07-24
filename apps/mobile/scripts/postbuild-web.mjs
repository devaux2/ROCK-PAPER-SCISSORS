// Injects mobile-web/PWA tags into the exported dist/index.html:
// install-to-home-screen manifest, iOS standalone meta, and touch CSS.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
let html = readFileSync(indexPath, 'utf-8');

const inject = `
    <meta name="theme-color" content="#0D1117" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/pwa-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Throwdown" />
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
console.log('postbuild-web: PWA tags injected into dist/index.html');
