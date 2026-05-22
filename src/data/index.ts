import type { Textbook } from '../types';

const gradeModules = {
  'grade7a': () => import('./grade7a.json'),
  'grade7b': () => import('./grade7b.json'),
  'grade8a': () => import('./grade8a.json'),
  'grade8b': () => import('./grade8b.json'),
  'grade9': () => import('./grade9.json'),
} as const;

/** 加载全部册次数据（并行请求，各自独立 chunk） */
export async function loadAllTextbooks(): Promise<Textbook[]> {
  const entries = Object.entries(gradeModules) as [keyof typeof gradeModules, () => Promise<{ default: unknown }>][];
  const results = await Promise.all(entries.map(([, loader]) => loader()));
  return results.map(r => r.default as Textbook);
}
