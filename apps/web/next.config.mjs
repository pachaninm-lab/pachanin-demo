/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/', destination: '/platform-v7/control-tower', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/platform-v7/logistics/trips/:tripId', destination: '/platform-v7/logistics/trips' },
    ];
  },
};

export default nextConfig;
