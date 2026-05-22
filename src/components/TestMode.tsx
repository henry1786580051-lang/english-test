/**
 * 测试模式组件
 * 生成选择题，支持"看中文选英文"和"看英文选中文"两种模式。
 * 答题进度可通过 onSaveState 回调保存，支持中途退出后恢复。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Unit, Word, TestQuestion, SavedTestState, Difficulty } from '../types';
import { shuffle } from '../utils';
import { WRONG_WORDS_UNIT } from '../constants';
import styles from '../styles/modules/TestMode.module.css';

interface TestModeProps {
  units: Unit[];
  testMode: 'chineseToEnglish' | 'englishToChinese';
  onTestComplete: (correctWords: Word[], incorrectWords: Word[]) => void;
  onQuit: (state: SavedTestState) => void;
  savedState?: SavedTestState | null;
  grade?: string;
  volume?: string;
  onSaveState?: (state: SavedTestState) => void;
  onWrongWord?: (word: Word) => void;
  allWords?: Word[];
  difficulty?: Difficulty;
  confusingWords?: Record<string, string[]>;
}

/** 从易混淆词表中提取干扰选项 */
function getConfusingOptions(
  word: Word,
  pool: Word[],
  isChineseToEnglish: boolean,
  confusingMap: Record<string, string[]>,
): string[] {
  const confusingEnglish = confusingMap[word.english] ?? [];

  if (isChineseToEnglish) {
    // C2E: 选项是英文，直接从 confusingMap 取英文（匹配 optionPool 中存在的）
    return shuffle(confusingEnglish.filter(e => pool.some(w => w.english === e))).slice(0, 3);
  }

  // E2C: 选项是中文，把易混淆英文词映射为中文释义
  const fromConfusing: string[] = [];
  for (const ce of confusingEnglish) {
    const cw = pool.find(w => w.english === ce);
    if (cw && cw.chinese !== word.chinese) {
      fromConfusing.push(cw.chinese);
    }
  }
  return shuffle(fromConfusing).slice(0, 3);
}

/** 补足不足 3 个的干扰选项（优先同词性） */
function fillWrongOptions(
  correct: string,
  existing: string[],
  pool: Word[],
  field: 'english' | 'chinese',
  pos: string,
): string[] {
  const result = [...existing];
  const used = new Set([correct, ...result]);

  const addFrom = (words: Word[]) => {
    for (const w of shuffle(words)) {
      if (result.length >= 3) break;
      if (!used.has(w[field])) {
        result.push(w[field]);
        used.add(w[field]);
      }
    }
  };

  addFrom(pool.filter(w => w.partOfSpeech === pos));
  if (result.length < 3) addFrom(pool);
  return result;
}

/** 从词库生成测试题目（纯函数，便于测试） */
function generateQuestions(
  units: Unit[],
  testMode: 'chineseToEnglish' | 'englishToChinese',
  optionPool: Word[],
  difficulty: Difficulty,
  confusingWordsMap?: Record<string, string[]>,
): TestQuestion[] {
  const shuffledWords = shuffle(units.flatMap(u => u.words));
  const isChineseToEnglish = testMode === 'chineseToEnglish';
  const field = isChineseToEnglish ? 'english' : 'chinese';

  return shuffledWords.map(word => {
    const correctAnswer = word[field];

    const wrongOptions = difficulty === 'hard' && confusingWordsMap
      ? getConfusingOptions(word, optionPool, isChineseToEnglish, confusingWordsMap)
      : [];

    const filled = fillWrongOptions(
      correctAnswer,
      wrongOptions.filter(o => o !== correctAnswer),
      optionPool,
      field,
      word.partOfSpeech,
    );

    return {
      word,
      options: shuffle([correctAnswer, ...filled.slice(0, 3)]),
      correctAnswer,
      isChineseToEnglish,
    };
  });
}

