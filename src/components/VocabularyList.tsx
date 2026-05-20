/**
 * 词汇表组件
 * 按年级/单元浏览全部词汇，支持全局搜索定位、单元内筛选、勾选单词发起测试。
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { Textbook, Unit, Word } from '../types';
import { posLabel, findWordLocation } from '../utils';

interface VocabularyListProps {
  textbooks: Textbook[];
  onTestWords: (words: Word[], grade: string, volume: string, unitName: string) => void;
}

interface SearchResult {
  word: Word;
  unit: Unit;
  textbook: Textbook;
}

export function VocabularyList({ textbooks, onTestWords }: VocabularyListProps) {
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [expandedTextbook, setExpandedTextbook] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState('');
  const [highlightWord, setHighlightWord] = useState<string | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const tbKey = (tb: Textbook) => `${tb.grade}-${tb.volume}`;

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
      const el = tableBodyRef.current?.querySelector('.row-highlight');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightWord(null), 1200);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [highlightWord]);

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
  const filteredWords = selectedUnit
    ? selectedUnit.words.filter(w =>
        w.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.chinese.includes(searchQuery)
      )
    : [];

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
        // 取消：仅移除可见的
        for (const k of visibleKeys) next.delete(k);
      } else {
        // 全选：添加可见的
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

  const hasSelection = selectedUnit !== null;
  const allChecked = filteredWords.length > 0 && filteredWords.every(w => selectedWords.has(w.english));
  const hasChecked = selectedWords.size > 0;

  return (
    <div className={`vocabulary ${hasSelection ? 'vocabulary--active' : ''}`}>
      <h2>词汇表</h2>

      {/* 全局搜索 */}
      <div className="vocab-global-search">
        <input
          type="text"
          placeholder="搜索全部词汇..."
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          className="global-search-input"
        />
        {globalSearch.trim() && (
          <div className="global-search-results">
            {searchResults.length === 0 ? (
              <div className="search-no-result">未找到匹配的单词</div>
            ) : (
              searchResults.slice(0, 20).map((r, i) => (
                <button
                  key={`${r.word.english}-${r.unit.unit}-${i}`}
                  className="search-result-item"
                  onClick={() => goToResult(r)}
                >
                  <span className="search-result-word">{r.word.english}</span>
                  <span className="search-result-pos">{r.word.partOfSpeech}</span>
                  <span className="search-result-chinese">{r.word.chinese}</span>
                  <span className="search-result-locate">
                    {r.textbook.grade}{r.textbook.volume} · {r.unit.unit}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="vocabulary-stage">
        <aside className="vocabulary-sidebar">
          {textbooks.map(textbook => {
            const key = tbKey(textbook);
            const isExpanded = expandedTextbook === key;
            return (
              <div key={key} className="vocab-textbook">
                <button
                  className={`vocab-textbook-header ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => handleTextbookToggle(key)}
                >
                  <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  {textbook.grade}{textbook.volume}
                </button>
                {isExpanded && (
                  <div className="vocab-units">
                    {textbook.units.map(unit => (
                      <button
                        key={unit.unit}
                        className={`vocab-unit-btn ${selectedUnit?.unit === unit.unit ? 'active' : ''}`}
                        onClick={() => handleUnitSelect(unit)}
                      >
                        {unit.unit}
                        <span className="vocab-word-count">{unit.words.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        {hasSelection && (
          <main className="vocabulary-main">
            <div className="vocabulary-header">
              <h3>{selectedUnit.unit}</h3>
              <div className="vocabulary-search">
                <input
                  type="text"
                  placeholder="在当前单元内搜索..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
            <div className="vocabulary-table-wrapper">
              <table className="vocabulary-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <button
                        className={`check-btn check-header ${allChecked ? 'checked' : ''}`}
                        onClick={toggleAll}
                        title={allChecked ? '取消全选' : '全选'}
                      >
                        {allChecked ? '✓' : ''}
                      </button>
                    </th>
                    <th className="col-english">英文</th>
                    <th className="col-pos">词性</th>
                    <th className="col-chinese">中文释义</th>
                  </tr>
                </thead>
                <tbody ref={tableBodyRef}>
                  {filteredWords.map((word, i) => {
                    const isSelected = selectedWords.has(word.english);
                    const isHighlight = highlightWord === word.english;
                    return (
                      <tr
                        key={`${word.english}-${i}`}
                        className={[
                          isSelected ? 'row-selected' : '',
                          isHighlight ? 'row-highlight' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => toggleWord(word.english)}
                      >
                        <td className="col-check">
                          <span className={`check-btn ${isSelected ? 'checked' : ''}`}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </td>
                        <td className="col-english">{word.english}</td>
                        <td className="col-pos">
                          <span className="pos-tag">{posLabel(word.partOfSpeech)}</span>
                          <span className="pos-abbrev">{word.partOfSpeech}</span>
                        </td>
                        <td className="col-chinese">{word.chinese}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="vocabulary-footer">
              共 {filteredWords.length} 个单词
              {hasChecked && ` · 已选 ${selectedWords.size} 个`}
            </div>
          </main>
        )}
      </div>

      {hasChecked && (
        <div className="vocab-test-bar">
          <button className="btn btn-primary" onClick={handleTest}>
            测试选中词汇 ({selectedWords.size})
          </button>
        </div>
      )}
    </div>
  );
}
