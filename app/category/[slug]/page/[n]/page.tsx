import { getPosts } from '@/lib/posts';
import { CATEGORIES } from '@/lib/site';
import { CategoryView, categoryMeta } from '@/lib/category-page';
import { pageParams } from '@/components/Listing';

type P = { params: Promise<{ slug: string; n: string }> };

export const dynamicParams = false;
export const generateStaticParams = () =>
  CATEGORIES.flatMap((c) => pageParams(getPosts().filter((p) => p.category === c.name).length).map((x) => ({ slug: c.slug, ...x })));
export const generateMetadata = async ({ params }: P) => {
  const { slug, n } = await params;
  return categoryMeta(slug, Number(n));
};

export default async function Page({ params }: P) {
  const { slug, n } = await params;
  return <CategoryView slug={slug} page={Number(n)} />;
}
