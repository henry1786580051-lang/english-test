/**
 * 测试模式选择视图
 * 展示难度切换、未完成测试恢复入口、中英/英中模式选择。
 */
import { useEffect } from 'react';
import type { TestModeType, SavedTestState, Difficulty } from '../types';
import sharedStyles from '../styles/modules/shared.module.css';
import styles from '../styles/modules/App.module.css';

interface ModeSelectProps {
  savedTestState: SavedTestState | null;
  difficulty: Difficulty;
  confusingWords: Record<string, string[]> | undefined;
  onConfusingWordsChange: (data: Record<string, string[]>) => void;
  onDifficultyChange: (d: Difficulty) => void;
  onModeSelected: (mode: TestModeType, confusingWords?: Record<string, string[]>) => void;
  onConfirmKeep: () => void;
}

export function ModeSelect({
  savedTestState,
  difficulty,
  confusingWords,
  onConfusingWordsChange,
  onDifficultyChange,
  onModeSelected,
  onConfirmKeep,
}: ModeSelectProps) {
  useEffect(() => {
    if (difficulty === 'hard' && !confusingWords) {
      import('../data/confusingWords.json').then(mod => onConfusingWordsChange(mod.default as Record<string, string[]>));
    }
  }, [difficulty, confusingWords, onConfusingWordsChange]);

  return (
    <div className={styles.modeSelect}>
      <h2>选择测试模式</h2>

      {savedTestState && (
        <div className={styles.savedTestBanner}>
          <div className={styles.savedTestInfo}>
            <span className={styles.savedTestLabel}>上次未完成的测试</span>
            <span className={styles.savedTestDetail}>
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
          <button className={`${sharedStyles.btn} ${sharedStyles.btnPrimary}`} onClick={onConfirmKeep}>
            继续上次测试
          </button>
        </div>
      )}

      <div className={styles.difficultyToggleWrapper}>
        <span className={`${styles.difficultyLabel} ${difficulty === 'normal' ? styles.difficultyLabelActive : ''}`}>普通</span>
        <button
          className={`${styles.difficultyToggle} ${difficulty === 'hard' ? styles.difficultyToggleHard : styles.difficultyToggleNormal}`}
          onClick={() => onDifficultyChange(difficulty === 'normal' ? 'hard' : 'normal')}
          role="switch"
          aria-checked={difficulty === 'hard'}
          aria-label="难度切换"
        >
          <span className={styles.difficultyThumb} />
        </button>
        <span className={`${styles.difficultyLabel} ${difficulty === 'hard' ? styles.difficultyLabelActive : ''}`}>困难</span>
      </div>
      <p className={styles.difficultyHint}>
        {difficulty === 'normal'
          ? '备选项随机抽取自全部词汇'
          : '备选项为拼写或词根相近的易混淆词'}
      </p>

      <div className={styles.modeButtons}>
        <button
          className={styles.modeButton}
          onClick={() => onModeSelected('chineseToEnglish', confusingWords)}
        >
          <span className={styles.modeIcon}>&#127464;&#127475; &rarr; &#127468;&#127463;</span>
          <span className={styles.modeLabel}>看中文选英文</span>
          <span className={styles.modeDesc}>给出中文释义，选择正确的英文单词</span>
        </button>
        <button
          className={styles.modeButton}
          onClick={() => onModeSelected('englishToChinese', confusingWords)}
        >
          <span className={styles.modeIcon}>&#127468;&#127463; &rarr; &#127464;&#127475;</span>
          <span className={styles.modeLabel}>看英文选中文</span>
          <span className={styles.modeDesc}>给出英文单词，选择正确的中文释义</span>
        </button>
      </div>
    </div>
  );
}

ModeSelect.displayName = 'ModeSelect';
