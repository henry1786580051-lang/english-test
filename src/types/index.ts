/** 词性缩写字面量类型 */
export type PartOfSpeech = 'n.' | 'v.' | 'adj.' | 'adv.' | 'pron.' | 'prep.' | 'conj.' | 'art.' | 'int.' | 'num.';

export interface Word {
  english: string;
  chinese: string;
  partOfSpeech: PartOfSpeech;
}

export interface Unit {
  unit: string;
  words: Word[];
}

export interface Textbook {
  grade: string;
  volume: string;
  units: Unit[];
}

export interface TestQuestion {
  word: Word;
  options: string[];
  correctAnswer: string;
  isChineseToEnglish: boolean;
}

export interface TestResult {
  totalQuestions: number;
  correctAnswers: number;
  incorrectWords: Word[];
  timestamp: number;
}

export interface WrongWord {
  word: Word;
  unit: string;
  grade: string;
  volume: string;
  count: number;
}

export type Difficulty = 'normal' | 'hard';

export type TestModeType = 'chineseToEnglish' | 'englishToChinese';

export interface SavedTestState {
  questions: TestQuestion[];
  currentIndex: number;
  correctWords: Word[];
  incorrectWords: Word[];
  testMode: 'chineseToEnglish' | 'englishToChinese';
  unitNames: string[];
  grade: string;
  volume: string;
  isTestingWrongWords: boolean;
  difficulty: Difficulty;
}
