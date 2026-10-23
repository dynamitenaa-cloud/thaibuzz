import { fbPostUrl } from '@/lib/fb-links';
import { SITE } from '@/lib/site';
import { FbIcon, ThreadsIcon } from './Icons';

// 글 하단 "함께 얘기해요" 상자: 독자 질문 + 페이스북 게시물로 바로 가는 댓글 버튼
// (메타가 2026-02 외부 사이트 댓글 플러그인을 폐지 → 댓글은 페이스북 게시물에서, 알고리즘 노출에도 유리)
export function CommentCta({ slug, question }: { slug: string; question?: string }) {
  const fb = fbPostUrl(slug);
  if (!fb.url && !SITE.social.threads) return null;
  return (
    <section className="cta-cmt" aria-label="ร่วมแสดงความคิดเห็น">
      <h2>💬 {question?.trim() || 'คุณคิดว่าไงกับเรื่องนี้?'}</h2>
      <p>บอกความเห็นของคุณได้ที่โพสต์นี้บน Facebook — บรรณาธิการอ่านทุกคอมเมนต์ และคำถามเกี่ยวกับเกาหลีจะถูกเลือกมาตอบในเว็บ</p>
      <div className="cta-row">
        {fb.url && <a className="btn-fb" href={fb.url} target="_blank" rel="noopener"><FbIcon /> {fb.direct ? 'คอมเมนต์โพสต์นี้บน Facebook' : 'คอมเมนต์ที่เพจ Facebook'}</a>}
        {SITE.social.threads && <a className="btn-th" href={SITE.social.threads} target="_blank" rel="noopener"><ThreadsIcon width={18} height={18} /> Threads</a>}
      </div>
    </section>
  );
}
