import fs from 'node:fs';
import path from 'node:path';

// 독자 질문 + 한국인 에디터 답변. 텔레그램 답장 → scripts/editor-notes.mjs → content/qa/<id>.json
export type QA = { id: string; q: string; a: string; at: string; slug?: string };
const DIR = path.join(process.cwd(), 'content', 'qa');

export function getQAs(): QA[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as QA).sort((a, b) => b.at.localeCompare(a.at));
}
