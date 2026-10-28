/**
 * npm run images
 *
 * Gets new renders ready for the site. For every folder in src/content/projects/:
 *  - images, including any in sub-folders, are shrunk to 2560px on the long side and saved as
 *    .webp with web-safe names ("LIVING ROOM 1.png" → "living-room-1.webp");
 *  - the original files are moved to originals/<project>/ (kept on this computer, never published);
 *  - index.md and src/content/wall.yaml are updated to the new names;
 *  - a folder without an index.md gets one that lists every image, as a draft to fill in.
 * Images that are already web-ready are left as they are, so it is safe to run at any time.
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROJECTS = path.join(ROOT, 'src/content/projects');
const WALL = path.join(ROOT, 'src/content/wall.yaml');
const ORIGINALS = path.join(ROOT, 'originals');
const MAX = 2560;          // long edge in px; the site shows at most 2400
const MAX_BYTES = 2.5e6;
const IMAGE = /\.(jpe?g|png|webp|avif|tiff?)$/i;
const READY = /\.(jpe?g|webp)$/;

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;
const slug = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
const stemOf = (f) => f.replace(/\.[^.]+$/, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FRAMES = { tall: 2 / 3, portrait: 0.8, square: 1, standard: 4 / 3, landscape: 1.5, wide: 16 / 9 };
const frameFor = (w, h) =>
  Object.entries(FRAMES).reduce((a, b) => (Math.abs(Math.log(b[1] * h / w)) < Math.abs(Math.log(a[1] * h / w)) ? b : a))[0];
// "07. LIVING ROOM 1" → "Living room 1"
const captionOf = (f) => {
  const s = stemOf(path.basename(f)).replace(/^\s*\d+\s*[.)_-]\s*/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
};
const titleOf = (folder) => folder.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function imagesIn(dir, rel = '') {
  const out = [];
  for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...imagesIn(dir, r));
    else if (IMAGE.test(e.name)) out.push(r);
  }
  return out;
}

let changed = 0;
for (const project of readdirSync(PROJECTS).sort(natural)) {
  const dir = path.join(PROJECTS, project);
  if (project.startsWith('_') || project.startsWith('.') || !statSync(dir).isDirectory()) continue;

  // top-level files first, then each sub-folder, each in natural order (2 before 10)
  const files = imagesIn(dir).sort((a, b) => (a.includes('/') - b.includes('/')) || natural(a, b));
  const used = new Set();
  const jobs = [];
  for (const rel of files) {
    const meta = await sharp(path.join(dir, rel), { limitInputPixels: false }).metadata();
    const bytes = statSync(path.join(dir, rel)).size;
    const name = path.basename(rel);
    const ready = !rel.includes('/') && READY.test(name) && Math.max(meta.width, meta.height) <= MAX && bytes <= MAX_BYTES;
    if (ready && name === slug(stemOf(name)) + path.extname(name)) { used.add(stemOf(name)); continue; }
    jobs.push({ rel, name, ready, meta });
  }
  if (!jobs.length && existsSync(path.join(dir, 'index.md'))) continue;

  const renamed = new Map();   // old file name (as written in index.md) → new file name
  const origin = new Map();    // new file name → where it came from (for captions)
  for (const j of jobs) {
    let base = slug(stemOf(j.name));
    if (used.has(base) && j.rel.includes('/')) base = `${slug(path.dirname(j.rel))}-${base}`;
    let stem = base;
    for (let n = 2; used.has(stem); n++) stem = `${base}-${n}`;
    used.add(stem);
    const from = path.join(dir, j.rel);
    const out = j.ready ? stem + path.extname(j.name).toLowerCase() : stem + '.webp';
    if (j.ready) {
      renameSync(from, path.join(dir, out));
    } else {
      const info = await sharp(from, { limitInputPixels: false })
        .rotate()
        .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#121211' })
        .webp({ quality: 90, effort: 5, smartSubsample: true })
        .toFile(path.join(dir, out));
      const keep = path.join(ORIGINALS, project, j.rel);
      mkdirSync(path.dirname(keep), { recursive: true });
      renameSync(from, keep);
      console.log(`  ${project}/${j.rel}  →  ${out}  (${info.width}×${info.height}, ${Math.round(info.size / 1e3)} kB)`);
    }
    if (!j.rel.includes('/')) renamed.set(j.name, out);
    origin.set(out, j.rel);
    changed++;
  }
  // remove sub-folders that are now empty
  for (const rel of new Set(jobs.map((j) => path.dirname(j.rel)).filter((d) => d !== '.').sort((a, b) => b.length - a.length))) {
    try { rmdirSync(path.join(dir, rel)); } catch (_) { /* not empty: leave it */ }
  }

  const md = path.join(dir, 'index.md');
  if (existsSync(md)) {
    let text = readFileSync(md, 'utf8');
    for (const [from, to] of renamed) {
      text = text.replace(new RegExp(`^(\\s*-?\\s*(?:file|cover):\\s*)(["']?)${esc(from)}\\2(?=\\s*(#.*)?$)`, 'gm'), `$1${to}`);
    }
    writeFileSync(md, text);
  } else {
    // in the order of the original files (top level, then sub-folders)
    const outs = [...origin.keys()];
    const rest = readdirSync(dir).filter((f) => IMAGE.test(f) && !origin.has(f)).sort(natural);
    const listed = [];
    for (const f of [...rest, ...outs]) {
      const m = await sharp(path.join(dir, f)).metadata();
      listed.push({ f, caption: captionOf(origin.get(f) ?? f), frame: frameFor(m.width, m.height) });
    }
    const lines = [
      '---',
      '# Made by `npm run images`. Fill in the details, check the order of the images,',
      '# then delete the `draft: true` line at the bottom to publish the project.',
      `title: ${titleOf(project)}`,
      'order: 99                 # position in the menu',
      'type: Project type        # e.g. Private residence, Office interiors',
      'category: Architecture    # menu heading under Projects, e.g. Interiors',
      'location:                 # e.g. Ahmedabad, Gujarat',
      "line: ''                  # a short line; a *word* in stars is set lighter",
      'facts:',
      '  Scope: Interiors',
      `cover: ${listed[0].f}`,
      'images:',
      ...listed.flatMap((im, i) => [
        `  - file: ${im.f}`,
        `    caption: ${JSON.stringify(im.caption)}`,
        ...(i < 2 ? [`    wall: ${im.frame}`] : []),
      ]),
      'draft: true',
      '---',
      '',
      'One or two paragraphs about the project.',
      '',
    ];
    writeFileSync(md, lines.join('\n'));
    console.log(`  ${project}/index.md written (a draft: fill it in, then remove "draft: true")`);
  }

  if (renamed.size && existsSync(WALL)) {
    let wall = readFileSync(WALL, 'utf8');
    for (const [from, to] of renamed) wall = wall.replace(new RegExp(`(^\\s*-\\s*)${esc(project)}/${esc(stemOf(from))}(?=\\s*(#.*)?$)`, 'gm'), `$1${project}/${stemOf(to)}`);
    writeFileSync(WALL, wall);
  }
}
console.log(changed ? `Done: ${changed} image(s) prepared. Originals are in originals/ (not published).` : 'All images are already web-ready.');
