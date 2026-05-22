/**
 * 词汇表组件
 * 按年级/单元浏览全部词汇，支持全局搜索定位、单元内筛选、勾选单词发起测试。
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Textbook, Unit, Word } from '../types';
import { posLabel, findWordLocation } from '../utils';
import styles from '../styles/modules/VocabularyList.module.css';

interface VocabularyListProps {
  textbooks: Textbook[];
  onTestWords: (words: Word[], grade: string, volume: string, unitName: string) => void;
}

interface SearchResult {
  word: Word;
  unit: Unit;
  textbook: Textbook;
}

/** 生成教材的唯一标识 key */
const tbKey = (tb: Textbook) => `${tb.grade}-${tb.volume}`;

/** 虚拟化行高和缓冲区大小 */
const ROW_HEIGHT = 44;
const BUFFER = 8;

export function VocabularyList({ textbooks, onTestWords }: VocabularyListProps) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [expandedTextbook, setExpandedTextbook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState('');
  const [highlightWord, setHighlightWord] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // 全局搜索结果
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];
    for (const tb of textbooks) {
      for (const unit of tb.units) {
        for (const word of unit.words) {
          if (word.english.toLowerCase().includes(q) || word.chinese.includes(q)) {
            results.push({ word, unit, textbook: tb });
          }
        }
      }
    }
    return results;
  }, [globalSearch, textbooks]);

  // 定位到搜索结果：展开年级、选中单元、清空搜索
  const goToResult = useCallback((result: SearchResult) => {
    setExpandedTextbook(tbKey(result.textbook));
    setSelectedUnit(result.unit);
    setSearchQuery('');
    setSelectedWords(new Set());
    setGlobalSearch('');
    setHighlightWord(result.word.english);
  }, []);

  // 高亮单词时自动滚动到视口中央
  useEffect(() => {
    if (!highlightWord) return;
    const timer = setTimeout(() => {
      const el = tableBodyRef.current?.querySelector(`.${styles.rowHighlight}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightWord(null), 1200);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [highlightWord]);

  // 虚拟化滚动：同步滚动位置和容器高度
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
      setContainerHeight(scrollContainerRef.current.clientHeight);
    }
  }, []);

  const handleTextbookToggle = (key: string) => {
    setExpandedTextbook(prev => prev === key ? null : key);
  };

  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    setSearchQuery('');
    setSelectedWords(new Set());
    setHighlightWord(null);
  };

  // 当前单元经筛选后的单词列表
  const filteredWords = useMemo(() => {
    if (!selectedUnit) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return selectedUnit.words;
    return selectedUnit.words.filter(w =>
      w.english.toLowerCase().includes(q) || w.chinese.includes(searchQuery)
    );
  }, [selectedUnit, searchQuery]);

  const toggleWord = (english: string) => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(english)) {
        next.delete(english);
      } else {
        next.add(english);
      }
      return next;
    });
  };

  /** 全选/取消全选（仅操作当前筛选可见的单词） */
  const toggleAll = () => {
    const visibleKeys = filteredWords.map(w => w.english);
    const allVisibleSelected = visibleKeys.every(k => selectedWords.has(k));

    setSelectedWords(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const k of visibleKeys) next.delete(k);
      } else {
        for (const k of visibleKeys) next.add(k);
      }
      return next;
    });
  };

  const selectedWordObjects = useMemo(() => {
    if (!selectedUnit) return [];
    return selectedUnit.words.filter(w => selectedWords.has(w.english));
  }, [selectedUnit, selectedWords]);

  const handleTest = () => {
    if (!selectedUnit || selectedWordObjects.length === 0) return;
    const loc = findWordLocation(textbooks, selectedWordObjects[0]);
    onTestWords(selectedWordObjects, loc?.grade ?? '', loc?.volume ?? '', selectedUnit.unit);
  };

  const allChecked = filteredWords.length > 0 && filteredWords.every(w => selectedWords.has(w.english));
  const hasChecked = selectedWords.size > 0;

  /** 渲染单行词汇（虚拟化/非虚拟化共用） */
  const renderWordRow = (word: Word, index: number) => {
    const isSelected = selectedWords.has(word.english);
    const isHighlight = highlightWord === word.english;
    return (
      <tr
        key={`${word.english}-${index}`}
        className={[isSelected ? styles.rowSelected : '', isHighlight ? styles.rowHighlight : ''].filter(Boolean).join(' ')}
        onClick={() => toggleWord(word.english)}
      >
        <td className={styles.colCheck}>
          <span className={`${styles.checkBtn} ${isSelected ? styles.checkBtnChecked : ''}`}>
            {isSelected ? '✓' : ''}
          </span>
        </td>
        <td className={styles.colEnglish}>{word.english}</td>
        <td className={styles.colPos}>
          <span className={styles.posTag}>{posLabel(word.partOfSpeech)}</span>
          <span className={styles.posAbbrev}>{word.partOfSpeech}</span>
        </td>
        <td className={styles.colChinese}>{word.chinese}</td>
      </tr>
    );
  };

  return (
    <div className={`${styles.vocabulary} ${selectedUnit ? styles.vocabularyActive : ''}`}>
      <h2>词汇表</h2>

      {/* 全局搜索 */}
      <div className={styles.vocabGlobalSearch}>
        <input
          type="text"
          placeholder="搜索全部词汇..."
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          className={styles.globalSearchInput}
        />
        {globalSearch.trim() && (
          <div className={styles.globalSearchResults}>
            {searchResults.length === 0 ? (
              <div className={styles.searchNoResult}>未找到匹配的单词</div>
            ) : (
              searchResults.slice(0, 20).map((r, i) => (
                <button
                  key={`${r.word.english}-${r.unit.unit}-${i}`}
                  className={styles.searchResultItem}
                  onClick={() => goToResult(r)}
                >
                  <span className={styles.searchResultWord}>{r.word.english}</span>
                  <span className={styles.searchResultPos}>{r.word.partOfSpeech}</span>
                  <span className={styles.searchResultChinese}>{r.word.chinese}</span>
                  <span className={styles.searchResultLocate}>
                    {r.textbook.grade}{r.textbook.volume} · {r.unit.unit}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className={styles.vocabularyStage}>
        <aside className={styles.vocabularySidebar}>
          {textbooks.map(textbook => {
            const key = tbKey(textbook);
            const isExpanded = expandedTextbook === key;
            return (
              <div key={key} className={styles.vocabTextbook}>
                <button
                  className={`${styles.vocabTextbookHeader} ${isExpanded ? styles.vocabTextbookHeaderExpanded : ''}`}
                  onClick={() => handleTextbookToggle(key)}
                >
                  <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                  {textbook.grade}{textbook.volume}
                </button>
                {isExpanded && (
                  <div className={styles.vocabUnits}>
                    {textbook.units.map(unit => (
                      <button
                        key={unit.unit}
                        className={`${styles.vocabUnitBtn} ${selectedUnit?.unit === unit.unit ? styles.vocabUnitBtnActive : ''}`}
                        onClick={() => handleUnitSelect(unit)}
                      >
                        {unit.unit}
                        <span className={styles.vocabWordCount}>{unit.words.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {selectedUnit && (
          <main className={styles.vocabularyMain}>
            <div className={styles.vocabularyHeader}>
              <h3>{selectedUnit.unit}</h3>
              <div className={styles.vocabularySearch}>
                <input
                  type="text"
                  placeholder="在当前单元内搜索..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>
            <div
              className={styles.vocabularyTableWrapper}
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ maxHeight: '70vh', overflowY: 'auto' }}
            >
              <table className={styles.vocabularyTable}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className={styles.colCheck}>
                      <button
                        className={`${styles.checkBtn} ${styles.checkHeader} ${allChecked ? styles.checkBtnChecked : ''}`}
                        onClick={toggleAll}
                        title={allChecked ? '取消全选' : '全选'}
                      >
                        {allChecked ? '✓' : ''}
                      </button>
                    </th>
                    <th className={styles.colEnglish}>英文</th>
                    <th className={styles.colPos}>词性</th>
                    <th className={styles.colChinese}>中文释义</th>
                  </tr>
                </thead>
                <tbody ref={tableBodyRef}>
                  {filteredWords.length <= 60 ? (
                    filteredWords.map((word, i) => renderWordRow(word, i))
                  ) : (() => {
                    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
                    const endIndex = Math.min(
                      filteredWords.length,
                      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER
                    );
                    const topSpacer = startIndex * ROW_HEIGHT;
                    const bottomSpacer = (filteredWords.length - endIndex) * ROW_HEIGHT;

                    return (
                      <>
                        {topSpacer > 0 && (
                          <tr style={{ height: topSpacer }}><td colSpan={4} /></tr>
                        )}
                        {filteredWords.slice(startIndex, endIndex).map((word, i) =>
                          renderWordRow(word, startIndex + i)
                        )}
                        {bottomSpacer > 0 && (
                          <tr style={{ height: bottomSpacer }}><td colSpan={4} /></tr>
                        )}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <div className={styles.vocabularyFooter}>
              共 {filteredWords.length} 个单词
              {hasChecked && ` · 已选 ${selectedWords.size} 个`}
            </div>
          </main>
        )}
      </div>

      {hasChecked && (
        <div className={styles.tabBarInner} style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '88px',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          borderTop: '0.5px solid rgba(0, 0, 0, 0.08)',
        }}>
          <button className={styles.tabStartBtn} onClick={handleTest}>
            测试选中词汇 ({selectedWords.size})
          </button>
        </div>
      )}
    </div>
  );
}

VocabularyList.displayName = 'VocabularyList';
