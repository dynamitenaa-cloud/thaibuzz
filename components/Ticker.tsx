import { getPosts, postUrl, trending } from '@/lib/posts';

const hangul = /[ㄱ-힝]/;
// 한국 기사 후보의 키워드는 한글이라 띠에 그대로 못 씀 → 태국어/영문 태그, 없으면 제목 앞부분
const label = (p: { keyword: string; tags: string[]; title: string }) =>
  hangul.test(p.keyword) ? (p.tags.find((t) => !hangul.test(t)) ?? p.title.slice(0, 28)) : p.keyword;

export default function Ticker() {
  const items = trending(getPosts(), 12);
  if (!items.length) return null;
  return (
    <div className="ticker">
      <div className="wrap ticker-in">
        <span className="ticker-label">มาแรง</span>
        <div className="ticker-list">
          {items.map((p) => (
            <a key={p.slug} href={postUrl(p)} className="chip">#{label(p)}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
