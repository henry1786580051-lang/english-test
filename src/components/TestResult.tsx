/**
 * 测试结果页
 * 展示正确率、统计数据和错误单词列表，支持重试或返回。
 */
import type { TestResult as TestResultType } from '../types';

interface TestResultProps {
  result: TestResultType;
  onRetry: () => void;
  onBackToSelect: () => void;
}

export function TestResult({ result, onRetry, onBackToSelect }: TestResultProps) {
  const accuracy = Math.round((result.correctAnswers / result.totalQuestions) * 100);

  return (
    <div className="test-result">
      <div className="result-card">
        <h2>测试完成！</h2>

        <div className="accuracy">{accuracy}%</div>
        <div className="accuracy-label">正确率</div>

        <div className="stats">
          <div className="stat-item">
            <div className="stat-value">{result.totalQuestions}</div>
            <div className="stat-label">总题数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{result.correctAnswers}</div>
            <div className="stat-label">正确</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{result.incorrectWords.length}</div>
            <div className="stat-label">错误</div>
          </div>
        </div>

        {result.incorrectWords.length > 0 && (
          <div className="incorrect-words">
            <h3>错误单词</h3>
            <div className="word-list">
              {result.incorrectWords.map(word => (
                <div key={`${word.english}-${word.chinese}`} className="word-item">
                  <span className="english">{word.english}</span>
                  <span className="chinese">{word.chinese}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="result-actions">
          <button onClick={onRetry} className="btn btn-primary">
            再次测试
          </button>
          <button onClick={onBackToSelect} className="btn btn-secondary">
            返回选择
          </button>
        </div>
      </div>
    </div>
  );
}
