// 태국어 음성 낭독 (Gemini TTS, 무료 티어). 실패하면 null → 호출 쪽에서 무음 영상으로 대체
//  영상 1개당 API 호출 1회: 제목 + 요약 3줄을 한 번에 읽히고, 무음 구간으로 장면 경계를 찾는다
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

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
  models = [...new Set([...pinned, ...found])];
  return models;
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
async function speakOne(model, text, file) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { pcm, rate } = await synth(model, STYLE + text);
      const raw = file + '.pcm', tmp = file + '.tmp.wav';
      fs.writeFileSync(raw, pcm);
      await run(ffmpegPath, ['-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw, '-af', `silenceremove=stop_periods=-1:stop_duration=0.35:stop_threshold=-40dB:stop_silence=0.3,atempo=${SPEED},loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '2', tmp]);
      fs.rmSync(raw, { force: true });
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
  if (!KEY() || process.env.REELS_VOICE === 'false') return null;
  fs.mkdirSync(outDir, { recursive: true });
  for (const model of await ttsModels()) {
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
    }
  }
  console.warn('tts: 사용 가능한 음성 모델 없음 → 무음 영상');
  return null;
}
