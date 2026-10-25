// 태국어 음성 낭독. 실패하면 null → 호출 쪽에서 무음 영상으로 대체
//  엔진 순서(REELS_VOICE_ENGINE, 기본 "edge,gemini"):
//   1) edge  — Microsoft Edge 읽어주기 음성(th-TH-PremwadeeNeural 등). 무료·한도 없음. 비공식 API 라 막히면 자동으로 다음 엔진 (2026-10-24 부터 서버 변경으로 실패 중)
//   3) gtts  — Google 번역 읽어주기 (비공식, 무료). Edge·Gemini 둘 다 안 될 때의 최후 예비 → 무음 영상이 나가지 않게
//   2) gemini — Gemini TTS 무료 티어 (한도가 작아 하루 몇 개면 소진)
//  문단마다 따로 합성해 장면과 1:1 싱크
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import { parseRetryMs } from './writer.mjs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// 음성 모델 무료 한도는 작음 → 소진된 모델은 안내된 대기 시간 동안 건너뜀 (글쓰기 모델과 같은 방식, .cache 로 실행 간 유지)
const COOL = '.cache/tts-cooldown.json';
const readCool = () => { try { return JSON.parse(fs.readFileSync(COOL, 'utf8')); } catch { return {}; } };
function markCooldown(model, msg) {
  const c = readCool();
  c[model] = Date.now() + (parseRetryMs(msg) ?? 6 * 36e5) + 60e3;
  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync(COOL, JSON.stringify(c));
}

const run = promisify(execFile);
const KEY = () => process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const API = 'https://generativelanguage.googleapis.com/v1beta';
const VOICE = process.env.GEMINI_TTS_VOICE || 'Kore'; // 또렷한 아나운서 톤

let models = null;
async function ttsModels() {
  if (models) return models;
  const pinned = (process.env.GEMINI_TTS_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);
  let found = [];
  try {
    const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': KEY() }, signal: AbortSignal.timeout(20000) });
    if (r.ok) {
      const ids = (await r.json()).models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => /tts/.test(n));
      const ver = (n) => parseFloat(n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? '0');
      // 음질 우선: flash(비 lite) 최신 → lite → pro 는 한도가 작아 마지막
      const rank = (n) => (/pro/.test(n) ? 2 : /lite/.test(n) ? 1 : 0);
      found = ids.sort((a, b) => rank(a) - rank(b) || ver(b) - ver(a));
    }
  } catch {}
  const cool = readCool();
  models = [...new Set([...pinned, ...found])].filter((m) => !(cool[m] > Date.now()));
  return models;
}

// ── Microsoft Edge 음성 ──
const EDGE_VOICE = process.env.EDGE_TTS_VOICE || 'th-TH-PremwadeeNeural'; // 여성 아나운서 톤. 남성: th-TH-NiwatNeural
async function synthEdge(text, file) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(EDGE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    // 속도는 엔진 자체 prosody 로 (atempo 보다 자연스러움)
    const { audioStream } = tts.toStream(text, { rate: SPEED });
    const chunks = [];
    const timer = setTimeout(() => audioStream.destroy(new Error('edge tts timeout')), 60000);
    try { for await (const c of audioStream) chunks.push(c); } finally { clearTimeout(timer); }
    const buf = Buffer.concat(chunks);
    if (buf.length < 2000) throw new Error('edge tts: empty audio');
    const mp3 = file + '.mp3';
    fs.writeFileSync(mp3, buf);
    return { input: ['-i', mp3], tmp: mp3, tempo: 1 };
  } finally { tts.close(); }
}

// ── Google 번역 읽어주기 (비공식, 무료, 한도 없음에 가까움) ── Edge 가 막혔을 때(2026-10-24~)와 Gemini 한도 소진 시 예비
//  요청당 약 200자 제한 → 문장을 쪼개 여러 번 받아 이어 붙임. 음색은 표준 안내 음성(Edge 보다 단조롭지만 명확)
const GTTS_MAX = 190;
function gttsChunks(text) {
  const out = [];
  let cur = '';
  for (const piece of String(text).split(/(?<=[\s,.!?…])/)) {
    if ([...cur + piece].length > GTTS_MAX && cur) { out.push(cur.trim()); cur = ''; }
    cur += piece;
  }
  if (cur.trim()) out.push(cur.trim());
  // 띄어쓰기 없는 긴 태국어 문장은 글자 수로 강제 분할
  return out.flatMap((c) => { const a = [...c]; const r = []; for (let i = 0; i < a.length; i += GTTS_MAX) r.push(a.slice(i, i + GTTS_MAX).join('')); return r; });
}
async function synthGtts(text, file) {
  const parts = [];
  for (const chunk of gttsChunks(text)) {
    const u = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(chunk)}`;
    let r;
    for (let i = 0; i < 2; i++) {
      r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', referer: 'https://translate.google.com/' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) break;
      await sleep(3000);
    }
    if (!r.ok) throw new Error(`gtts ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 1000) throw new Error('gtts: empty audio');
    parts.push(b);
  }
  const mp3 = file + '.mp3';
  fs.writeFileSync(mp3, Buffer.concat(parts));
  return { input: ['-i', mp3], tmp: mp3, tempo: SPEED };
}

// ── Gemini TTS ──
async function synthGemini(model, text, file) {
  const { pcm, rate } = await synth(model, STYLE + text);
  const raw = file + '.pcm';
  fs.writeFileSync(raw, pcm);
  return { input: ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw], tmp: raw, tempo: SPEED };
}

