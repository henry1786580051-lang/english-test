/**
 * 应用根组件
 * 管理全局视图路由、测试状态、错题本持久化。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import wordsData from './data/words.json';
import confusingWordsData from './data/confusingWords.json';
import type { Textbook, Unit, Word, TestResult, WrongWord, SavedTestState, Difficulty } from './types';
import { UnitSelector } from './components/UnitSelector';
import { TestMode } from './components/TestMode';
import { TestResult as TestResultComponent } from './components/TestResult';
import { WrongWords } from './components/WrongWords';
import { VocabularyList } from './components/VocabularyList';
import { LiquidGlass } from './components/LiquidGlass';
import { findWordLocation } from './utils';
import './styles/App.css';

type View = 'select' | 'modeSelect' | 'test' | 'result' | 'wrongWords' | 'vocabulary';
type TestModeType = 'chineseToEnglish' | 'englishToChinese';

const textbooks = wordsData as Textbook[];
const confusingWords = confusingWordsData as Record<string, string[]>;

/** 全量单词池（模块常量，不需要 useMemo） */
const allWords = textbooks.flatMap(tb => tb.units.flatMap(u => u.words));

/** 校验保存的测试状态是否有效 */
function isValidSavedState(state: SavedTestState): boolean {
  return (
    Array.isArray(state.questions) &&
    state.questions.length > 0 &&
    typeof state.currentIndex === 'number' &&
    state.currentIndex >= 0 &&
    state.currentIndex < state.questions.length &&
    Array.isArray(state.correctWords) &&
    Array.isArray(state.incorrectWords)
  );
}

