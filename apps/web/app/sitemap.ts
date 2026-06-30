import type { MetadataRoute } from 'next';

const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const lastModified = new Date();

const routes = ['/platform-v7', '/platform-v7/demo', '/platform-v7/contact'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
  }));
}
