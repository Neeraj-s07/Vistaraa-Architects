/**
 * Turns the project folders (src/content/projects/) and src/content/wall.yaml into the
 * data the pages and the wall script use. Runs at build time only.
 */
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import sharp from 'sharp';
import type { WALL_FRAMES } from '../content.config';
import { at } from './url';

const DIR = '/src/content/projects/';
const IMAGES = import.meta.glob<ImageMetadata>(
  '/src/content/projects/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);
const VIDEOS = import.meta.glob<string>('/src/content/projects/*/*.{mp4,webm,MP4,WEBM}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Wall frame shapes: code used by the wall script, [aspect ratio, height within its row]. */
export const SHAPE: Record<string, [number, number]> = {
  T: [2 / 3, 1], P: [0.8, 0.96], S: [1, 0.84], L: [1.5, 0.78], W: [16 / 9, 0.74], X: [4 / 3, 0.92],
};
const FRAME_CODE: Record<(typeof WALL_FRAMES)[number], string> = {
  tall: 'T', portrait: 'P', square: 'S', landscape: 'L', wide: 'W', standard: 'X',
};
const ROW_PX = { A: 440, B: 330 };
const DEFAULT_ROWS = [['large', 0], ['small', 140], ['large', -260], ['small', 380], ['large', 90], ['small', -420]] as const;
/** In wall.yaml, this name hangs the studio's logo on the wall (drawn by the wall script, 4:5). */
export const LOGO = 'logo';

export interface Img {
  k: string; p: string; w: number; h: number; alt: string; cap: string;
  full: string; fw: number; lg: string; lw: number; md: string; dw: number; mid: string; mw: number;
  /** c: the photo's average colour, shown until it arrives; ph: a tiny blurred copy of its wall tile, inside the page itself */
  c: string; ph?: string;
  wall?: string; video?: string; wallVideo?: string; ref?: 1;
}
export interface Project {
  /** cat: the heading it is listed under in the menu; thumb: a small copy of the cover for the menu */
  id: string; no: string; name: string; typ: string; cat: string; place: string; thumb: string;
  line: string; copy: string; facts: [string, string][];
  hero: string; seq: string[]; placeholder?: 1; url: string;
}
export interface Source {
  k: string; file: string; path: string; meta: ImageMetadata;
  frame?: string; focus?: [number, number];
}
export interface WallLayout {
  start: [string, number];
  rows: { band: 'A' | 'B'; shift: number; tiles: [string, string][] }[];
  focus: Record<string, [number, number]>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Escapes text, then *italic* → <em>, **bold** → <strong>. */
export const inline = (s: string) =>
  esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
/** Plain text from HTML, cut to about 160 characters for meta descriptions. */
export function plain(html: string, max = 160) {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').replace(/ ([,.;:!?])/g, '$1').trim();
  return t.length <= max ? t : t.slice(0, t.lastIndexOf(' ', max - 1)) + '…';
}
const stemOf = (f: string) => f.replace(/\.[^.]+$/, '');

function inferFrame(w: number, h: number) {
  const r = Math.log(w / h);
  return Object.entries(SHAPE).reduce((a, b) => (Math.abs(Math.log(b[1][0]) - r) < Math.abs(Math.log(a[1][0]) - r) ? b : a))[0];
}

async function build() {
  const entries = (await getCollection('projects'))
    .filter((e) => !e.data.draft)
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
  if (!entries.length) throw new Error('No projects found in src/content/projects/');

  const images: Record<string, Img> = {};
  const sources: Record<string, Source> = {};
  const projects: Project[] = [];

  for (const [i, e] of entries.entries()) {
    const { id, data: d } = e;
    const where = `src/content/projects/${id}/index.md`;
    const video = (f?: string | null) => {
      if (!f) return undefined;
      const u = VIDEOS[DIR + id + '/' + f];
      if (!u) throw new Error(`${where}: video "${f}" is not in the project folder`);
      return u;
    };
    const seq: string[] = [];
    for (const it of d.images) {
      const meta = IMAGES[DIR + id + '/' + it.file];
      if (!meta) throw new Error(`${where}: image "${it.file}" is not in the project folder`);
      const k = `${id}/${stemOf(it.file)}`;
      if (images[k]) throw new Error(`${where}: "${it.file}" is listed twice, or two files share the name "${stemOf(it.file)}"`);
      const fw = Math.min(meta.width, 2400), lw = Math.min(meta.width, 1600), dw = Math.min(meta.width, 1280), mw = Math.min(meta.width, 900);
      const [full, lg, md, mid, one] = await Promise.all([
        getImage({ src: meta, width: fw, format: 'webp', quality: 82 }),
        getImage({ src: meta, width: lw, format: 'webp', quality: 80 }),
        getImage({ src: meta, width: dw, format: 'webp', quality: 78 }),
        getImage({ src: meta, width: mw, format: 'webp', quality: 78 }),
        sharp(`src/content/projects/${id}/${it.file}`, { limitInputPixels: false }).resize(1, 1).removeAlpha().raw().toBuffer(),
      ]);
      const img: Img = {
        k, p: id, w: meta.width, h: meta.height,
        alt: it.alt || (it.caption ? `${d.title}, ${it.caption}` : d.title),
        cap: it.caption || '',
        full: full.src, fw, lg: lg.src, lw, md: md.src, dw, mid: mid.src, mw, c: '#' + one.toString('hex'),
      };
      const v = video(it.video);
      if (v) { img.video = v; img.wallVideo = video(it.wallVideo) || v; }
      if (d.reference) img.ref = 1;
      images[k] = img;
      sources[k] = {
        k, file: it.file, path: `src/content/projects/${id}/${it.file}`, meta,
        frame: it.wall ? FRAME_CODE[it.wall] : undefined, focus: it.focus ?? undefined,
      };
      seq.push(k);
    }
    const hero = d.cover ? `${id}/${stemOf(d.cover)}` : seq[0];
    if (!images[hero]) throw new Error(`${where}: cover "${d.cover}" must be one of the images listed below it`);
    const cm = sources[hero].meta;
    const thumb = await getImage({ src: cm, width: Math.min(cm.width, 480), format: 'webp', quality: 72 });
    projects.push({
      id, no: String(i + 1).padStart(2, '0'), name: d.title, typ: d.type, cat: d.category?.trim() || 'Other',
      place: d.location ?? '', thumb: thumb.src,
      line: inline(d.line), copy: e.rendered?.html ?? '', facts: Object.entries(d.facts ?? {}),
      hero, seq, ...(d.reference ? { placeholder: 1 as const } : {}), url: at(`/work/${id}/`),
    });
  }

  const wall = buildWall(sources, projects);
  for (const k of wall.tiles) images[k].wall = at(`/wall/${k}.webp`);
  const frames = new Map(wall.layout.rows.flatMap((r) => r.tiles));
  await Promise.all(wall.tiles.map(async (k) => {
    const src = sources[k], ratio = SHAPE[frames.get(k)!][0];
    const buf = await sharp(src.path, { limitInputPixels: false })
      .rotate()
      .extract(cropBox(src.meta.width, src.meta.height, ratio, src.focus))
      .resize(ratio >= 1 ? { width: 64 } : { height: 64 })
      .blur(0.8)
      .webp({ quality: 50 })
      .toBuffer();
    images[k].ph = 'data:image/webp;base64,' + buf.toString('base64');
  }));
  return { projects, images, sources, wall: wall.layout, wallTiles: wall.tiles };
}

/** Rows from wall.yaml, then every other image marked `wall:` dealt into the shortest rows. */
function buildWall(sources: Record<string, Source>, projects: Project[]) {
  const file = 'src/content/wall.yaml';
  const cfg = existsSync(file) ? parse(readFileSync(file, 'utf8')) ?? {} : {};
  const given: { size?: string; shift?: number; tiles?: unknown }[] =
    Array.isArray(cfg.rows) && cfg.rows.length ? cfg.rows : DEFAULT_ROWS.map(([size, shift]) => ({ size, shift }));
  const rows = given.map((r) => ({
    band: (r.size === 'small' ? 'B' : 'A') as 'A' | 'B',
    shift: Number(r.shift) || 0,
    want: (Array.isArray(r.tiles) ? r.tiles : []) as string[],
    tiles: [] as [string, string][],
    width: 0,
  }));
  const used = new Set<string>();
  const add = (row: (typeof rows)[number], k: string) => {
    const s = sources[k];
    const code = s.frame ?? inferFrame(s.meta.width, s.meta.height);
    const [ar, f] = SHAPE[code];
    row.tiles.push([k, code]);
    row.width += ROW_PX[row.band] * f * ar + 84;
    used.add(k);
  };
  let logo = false;
  for (const r of rows) {
    for (const k of r.want) {
      if (k === LOGO) {
        if (logo) continue;
        logo = true;
        r.tiles.push([LOGO, 'P']);
        r.width += ROW_PX[r.band] * SHAPE.P[1] * SHAPE.P[0] + 84;
        continue;
      }
      if (!sources[k]) { console.warn(`[wall] ${file} lists "${k}", which is not an image in any project. Skipped.`); continue; }
      if (!used.has(k)) add(r, k);
    }
  }
  const queues = projects.map((p) => p.seq.filter((k) => sources[k].frame && !used.has(k)));
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const k = q.shift();
      if (k) add(rows.reduce((a, b) => (b.width < a.width ? b : a)), k);
    }
  }
  if (!used.size) projects.forEach((p, i) => add(rows[i % rows.length], p.hero));

  const live = rows.filter((r) => r.tiles.length);
  const start = typeof cfg.start === 'string' && used.has(cfg.start) ? cfg.start : live[0].tiles[0][0];
  const focus: WallLayout['focus'] = {};
  for (const k of used) if (sources[k].focus) focus[k] = sources[k].focus!;
  const layout: WallLayout = { start: [start, 0], rows: live.map(({ band, shift, tiles }) => ({ band, shift, tiles })), focus };
  return { layout, tiles: [...used] };
}

let cache: ReturnType<typeof build> | undefined;
export const siteData = () => (cache ??= build());

/** Crop box for a frame of the given aspect ratio around a focus point (same maths as the wall shader). */
export function cropBox(w: number, h: number, ratio: number, focus: [number, number] = [0.5, 0.5]) {
  const cw = w / h > ratio ? Math.round(h * ratio) : w;
  const ch = w / h > ratio ? h : Math.round(w / ratio);
  return { left: Math.round((w - cw) * focus[0]), top: Math.round((h - ch) * focus[1]), width: cw, height: ch };
}
