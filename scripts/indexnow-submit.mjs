import fs from 'node:fs';

const siteUrl = process.env.SITE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const indexNowKey = process.env.INDEXNOW_KEY || 'a7a2b84a1d594be0b7648166c4c4cf26';
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const publicSeoAuthority = JSON.parse(
  fs.readFileSync(new URL('../apps/web/lib/platform-v7/public-seo-routes.json', import.meta.url), 'utf8'),
);
const defaultPaths = [
  ...publicSeoAuthority.routes.map((route) => route.path),
  '/sitemap.xml',
  '/robots.txt',
  '/indexnow.txt',
];
const paths = (process.env.INDEXNOW_URLS ? process.env.INDEXNOW_URLS.split(',') : defaultPaths)
  .map((path) => path.trim())
  .filter(Boolean);

const origin = new URL(siteUrl).origin;
const payload = {
  host: new URL(origin).host,
  key: indexNowKey,
  keyLocation: `${origin}/indexnow.txt`,
  urlList: paths.map((path) => new URL(path, origin).toString()),
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const responseText = await response.text().catch(() => '');
  throw new Error(`IndexNow submit failed: ${response.status} ${responseText}`);
}

console.log(`IndexNow submit accepted for ${payload.urlList.length} URLs`);
