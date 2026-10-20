// 숏폼(세로 1080×1920) 자동 생성: 장면 이미지(satori → resvg) → ffmpeg(줌 + 디졸브) → MP4
//  장면: 훅(사진 카드 + 제목, 첫 구절 형광펜) → 요약(사진 상단 + 유리 카드, 번호) → 마무리(CTA + 출처). 약 16초
//  디자인 원칙: 인스타/페북 UI 에 가리는 상단 120px·하단 320px·오른쪽 150px 은 비움. 글자는 왼쪽 70~940px 안에
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { fonts, thaiWrap } from './thumbs.mjs';
import { questionOf } from './social.mjs';
import crypto from 'node:crypto';

const run = promisify(execFile);
const W = 1080, H = 1920, FPS = 30;
// 액센트 색을 글마다 돌려 써서 매번 같은 템플릿처럼 보이지 않게
const ACCENTS = ['#fde047', '#5eead4', '#f9a8d4', '#fdba74'];
let YELLOW = ACCENTS[0];
const pickAccent = (slug) => ACCENTS[parseInt(crypto.createHash('md5').update(String(slug)).digest('hex').slice(0, 6), 16) % ACCENTS.length];
const XFADE = 0.4; // 장면 사이 디졸브(초)
export const REEL_DIR = path.join('.cache', 'reels');

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });
const dataUri = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;
const img = (src, style, w, hh) => h('img', style, undefined, { src, width: w, height: hh });

// 사진이 있으면: 흐린 전체 배경 + 카드용/상단용 크롭. 없으면 null (카테고리 색 배경 + 워터마크)
async function visuals(post) {
  const file = post.thumbClean ? path.join('public', post.thumbClean) : '';
  if (!file || !fs.existsSync(file)) return { bg: null, card: null, top: null };
  const src = sharp(file);
  const [bg, card, top] = await Promise.all([
    src.clone().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.5, saturation: 1.2 }).jpeg({ quality: 78 }).toBuffer(),
    src.clone().resize(1000, 700, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toBuffer(),
    src.clone().resize(W, 820, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toBuffer(),
  ]);
  return { bg: dataUri(bg), card: dataUri(card), top: dataUri(top) };
}

// 공통 프레임: 배경 + 상단 진행 바 + 브랜드/카테고리 줄
function frame({ bg, color, step, steps, category, watermark }, children) {
  return h('div', { width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Prompt', fontWeight: 700, color: '#fff', backgroundImage: `linear-gradient(160deg, ${color} 0%, #1e1b4b 100%)` }, [
    bg && img(bg, { position: 'absolute', top: 0, left: 0, width: W, height: H }, W, H),
    // 사진 없을 때: 부드러운 원 2개 + 큰 워터마크 글자
    !bg && h('div', { position: 'absolute', top: -260, right: -260, width: 820, height: 820, borderRadius: 999, background: 'rgba(255,255,255,0.08)', display: 'flex' }),
    !bg && h('div', { position: 'absolute', bottom: -200, left: -300, width: 760, height: 760, borderRadius: 999, background: 'rgba(0,0,0,0.22)', display: 'flex' }),
    !bg && watermark && h('div', { position: 'absolute', top: 1180, left: -40, fontSize: 250, lineHeight: 1, color: 'rgba(255,255,255,0.07)', display: 'flex', transform: 'rotate(-10deg)', whiteSpace: 'nowrap' }, watermark),
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.8) 100%)' }),
    // 진행 바 (스토리 느낌)
    h('div', { position: 'absolute', top: 118, left: 60, right: 60, display: 'flex', gap: 10 }, Array.from({ length: steps }, (_, i) =>
      h('div', { flex: 1, height: 8, borderRadius: 8, background: i <= step ? YELLOW : 'rgba(255,255,255,0.35)', display: 'flex' }))),
    h('div', { position: 'absolute', top: 150, left: 60, right: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.5)', padding: '10px 26px', borderRadius: 999, fontSize: 38 }, [
        h('div', { width: 18, height: 18, borderRadius: 99, background: YELLOW, display: 'flex' }),
        'ThaiBuzz',
      ]),
      category && h('div', { display: 'flex', background: '#fff', color, fontSize: 34, padding: '8px 24px', borderRadius: 999 }, category),
    ].filter(Boolean)),
    ...children,
  ].filter(Boolean));
}

const text = (s, size, extra = {}) => h('div', { fontSize: size, lineHeight: 1.28, display: 'flex', flexWrap: 'wrap', textShadow: '0 4px 20px rgba(0,0,0,0.5)', ...extra }, thaiWrap(s));

// 제목의 첫 구절(느낌표/공백 앞, 4~26자)을 형광펜으로: "สยามแทบแตก!" 같은 훅이 먼저 눈에 들어오게
function hookTitle(title, size) {
  const m = title.match(/^([^\s!?:]{4,26}[!?:]?)\s+(.{8,})$/s);
  if (!m) return [text(title, size)];
  return [
    h('div', { display: 'flex' }, [h('div', { display: 'flex', background: YELLOW, color: '#111', fontSize: size, lineHeight: 1.25, padding: '0 20px', borderRadius: 14, textShadow: 'none' }, thaiWrap(m[1]))]),
    text(m[2], size, { marginTop: 10 }),
  ];
}

