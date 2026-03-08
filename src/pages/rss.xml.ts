import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: any) {
  const articles = await getCollection('articles', ({ data }) => data.published !== false);
  const sorted = articles.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  return rss({
    title: 'Scaling Legends',
    description: 'Construction Industry Growth Stories - Data-driven podcast and market intelligence for contractors.',
    site: context.site,
    items: sorted.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: new Date(article.data.date),
      link: `/article/${article.id}`,
      ...(article.data.audioUrl ? {
        enclosure: { url: article.data.audioUrl, length: 0, type: 'audio/mpeg' },
      } : {}),
    })),
  });
}
