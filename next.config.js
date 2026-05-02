/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => {
        try {
          return url.origin === self.location.origin && url.pathname.startsWith('/uploads/');
        } catch {
          return false;
        }
      },
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'uploads-images',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 14,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
  fallbacks: {
    document: '/offline',
  },
  // Add custom service worker logic
  importScripts: ['/custom-sw.js'],
});

const nextConfig = withPWA({
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/laporan-nota-sawit',
        destination: '/laporan-kebun',
        permanent: true,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/laporan-kebun',
        destination: '/laporan-nota-sawit',
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http:; frame-ancestors 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" }
        ],
      },
    ];
  },
  distDir: '.next',
});

module.exports = nextConfig;
