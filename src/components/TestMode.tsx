/**
 * 测试模式组件
 * 生成选择题，支持"看中文选英文"和"看英文选中文"两种模式。
 * 答题进度可通过 onSaveState 回调保存，支持中途退出后恢复。
 */
import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
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

// 答题反馈状态 — 合并为单一对象，确保原子更新
interface FeedbackState {
  selectedAnswer: string | null;
  isAnswered: boolean;
}

type FeedbackAction =
  | { type: 'ANSWER'; answer: string }
  | { type: 'RESET' };

function feedbackReducer(_state: FeedbackState, action: FeedbackAction): FeedbackState {
  switch (action.type) {
    case 'ANSWER':
      return { selectedAnswer: action.answer, isAnswered: true };
    case 'RESET':
      return { selectedAnswer: null, isAnswered: false };
  }
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
  const [feedback, dispatchFeedback] = useReducer(feedbackReducer, {
    selectedAnswer: null,
    isAnswered: false,
  });
  const [correctWords, setCorrectWords] = useState<Word[]>(savedState?.correctWords ?? []);
  const [incorrectWords, setIncorrectWords] = useState<Word[]>(savedState?.incorrectWords ?? []);
  const questionsGenerated = useRef(!!savedState);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateRef = useRef({ correctWords, incorrectWords, currentIndex });
  useEffect(() => {
    stateRef.current = { correctWords, incorrectWords, currentIndex };
  });

  const isTestingWrongWords = units.length === 1 && units[0].unit === '错题本';

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

  // 前进到下一题或结束测试 — 使用 useReducer 确保状态原子更新
  const advance = useCallback((isCorrect: boolean, word: Word) => {
    const { correctWords: c, incorrectWords: ic, currentIndex: idx } = stateRef.current;
    const nextCorrect = isCorrect ? [...c, word] : c;
    const nextIncorrect = isCorrect ? ic : [...ic, word];

    advanceTimeoutRef.current = setTimeout(() => {
      // 原子更新：先重置反馈状态，再切题
      dispatchFeedback({ type: 'RESET' });
      if (idx < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onTestComplete(nextCorrect, nextIncorrect);
      }
    }, 800);
  }, [questions.length, onTestComplete]);

  const handleAnswer = useCallback((answer: string) => {
    if (feedback.isAnswered) return;

    dispatchFeedback({ type: 'ANSWER', answer });

    const currentQuestion = questions[currentIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;

    if (isCorrect) {
      setCorrectWords(prev => [...prev, currentQuestion.word]);
    } else {
      setIncorrectWords(prev => [...prev, currentQuestion.word]);
      onWrongWord?.(currentQuestion.word);
    }

    advance(isCorrect, currentQuestion.word);
  }, [feedback.isAnswered, questions, currentIndex, onWrongWord, advance]);

  const handleDontKnow = useCallback(() => {
    if (feedback.isAnswered) return;

    dispatchFeedback({ type: 'ANSWER', answer: '__dont_know__' });

    const currentQuestion = questions[currentIndex];
    setIncorrectWords(prev => [...prev, currentQuestion.word]);
    onWrongWord?.(currentQuestion.word);

    advance(false, currentQuestion.word);
  }, [feedback.isAnswered, questions, currentIndex, onWrongWord, advance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (feedback.isAnswered) return;
      const key = e.key;
      if (key >= '1' && key <= '4') {
        const index = parseInt(key) - 1;
        const currentQ = questions[currentIndex];
        if (currentQ && index < currentQ.options.length) {
          handleAnswer(currentQ.options[index]);
        }
      } else if (key === '0') {
        handleDontKnow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback.isAnswered, questions, currentIndex, handleAnswer, handleDontKnow]);

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

      <div className="question-card" key={currentIndex}>
        <div className="question-word">
          {currentQuestion.isChineseToEnglish
            ? currentQuestion.word.chinese
            : currentQuestion.word.english}
        </div>

        <div className="options">
          {currentQuestion.options.map((option, index) => {
            let className = 'option';
            if (feedback.isAnswered) {
              if (option === currentQuestion.correctAnswer) {
                className += ' correct';
              } else if (option === feedback.selectedAnswer && feedback.selectedAnswer !== '__dont_know__') {
                className += ' incorrect';
              }
            }

            return (
              <button
                key={index}
                className={className}
                onClick={() => handleAnswer(option)}
                disabled={feedback.isAnswered}
              >
                {option}
              </button>
            );
          })}
        </div>

        <button
          className="dont-know-btn"
          onClick={handleDontKnow}
          disabled={feedback.isAnswered}
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
