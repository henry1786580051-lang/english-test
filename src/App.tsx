/**
 * 应用根组件
 * 管理全局视图路由、测试状态、错题本持久化。
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import wordsData from './data/words.json';
import confusingWordsData from './data/confusingWords.json';
import type { Textbook, Unit, Word, TestResult, WrongWord, SavedTestState, Difficulty } from './types';
import { UnitSelector } from './components/UnitSelector';
import { TestMode } from './components/TestMode';
import { TestResult as TestResultComponent } from './components/TestResult';
import { WrongWords } from './components/WrongWords';
import { VocabularyList } from './components/VocabularyList';
import { findWordLocation } from './utils';
import './styles/App.css';

type View = 'select' | 'modeSelect' | 'test' | 'result' | 'wrongWords' | 'vocabulary';
type TestModeType = 'chineseToEnglish' | 'englishToChinese';

const textbooks = wordsData as Textbook[];
const confusingWords = confusingWordsData as Record<string, string[]>;

function App() {
  const [currentView, setCurrentView] = useState<View>('select');
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  // 使用惰性初始化从 localStorage 加载错题本
  const [wrongWords, setWrongWords] = useState<WrongWord[]>(() => {
    try {
      const saved = localStorage.getItem('wrongWords');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [retryUnits, setRetryUnits] = useState<Unit[]>([]);
  const [testMode, setTestMode] = useState<TestModeType>('chineseToEnglish');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [isTestingWrongWords, setIsTestingWrongWords] = useState(false);
  const [savedTestState, setSavedTestState] = useState<SavedTestState | null>(() => {
    try {
      const saved = localStorage.getItem('savedTestState');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'newTest' | 'wrongWords' | null>(null);
  const [pendingMode, setPendingMode] = useState<TestModeType | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedVolume, setSelectedVolume] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // 全量单词池，用于测试时生成干扰项
  const allWords = useMemo(() =>
    textbooks.flatMap(tb => tb.units.flatMap(u => u.words)),
  []);

  // 错题本变化时持久化
  useEffect(() => {
    localStorage.setItem('wrongWords', JSON.stringify(wrongWords));
  }, [wrongWords]);

  // 未完成测试进度持久化
  useEffect(() => {
    if (savedTestState) {
      localStorage.setItem('savedTestState', JSON.stringify(savedTestState));
    } else {
      localStorage.removeItem('savedTestState');
    }
  }, [savedTestState]);

  /** 查找单元所属的年级和册次 */
  const findUnitGradeVolume = useCallback((units: Unit[]): { grade: string; volume: string } => {
    for (const tb of textbooks) {
      if (tb.units.some(u => units.includes(u))) {
        return { grade: tb.grade, volume: tb.volume };
      }
    }
    return { grade: '', volume: '' };
  }, []);

  const handleUnitsSelected = (units: Unit[]) => {
    setSelectedUnits(units);
    setRetryUnits(units);
    const { grade, volume } = findUnitGradeVolume(units);
    setSelectedGrade(grade);
    setSelectedVolume(volume);
    setCurrentView('modeSelect');
  };

  const handleModeSelected = (mode: TestModeType) => {
    if (savedTestState) {
      setPendingAction('newTest');
      setPendingMode(mode);
      setShowConfirmDialog(true);
      return;
    }
    setTestMode(mode);
    setCurrentView('test');
  };

  const handleConfirmDiscard = () => {
    setShowConfirmDialog(false);
    setSavedTestState(null);
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'wrongWords') {
      setIsTestingWrongWords(true);
      setCurrentView('modeSelect');
    } else if (pendingMode) {
      setTestMode(pendingMode);
      setPendingMode(null);
      setCurrentView('test');
    }
  };

  const handleConfirmKeep = () => {
    setShowConfirmDialog(false);
    setPendingMode(null);
    setPendingAction(null);
    if (savedTestState?.isTestingWrongWords) {
      setIsTestingWrongWords(true);
    }
    if (savedTestState?.difficulty) {
      setDifficulty(savedTestState.difficulty);
    }
    setCurrentView('test');
  };

  const handleCancelDialog = () => {
    setShowConfirmDialog(false);
    setPendingMode(null);
    setPendingAction(null);
  };

  const handleTestComplete = (correctWords: Word[], incorrectWords: Word[]) => {
    setTestResult({
      totalQuestions: correctWords.length + incorrectWords.length,
      correctAnswers: correctWords.length,
      incorrectWords,
      timestamp: Date.now(),
    });
    setSavedTestState(null);
    setCurrentView('result');
  };

  const handleQuitTest = (state: SavedTestState) => {
    setSavedTestState(state);
    setCurrentView('select');
  };

  /** 重试：回到模式选择页，沿用上次的单元 */
  const handleRetry = () => {
    setRetryUnits([...selectedUnits]);
    setCurrentView('modeSelect');
  };

  const handleBackToSelect = () => {
    if (currentView === 'test' && savedTestState) {
      setPendingAction('newTest');
      setShowConfirmDialog(true);
      return;
    }
    setCurrentView('select');
    setTestResult(null);
  };

  const handleSaveTestState = (state: SavedTestState) => {
    setSavedTestState(state);
  };

  /** 记录错词，若已存在则累加错误次数 */
  const handleWrongWord = (word: Word) => {
    setWrongWords(prev => {
      const existingIndex = prev.findIndex(
        w => w.word.english === word.english && w.word.chinese === word.chinese
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], count: updated[existingIndex].count + 1 };
        return updated;
      }
      const loc = findWordLocation(textbooks, word);
      return [...prev, {
        word,
        unit: loc?.unit ?? '未知',
        grade: loc?.grade ?? '未知',
        volume: loc?.volume ?? '未知',
        count: 1,
      }];
    });
  };

  const handleShowWrongWords = () => setCurrentView('wrongWords');
  const handleBackFromWrongWords = () => setCurrentView('select');
  const handleShowVocabulary = () => setCurrentView('vocabulary');

  const handleVocabTestWords = (words: Word[], grade: string, volume: string, unitName: string) => {
    const unit: Unit = { unit: unitName, words };
    setSelectedUnits([unit]);
    setRetryUnits([unit]);
    setSelectedGrade(grade);
    setSelectedVolume(volume);
    setCurrentView('modeSelect');
  };

  const handleTestWrongWords = () => {
    if (savedTestState) {
      setPendingAction('wrongWords');
      setPendingMode(null);
      setShowConfirmDialog(true);
      return;
    }
    setIsTestingWrongWords(true);
    setCurrentView('modeSelect');
  };

  const handleDeleteWrongWord = (index: number) => {
    setWrongWords(prev => prev.filter((_, i) => i !== index));
  };

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      wrongWords,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-test-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('数据已导出');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!data.wrongWords || !Array.isArray(data.wrongWords)) {
            alert('文件格式不正确');
            return;
          }
          const validated: WrongWord[] = [];
          for (const item of data.wrongWords) {
            if (
              item &&
              typeof item === 'object' &&
              item.word &&
              typeof item.word.english === 'string' &&
              typeof item.word.chinese === 'string' &&
              typeof item.word.partOfSpeech === 'string' &&
              typeof item.unit === 'string' &&
              typeof item.grade === 'string' &&
              typeof item.volume === 'string' &&
              typeof item.count === 'number' &&
              item.count > 0
            ) {
              validated.push(item);
            }
          }
          if (validated.length === 0) {
            alert('文件中没有有效的错词数据');
            return;
          }
          const merge = wrongWords.length > 0
            ? window.confirm(`当前有 ${wrongWords.length} 个错词。\n\n确定 = 合并（去重），取消 = 覆盖`)
            : false;
          if (merge) {
            setWrongWords(prev => {
              const map = new Map<string, WrongWord>();
              for (const w of prev) map.set(`${w.word.english}-${w.word.chinese}`, w);
              for (const w of validated) {
                const key = `${w.word.english}-${w.word.chinese}`;
                const existing = map.get(key);
                if (existing) {
                  map.set(key, { ...existing, count: existing.count + w.count });
                } else {
                  map.set(key, w);
                }
              }
              return Array.from(map.values());
            });
          } else {
            setWrongWords(validated);
          }
          setSavedTestState(null);
          setToast(`已${merge ? '合并' : '导入'} ${validated.length} 个错词`);
        } catch {
          alert('文件解析失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleWrongWordsTestComplete = (correctWords: Word[], incorrectWords: Word[]) => {
    setTestResult({
      totalQuestions: correctWords.length + incorrectWords.length,
      correctAnswers: correctWords.length,
      incorrectWords,
      timestamp: Date.now(),
    });
    setSavedTestState(null);
    setIsTestingWrongWords(false);
    setCurrentView('result');
  };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-main">
          <button
            onClick={handleBackToSelect}
            className={`nav-button ${currentView === 'select' ? 'active' : ''}`}
          >
            选择单元
          </button>
          <button
            onClick={handleShowWrongWords}
            className={`nav-button ${currentView === 'wrongWords' ? 'active' : ''}`}
          >
            错题本 {wrongWords.length > 0 && `(${wrongWords.length})`}
          </button>
          <button
            onClick={handleShowVocabulary}
            className={`nav-button ${currentView === 'vocabulary' ? 'active' : ''}`}
          >
            词汇表
          </button>
        </div>
        <div className="nav-actions">
          <button onClick={handleExport} className="nav-icon-btn" title="导出数据">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button onClick={handleImport} className="nav-icon-btn" title="导入数据">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>
        </div>
      </nav>

      {currentView === 'select' && (
        <UnitSelector textbooks={textbooks} onUnitsSelected={handleUnitsSelected} />
      )}

      {currentView === 'modeSelect' && (
        <div className="mode-select">
          <h2>选择测试模式</h2>

          {savedTestState && (
            <div className="saved-test-banner">
              <div className="saved-test-info">
                <span className="saved-test-label">上次未完成的测试</span>
                <span className="saved-test-detail">
                  {savedTestState.grade}{savedTestState.volume}
                  {' · '}
                  {savedTestState.unitNames.join('、')}
                  {' · '}
                  {savedTestState.testMode === 'chineseToEnglish' ? '看中文选英文' : '看英文选中文'}
                  {' · '}
                  {savedTestState.difficulty === 'hard' ? '困难' : '普通'}
                  {' · '}
                  已答 {savedTestState.currentIndex} / {savedTestState.questions.length} 题
                  {' · '}
                  正确 {savedTestState.correctWords.length} · 错误 {savedTestState.incorrectWords.length}
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleConfirmKeep}>
                继续上次测试
              </button>
            </div>
          )}

          <div className="difficulty-toggle-wrapper">
            <span className={`difficulty-label ${difficulty === 'normal' ? 'active' : ''}`}>普通</span>
            <button
              className={`difficulty-toggle ${difficulty === 'hard' ? 'hard' : 'normal'}`}
              onClick={() => setDifficulty(d => d === 'normal' ? 'hard' : 'normal')}
              role="switch"
              aria-checked={difficulty === 'hard'}
              aria-label="难度切换"
            >
              <span className="difficulty-thumb" />
            </button>
            <span className={`difficulty-label ${difficulty === 'hard' ? 'active' : ''}`}>困难</span>
          </div>
          <p className="difficulty-hint">
            {difficulty === 'normal'
              ? '备选项随机抽取自全部词汇'
              : '备选项为拼写或词根相近的易混淆词'}
          </p>

          <div className="mode-buttons">
            <button
              className="mode-button chinese-to-english"
              onClick={() => handleModeSelected('chineseToEnglish')}
            >
              <span className="mode-icon">&#127464;&#127475; &rarr; &#127468;&#127463;</span>
              <span className="mode-label">看中文选英文</span>
              <span className="mode-desc">给出中文释义，选择正确的英文单词</span>
            </button>
            <button
              className="mode-button english-to-chinese"
              onClick={() => handleModeSelected('englishToChinese')}
            >
              <span className="mode-icon">&#127468;&#127463; &rarr; &#127464;&#127475;</span>
              <span className="mode-label">看英文选中文</span>
              <span className="mode-desc">给出英文单词，选择正确的中文释义</span>
            </button>
          </div>
        </div>
      )}

      {currentView === 'test' && (
        <TestMode
          units={isTestingWrongWords
            ? [{ unit: '错题本', words: wrongWords.map(w => w.word) }]
            : (retryUnits.length > 0 ? retryUnits : selectedUnits)
          }
          testMode={testMode}
          onTestComplete={isTestingWrongWords ? handleWrongWordsTestComplete : handleTestComplete}
          onQuit={handleQuitTest}
          savedState={savedTestState}
          grade={selectedGrade}
          volume={selectedVolume}
          onSaveState={handleSaveTestState}
          onWrongWord={handleWrongWord}
          allWords={allWords}
          difficulty={savedTestState?.difficulty ?? difficulty}
          confusingWords={confusingWords}
        />
      )}

      {currentView === 'result' && testResult && (
        <TestResultComponent
          result={testResult}
          onRetry={handleRetry}
          onBackToSelect={handleBackToSelect}
        />
      )}

      {currentView === 'wrongWords' && (
        <>
          <WrongWords
            wrongWords={wrongWords}
            onTestWrongWords={handleTestWrongWords}
            onDeleteWrongWord={handleDeleteWrongWord}
          />
          <div className="wrong-words-footer">
            {wrongWords.length > 0 && (
              <button onClick={() => { if (window.confirm('确定清空全部错词？')) setWrongWords([]); }} className="btn btn-secondary">
                清空全部
              </button>
            )}
            <button onClick={handleBackFromWrongWords} className="btn btn-secondary">
              返回
            </button>
          </div>
        </>
      )}

      {currentView === 'vocabulary' && (
        <VocabularyList textbooks={textbooks} onTestWords={handleVocabTestWords} />
      )}

      {showConfirmDialog && (
        <div className="dialog-overlay" onClick={handleCancelDialog}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>放弃当前进度？</h3>
            <p>你有一次未完成的测试。开始{pendingAction === 'wrongWords' ? '错题测试' : '新测试'}后，之前的进度将不会保留。</p>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={handleCancelDialog}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleConfirmDiscard}>
                {pendingAction === 'wrongWords' ? '开始错题测试' : '开始新测试'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  );
}

export default App;