async function synth(model, text) {
  const r = await fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY(), 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error('no audio in response');
  const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] || 24000);
  return { pcm: Buffer.from(part.inlineData.data, 'base64'), rate };
}

// 무음 구간 탐지 → 가장 긴 무음 (n-1)개를 시간순으로 = 문단 경계
// 구간 [a, b] 안에서 실제 말이 시작/끝나는 지점 (앞뒤 무음 제외). silenceremove 는 끝부분 무음을 못 자르는 버전이 있어 silencedetect 로 직접 계산
export async function speechBounds(wav, a, b) {
  const { stderr } = await run(ffmpegPath, ['-ss', a.toFixed(3), '-to', b.toFixed(3), '-i', wav, '-af', 'silencedetect=noise=-40dB:d=0.08', '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 }).catch((e) => e);
  const out = String(stderr), len = b - a;
  const starts = [...out.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, +m[1]));
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  let s = 0, e = len;
  if (starts.length && starts[0] < 0.05 && ends[0] !== undefined) s = ends[0]; // 앞 무음
  const lastStart = starts[starts.length - 1];
  if (lastStart !== undefined && (ends.length < starts.length || ends[ends.length - 1] >= len - 0.05) && lastStart > s) e = lastStart; // 뒤 무음
  return [a + Math.max(0, s - 0.05), a + Math.min(len, e + 0.08)]; // 말 앞뒤로 아주 조금 여유
}

export async function durationOf(file) {
  const { stderr } = await run(ffmpegPath, ['-i', file, '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 }).catch((e) => e);
  const m = String(stderr).match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.match(/(\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 숏폼용: 빠르고 끊김 없이 (TTS 가 띄어쓰기마다 1초 넘게 쉬는 경향 → 프롬프트 + 후처리로 압축)
const STYLE = 'อ่านแบบผู้ประกาศข่าวบันเทิงบน TikTok น้ำเสียงสดใส พูดเร็ว กระชับ และต่อเนื่อง ไม่เว้นช่วงหยุดยาว:\n\n';
const SPEED = Number(process.env.REELS_VOICE_SPEED || 1.15);

// 문단 하나 → 정리된 wav (앞뒤 무음 제거 + 음량 정규화). 분당 한도(429 + 짧은 대기)는 한 번 기다렸다가 재시도
//  model: 'edge' 또는 Gemini 모델명
async function speakOne(model, text, file) {
  for (let attempt = 0; ; attempt++) {
    try {
      const src = model === 'edge' ? await synthEdge(text, file) : model === 'gtts' ? await synthGtts(text, file) : await synthGemini(model, text, file);
      const tmp = file + '.tmp.wav';
      await run(ffmpegPath, ['-y', ...src.input, '-af', `silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-40dB:stop_silence=0.3,atempo=${src.tempo},loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '2', tmp]);
      fs.rmSync(src.tmp, { force: true });
      const len = await durationOf(tmp);
      const [a, b] = await speechBounds(tmp, 0, len);
      await run(ffmpegPath, ['-y', '-i', tmp, '-ss', a.toFixed(3), '-to', b.toFixed(3), file]);
      fs.rmSync(tmp, { force: true });
      return b - a;
    } catch (e) {
      const wait = String(e.message).match(/retry in\s*([\d.]+)s/i);
      if (attempt === 0 && /429|quota|RESOURCE_EXHAUSTED/i.test(e.message) && wait && +wait[1] <= 60) { await sleep((+wait[1] + 1) * 1000); continue; }
      throw e;
    }
  }
}

/**
 * segments: 읽을 문단들 (제목, 요약1..3). 문단마다 따로 합성 → 장면과 정확히 1:1 싱크
 * (한 번에 읽힌 음성을 무음 기준으로 쪼개면 TTS 가 문장 중간에서 길게 쉴 때 경계가 틀어짐 — 실제로 발생)
 * 반환: { parts: [{ wav, dur }], total } / 실패(키 없음·한도·오류) 시 null → 무음 영상
 */
export async function narrate(segments, outDir) {
  if (process.env.REELS_VOICE === 'false') return null;
  fs.mkdirSync(outDir, { recursive: true });
  const engines = (process.env.REELS_VOICE_ENGINE || 'edge,gemini,gtts').split(',').map((s) => s.trim()).filter(Boolean);
  const chain = [];
  for (const e of engines) {
    if (e === 'edge') chain.push('edge');
    else if (e === 'gtts') chain.push('gtts');
    else if (e === 'gemini' && KEY()) chain.push(...(await ttsModels()));
  }
  for (const model of chain) {
    try {
      const parts = [];
      for (let i = 0; i < segments.length; i++) {
        const wav = path.join(outDir, `part${i}.wav`);
        const dur = await speakOne(model, segments[i], wav);
        if (dur < 0.5) throw new Error(`segment ${i} too short`);
        parts.push({ wav, dur });
      }
      console.log(`tts: ${model} → 문단 ${parts.map((p) => p.dur.toFixed(1)).join('/')}s`);
      return { parts, total: parts.reduce((a, p) => a + p.dur, 0) };
    } catch (e) {
      console.warn(`tts: ${model} 실패 → ${String(e.message).slice(0, 160)}`);
      if (model !== 'edge' && model !== 'gtts' && /429|quota|RESOURCE_EXHAUSTED/i.test(e.message)) markCooldown(model, e.message);
    }
  }
  console.warn('tts: 사용 가능한 음성 모델 없음 → 무음 영상');
  return null;
}
