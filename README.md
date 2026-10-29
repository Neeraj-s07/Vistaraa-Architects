# Vistaraa Architects website

The studio's site, built with [Astro](https://astro.build). It is the "Gallery" design: an endless
wall of the work, a Menu, a full-screen view for each project, and About, Contact and Careers
panels. Every project and panel also has its own address (`/work/kings-avenue/`, `/about/`,
`/contact/`, `/careers/`), so links can be shared and search engines can find each page.

The whole site uses one typeface, DM Sans (set in `astro.config.mjs`). The home page opens with
"Vistaraa / Architects"; on the first scroll the V and the A fly to the top-left corner and become
the logo, and clicking that logo plays it back. The two lines are `wordmark` in `src/site.ts`.

The site is light or dark to match each visitor's phone or computer setting, and changes when that
setting does. The half-filled circle in the top bar picks the other one; the browser remembers that
choice until the visitor switches back. Both sets of colours are at the top of
`src/styles/gallery.css` (`:root` for dark, `:root[data-theme="light"]` for light).

Because the home page is unusual, it explains itself: "Scroll or drag to explore the work" (swipe,
on phones) shows under the title, then one image is lit up with "Click any image to explore the
project", and then the top bar pulses with a note under Work / About / Contact (under Menu on
phones). They come back on every visit until the visitor has done them or seen them twice in that
visit. To see them again straight away, add `?guide` to the address. The
wording is in `src/components/Gallery.astro` (the `guide` block) and, for phones, in
`src/scripts/gallery.js`.

## Run it on your computer

