// One-time security policy scope trigger; restored after the governance commit.
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vermillion-kitsune-0e7b97.netlify.app';

const STATIC_ROUTES: Array<{ url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { url: '/platform-v7',                    priority: 1.0,  changeFrequency: 'daily' },
  { url: '/platform-v7/how-it-works',       priority: 0.95, changeFrequency: 'weekly' },
  { url: '/platform-v7/deals',              priority: 0.9,  changeFrequency: 'hourly' },
  { url: '/platform-v7/lots',               priority: 0.9,  changeFrequency: 'hourly' },
  { url: '/platform-v7/control-tower',      priority: 0.85, changeFrequency: 'hourly' },
  { url: '/platform-v7/disputes',           priority: 0.8,  changeFrequency: 'daily' },
  { url: '/platform-v7/documents',          priority: 0.75, changeFrequency: 'daily' },
  { url: '/platform-v7/logistics',          priority: 0.75, changeFrequency: 'hourly' },
  { url: '/platform-v7/elevator',           priority: 0.7,  changeFrequency: 'daily' },
  { url: '/platform-v7/bank/release-safety', priority: 0.7, changeFrequency: 'daily' },
  { url: '/platform-v7/seller',             priority: 0.7,  changeFrequency: 'daily' },
  { url: '/platform-v7/buyer',              priority: 0.7,  changeFrequency: 'daily' },
  { url: '/platform-v7/operator',           priority: 0.7,  changeFrequency: 'daily' },
  { url: '/platform-v7/investor',           priority: 0.65, changeFrequency: 'weekly' },
  { url: '/platform-v7/lab',                priority: 0.6,  changeFrequency: 'daily' },
  { url: '/platform-v7/audit-log',          priority: 0.6,  changeFrequency: 'daily' },
  { url: '/platform-v7/profile',            priority: 0.5,  changeFrequency: 'monthly' },
  { url: '/platform-v7/connectors',         priority: 0.5,  changeFrequency: 'weekly' },
  { url: '/platform-v7/companies',          priority: 0.5,  changeFrequency: 'weekly' },
];

const KNOWN_DEAL_IDS = ['DL-9102', 'DL-9106', 'DL-9109'];
const KNOWN_LOT_IDS  = ['LOT-2403', 'LOT-2405', 'LOT-2410'];
const KNOWN_INNS     = ['6164065090', '2309160154'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.url}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const dealEntries: MetadataRoute.Sitemap = KNOWN_DEAL_IDS.map((id) => ({
    url: `${BASE_URL}/platform-v7/deals/${id}/clean`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  const lotEntries: MetadataRoute.Sitemap = KNOWN_LOT_IDS.map((id) => ({
    url: `${BASE_URL}/platform-v7/lots/${id}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.75,
  }));

  const counterpartyEntries: MetadataRoute.Sitemap = KNOWN_INNS.map((inn) => ({
    url: `${BASE_URL}/platform-v7/counterparty/${inn}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticEntries, ...dealEntries, ...lotEntries, ...counterpartyEntries];
}
