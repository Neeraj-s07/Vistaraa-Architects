import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Shapes an image can take on the wall (see README.md).
export const WALL_FRAMES = ['tall', 'portrait', 'square', 'landscape', 'wide', 'standard'] as const;

const unit = z.number().min(0).max(1);

const projects = defineCollection({
  // One folder per project: src/content/projects/<folder>/index.md plus its images.
  // Folders starting with "_" (like _template) are ignored.
  loader: glob({
    pattern: ['*/index.md', '!_*/index.md'],
    base: './src/content/projects',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(99),
    type: z.string(),
    category: z.string().nullish(),
    location: z.string().nullish(),
    line: z.string().default(''),
    reference: z.boolean().default(false),
    draft: z.boolean().default(false),
    facts: z.record(z.string(), z.coerce.string()).nullish(),
    cover: z.string().nullish(),
    images: z
      .array(
        z.object({
          file: z.string(),
          caption: z.string().nullish(),
          alt: z.string().nullish(),
          wall: z.enum(WALL_FRAMES).nullish(),
          focus: z.tuple([unit, unit]).nullish(),
          video: z.string().nullish(),
          wallVideo: z.string().nullish(),
        }),
      )
      .min(1),
  }),
});

export const collections = { projects };
