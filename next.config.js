/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/canon' },
      { source: '/cabinet', destination: '/canon/roles' },
      { source: '/roles/:path*', destination: '/canon/roles' },
      { source: '/analytics', destination: '/canon/analytics2' },
      { source: '/connectors', destination: '/canon/analytics2' },
      { source: '/receiving', destination: '/canon/receiving2' },
      { source: '/inventory', destination: '/canon/receiving2' },
      { source: '/weighbridge', destination: '/canon/receiving2' },
      { source: '/lots', destination: '/canon/catalog2' },
      { source: '/auctions', destination: '/canon/catalog2' },
      { source: '/documents', destination: '/canon/documents' },
      { source: '/deals', destination: '/canon/deals' },
      { source: '/payments', destination: '/canon/finance' },
      { source: '/dispatch', destination: '/canon/operations' },
      { source: '/logistics', destination: '/canon/operations' },
      { source: '/lab', destination: '/canon/quality' },
      { source: '/survey', destination: '/canon/quality' },
      { source: '/operator-cockpit', destination: '/canon/control' },
      { source: '/control', destination: '/canon/control' },
      { source: '/support', destination: '/canon/control' },
      { source: '/driver-mobile', destination: '/canon/mobile2' },
      { source: '/field-mobile', destination: '/canon/mobile2' },
      { source: '/market-center', destination: '/canon/market' }
    ];
  }
};

module.exports = nextConfig;
