import { getPosts, postUrl, trending } from '@/lib/posts';

export default function Ticker() {
  const items = trending(getPosts(), 12);
  if (!items.length) return null;
  return (
    <div className="ticker">
      <div className="wrap ticker-in">
        <span className="ticker-label">มาแรง</span>
        <div className="ticker-list">
          {items.map((p) => (
            <a key={p.slug} href={postUrl(p)} className="chip">#{p.keyword}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
