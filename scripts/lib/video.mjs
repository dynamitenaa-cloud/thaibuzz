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

// 편집자 육성 (brand/voice/*.m4a, manifest.json): 릴스 앞뒤에 사람 목소리 → AI 낭독만 있는 영상과 구분
//   intro-hello "สวัสดีครับ ผมยุนมิน" · intro-korea "ข่าวนี้คนเกาหลีก็พูดถึงครับ" · outro-question "คุณคิดว่าไงครับ คอมเมนต์บอกหน่อย" · outro-brand "ThaiBuzz ครับ"
// REELS_EDITOR_VOICE=false 로 끌 수 있음
const editorVoice = (() => {
  if (process.env.REELS_EDITOR_VOICE === 'false') return {};
  try {
    const m = JSON.parse(fs.readFileSync(path.join('brand', 'voice', 'manifest.json'), 'utf8'));
    return Object.fromEntries(Object.entries(m).filter(([, v]) => fs.existsSync(v.file)).map(([k, v]) => [k, { file: path.resolve(v.file), dur: Number(v.dur) }]));
  } catch { return {}; }
})();
// 편집자 셀카 영상 (brand/video/*.mp4 1080x1920 30fps, manifest.json): 첫 장면·질문 장면을 실제 얼굴 영상으로
//   selfie-hello "สวัสดีครับ ผมยุนมิน" · selfie-korea "ข่าวนี้คนเกาหลีก็พูดถึงครับ" · selfie-story "วันนี้มีข่าวน่าสนใจครับ" · selfie-question "คุณคิดว่าไงครับ คอมเมนต์บอกหน่อย"
const selfie = (() => {
  if (process.env.REELS_EDITOR_VOICE === 'false' || process.env.REELS_SELFIE === 'false') return {};
  try {
    const m = JSON.parse(fs.readFileSync(path.join('brand', 'video', 'manifest.json'), 'utf8'));
    return Object.fromEntries(Object.entries(m).filter(([, v]) => fs.existsSync(v.file)).map(([k, v]) => [k, { file: path.resolve(v.file), dur: Number(v.dur) }]));
  } catch { return {}; }
})();
const SELFIE_CAPTION = { 'selfie-hello': 'สวัสดีครับ ผมยุนมิน', 'selfie-korea': 'ข่าวนี้คนเกาหลีก็พูดถึงครับ', 'selfie-story': 'วันนี้มีข่าวน่าสนใจครับ', 'selfie-question': 'คุณคิดว่าไงครับ?' };
const hashN = (slug, salt, n) => parseInt(crypto.createHash('md5').update(`${slug}:${salt}`).digest('hex').slice(0, 6), 16) % n;
const SITE_HOST = (() => { try { return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').host; } catch { return 'thaibuzz.net'; } })();

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

// 셀카 영상 위에 얹는 투명 오버레이: 진행 바 + 브랜드 + 이름표 + 자막 (+ 버튼)
function selfieOverlay({ step, steps, category, color }, caption, { sub = '', pill = '' } = {}) {
  return h('div', { width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Prompt', fontWeight: 700, color: '#fff' }, [
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: 420, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)' }),
    h('div', { position: 'absolute', top: 1080, left: 0, width: W, height: 840, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.92) 100%)' }),
    h('div', { position: 'absolute', top: 118, left: 60, right: 60, display: 'flex', gap: 10 }, Array.from({ length: steps }, (_, i) =>
      h('div', { flex: 1, height: 8, borderRadius: 8, background: i <= step ? YELLOW : 'rgba(255,255,255,0.35)', display: 'flex' }))),
    h('div', { position: 'absolute', top: 150, left: 60, right: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.5)', padding: '10px 26px', borderRadius: 999, fontSize: 38 }, [
        h('div', { width: 18, height: 18, borderRadius: 99, background: YELLOW, display: 'flex' }),
        'ThaiBuzz',
      ]),
      category && h('div', { display: 'flex', background: '#fff', color, fontSize: 34, padding: '8px 24px', borderRadius: 999 }, category),
    ].filter(Boolean)),
    h('div', { position: 'absolute', left: 70, right: 70, top: 1300, display: 'flex', flexDirection: 'column', gap: 22 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
        h('div', { display: 'flex', background: '#0047a0', color: '#fff', fontSize: 28, padding: '6px 16px', borderRadius: 10, letterSpacing: 2 }, 'KR'),
        h('div', { display: 'flex', fontSize: 36, fontWeight: 500, opacity: 0.95 }, 'ยุนมิน · บรรณาธิการชาวเกาหลี'),
      ]),
      text(caption, 66, { textShadow: '0 4px 24px rgba(0,0,0,0.6)' }),
      sub && text(sub, 46, { fontWeight: 500, opacity: 0.92 }),
      pill && h('div', { display: 'flex', background: YELLOW, color: '#111', fontSize: 40, padding: '12px 34px', borderRadius: 999, alignSelf: 'flex-start', marginTop: 6 }, pill),
    ].filter(Boolean)),
  ]);
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
  const isK = post.category === 'K-บันเทิง';
  // 셀카 장면: 인사(K-연예는 한국 멘트, 그 외는 인사/오늘 뉴스 번갈아) + 마무리 질문
  // 인사 셀카는 기본 꺼짐 (첫 1~2초에 뉴스가 보여야 안 넘김). REELS_SELFIE_INTRO=true 로 켜서 A/B 가능
  const introOn = process.env.REELS_SELFIE_INTRO === 'true';
  const introKey = !introOn ? null : isK && selfie['selfie-korea'] ? 'selfie-korea' : hashN(post.slug, 'intro', 2) === 0 && selfie['selfie-story'] ? 'selfie-story' : selfie['selfie-hello'] ? 'selfie-hello' : null;
  const askKey = selfie['selfie-question'] ? 'selfie-question' : null;
  const steps = sum.length + 2 + (introKey ? 1 : 0) + (askKey ? 1 : 0);
  let step = 0;
  const watermark = isK ? 'K-POP' : post.category;
  const base = (st) => ({ bg: v.bg, color, step: st, steps, category: post.category, watermark });
  const out = [];

  // 0) 셀카 인사 (영상 자체 소리 사용)
  if (introKey) out.push({ dur: selfie[introKey].dur, video: selfie[introKey].file, tree: selfieOverlay({ step: step++, steps, category: post.category, color }, SELFIE_CAPTION[introKey]) });

  // 1) 훅: 사진 카드 + 날짜 + 제목(첫 구절 형광펜)
  const long = post.title.length > 70;
  out.push({ dur: 3.6, tree: frame(base(step++), [
    v.card && img(v.card, { position: 'absolute', top: 250, left: 40, width: 1000, height: 700, borderRadius: 36, boxShadow: '0 24px 70px rgba(0,0,0,0.55)', border: '3px solid rgba(255,255,255,0.25)' }, 1000, 700),
    h('div', { position: 'absolute', left: 70, right: 110, top: v.card ? 1000 : 620, display: 'flex', flexDirection: 'column', gap: 18 }, [
      h('div', { fontSize: 34, opacity: 0.85, display: 'flex', fontWeight: 500 }, thaiDate(post.createdAt)),
      ...hookTitle(post.title, v.card ? (long ? 60 : 68) : (long ? 72 : 84)),
    ]),
  ]) });

  // 2) 요약: 사진은 상단에 그대로(화면이 비지 않게), 아래 유리 카드에 번호 + 문장
  sum.forEach((s, i) => {
    out.push({ dur: 3.4, tree: frame(base(step++), [
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

  // 3) 셀카 질문 (댓글 유도) — 영상 자체 소리
  const q = questionOf(post).replace(/\s*[👇🙋👉]\s*$/u, '');
  if (askKey) out.push({ dur: selfie[askKey].dur, video: selfie[askKey].file, tree: selfieOverlay({ step: step++, steps, category: post.category, color }, SELFIE_CAPTION[askKey], { sub: q, pill: 'คอมเมนต์บอกหน่อย' }) });

  // 4) 브랜드 카드: 로고 + (셀카 없을 때만 질문) + 주소 + 출처
  // 폰트(Prompt)에 없는 문자(한글 등)로 된 매체명은 네모로 깨짐 → 태국어/라틴 이름만 표시
  const srcs = [...new Set((post.sources || []).map((x) => x.source).filter((n) => n && /^[ -~฀-๿·–-]+$/.test(n)))].slice(0, 3).join(' · ');
  out.push({ dur: 2.8, tree: frame({ ...base(steps - 1), category: '' }, [
    h('div', { position: 'absolute', left: 70, right: 70, top: askKey ? 640 : 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 22 }, [
        h('div', { width: 44, height: 44, borderRadius: 99, background: YELLOW, display: 'flex' }),
        h('div', { fontSize: 120, lineHeight: 1, display: 'flex' }, 'ThaiBuzz'),
      ]),
      !askKey && h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 30, background: 'rgba(8,8,24,0.55)', border: '2px solid rgba(255,255,255,0.14)', borderRadius: 36, padding: '34px 44px', width: 940 }, [
        h('div', { fontSize: 34, opacity: 0.75, display: 'flex', fontWeight: 500 }, 'คุณคิดว่าไง?'),
        text(q, 54, { justifyContent: 'center', textAlign: 'center', textShadow: 'none' }),
        h('div', { display: 'flex', background: YELLOW, color: '#111', fontSize: 40, padding: '12px 34px', borderRadius: 999, marginTop: 10 }, 'คอมเมนต์บอกหน่อย'),
      ]),
      h('div', { fontSize: 36, opacity: 0.85, display: 'flex', marginTop: 24, fontWeight: 500 }, `อ่านฉบับเต็ม → ลิงก์ในโพสต์ · ${SITE_HOST}`),
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
  const n = list.length;
  const isVideo = (sc) => !!sc.video;
  // TTS 는 정지 장면(훅 + 요약)에 1:1. 셀카/브랜드 카드 제외
  const ttsScenes = list.map((sc, i) => (!isVideo(sc) && i < n - 1 ? i : -1)).filter((i) => i >= 0);
  const voiced = voice && voice.parts?.length === ttsScenes.length ? voice : null;
  const GAP = 0.25;
  // 장면별 오디오 클립(순서대로). 셀카 장면은 영상 자체 소리
  const clips = list.map((sc, i) => (isVideo(sc) ? [{ own: true, dur: sc.dur }] : []));
  const hasSelfieIntro = isVideo(list[0]);
  const hasSelfieAsk = n >= 2 && isVideo(list[n - 2]);
  // 셀카 영상이 없을 때만 인사 음성 (옛 방식)
  // 인사 음성도 기본 꺼짐 (REELS_VOICE_INTRO=true 로 켬) — 제목 낭독이 바로 시작되게
  if (!hasSelfieIntro && process.env.REELS_VOICE_INTRO === 'true') { const intro = editorVoice[post.category === 'K-บันเทิง' ? 'intro-korea' : 'intro-hello'] || editorVoice['intro-hello']; if (intro) clips[ttsScenes[0] ?? 0].push(intro); }
  if (voiced) voiced.parts.forEach((p, k) => clips[ttsScenes[k]].push({ file: p.wav, dur: p.dur }));
  // 편집자 한 마디: 첫 요약 앞 (K-연예 → 한국에서도 화제 / 스포츠 → 응원 / 그 외 절반 → 저도 놀랐어요)
  const reactKey = post.category === 'K-บันเทิง' ? 'react-korea' : post.category === 'กีฬา' ? 'react-cheer' : hashN(post.slug, 'react', 2) === 0 ? 'react-surprised' : null;
  if (reactKey && editorVoice[reactKey] && ttsScenes.length >= 2) clips[ttsScenes[1]].unshift(editorVoice[reactKey]);
  // 마무리: 셀카 질문이 있으면 브랜드 카드에 "ThaiBuzz ครับ"/"ขอบคุณครับ", 없으면 질문 음성 + 브랜드
  const outroKeys = hasSelfieAsk ? [hashN(post.slug, 'outro', 2) === 0 && editorVoice['outro-thanks'] ? 'outro-thanks' : 'outro-brand'] : ['outro-question', 'outro-brand'];
  for (const k of outroKeys) if (editorVoice[k]) clips[n - 1].push(editorVoice[k]);
  // 정지 장면 길이 = 클립 길이에 맞춤 (셀카 장면은 영상 길이 그대로)
  list.forEach((sc, i) => { if (isVideo(sc)) return; const c = clips[i]; if (c.length) sc.dur = Math.max(2.6, LEAD + c.reduce((a, x) => a + x.dur, 0) + GAP * (c.length - 1) + 0.4); });
  for (let i = 0; i < n; i++) await renderPng(list[i].tree, path.join(work, `s${i}.png`));

  const total = list.reduce((a, sc) => a + sc.dur, 0) - XFADE * (n - 1);
  const args = ['-y'];
  let idx = 0;
  const vIdx = [], oIdx = [];
  list.forEach((sc, i) => {
    if (isVideo(sc)) { args.push('-i', sc.video); vIdx[i] = idx++; args.push('-i', path.join(work, `s${i}.png`)); oIdx[i] = idx++; }
    else { args.push('-i', path.join(work, `s${i}.png`)); vIdx[i] = idx++; }
  });
  const aIdx = clips.map((c, i) => c.map((clip) => { if (clip.own) return vIdx[i]; args.push('-i', clip.file); return idx++; }));
  const anyAudio = aIdx.some((c) => c.length);
  if (!anyAudio) { args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo'); } // 무음 트랙(Reels 호환)
  const silentIdx = idx;
  const chains = list.map((sc, i) => {
    const D = sc.dur.toFixed(3);
    if (isVideo(sc)) return `[${vIdx[i]}:v]trim=duration=${D},setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H},setsar=1[vb${i}];[vb${i}][${oIdx[i]}:v]overlay=0:0:format=auto,format=yuv420p[v${i}]`;
    // 정지 장면: 켄 번스 (짝수 줌인, 홀수 줌아웃)
    const frames = Math.round(sc.dur * FPS);
    const z = i % 2 === 0 ? `min(zoom+0.0006,1.06)` : `if(lte(on,1),1.06,max(zoom-0.0006,1.0))`;
    return `[${vIdx[i]}:v]scale=1620:2880,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p,setsar=1[v${i}]`;
  });
  // 디졸브로 이어 붙이기
  let prev = '[v0]', off = 0;
  for (let i = 1; i < n; i++) {
    off += list[i - 1].dur - XFADE;
    const outName = i === n - 1 ? '[vx]' : `[x${i}]`;
    chains.push(`${prev}[v${i}]xfade=transition=fade:duration=${XFADE}:offset=${off.toFixed(3)}${outName}`);
    prev = outName;
  }
  if (n === 1) chains.push('[v0]copy[vx]');
  chains.push(`[vx]fade=t=in:st=0:d=0.3,fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[v]`);
  let audioOut = `${silentIdx}:a`;
  if (anyAudio) {
    for (let i = 0; i < n; i++) {
      const c = clips[i];
      const D = list[i].dur.toFixed(3);
      if (!c.length) { chains.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${D}[a${i}]`); continue; }
      let at = isVideo(list[i]) ? 0 : LEAD;
      const names = c.map((clip, j) => {
        chains.push(`[${aIdx[i][j]}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=${Math.round(at * 1000)}:all=1,apad=whole_dur=${D},atrim=duration=${D}[c${i}_${j}]`);
        at += clip.dur + GAP;
        return `[c${i}_${j}]`;
      });
      chains.push(names.length === 1 ? `${names[0]}acopy[a${i}]` : `${names.join('')}amix=inputs=${names.length}:normalize=0:duration=longest[a${i}]`);
    }
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
  return { file: out, duration: total, size: fs.statSync(out).size, voiced: !!voiced, selfie: hasSelfieIntro, editorVoice: hasSelfieIntro || Object.keys(editorVoice).length > 0 };
}
