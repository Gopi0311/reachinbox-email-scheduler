/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/:path*`,
        const api = 'https://reachinbox-api-6ze5.onrender.com';
  return [
    { source: '/api/:path*', destination: `${api}/api/:path*` },
    { source: '/auth/:path*', destination: `${api}/auth/:path*` },
    { source: '/admin/:path*', destination: `${api}/admin/:path*` },
  ]
      },
    ];
  },
};

export default nextConfig;
