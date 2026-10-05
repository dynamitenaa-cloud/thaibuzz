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
export async function boundaries(wav, n) {
  const { stderr } = await run(ffmpegPath, ['-i', wav, '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 }).catch((e) => e);
  const starts = [...String(stderr).matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...String(stderr).matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ end: +m[1], dur: +m[2] }));
  const gaps = ends.map((e, i) => ({ mid: (starts[i] ?? e.end - e.dur) + e.dur / 2, dur: e.dur })).filter((g) => g.mid > 0.5);
  if (gaps.length < n - 1) return null;
  return gaps.sort((a, b) => b.dur - a.dur).slice(0, n - 1).map((g) => g.mid).sort((a, b) => a - b);
}

export async function durationOf(file) {
  const { stderr } = await run(ffmpegPath, ['-i', file, '-f', 'null', '-'], { maxBuffer: 16 * 1024 * 1024 }).catch((e) => e);
  const m = String(stderr).match(/time=(\d+):(\d+):([\d.]+)/g)?.pop()?.match(/(\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

/**
 * segments: 읽을 문단들 (제목, 요약1..3). 반환: { wav, total, durations[] } — durations 는 문단별 길이(초)
 * 실패(키 없음/한도/오류) 시 null
 */
export async function narrate(segments, outDir) {
  if (!KEY() || process.env.REELS_VOICE === 'false') return null;
  const script = 'อ่านแบบผู้ประกาศข่าวบันเทิง น้ำเสียงสดใส ชัดเจน กระชับ และเว้นจังหวะหยุดสั้น ๆ ระหว่างแต่ละย่อหน้า:\n\n' + segments.join('\n\n');
  for (const model of await ttsModels()) {
    try {
      const { pcm, rate } = await synth(model, script);
      fs.mkdirSync(outDir, { recursive: true });
      const raw = path.join(outDir, 'voice.pcm'), wav = path.join(outDir, 'voice.wav');
      fs.writeFileSync(raw, pcm);
      // 앞뒤 무음 정리 + 음량 정규화
      await run(ffmpegPath, ['-y', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw,
        '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ar', '44100', '-ac', '2', wav]);
      fs.rmSync(raw, { force: true });
      const total = await durationOf(wav);
      if (total < 3) throw new Error(`audio too short (${total}s)`);
      // 문단 경계: 무음 탐지 → 실패 시 글자 수 비례
      const cuts = await boundaries(wav, segments.length);
      const marks = cuts ?? (() => {
        const lens = segments.map((s) => [...s].length), sum = lens.reduce((a, b) => a + b, 0);
        let acc = 0;
        return lens.slice(0, -1).map((l) => (acc += (l / sum) * total));
      })();
      const points = [0, ...marks, total];
      const durations = segments.map((_, i) => points[i + 1] - points[i]);
      console.log(`tts: ${model} ${total.toFixed(1)}s, scenes ${durations.map((d) => d.toFixed(1)).join('/')}${cuts ? '' : ' (proportional)'}`);
      return { wav, total, durations };
    } catch (e) {
      console.warn(`tts: ${model} 실패 → ${String(e.message).slice(0, 160)}`);
    }
  }
  console.warn('tts: 사용 가능한 음성 모델 없음 → 무음 영상');
  return null;
}
