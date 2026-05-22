/**
 * 错题本组件
 * 按年级→单元分组展示错词，支持删除单条记录和发起错题测试。
 */
import { useMemo } from 'react';
import type { WrongWord, Word } from '../types';
import styles from '../styles/modules/WrongWords.module.css';
import sharedStyles from '../styles/modules/shared.module.css';

interface WrongWordsProps {
  wrongWords: WrongWord[];
  onTestWrongWords: () => void;
  onDeleteWrongWord: (word: Word) => void;
}

interface GroupedWords {
  [gradeVolume: string]: {
    [unit: string]: WrongWord[];
  };
}

export function WrongWords({ wrongWords, onTestWrongWords, onDeleteWrongWord }: WrongWordsProps) {
  // 按年级+册→单元分组，单元内按错误次数降序
  const grouped = useMemo<GroupedWords>(() => {
    const result: GroupedWords = {};

    wrongWords.forEach(item => {
      const gradeVolume = `${item.grade}${item.volume}`;
      if (!result[gradeVolume]) result[gradeVolume] = {};
      if (!result[gradeVolume][item.unit]) result[gradeVolume][item.unit] = [];
      result[gradeVolume][item.unit].push(item);
    });

    for (const gradeVolume of Object.keys(result)) {
      for (const unit of Object.keys(result[gradeVolume])) {
        result[gradeVolume][unit].sort((a, b) => b.count - a.count);
      }
    }

    return result;
  }, [wrongWords]);

  if (wrongWords.length === 0) {
    return (
      <div className={styles.wrongWords}>
        <h2>错题本</h2>
        <div className={sharedStyles.emptyState}>
          <p>还没有错题，继续加油！</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrongWords}>
      <h2>错题本</h2>
      <div className={styles.wrongWordsActions}>
        <button className={`${sharedStyles.btn} ${sharedStyles.btnPrimary}`} onClick={onTestWrongWords}>
          测试错题 ({wrongWords.length})
        </button>
      </div>
      {Object.entries(grouped).map(([gradeVolume, units]) => (
        <div key={gradeVolume} className={styles.wrongWordsGroup}>
          <h3 className={styles.gradeVolumeTitle}>{gradeVolume}</h3>
          {Object.entries(units).map(([unit, words]) => (
            <div key={unit} className={styles.wrongWordsUnit}>
              <h4 className={styles.unitTitle}>{unit}</h4>
              <div className={styles.wrongWordsList}>
                {words.map(item => (
                  <div key={`${item.word.english}-${item.word.chinese}`} className={styles.wrongWordItem}>
                    <div className={styles.wordInfo}>
                      <span className={styles.english}>
                        {item.word.english}
                        <span className={styles.posTag}>{item.word.partOfSpeech}</span>
                      </span>
                      <span className={styles.chinese}>{item.word.chinese}</span>
                    </div>
                    <div className={styles.wordMeta}>
                      <span className={styles.count}>错误 {item.count} 次</span>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => onDeleteWrongWord(item.word)}
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

WrongWords.displayName = 'WrongWords';
