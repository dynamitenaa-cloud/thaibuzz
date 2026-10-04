import { CATEGORIES } from '@/lib/site';
import { CategoryView, categoryMeta } from '@/lib/category-page';

export const dynamicParams = false;
export const generateStaticParams = () => CATEGORIES.map((c) => ({ slug: c.slug }));
export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }) => categoryMeta((await params).slug);

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <CategoryView slug={(await params).slug} page={1} />;
}