const thaiDate = (iso) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });

function scenes(post, v, color) {
  YELLOW = pickAccent(post.slug);
  const sum = post.summary.slice(0, 3);
  const steps = sum.length + 2;
  const isK = post.category === 'K-บันเทิง';
  const watermark = isK ? 'K-POP' : post.category;
  const base = (step) => ({ bg: v.bg, color, step, steps, category: post.category, watermark });
  const out = [];

  // 1) 훅: 사진 카드 + 날짜 + 제목(첫 구절 형광펜)
  const long = post.title.length > 70;
  out.push({ dur: 3.6, tree: frame(base(0), [
    v.card && img(v.card, { position: 'absolute', top: 250, left: 40, width: 1000, height: 700, borderRadius: 36, boxShadow: '0 24px 70px rgba(0,0,0,0.55)', border: '3px solid rgba(255,255,255,0.25)' }, 1000, 700),
    h('div', { position: 'absolute', left: 70, right: 110, top: v.card ? 1000 : 620, display: 'flex', flexDirection: 'column', gap: 18 }, [
      h('div', { fontSize: 34, opacity: 0.85, display: 'flex', fontWeight: 500 }, thaiDate(post.createdAt)),
      ...hookTitle(post.title, v.card ? (long ? 60 : 68) : (long ? 72 : 84)),
    ]),
  ]) });

  // 2) 요약: 사진은 상단에 그대로(화면이 비지 않게), 아래 유리 카드에 번호 + 문장
  sum.forEach((s, i) => {
    out.push({ dur: 3.4, tree: frame(base(i + 1), [
      v.top && img(v.top, { position: 'absolute', top: 0, left: 0, width: W, height: 820 }, W, 820),
      v.top && h('div', { position: 'absolute', top: 0, left: 0, width: W, height: 820, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 60%, rgba(10,10,30,0.95) 100%)' }),
      h('div', { position: 'absolute', left: 50, right: 50, top: v.top ? 790 : 680, display: 'flex', flexDirection: 'column', gap: 22, background: 'rgba(8,8,24,0.62)', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 40, padding: '42px 46px 50px' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 22 }, [
          h('div', { fontSize: 88, lineHeight: 1, color: YELLOW, display: 'flex' }, String(i + 1).padStart(2, '0')),
          h('div', { display: 'flex', flexDirection: 'column', gap: 4 }, [
            h('div', { fontSize: 30, opacity: 0.7, display: 'flex', fontWeight: 500 }, `ประเด็นที่ ${i + 1} จาก ${sum.length}`),
            h('div', { width: 140, height: 6, borderRadius: 6, background: YELLOW, display: 'flex' }),
          ]),
        ]),
        text(s, s.length > 110 ? 50 : s.length > 70 ? 56 : 62, { fontWeight: 500, textShadow: 'none' }),
      ]),
    ]) });
  });

  // 3) 마무리: CTA + 출처 (신뢰) + 주소
  // 폰트(Prompt)에 없는 문자(한글 등)로 된 매체명은 네모로 깨짐 → 태국어/라틴 이름만 표시
  const srcs = [...new Set((post.sources || []).map((x) => x.source).filter((n) => n && /^[ -~฀-๿·–-]+$/.test(n)))].slice(0, 3).join(' · ');
  out.push({ dur: 2.8, tree: frame({ ...base(steps - 1), category: '' }, [
    h('div', { position: 'absolute', left: 70, right: 70, top: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 22 }, [
        h('div', { width: 44, height: 44, borderRadius: 99, background: YELLOW, display: 'flex' }),
        h('div', { fontSize: 120, lineHeight: 1, display: 'flex' }, 'ThaiBuzz'),
      ]),
      // 독자 질문 → 댓글 유도 (반응이 있어야 노출이 늘어남)
      h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 30, background: 'rgba(8,8,24,0.55)', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 36, padding: '34px 44px', width: 940 }, [
        h('div', { fontSize: 34, opacity: 0.75, display: 'flex', fontWeight: 500 }, 'คุณคิดว่าไง?'),
        text(questionOf(post).replace(/\s*[👇🙋👉]\s*$/u, ''), 54, { justifyContent: 'center', textAlign: 'center', textShadow: 'none' }),
        h('div', { display: 'flex', background: YELLOW, color: '#111', fontSize: 40, padding: '12px 34px', borderRadius: 999, marginTop: 10 }, 'คอมเมนต์บอกหน่อย'),
      ]),
      h('div', { fontSize: 34, opacity: 0.8, display: 'flex', marginTop: 24, fontWeight: 500 }, isK ? 'อ่านฉบับเต็ม → ลิงก์ในโพสต์ · ข่าวบันเทิงไทย × เกาหลี' : 'อ่านฉบับเต็ม → ลิงก์ในโพสต์ · thaibuzz.pages.dev'),
      srcs && h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 40 }, [
        h('div', { fontSize: 28, opacity: 0.6, display: 'flex', fontWeight: 500 }, 'ที่มา'),
        h('div', { fontSize: 32, opacity: 0.85, display: 'flex', fontWeight: 500, textAlign: 'center', justifyContent: 'center' }, srcs),
      ]),
    ].filter(Boolean)),
  ]) });
  return out;
}

