/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase payload size limit for large file uploads
  serverExternalPackages: ['pizzip'],
  images: {
    domains: ['p95t08lhll.ufs.sh'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'p95t08lhll.ufs.sh',
        port: '',
        pathname: '/f/**',
      },
    ],
    qualities: [85],
  },
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  // Increase payload size limit
  experimental: {
    serverActions: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
  },
  // Response size limit
  serverRuntimeConfig: {
    responseLimit: '20mb',
  },
};

export default nextConfig;
