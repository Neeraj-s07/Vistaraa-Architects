import type { APIRoute } from 'astro';
import { SITE } from '../site';
import { siteData } from '../lib/data';
import { at } from '../lib/url';

export const GET: APIRoute = async () => {
  const { projects } = await siteData();
  const paths = [...['/', '/about/', '/contact/', '/careers/'].map(at), ...projects.filter((p) => !p.placeholder).map((p) => p.url)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${new URL(p, SITE.url).href}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