async function renderPng(tree, file) {
  const svg = await satori(tree, { width: W, height: H, fonts: await fonts(true) });
  fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
}

// 낭독할 문단: 훅(제목) + 요약 각 장면과 1:1 대응
export const narrationSegments = (post) => [post.title, ...post.summary.slice(0, 3)];
// 디자인 확인용 (영상 없이 장면 트리만)
export const __scenes = async (post, color) => scenes(post, await visuals(post), color);

/**
 * voice: tts.narrate() 결과 { parts: [{ wav, dur }] } 또는 null(무음)
 * 음성이 있으면 장면 길이를 각 문단 낭독 길이(+여유)에 맞추고, 문단 음성을 장면마다 따로 넣어 싱크가 밀리지 않게 함
 */
const LEAD = XFADE + 0.1; // 디졸브가 끝난 뒤 말이 시작되도록
export async function makeReel(post, color = '#e11d48', voice = null) {
  fs.mkdirSync(REEL_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(REEL_DIR, `${post.slug}-`));
  const list = scenes(post, await visuals(post), color);
  const voiced = voice && voice.parts?.length === list.length - 1 ? voice : null; // 마무리 장면은 음성 없음
  if (voiced) voiced.parts.forEach((p, i) => { list[i].dur = Math.max(2.6, p.dur + LEAD + 0.4); });
  for (let i = 0; i < list.length; i++) await renderPng(list[i].tree, path.join(work, `s${i}.png`));

  const n = list.length;
  const total = list.reduce((a, s) => a + s.dur, 0) - XFADE * (n - 1);
  const args = ['-y'];
  list.forEach((_, i) => args.push('-i', path.join(work, `s${i}.png`)));
  const A = n; // 첫 오디오 입력 번호
  if (voiced) voiced.parts.forEach((p) => args.push('-i', p.wav));
  else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo'); // 무음 트랙(Reels 호환)
  // 장면마다 켄 번스: 짝수는 줌인, 홀수는 줌아웃 → 단조롭지 않게
  const chains = list.map((s, i) => {
    const frames = Math.round(s.dur * FPS);
    const z = i % 2 === 0 ? `min(zoom+0.0006,1.06)` : `if(lte(on,1),1.06,max(zoom-0.0006,1.0))`;
    return `[${i}:v]scale=1620:2880,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1[v${i}]`;
  });
  // 디졸브로 이어 붙이기 (검은 화면으로 꺼졌다 켜지지 않게)
  let prev = '[v0]', off = 0;
  for (let i = 1; i < n; i++) {
    off += list[i - 1].dur - XFADE;
    const outName = i === n - 1 ? '[vx]' : `[x${i}]`;
    chains.push(`${prev}[v${i}]xfade=transition=fade:duration=${XFADE}:offset=${off.toFixed(3)}${outName}`);
    prev = outName;
  }
  if (n === 1) chains.push('[v0]copy[vx]');
  chains.push(`[vx]fade=t=in:st=0:d=0.3,fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[v]`);
  let audioOut = `${A}:a`;
  if (voiced) {
    // 문단 음성을 장면 시작 LEAD 뒤에 두고 장면 길이까지 무음 → 영상과 같은 길이로 크로스페이드
    const segs = voiced.parts.map((_, i) =>
      `[${A + i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${Math.round(LEAD * 1000)}:all=1,apad=whole_dur=${list[i].dur.toFixed(3)},atrim=duration=${list[i].dur.toFixed(3)}[a${i}]`);
    segs.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${list[n - 1].dur.toFixed(3)}[a${n - 1}]`);
    chains.push(...segs);
    let ap = '[a0]';
    for (let i = 1; i < n; i++) {
      const outName = i === n - 1 ? '[aout]' : `[ax${i}]`;
      chains.push(`${ap}[a${i}]acrossfade=d=${XFADE}:c1=tri:c2=tri${outName}`);
      ap = outName;
    }
    audioOut = n === 1 ? '[a0]' : '[aout]';
  }
  const out = path.join(REEL_DIR, `${post.slug}.mp4`);
  args.push('-filter_complex', chains.join(';'), '-map', '[v]', '-map', audioOut,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', out);
  await run(ffmpegPath, args, { maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(work, { recursive: true, force: true });
  return { file: out, duration: total, size: fs.statSync(out).size, voiced: !!voiced };
}
