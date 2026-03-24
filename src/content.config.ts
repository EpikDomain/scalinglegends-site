import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    image: z.string().optional(),
    imageOriginal: z.string().optional(),
    audioUrl: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    readTime: z.string().optional(),
    published: z.boolean().default(true),
    season: z.number().optional(),
    episode: z.number().optional(),
    guest: z.string().optional(),
    guests: z.array(z.object({
      name: z.string(),
      title: z.string().optional(),
      company: z.string().optional(),
      image: z.string().optional(),
    })).optional(),
    sponsors: z.array(z.object({
      name: z.string(),
      url: z.string().optional(),
      description: z.string().optional(),
    })).optional(),
    transcript: z.string().optional(),
    pillar: z.enum(['market-intelligence', 'business-growth', 'technology', 'workforce', 'policy']).optional(),
    howTo: z.array(z.object({
      name: z.string(),
      text: z.string(),
    })).optional(),
    updatedAt: z.string().optional(),
    noindex: z.boolean().optional(),
  }),
});

export const collections = { articles };
