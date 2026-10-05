// 숏폼(세로 1080×1920) 자동 생성: 장면 이미지(satori → resvg) → ffmpeg(줌 + 페이드) → MP4
//  장면: 오프닝(사진 + 제목) → 요약 3개(한 장씩) → 마무리(사이트 안내). 약 16초
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { fonts, thaiWrap } from './thumbs.mjs';

const run = promisify(execFile);
const W = 1080, H = 1920, FPS = 30;
export const REEL_DIR = path.join('.cache', 'reels');

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });
const dataUri = (buf, mime = 'image/jpeg') => `data:${mime};base64,${buf.toString('base64')}`;

// 사진이 있으면: 흐리게 꽉 채운 배경 + 원본 사진 카드. 없으면 카테고리 색 그라데이션
async function visuals(post) {
  const file = post.thumbClean ? path.join('public', post.thumbClean) : '';
  if (!file || !fs.existsSync(file)) return { bg: null, photo: null };
  const bg = await sharp(file).resize(W, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55 }).jpeg({ quality: 80 }).toBuffer();
  const photo = await sharp(file).resize(1000, 525, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
  return { bg: dataUri(bg), photo: dataUri(photo) };
}

function frame({ bg, color }, children) {
  return h('div', { width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Prompt', color: '#fff', backgroundImage: `linear-gradient(160deg, ${color} 0%, #4c1d95 100%)` }, [
    bg && h('img', { position: 'absolute', top: 0, left: 0, width: W, height: H }, undefined, { src: bg, width: W, height: H }),
    h('div', { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)' }),
    // 상단 브랜드 (인스타/페북 UI 에 가리지 않도록 상단 여백 확보)
    h('div', { position: 'absolute', top: 150, left: 60, display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,0,0,0.45)', padding: '10px 26px', borderRadius: 999, fontSize: 38 }, [
      h('div', { width: 18, height: 18, borderRadius: 99, background: '#fde047', display: 'flex' }),
      'ThaiBuzz',
    ]),
    ...children,
  ].filter(Boolean));
}

