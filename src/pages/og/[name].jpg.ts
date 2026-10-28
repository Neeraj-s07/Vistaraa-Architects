// Share images (1200 × 630) shown when a link is posted on WhatsApp, LinkedIn, etc.
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { cropBox, siteData, type Source } from '../../lib/data';

export const getStaticPaths = (async () => {
  const { projects, sources, wall } = await siteData();
  return [
    { params: { name: 'home' }, props: { src: sources[wall.start[0]] } },
    ...projects.map((p) => ({ params: { name: p.id }, props: { src: sources[p.hero] } })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { src } = props as { src: Source };
  const box = cropBox(src.meta.width, src.meta.height, 1200 / 630, src.focus);
  const buf = await sharp(src.path, { limitInputPixels: false })
    .rotate()
    .extract(box)
    .resize({ width: 1200, height: 630, fit: 'cover' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/jpeg' } });
};
