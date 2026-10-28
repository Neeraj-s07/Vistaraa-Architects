/**
 * A path on this site, written from its root (`at('/about/')`). The site normally lives at the root
 * of its domain; on GitHub Pages it lives under the repository's name (`/Vistaraa-Architects/about/`),
 * which the build is told through BASE_PATH (see astro.config.mjs).
 */
const ROOT = import.meta.env.BASE_URL.replace(/\/$/, '');
export const at = (path: string) => ROOT + path;
