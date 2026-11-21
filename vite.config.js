import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const publicFiles = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

export default defineConfig({
  base: process.env.BASE_PATH || '/strength-log/',
  plugins: [{
    name: 'offline-app-shell',
    generateBundle(_, bundle) {
      const files = ['./', ...new Set(['index.html', ...publicFiles, ...Object.keys(bundle)])]
        .map(file => file === './' ? file : './' + file);
      const hash = createHash('sha256')
        .update(JSON.stringify(files))
        .update(process.env.BASE_PATH || '/strength-log/')
        .update(readFileSync(new URL('./index.html', import.meta.url)));
      for (const file of publicFiles) {
        hash.update(readFileSync(new URL('./public/' + file, import.meta.url)));
      }
      for (const item of Object.values(bundle)) hash.update(item.code ?? item.source);
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const prefix = 'strength-log:' + self.registration.scope + ':';
const cacheName = prefix + ${JSON.stringify(version)};
const shell = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(shell.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.hash = '';
  const navigation = event.request.mode === 'navigate' && url.href.startsWith(self.registration.scope);
  if (!navigation && !shell.includes(url.href)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    const target = navigation ? new URL('./index.html', self.registration.scope).href : url.href;
    return (await cache.match(target, { ignoreVary: true })) || fetch(event.request);
  }));
});
`,
      });
    },
  }],
});