export function TestMode({
  units,
  testMode,
  onTestComplete,
  onQuit,
  savedState,
  grade = '',
  volume = '',
  onSaveState,
  onWrongWord,
  allWords: allWordsProp,
  difficulty = 'normal',
  confusingWords: confusingWordsMap,
}: TestModeProps) {
  const [questions, setQuestions] = useState<TestQuestion[]>(savedState?.questions ?? []);
  const [currentIndex, setCurrentIndex] = useState(savedState?.currentIndex ?? 0);
  const [correctWords, setCorrectWords] = useState<Word[]>(savedState?.correctWords ?? []);
  const [incorrectWords, setIncorrectWords] = useState<Word[]>(savedState?.incorrectWords ?? []);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<{ index: number; isCorrect: boolean } | null>(null);
  const questionsGenerated = useRef(!!savedState);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef({ correctWords, incorrectWords, currentIndex });
  useEffect(() => {
    stateRef.current = { correctWords, incorrectWords, currentIndex };
  });

  const isTestingWrongWords = units.length === 1 && units[0].unit === WRONG_WORDS_UNIT;

  // 生成题目（仅执行一次，有保存状态时跳过）
  useEffect(() => {
    if (questionsGenerated.current) return;
    const optionPool = allWordsProp && allWordsProp.length > 0 ? allWordsProp : units.flatMap(u => u.words);
    setQuestions(generateQuestions(units, testMode, optionPool, difficulty, confusingWordsMap));
    questionsGenerated.current = true;
  }, [units, testMode, allWordsProp, difficulty, confusingWordsMap]);

  // 保存测试进度
  useEffect(() => {
    if (questions.length > 0 && onSaveState) {
      const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
      onSaveState({
        questions,
        currentIndex: idx,
        correctWords: c,
        incorrectWords: ic,
        testMode,
        unitNames: units.map(u => u.unit),
        grade,
        volume,
        isTestingWrongWords,
        difficulty,
      });
    }
  }, [correctWords.length, incorrectWords.length, currentIndex, questions.length, onSaveState, questions, testMode, units, grade, volume, isTestingWrongWords, difficulty]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  /** 处理用户选择答案 */
  const handleAnswer = useCallback((answerIndex: number) => {
    if (isAnswered) return;
    const currentQuestion = questions[currentIndex];
    const answer = currentQuestion.options[answerIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    setIsAnswered(true);
    setSelectedAnswer({ index: answerIndex, isCorrect });

    if (isCorrect) {
      setCorrectWords(prev => [...prev, currentQuestion.word]);
    } else {
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      onWrongWord?.(currentQuestion.word);
    }

    advanceTimeoutRef.current = setTimeout(() => {
      setSelectedAnswer(null);
      const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
      if (idx < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnswered(false);
      } else {
        const nextCorrect = isCorrect ? [...c, currentQuestion.word] : c;
        const nextIncorrect = isCorrect ? ic : [...ic, currentQuestion.word];
        onTestComplete(nextCorrect, nextIncorrect);
      }
    }, 800);
  }, [isAnswered, questions, currentIndex, onWrongWord, onTestComplete]);

  /** 用户点击「我不知道」 */
  const handleDontKnow = useCallback(() => {
    if (isAnswered) return;
    const currentQuestion = questions[currentIndex];

    setIsAnswered(true);
    setIncorrectWords(prev => [...prev, currentQuestion.word]);
    onWrongWord?.(currentQuestion.word);

    advanceTimeoutRef.current = setTimeout(() => {
      setSelectedAnswer(null);
      const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
      if (idx < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnswered(false);
      } else {
        onTestComplete(c, [...ic, currentQuestion.word]);
      }
    }, 800);
  }, [isAnswered, questions, currentIndex, onWrongWord, onTestComplete]);

  // 键盘快捷键：数字键 1-4 选择选项，0 键表示「我不知道」
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered) return;
      const key = e.key;
      if (key >= '1' && key <= '4') {
        const index = parseInt(key) - 1;
        const currentQ = questions[currentIndex];
        if (currentQ && index < currentQ.options.length) {
          handleAnswer(index);
        }
      } else if (key === '0') {
        handleDontKnow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, questions, currentIndex, handleAnswer, handleDontKnow]);

  const handleQuit = () => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    onQuit({
      questions,
      currentIndex,
      correctWords,
      incorrectWords,
      testMode,
      unitNames: units.map(u => u.unit),
      grade,
      volume,
      isTestingWrongWords,
      difficulty,
    });
  };

  if (questions.length === 0) {
    return <div className={styles.loading}>正在生成测试题...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className={styles.testMode}>
      <div className={styles.testHeader}>
        <div className={styles.progressBar}>
          <div className={styles.progress} style={{ width: `${progress}%` }}></div>
        </div>
        <button className={styles.quitBtn} onClick={handleQuit} title="退出测试">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.questionInfo}>
        <span>第 {currentIndex + 1} / {questions.length} 题</span>
        <span className={styles.modeIndicator}>
          {currentQuestion.isChineseToEnglish ? '看中文选英文' : '看英文选中文'}
        </span>
      </div>

      <div className={styles.questionCard} key={currentIndex}>
        <div className={styles.questionWord}>
          {currentQuestion.isChineseToEnglish
            ? currentQuestion.word.chinese
            : currentQuestion.word.english}
        </div>

        <div className={styles.options}>
          {currentQuestion.options.map((option, index) => {
            const feedbackClass = selectedAnswer?.index === index
              ? (selectedAnswer.isCorrect ? styles.optionCorrect : styles.optionIncorrect)
              : '';
            return (
              <button
                key={index}
                className={`${styles.option} ${feedbackClass}`}
                onClick={() => handleAnswer(index)}
                disabled={isAnswered}
              >
                {option}
              </button>
            );
          })}
        </div>

        <button
          className={styles.dontKnowBtn}
          onClick={handleDontKnow}
          disabled={isAnswered}
        >
          我不知道
        </button>
      </div>

      <div className={styles.scoreDisplay}>
        <span>正确: {correctWords.length}</span>
        <span>错误: {incorrectWords.length}</span>
      </div>
    </div>
  );
}

TestMode.displayName = 'TestMode';
