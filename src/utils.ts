/**
 * 公共工具函数
 */
import type { Textbook, Word } from './types';

/** 词性缩写 → 中文标签 */
const POS_LABELS: Record<string, string> = {
  'n.': '名词',
  'v.': '动词',
  'adj.': '形容词',
  'adv.': '副词',
  'pron.': '代词',
  'prep.': '介词',
  'conj.': '连词',
  'art.': '冠词',
  'int.': '感叹词',
  'num.': '数词',
};

export function posLabel(pos: string): string {
  return POS_LABELS[pos] || pos;
}

/** 在全量教材数据中查找单词所属的年级、册次、单元 */
export function findWordLocation(
  textbooks: Textbook[],
  word: Word,
): { grade: string; volume: string; unit: string } | null {
  for (const tb of textbooks) {
    for (const u of tb.units) {
      if (u.words.some(w => w.english === word.english && w.chinese === word.chinese)) {
        return { grade: tb.grade, volume: tb.volume, unit: u.unit };
      }
    }
  }
  return null;
}

/** Fisher-Yates 洗牌 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