const block = (style, children) => h('div', { position: 'absolute', left: 70, right: 70, display: 'flex', flexDirection: 'column', ...style }, children);
const text = (s, size, extra = {}) => h('div', { fontSize: size, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap', textShadow: '0 4px 24px rgba(0,0,0,0.55)', ...extra }, thaiWrap(s));

function scenes(post, v, color) {
  const out = [];
  // 1) 오프닝: 사진 카드 + 카테고리 + 제목
  out.push({ dur: 3.6, tree: frame({ bg: v.bg, color }, [
    v.photo && h('img', { position: 'absolute', top: 330, left: 40, width: 1000, height: 525, borderRadius: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }, undefined, { src: v.photo, width: 1000, height: 525 }),
    block({ top: v.photo ? 930 : 640, gap: 32 }, [
      h('div', { display: 'flex' }, [h('div', { background: '#fff', color, fontSize: 40, padding: '6px 26px', borderRadius: 14 }, post.category)]),
      text(post.title, v.photo ? (post.title.length > 70 ? 62 : 72) : (post.title.length > 70 ? 74 : 86)),
      h('div', { width: 180, height: 12, borderRadius: 12, background: '#fde047', display: 'flex' }),
    ]),
  ]) });
  // 2) 요약 3개
  post.summary.slice(0, 3).forEach((s, i, arr) => {
    out.push({ dur: 3.4, tree: frame({ bg: v.bg, color }, [
      block({ top: 560, gap: 26 }, [
        h('div', { fontSize: 42, opacity: 0.9, display: 'flex' }, 'สรุปประเด็น'),
        h('div', { display: 'flex' }, [h('div', { background: '#fde047', color: '#111', fontSize: 44, padding: '6px 28px', borderRadius: 999 }, `${i + 1} / ${arr.length}`)]),
      ]),
      block({ top: 760, gap: 0 }, [text(s, s.length > 90 ? 64 : 74)]),
    ]) });
  });
  // 3) 마무리
  out.push({ dur: 2.6, tree: frame({ bg: v.bg, color }, [
    block({ top: 700, gap: 30, alignItems: 'center' }, [
      h('div', { fontSize: 120, display: 'flex' }, 'ThaiBuzz'),
      text('อ่านข่าวฉบับเต็มพร้อมแหล่งอ้างอิง', 52, { justifyContent: 'center' }),
      h('div', { display: 'flex', background: '#fde047', color: '#111', fontSize: 46, padding: '12px 36px', borderRadius: 999, marginTop: 20 }, 'ลิงก์อยู่ในโพสต์'),
    ]),
  ]) });
  return out;
}

async function renderPng(tree, file) {
  const svg = await satori(tree, { width: W, height: H, fonts: await fonts() });
  fs.writeFileSync(file, new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
}

// 낭독할 문단: 오프닝(제목) + 요약 각 장면과 1:1 대응
export const narrationSegments = (post) => [post.title, ...post.summary.slice(0, 3)];

/**
 * voice: tts.narrate() 결과 { wav, durations[] } 또는 null(무음)
 * 음성이 있으면 장면 길이를 각 문단 낭독 길이(+여유)에 맞추고, 음성을 장면별로 잘라 붙여 싱크가 밀리지 않게 함
 */
export async function makeReel(post, color = '#e11d48', voice = null) {
  fs.mkdirSync(REEL_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(REEL_DIR, `${post.slug}-`));
  const list = scenes(post, await visuals(post), color);
  const voiced = voice && voice.durations.length === list.length - 1 ? voice : null; // 마무리 장면은 음성 없음
  if (voiced) voiced.durations.forEach((d, i) => { list[i].dur = Math.max(2.4, d + 0.35); });
  for (let i = 0; i < list.length; i++) await renderPng(list[i].tree, path.join(work, `s${i}.png`));

  // 장면마다 살짝 줌인(켄 번스) + 0.25초 페이드 → 이어 붙이기
  const total = list.reduce((a, s) => a + s.dur, 0);
  const args = ['-y'];
  list.forEach((_, i) => args.push('-i', path.join(work, `s${i}.png`)));
  const A = list.length; // 오디오 입력 번호
  if (voiced) args.push('-i', voiced.wav);
  else args.push('-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo'); // 무음 트랙(Reels 호환)
  const chains = list.map((s, i) => {
    const frames = Math.round(s.dur * FPS);
    return `[${i}:v]scale=1620:2880,zoompan=z='min(zoom+0.0007,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},` +
      `fade=t=in:st=0:d=0.25,fade=t=out:st=${(s.dur - 0.25).toFixed(2)}:d=0.25,setsar=1[v${i}]`;
  });
  let audioOut = `${A}:a`;
  if (voiced) {
    // 음성을 문단 경계에서 잘라 각 장면 길이로 늘린 뒤 이어 붙임 (+ 마무리 장면 길이만큼 무음)
    let t = 0;
    const segs = voiced.durations.map((d, i) => {
      const part = `[${A}:a]atrim=start=${t.toFixed(3)}:end=${(t + d).toFixed(3)},asetpts=PTS-STARTPTS,apad=whole_dur=${list[i].dur.toFixed(3)}[a${i}]`;
      t += d;
      return part;
    });
    const last = list.length - 1;
    segs.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${list[last].dur.toFixed(3)}[a${last}]`);
    chains.push(...segs, `${list.map((_, i) => `[a${i}]`).join('')}concat=n=${list.length}:v=0:a=1[aout]`);
    audioOut = '[aout]';
  }
  const filter = `${chains.join(';')};${list.map((_, i) => `[v${i}]`).join('')}concat=n=${list.length}:v=1:a=0[v]`;
  const out = path.join(REEL_DIR, `${post.slug}.mp4`);
  args.push('-filter_complex', filter, '-map', '[v]', '-map', audioOut,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', out);
  await run(ffmpegPath, args, { maxBuffer: 64 * 1024 * 1024 });
  fs.rmSync(work, { recursive: true, force: true });
  return { file: out, duration: total, size: fs.statSync(out).size, voiced: !!voiced };
}