Needs [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install      # once
npm run dev      # then open http://localhost:4321 — the page updates as you save files
```

`npm run build` makes the finished site in `dist/`, and `npm run preview` shows that build.

**Without this computer:** on GitHub, open the repository, click the green **Code** button, then
**Codespaces → Create codespace on main**. GitHub builds the site (5–10 minutes the first
time) and opens it in a new tab; if the tab is blocked, open the **Ports** tab and click the globe
next to "Website". Only you can open that address. To see newer changes, type
`git pull && npm run build` in the codespace's terminal, then refresh. A codespace stops by itself
after 30 minutes unused; reopen it from the same **Code → Codespaces** menu.
`npm run check` looks for mistakes in the code, and `npm run images` prepares new renders (below).

## Where things live

| To change… | Edit |
|---|---|
| A project's text, images, order, menu category | `src/content/projects/<project>/index.md` |
| Which images hang on the wall, and where | `wall:` lines in each project, and `src/content/wall.yaml` |
| About text, founders, services, contact details, enquiry form, Careers text | `src/site.ts` |
| Founders' portraits | `src/assets/studio/` |
| Look and feel, dark and light colours | `src/styles/gallery.css` |
| Wall motion, project view, panels | `src/scripts/gallery.js` |
| Page markup | `src/components/Gallery.astro` |

## Add a project

1. Make a folder in `src/content/projects/`. Its name becomes the address:
   `riverside-villa` → `/work/riverside-villa/`. Use lowercase and hyphens.
2. Put the project's renders in it, straight from the renderer: PNG, JPG or TIFF, any size,
   sub-folders allowed. Avoid images sent through WhatsApp, which loses most of the quality.
3. Run `npm run images`. It shrinks every render to 2560px (still more than the site shows),
   saves it as `.webp` with a web-safe name, moves the original files to `originals/` (kept on
   this computer, never published) and writes a draft `index.md` listing the images in the
   order of their file names (`1`, `2` … `10`).
4. Edit `index.md`: title, type, `category`, the short `line`, facts, the `cover` image, captions,
   and the order of the `images`. The paragraphs about the project go below the second `---`.
5. Delete the `draft: true` line to publish it.

`category` is the heading the project is listed under when Projects is opened in the Menu
(now `Architecture` or `Interiors`). Type any name to start a new heading; headings appear in
the order of their first project. `order` sets the order of projects.

Adding images to an existing project works the same way: drop them in, run `npm run images`,
then list them in its `index.md`. Run it whenever you add renders. It never touches images that
are already web-ready. (Very large originals would make the site slow to build and too big
for GitHub, which refuses files over 100 MB.)

If something is wrong (say an image is listed but missing from the folder), `npm run dev` and
`npm run build` stop with a message that names the file and the problem.

### Images on the wall

Add `wall:` to an image to also hang it on the home page wall. The value is the frame shape:

| `wall:` | Shape |
|---|---|
| `tall` | 2:3 |
| `portrait` | 4:5 |
| `square` | 1:1 |
| `landscape` | 3:2 |
| `wide` | 16:9 |
| `standard` | 4:3 |

The image is cropped to that shape around its centre. To keep a different part in frame, add
`focus: [x, y]`, where each number runs from 0 to 1 (`[0, 0.5]` keeps the left edge, `[1, 0.5]` the
right). A good wall mixes shapes. Upright photographs suit `tall` and `portrait` best.

New wall images are added to the wall automatically. To arrange them by hand, list them in
`src/content/wall.yaml` (see the notes at the top of that file). The line `- logo` there hangs the
studio's logo among the images (clicking it opens About); move it to another row or position to
move the tile, or delete it to remove the tile.

### Video

Give a still as `file` (used as the poster) and the clip as `video`. Optionally add a smaller
`wallVideo` for the wall. Short, silent, looping MP4s of 5–15 seconds work best.

## Before launch

In `src/site.ts`:

- `url`: `https://www.vistaraaarchitects.com`, already set; change it only if the domain changes
- `live: true`, so search engines may index the site (it asks them not to while `false`)
- `formKey`: so enquiries arrive in the studio inbox by themselves (see "The enquiry form")
- every line marked `TODO`: founders' quotes, the Careers wording
- `address` in `CONTACT`, if the street should be shown (it is the city and PIN for now)

## The enquiry form

The form on Contact asks for a name and a phone number or an email, plus the project type and a
message. It sends through [Web3Forms](https://web3forms.com), which is free for 250 enquiries a
month and needs no account:

1. Open web3forms.com, type the studio email (`info.vistaraaarchitects@gmail.com`) and create an
   access key. The key arrives in that inbox (check Spam if it doesn't show).
2. Paste it into `formKey` in `src/site.ts` and publish. The key is meant to be public.

Each enquiry then arrives as an email titled like "Website enquiry: Residence from Priya Shah"
(`formSubject`); pressing Reply
answers the visitor directly when they gave an email. Until there is a key, pressing Send opens the
visitor's own email app with the enquiry written out to the studio, so nothing is lost either way.

The Call and WhatsApp buttons on Contact use the numbers in `principals`; the message WhatsApp
starts with is `whatsappText`.

## Publishing

**GitHub Pages (now):** every push to `main` builds the site and publishes it at
https://neeraj-s07.github.io/Vistaraa-Architects/ (`.github/workflows/pages.yml`; the repository's
Settings → Pages → Source must be "GitHub Actions"). Progress shows in the repository's
**Actions** tab. The site works from that sub-folder because every link goes through `at()` in
`src/lib/url.ts`; keep using it for new links.

Any static host works. Netlify or Cloudflare Pages are the best fit: they read
`public/_headers`, which lets browsers keep images instead of downloading them again on every
visit. Connect the site's Git repository (on Netlify, `netlify.toml` already holds these):

- Build command: `npm run build`
- Output folder: `dist`
- Node version: 22 or newer

Point `vistaraaarchitects.com` and `www.vistaraaarchitects.com` at the host, with the bare
domain redirecting to `www`. The studio also owns `vistaraaachitects.com` (no "r"): redirect it
to the same address so a mistyped link still arrives. `public/_redirects` sends the old
`/studio/` address to `/about/`.
