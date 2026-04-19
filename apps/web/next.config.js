/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/platform-v7/integrations',
        destination: '/platform-v7/connectors',
        permanent: true,
      },
      {
        source: '/platform-v7/marketplace',
        destination: '/platform-v7/lots',
        permanent: true,
      },
      {
        source: '/platform-v7/analytics',
        destination: '/platform-v7/executive',
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