function App() {
  const [currentView, setCurrentView] = useState<View>('select');
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [selectedUnitCount, setSelectedUnitCount] = useState(0);
  const startTestRef = useRef<() => void>(() => {});
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
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return isValidSavedState(parsed) ? parsed : null;
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

  // 底栏 indicator 位置
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabBarRef = useRef<HTMLElement>(null);

  // 底栏 indicator 定位
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('.tab-item.active') as HTMLElement;
    if (activeBtn) {
      setIndicatorStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
    }
  }, [currentView, selectedUnitCount]);

  // 错题本变化时持久化
  useEffect(() => {
    try {
      localStorage.setItem('wrongWords', JSON.stringify(wrongWords));
    } catch {
      // localStorage 配额超出时静默失败
    }
  }, [wrongWords]);

  // 未完成测试进度持久化
  useEffect(() => {
    try {
      if (savedTestState) {
        localStorage.setItem('savedTestState', JSON.stringify(savedTestState));
      } else {
        localStorage.removeItem('savedTestState');
      }
    } catch {
      // localStorage 配额超出时静默失败
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

  const handleUnitsSelected = useCallback((units: Unit[]) => {
    setSelectedUnits(units);
    setRetryUnits(units);
    const { grade, volume } = findUnitGradeVolume(units);
    setSelectedGrade(grade);
    setSelectedVolume(volume);
    setCurrentView('modeSelect');
  }, [findUnitGradeVolume]);

  const handleModeSelected = useCallback((mode: TestModeType) => {
    if (savedTestState) {
      setPendingAction('newTest');
      setPendingMode(mode);
      setShowConfirmDialog(true);
      return;
    }
    setTestMode(mode);
    setCurrentView('test');
  }, [savedTestState]);

  const handleConfirmDiscard = useCallback(() => {
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
  }, [pendingAction, pendingMode]);

  const handleConfirmKeep = useCallback(() => {
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
  }, [savedTestState]);

  const handleCancelDialog = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingMode(null);
    setPendingAction(null);
  }, []);

  /** 测试完成：记录成绩并跳转结果页（普通测试和错题测试共用） */
  const handleTestComplete = useCallback((correctWordsResult: Word[], incorrectWordsResult: Word[]) => {
    setTestResult({
      totalQuestions: correctWordsResult.length + incorrectWordsResult.length,
      correctAnswers: correctWordsResult.length,
      incorrectWords: incorrectWordsResult,
      timestamp: Date.now(),
    });
    setSavedTestState(null);
    setIsTestingWrongWords(false);
    setCurrentView('result');
  }, []);

  /** 保存测试进度（含退出跳转） */
  const handleSaveTestState = useCallback((state: SavedTestState) => {
    setSavedTestState(state);
  }, []);

  /** 退出测试：保存并返回选择页 */
  const handleQuitTest = useCallback((state: SavedTestState) => {
    setSavedTestState(state);
    setCurrentView('select');
  }, []);

  /** 记录错词，若已存在则累加错误次数 */
  const handleWrongWord = useCallback((word: Word) => {
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
  }, []);

  const handleBackToSelect = useCallback(() => {
    if (currentView === 'test' && savedTestState) {
      setPendingAction('newTest');
      setShowConfirmDialog(true);
      return;
    }
    setCurrentView('select');
    setTestResult(null);
  }, [currentView, savedTestState]);

  const handleShowWrongWords = useCallback(() => setCurrentView('wrongWords'), []);
  const handleBackFromWrongWords = useCallback(() => setCurrentView('select'), []);
  const handleShowVocabulary = useCallback(() => setCurrentView('vocabulary'), []);

  const handleVocabTestWords = useCallback((words: Word[], grade: string, volume: string, unitName: string) => {
    const unit: Unit = { unit: unitName, words };
    setSelectedUnits([unit]);
    setRetryUnits([unit]);
    setSelectedGrade(grade);
    setSelectedVolume(volume);
    setCurrentView('modeSelect');
  }, []);

  const handleTestWrongWords = useCallback(() => {
    if (savedTestState) {
      setPendingAction('wrongWords');
      setPendingMode(null);
      setShowConfirmDialog(true);
      return;
    }
    setIsTestingWrongWords(true);
    setCurrentView('modeSelect');
  }, [savedTestState]);

  /** 按 Word 匹配删除错词（而非 index） */
  const handleDeleteWrongWord = useCallback((word: Word) => {
    setWrongWords(prev => prev.filter(w =>
      !(w.word.english === word.english && w.word.chinese === word.chinese)
    ));
  }, []);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleExport = useCallback(() => {
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
  }, [wrongWords]);

  const handleImport = useCallback(() => {
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
  }, [wrongWords]);

  return (
    <div className="app">
      {/* 右上角导出导入按钮 */}
      <div className="top-actions">
        <button onClick={handleExport} className="icon-btn" title="导出数据">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button onClick={handleImport} className="icon-btn" title="导入数据">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
      </div>

      {currentView === 'select' && (
        <UnitSelector
          textbooks={textbooks}
          onUnitsSelected={handleUnitsSelected}
          onSelectedCountChange={setSelectedUnitCount}
          onStartTestRef={fn => { startTestRef.current = fn; }}
        />
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
          onTestComplete={handleTestComplete}
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
          onRetry={() => { setRetryUnits([...selectedUnits]); setCurrentView('modeSelect'); }}
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

      {/* iOS 26 液态玻璃底栏 */}
      {(currentView === 'select' || currentView === 'modeSelect' || currentView === 'wrongWords' || currentView === 'vocabulary') && (
        <div className="tab-bar-shell">
          <LiquidGlass style={{ height: 56, borderRadius: 28 }}>
            <nav className="tab-bar-pill" ref={tabBarRef}>
              <div
                className="tab-indicator"
                style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
              />
              <button
                onClick={handleBackToSelect}
                className={`tab-item ${currentView === 'select' ? 'active' : ''}`}
              >
                <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
                <span className="tab-label">选择</span>
              </button>
              {currentView === 'select' && selectedUnitCount > 0 && (
                <button
                  className="tab-start-btn-inline"
                  onClick={() => startTestRef.current()}
                >
                  开始测试 ({selectedUnitCount})
                </button>
              )}
              <button
                onClick={handleShowWrongWords}
                className={`tab-item ${currentView === 'wrongWords' ? 'active' : ''}`}
              >
                <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <span className="tab-label">错题本</span>
                {wrongWords.length > 0 && <span className="tab-badge">{wrongWords.length}</span>}
              </button>
              <button
                onClick={handleShowVocabulary}
                className={`tab-item ${currentView === 'vocabulary' ? 'active' : ''}`}
              >
                <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span className="tab-label">词汇表</span>
              </button>
            </nav>
          </LiquidGlass>
        </div>
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

App.displayName = 'App';

export default App;
