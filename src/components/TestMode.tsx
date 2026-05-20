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
  // 有保存状态时恢复，否则从空状态开始
  const [questions, setQuestions] = useState<TestQuestion[]>(savedState?.questions ?? []);
  const [currentIndex, setCurrentIndex] = useState(savedState?.currentIndex ?? 0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctWords, setCorrectWords] = useState<Word[]>(savedState?.correctWords ?? []);
  const [incorrectWords, setIncorrectWords] = useState<Word[]>(savedState?.incorrectWords ?? []);
  const questionsGenerated = useRef(!!savedState);

  // 用 ref 管理选项反馈样式，绕过 React 渲染周期，避免移动端样式残留
  const selectedBtnRef = useRef<HTMLButtonElement | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用 ref 跟踪最新答题状态，避免 setTimeout 闭包过期
  const stateRef = useRef({ correctWords, incorrectWords, currentIndex });
  useEffect(() => {
    stateRef.current = { correctWords, incorrectWords, currentIndex };
  });

  // 是否为错题本测试
  const isTestingWrongWords = units.length === 1 && units[0].unit === '错题本';

  // 构造保存状态的快照
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

  // 答题状态变化时同步给父组件
  useEffect(() => {
    if (questions.length > 0 && onSaveState) {
      onSaveState(buildSnapshot());
    }
  }, [correctWords.length, incorrectWords.length, currentIndex, questions.length, onSaveState, buildSnapshot]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  // 生成题目（仅一次，有保存状态时跳过）
  useEffect(() => {
    if (questionsGenerated.current) return;

    const testWords = units.flatMap(u => u.words);
    const shuffledWords = shuffle(testWords);
    const isChineseToEnglish = testMode === 'chineseToEnglish';
    const optionPool = allWordsProp && allWordsProp.length > 0 ? allWordsProp : testWords;

    const newQuestions: TestQuestion[] = shuffledWords.map(word => {
      const correctAnswer = isChineseToEnglish ? word.english : word.chinese;

      let wrongOptions: string[];

      if (difficulty === 'hard' && isChineseToEnglish && confusingWordsMap) {
        // 困难模式：看中文选英文 — 使用词型相近的词
        const confusingList = confusingWordsMap[word.english] ?? [];
        const fromConfusing = shuffle(confusingList).slice(0, 3);
        if (fromConfusing.length < 3) {
          const need = 3 - fromConfusing.length;
          // 优先选同词性的词作为补充
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
        // 困难模式：看英文选中文 — 使用词型相近词的中文释义作为干扰项
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
          // 优先选同词性的词的中文释义作为补充
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
        // 普通难度：从全量词池随机抽取
        const wrongWords = optionPool.filter(w =>
          (isChineseToEnglish ? w.english : w.chinese) !== correctAnswer
        );
        wrongOptions = shuffle(wrongWords).slice(0, 3).map(w =>
          isChineseToEnglish ? w.english : w.chinese
        );
      }

      // 去重：确保 correctAnswer 恰好出现一次，干扰项不重复
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

  // 前进到下一题或结束测试 — 直接操作 DOM 清除反馈样式
  const advance = useCallback((isCorrect: boolean, word: Word, selectedBtn: HTMLButtonElement | null) => {
    const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
    const nextCorrect = isCorrect ? [...c, word] : c;
    const nextIncorrect = isCorrect ? ic : [...ic, word];

    advanceTimeoutRef.current = setTimeout(() => {
      // 直接清除按钮上的反馈样式
      if (selectedBtn) {
        selectedBtn.classList.remove('correct', 'incorrect');
      }

      if (idx < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnswered(false);
      } else {
        onTestComplete(nextCorrect, nextIncorrect);
      }
    }, 800);
  }, [questions.length, onTestComplete]);

  const handleAnswer = (answer: string, btn: HTMLButtonElement) => {
    if (isAnswered) return;

    setIsAnswered(true);

    // 直接操作 DOM 添加反馈样式
    const currentQuestion = questions[currentIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      btn.classList.add('correct');
      setCorrectWords(prev => [...prev, currentQuestion.word]);
    } else {
      btn.classList.add('incorrect');
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      onWrongWord?.(currentQuestion.word);
    }
    selectedBtnRef.current = btn;

    advance(isCorrect, currentQuestion.word, btn);
  };

  const handleDontKnow = () => {
    if (isAnswered) return;

    setIsAnswered(true);

    const currentQuestion = questions[currentIndex];
    setIncorrectWords(prev => [...prev, currentQuestion.word]);
    onWrongWord?.(currentQuestion.word);

    advance(false, currentQuestion.word, null);
  };

  // 键盘快捷键：1-4 选择选项，0 表示不知道
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
  });

  const handleQuit = () => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
    }
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

      <div className="question-card">
        <div className="question-word">
          {currentQuestion.isChineseToEnglish
            ? currentQuestion.word.chinese
            : currentQuestion.word.english}
        </div>

        <div className="options" key={currentIndex}>
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
