
// base: '/' -> /, /page/2/ ... ; '/category/x/' -> /category/x/, /category/x/page/2/
export default function Pager({ base, page, total }: { base: string; page: number; total: number }) {
  if (total <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  const nums = [...new Set([1, page - 1, page, page + 1, total])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label="หน้า">
      {page > 1 && <a href={href(page - 1)} rel="prev">‹ ก่อนหน้า</a>}
      {nums.map((n, i) => (
        <span key={n} style={{ display: 'contents' }}>
          {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden>…</span>}
          {n === page ? <span aria-current="page">{n}</span> : <a href={href(n)}>{n}</a>}
        </span>
      ))}
      {page < total && <a href={href(page + 1)} rel="next">ถัดไป ›</a>}
    </nav>
  );
}
