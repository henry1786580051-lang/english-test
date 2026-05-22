import type { Textbook } from '../types';

const gradeModules = {
  'grade7a': () => import('./grade7a.json'),
  'grade7b': () => import('./grade7b.json'),
  'grade8a': () => import('./grade8a.json'),
  'grade8b': () => import('./grade8b.json'),
  'grade9': () => import('./grade9.json'),
} as const;

export type GradeKey = keyof typeof gradeModules;

export const GRADE_LABELS: Record<GradeKey, string> = {
  'grade7a': '七年级上册',
  'grade7b': '七年级下册',
  'grade8a': '八年级上册',
  'grade8b': '八年级下册',
  'grade9': '九年级全一册',
};

export const ALL_GRADE_KEYS: GradeKey[] = Object.keys(gradeModules) as GradeKey[];

/** 加载全部册次数据（并行请求，各自独立 chunk） */
export async function loadAllTextbooks(): Promise<Textbook[]> {
  const entries = Object.entries(gradeModules) as [GradeKey, () => Promise<{ default: unknown }>][];
  const results = await Promise.all(entries.map(([, loader]) => loader()));
  return results.map(r => r.default as Textbook);
}

/** 按需加载单册 */
export async function loadTextbook(key: GradeKey): Promise<Textbook> {
  const mod = await gradeModules[key]();
  return mod.default as Textbook;
}
