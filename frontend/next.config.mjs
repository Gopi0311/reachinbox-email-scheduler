/** @type {import('next').NextConfig} */
const API_URL = 'https://reachinbox-api-6ze5.onrender.com';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || API_URL;
    return [
      { source: '/backend-api/:path*', destination: `${backend}/:path*` },
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
      { source: '/admin/:path*', destination: `${API_URL}/admin/:path*` },
    ];
  },
};

export default nextConfig;