/**
 * 错题本组件
 * 按年级→单元分组展示错词，支持删除单条记录和发起错题测试。
 */
import { useMemo } from 'react';
import type { WrongWord } from '../types';

interface WrongWordsProps {
  wrongWords: WrongWord[];
  onTestWrongWords: () => void;
  onDeleteWrongWord: (index: number) => void;
}

interface GroupedWords {
  [gradeVolume: string]: {
    [unit: string]: { item: WrongWord; originalIndex: number }[];
  };
}

export function WrongWords({ wrongWords, onTestWrongWords, onDeleteWrongWord }: WrongWordsProps) {
  // 按年级+册→单元分组，单元内按错误次数降序
  const grouped = useMemo<GroupedWords>(() => {
    const result: GroupedWords = {};

    wrongWords.forEach((item, index) => {
      const gradeVolume = `${item.grade}${item.volume}`;
      if (!result[gradeVolume]) result[gradeVolume] = {};
      if (!result[gradeVolume][item.unit]) result[gradeVolume][item.unit] = [];
      result[gradeVolume][item.unit].push({ item, originalIndex: index });
    });

    for (const gradeVolume of Object.keys(result)) {
      for (const unit of Object.keys(result[gradeVolume])) {
        result[gradeVolume][unit].sort((a, b) => b.item.count - a.item.count);
      }
    }

    return result;
  }, [wrongWords]);

  if (wrongWords.length === 0) {
    return (
      <div className="wrong-words">
        <h2>错题本</h2>
        <div className="empty-state">
          <p>还没有错题，继续加油！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrong-words">
      <h2>错题本</h2>
      <div className="wrong-words-actions">
        <button className="btn btn-primary" onClick={onTestWrongWords}>
          测试错题 ({wrongWords.length})
        </button>
      </div>
      {Object.entries(grouped).map(([gradeVolume, units]) => (
        <div key={gradeVolume} className="wrong-words-group">
          <h3 className="grade-volume-title">{gradeVolume}</h3>
          {Object.entries(units).map(([unit, words]) => (
            <div key={unit} className="wrong-words-unit">
              <h4 className="unit-title">{unit}</h4>
              <div className="wrong-words-list">
                {words.map(({ item, originalIndex }) => (
                  <div key={`${item.word.english}-${item.word.chinese}-${originalIndex}`} className="wrong-word-item">
                    <div className="word-info">
                      <span className="english">
                        {item.word.english}
                        <span className="pos-tag">{item.word.partOfSpeech}</span>
                      </span>
                      <span className="chinese">{item.word.chinese}</span>
                    </div>
                    <div className="word-meta">
                      <span className="count">错误 {item.count} 次</span>
                      <button
                        className="delete-btn"
                        onClick={() => onDeleteWrongWord(originalIndex)}
                        title="从错题本中移除"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
