// SNS 캡션 공통: 뉴스 봇처럼 "제목+요약+링크" 만 반복하지 않게
//  - 글마다 LLM 이 쓴 한 줄 훅(hook)·독자 질문(question) 을 앞세움 (없으면 카테고리별 질문 템플릿)
//  - 이모지·문장 순서·마무리 문구를 slug 기준으로 돌려 써서 매번 같은 틀이 아니게
//  - 반응(댓글)을 부르는 질문을 링크보다 먼저. 페이스북은 댓글·공유가 있어야 노출이 늘어남
import crypto from 'node:crypto';

const EMOJI = {
  'บันเทิง': ['🔥', '😳', '👀', '💥', '🎤'],
  'K-บันเทิง': ['🇰🇷', '💜', '✨', '🔥', '👀'],
  'ซีรีส์/หนัง': ['🎬', '🍿', '😭', '👀', '🔥'],
  'โซเชียล/ไวรัล': ['😳', '👀', '🤯', '💬', '🔥'],
  'ข่าวทั่วไป': ['📌', '⚡', '👀', '🚨', '📢'],
  'กีฬา': ['⚽', '🔥', '🏆', '👀', '💪'],
  'ไลฟ์สไตล์': ['✨', '💫', '😍', '👀', '🌿'],
};
// LLM 질문이 없을 때 (예전 글) 카테고리별 질문
const QUESTIONS = {
  'บันเทิง': ['คิดว่าไงกันบ้าง? 👇', 'ใครตามเรื่องนี้อยู่บ้าง? 🙋', 'แชร์ให้เพื่อนที่เป็นแฟนคลับ 👉'],
  'K-บันเทิง': ['แฟนไทยคิดว่าไง? 👇', 'ใครรอคอนเสิร์ตที่ไทยบ้าง? 🙋', 'ชอบเพลงไหนที่สุด? คอมเมนต์เลย 👇'],
  'ซีรีส์/หนัง': ['ดูแล้วเป็นไงบ้าง? 👇', 'ใครรอดูบ้าง? 🙋', 'ให้กี่คะแนน? คอมเมนต์เลย 👇'],
  'โซเชียล/ไวรัล': ['เห็นด้วยไหม? 👇', 'คิดว่าใครถูก? คอมเมนต์เลย 👇', 'เจอแบบนี้จะทำยังไง? 🤔'],
  'ข่าวทั่วไป': ['คิดว่าไงกันบ้าง? 👇', 'ใครได้รับผลกระทบบ้าง? คอมเมนต์เลย 👇', 'ควรทำยังไงต่อ? 🤔'],
  'กีฬา': ['เชียร์ทีมไหน? 👇', 'ทายผลหน่อย! คอมเมนต์เลย ⚽', 'ใครดูสดบ้าง? 🙋'],
  'ไลฟ์สไตล์': ['ใครเคยลองบ้าง? 🙋', 'คิดว่าไง? คอมเมนต์เลย 👇', 'แชร์ให้เพื่อนที่ต้องรู้ 👉'],
};
const CLOSERS = ['อ่านฉบับเต็ม 👉', 'รายละเอียดทั้งหมด 👉', 'อ่านต่อ 👉', 'เรื่องเต็ม ๆ อยู่ที่นี่ 👉'];

const hashN = (slug, n, salt = '') => parseInt(crypto.createHash('md5').update(slug + salt).digest('hex').slice(0, 8), 16) % n;
export const hashtag = (t) => '#' + String(t).replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const pick = (arr, slug, salt) => arr[hashN(slug, arr.length, salt)];

export function emojiOf(p) { return pick(EMOJI[p.category] || EMOJI['ข่าวทั่วไป'], p.slug, 'e'); }
export function questionOf(p) {
  const q = String(p.question || '').trim();
  if (q) return q + (/[?？👇🙋]$/.test(q) ? '' : ' 👇');
  return pick(QUESTIONS[p.category] || QUESTIONS['ข่าวทั่วไป'], p.slug, 'q');
}
export function hookOf(p) { return String(p.hook || '').trim(); }
export const tagsOf = (p, n = 4) => p.tags.slice(0, n).map(hashtag).join(' ');

/**
 * kind: 'facebook' | 'threads' | 'reel' | 'instagram' | 'tiktok' | 'youtube'
 * 반환: 플랫폼별 길이·링크 규칙에 맞춘 캡션
 */
export function caption(p, kind, url = '') {
  const e = emojiOf(p);
  const hook = hookOf(p);
  const q = questionOf(p);
  const isK = p.category === 'K-บันเทิง';
  const extraTags = isK ? '#ข่าวเกาหลี #kpop' : '#ข่าววันนี้';
  // 첫 줄: 훅이 있으면 훅, 없으면 제목. 두 번째: 제목/요약
  const first = hook ? `${e} ${hook}` : `${e} ${p.title}`;
  const second = hook ? p.title : p.excerpt;
  const closer = pick(CLOSERS, p.slug, 'c');
  switch (kind) {
    case 'facebook':
      return `${first}\n\n${second}\n\n${q}\n\n${closer} ${url}\n\n${tagsOf(p, 3)} ${extraTags}`;
    case 'threads': {
      const tail = `\n\n${q}\n${closer} ${url}\n${hashtag(p.tags[0] || 'ข่าววันนี้')}`;
      let body = `${first}\n\n${second}`;
      const max = 500 - [...tail].length;
      if ([...body].length > max) body = [...body].slice(0, max - 1).join('') + '…';
      return body + tail;
    }
    case 'reel':
      return `${first}\n\n${q}\n\n${closer} ${url}\n\n${tagsOf(p, 4)} ${extraTags}`;
    case 'instagram':
      return `${first}\n\n${second}\n\n${q}\n\n🔗 อ่านฉบับเต็มที่ลิงก์ในโปรไฟล์ (${url.replace(/^https?:\/\//, '').replace(/\/post\/.*$/, '')})\n\n${tagsOf(p, 5)} ${extraTags} #ไทยบัซ`;
    case 'tiktok': {
      // 틱톡: 첫 줄 훅(없으면 제목) → 제목 → 질문 → 링크 안내(틱톡은 본문 링크 불가) → 태그 10개 안팎 (고유 4 + 카테고리 + 트렌드)
      const catTags = isK ? '#kpop #เกาหลี #ข่าวเกาหลี #ซีรีส์เกาหลี' : p.category === 'กีฬา' ? '#ข่าวกีฬา #ฟุตบอล #บอลไทย' : '#ข่าวบันเทิง #ดารา #ข่าววันนี้';
      return `${first}\n${hook ? p.title + '\n' : ''}\n${q} 👇\n\n📍 อ่านเต็ม ๆ ที่ thaibuzz.net (ลิงก์ในไบโอ)\n\n${tagsOf(p, 4)} ${catTags} #ThaiBuzz #เทรนด์วันนี้ #fyp #foryoupage #ฟีดดดシ #tiktokข่าว`;
    }
    case 'youtube':
      return `${p.excerpt}\n\n${q}\n\nอ่านฉบับเต็มพร้อมแหล่งอ้างอิง: ${url}\n\n${tagsOf(p, 4)} ${extraTags}`;
    default:
      return `${first}\n\n${q}\n\n${url}`;
  }
}
