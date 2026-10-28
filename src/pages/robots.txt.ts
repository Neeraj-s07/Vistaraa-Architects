import type { APIRoute } from 'astro';
import { SITE } from '../site';
import { at } from '../lib/url';

export const GET: APIRoute = () => {
  const body = SITE.live
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL(at('/sitemap.xml'), SITE.url).href}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
