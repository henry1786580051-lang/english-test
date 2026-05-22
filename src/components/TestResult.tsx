/**
 * 测试结果页
 * 展示正确率、统计数据和错误单词列表，支持重试或返回。
 */
import type { TestResult as TestResultType } from '../types';
import styles from '../styles/modules/TestResult.module.css';
import sharedStyles from '../styles/modules/shared.module.css';

interface TestResultProps {
  result: TestResultType;
  onRetry: () => void;
  onBackToSelect: () => void;
}

export function TestResult({ result, onRetry, onBackToSelect }: TestResultProps) {
  const accuracy = result.totalQuestions > 0
    ? Math.round((result.correctAnswers / result.totalQuestions) * 100)
    : 0;

  return (
    <div className={styles.testResult}>
      <div className={styles.resultCard}>
        <h2>测试完成！</h2>

        <div className={styles.accuracy}>{accuracy}%</div>
        <div className={styles.accuracyLabel}>正确率</div>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{result.totalQuestions}</div>
            <div className={styles.statLabel}>总题数</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{result.correctAnswers}</div>
            <div className={styles.statLabel}>正确</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{result.incorrectWords.length}</div>
            <div className={styles.statLabel}>错误</div>
          </div>
        </div>

        {result.incorrectWords.length > 0 && (
          <div className={styles.incorrectWords}>
            <h3>错误单词</h3>
            <div className={styles.wordList}>
              {result.incorrectWords.map(word => (
                <div key={`${word.english}-${word.chinese}`} className={styles.wordItem}>
                  <span className={styles.english}>{word.english}</span>
                  <span className={styles.chinese}>{word.chinese}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.resultActions}>
          <button onClick={onRetry} className={`${sharedStyles.btn} ${sharedStyles.btnPrimary}`}>
            再次测试
          </button>
          <button onClick={onBackToSelect} className={`${sharedStyles.btn} ${sharedStyles.btnSecondary}`}>
            返回选择
          </button>
        </div>
      </div>
    </div>
  );
}

TestResult.displayName = 'TestResult';
