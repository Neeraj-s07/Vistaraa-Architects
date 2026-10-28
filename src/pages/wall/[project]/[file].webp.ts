// Wall textures: each wall image cropped to its frame around its focus point, 768 px on the long side.
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { SHAPE, cropBox, siteData, type Source } from '../../../lib/data';

export const getStaticPaths = (async () => {
  const { wall, sources } = await siteData();
  return wall.rows.flatMap((r) =>
    r.tiles.map(([k, code]) => {
      const [project, file] = k.split('/');
      return { params: { project, file }, props: { src: sources[k], ratio: SHAPE[code][0] } };
    }),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { src, ratio } = props as { src: Source; ratio: number };
  const box = cropBox(src.meta.width, src.meta.height, ratio, src.focus);
  const long = ratio >= 1 ? { width: 768 } : { height: 768 };
  const buf = await sharp(src.path, { limitInputPixels: false })
    .rotate()
    .extract(box)
    .resize({ ...long, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/webp' } });
};
