/**
 * 测试模式组件
 * 生成选择题，支持"看中文选英文"和"看英文选中文"两种模式。
 * 答题进度可通过 onSaveState 回调保存，支持中途退出后恢复。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Unit, Word, TestQuestion, SavedTestState, Difficulty } from '../types';
import { shuffle } from '../utils';

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
  const questionsGenerated = useRef(!!savedState);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackBtnRef = useRef<HTMLButtonElement | null>(null);

  // 用 ref 同步最新状态，供 setTimeout 回调读取（避免闭包过期）
  const stateRef = useRef({ correctWords, incorrectWords, currentIndex });
  useEffect(() => {
    stateRef.current = { correctWords, incorrectWords, currentIndex };
  });

  const isTestingWrongWords = units.length === 1 && units[0].unit === '错题本';

  /** 构建当前测试快照，用于退出时保存或定期持久化 */
  const buildSnapshot = useCallback((): SavedTestState => ({
    questions,
    currentIndex: stateRef.current.currentIndex,
    correctWords: stateRef.current.correctWords,
    incorrectWords: stateRef.current.incorrectWords,
    testMode,
    unitNames: units.map(u => u.unit),
    grade,
    volume,
    isTestingWrongWords,
    difficulty,
  }), [questions, testMode, units, grade, volume, isTestingWrongWords, difficulty]);

  useEffect(() => {
    if (questions.length > 0 && onSaveState) {
      onSaveState(buildSnapshot());
    }
  }, [correctWords.length, incorrectWords.length, currentIndex, questions.length, onSaveState, buildSnapshot]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  // 题目切换后，强制清除所有选项按钮的反馈样式（移动端兼容）
  useEffect(() => {
    const btns = document.querySelectorAll('.options .option');
    btns.forEach(btn => {
      btn.classList.remove('correct', 'incorrect');
      (btn as HTMLButtonElement).style.backgroundColor = '';
      (btn as HTMLButtonElement).style.borderColor = '';
      (btn as HTMLButtonElement).style.color = '';
    });
  }, [currentIndex]);

  // 生成题目（仅执行一次，有保存状态时跳过）
  useEffect(() => {
    if (questionsGenerated.current) return;

    const testWords = units.flatMap(u => u.words);
    const shuffledWords = shuffle(testWords);
    const isChineseToEnglish = testMode === 'chineseToEnglish';
    // 干扰项来源：优先使用全量词库，否则使用当前测试词库
    const optionPool = allWordsProp && allWordsProp.length > 0 ? allWordsProp : testWords;

    const newQuestions: TestQuestion[] = shuffledWords.map(word => {
      const correctAnswer = isChineseToEnglish ? word.english : word.chinese;

      let wrongOptions: string[];

      if (difficulty === 'hard' && isChineseToEnglish && confusingWordsMap) {
        const confusingList = confusingWordsMap[word.english] ?? [];
        const fromConfusing = shuffle(confusingList).slice(0, 3);
        if (fromConfusing.length < 3) {
          const need = 3 - fromConfusing.length;
          const samePos = optionPool.filter(w =>
            w.english !== word.english &&
            w.partOfSpeech === word.partOfSpeech &&
            !fromConfusing.includes(w.english)
          );
          const fallback = shuffle(samePos.length >= need ? samePos : optionPool.filter(w =>
            w.english !== word.english && !fromConfusing.includes(w.english)
          )).slice(0, need).map(w => w.english);
          wrongOptions = shuffle([...fromConfusing, ...fallback]);
        } else {
          wrongOptions = fromConfusing;
        }
      } else if (difficulty === 'hard' && !isChineseToEnglish && confusingWordsMap) {
        const confusingList = confusingWordsMap[word.english] ?? [];
        const confusingChinese: string[] = [];
        for (const ce of confusingList) {
          const cw = optionPool.find(w => w.english === ce);
          if (cw && cw.chinese !== word.chinese) {
            confusingChinese.push(cw.chinese);
          }
        }
        const fromConfusing = shuffle(confusingChinese).slice(0, 3);
        if (fromConfusing.length < 3) {
          const need = 3 - fromConfusing.length;
          const samePos = optionPool.filter(w =>
            w.chinese !== word.chinese &&
            w.partOfSpeech === word.partOfSpeech &&
            !fromConfusing.includes(w.chinese)
          );
          const fallback = shuffle(samePos.length >= need ? samePos : optionPool.filter(w =>
            w.chinese !== word.chinese && !fromConfusing.includes(w.chinese)
          )).slice(0, need).map(w => w.chinese);
          wrongOptions = shuffle([...fromConfusing, ...fallback]);
        } else {
          wrongOptions = fromConfusing;
        }
      } else {
        const wrongWords = optionPool.filter(w =>
          (isChineseToEnglish ? w.english : w.chinese) !== correctAnswer
        );
        wrongOptions = shuffle(wrongWords).slice(0, 3).map(w =>
          isChineseToEnglish ? w.english : w.chinese
        );
      }

      const uniqueWrong = [...new Set(wrongOptions.filter(o => o !== correctAnswer))];
      while (uniqueWrong.length < 3) {
        const filler = optionPool.find(w =>
          (isChineseToEnglish ? w.english : w.chinese) !== correctAnswer &&
          !uniqueWrong.includes(isChineseToEnglish ? w.english : w.chinese)
        );
        if (filler) uniqueWrong.push(isChineseToEnglish ? filler.english : filler.chinese);
        else break;
      }
      const options = shuffle([correctAnswer, ...uniqueWrong.slice(0, 3)]);

      return {
        word,
        options,
        correctAnswer,
        isChineseToEnglish,
      };
    });

    setQuestions(newQuestions);
    questionsGenerated.current = true;
  }, [units, savedState, testMode, allWordsProp, difficulty, confusingWordsMap]);

  /**
   * 前进到下一题
   * 延迟 800ms 让用户看到反馈动画，然后清除 DOM 样式并切题。
   * 使用 stateRef 读取最新状态，避免闭包过期。
   */
  const advance = useCallback((isCorrect: boolean, word: Word) => {
    const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
    const nextCorrect = isCorrect ? [...c, word] : c;
    const nextIncorrect = isCorrect ? ic : [...ic, word];

    advanceTimeoutRef.current = setTimeout(() => {
      // 清除按钮 DOM 上的反馈样式（inline style + class），解决移动端样式残留问题
      const btn = feedbackBtnRef.current;
      if (btn) {
        btn.classList.remove('correct', 'incorrect');
        btn.style.borderColor = '';
        btn.style.backgroundColor = '';
        btn.style.color = '';
      }
      feedbackBtnRef.current = null;

      if (idx < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnswered(false);
      } else {
        onTestComplete(nextCorrect, nextIncorrect);
      }
    }, 800);
  }, [questions.length, onTestComplete]);

  /** 处理用户选择答案：添加反馈样式、记录结果、延迟切题 */
  const handleAnswer = useCallback((answer: string, btn: HTMLButtonElement) => {
    if (isAnswered) return;
    setIsAnswered(true);

    const currentQuestion = questions[currentIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    // 同时使用 class（CSS 动画）和 inline style（颜色兜底），确保移动端反馈正确显示
    btn.classList.add(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      btn.style.borderColor = 'var(--color-correct)';
      btn.style.backgroundColor = 'var(--color-correct-subtle)';
      btn.style.color = 'var(--color-correct)';
    } else {
      btn.style.borderColor = 'var(--color-incorrect)';
      btn.style.backgroundColor = 'var(--color-incorrect-subtle)';
      btn.style.color = 'var(--color-incorrect)';
    }
    feedbackBtnRef.current = btn;

    if (isCorrect) {
      setCorrectWords(prev => [...prev, currentQuestion.word]);
    } else {
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      onWrongWord?.(currentQuestion.word);
    }

    advance(isCorrect, currentQuestion.word);
  }, [isAnswered, questions, currentIndex, onWrongWord, advance]);

  /** 用户点击「我不知道」：直接记为错误并前进 */
  const handleDontKnow = useCallback(() => {
    if (isAnswered) return;
    setIsAnswered(true);

    const currentQuestion = questions[currentIndex];
    setIncorrectWords(prev => [...prev, currentQuestion.word]);
    onWrongWord?.(currentQuestion.word);

    advance(false, currentQuestion.word);
  }, [isAnswered, questions, currentIndex, onWrongWord, advance]);

  // 键盘快捷键：数字键 1-4 选择选项，0 键表示「我不知道」
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered) return;
      const key = e.key;
      if (key >= '1' && key <= '4') {
        const index = parseInt(key) - 1;
        const currentQ = questions[currentIndex];
        if (currentQ && index < currentQ.options.length) {
          const btns = document.querySelectorAll('.options .option');
          const btn = btns[index] as HTMLButtonElement;
          if (btn) handleAnswer(currentQ.options[index], btn);
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
    onQuit(buildSnapshot());
  };

  if (questions.length === 0) {
    return <div className="loading">正在生成测试题...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="test-mode">
      <div className="test-header">
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
        </div>
        <button className="quit-btn" onClick={handleQuit} title="退出测试">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="question-info">
        <span>第 {currentIndex + 1} / {questions.length} 题</span>
        <span className="mode-indicator">
          {currentQuestion.isChineseToEnglish ? '看中文选英文' : '看英文选中文'}
        </span>
      </div>

      <div className="question-card" key={currentIndex}>
        <div className="question-word">
          {currentQuestion.isChineseToEnglish
            ? currentQuestion.word.chinese
            : currentQuestion.word.english}
        </div>

        <div className="options">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              className="option"
              onClick={(e) => handleAnswer(option, e.currentTarget)}
              disabled={isAnswered}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          className="dont-know-btn"
          onClick={handleDontKnow}
          disabled={isAnswered}
        >
          我不知道
        </button>
      </div>

      <div className="score-display">
        <span>正确: {correctWords.length}</span>
        <span>错误: {incorrectWords.length}</span>
      </div>
    </div>
  );
}
