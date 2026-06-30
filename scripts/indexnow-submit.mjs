const siteUrl = process.env.SITE_URL || 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const indexNowKey = process.env.INDEXNOW_KEY || 'a7a2b84a1d594be0b7648166c4c4cf26';
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const paths = (process.env.INDEXNOW_URLS || '/platform-v7,/platform-v7/about,/platform-v7/demo,/platform-v7/docs,/platform-v7/contact,/platform-v7/request,/platform-v7/security,/sitemap.xml,/robots.txt,/indexnow.txt')
  .split(',')
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
