export async function fetchReleaseHealth(baseUrl: string) {
  const response = await fetch(`${baseUrl}/release-health`, { cache: 'no-store' });
  if (!response.ok) throw new Error('release health failed');
  return response.json();
}
