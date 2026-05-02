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
      {
        source: '/platform-v7/deals/:id',
        destination: '/platform-v7/deals/:id/clean',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
