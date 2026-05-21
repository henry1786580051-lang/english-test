/**
 * 单元选择器
 * 按年级、册次、单元展示可选单元，支持全选/取消全选。
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Textbook, Unit } from '../types';

interface UnitSelectorProps {
  textbooks: Textbook[];
  onUnitsSelected: (units: Unit[]) => void;
  onSelectedCountChange: (count: number) => void;
  onStartTestRef: (fn: () => void) => void;
}

/** 生成 unit 的唯一标识 key */
function unitKey(textbook: Textbook, unit: Unit): string {
  return `${textbook.grade}-${textbook.volume}-${unit.unit}`;
}

export function UnitSelector({ textbooks, onUnitsSelected, onSelectedCountChange, onStartTestRef }: UnitSelectorProps) {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // 所有 unit key 的平坦列表
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const tb of textbooks) {
      for (const unit of tb.units) {
        keys.push(unitKey(tb, unit));
      }
    }
    return keys;
  }, [textbooks]);

  const handleUnitToggle = (key: string) => {
    setSelectedUnits(prev =>
      prev.includes(key) ? prev.filter(u => u !== key) : [...prev, key]
    );
  };

  /** 全选 / 取消全选 */
  const handleToggleAll = () => {
    setSelectedUnits(prev => prev.length === allKeys.length ? [] : allKeys);
  };

  const handleStartTest = useCallback(() => {
    const units: Unit[] = [];
    for (const tb of textbooks) {
      for (const unit of tb.units) {
        if (selectedUnits.includes(unitKey(tb, unit))) {
          units.push(unit);
        }
      }
    }
    onUnitsSelected(units);
  }, [textbooks, selectedUnits, onUnitsSelected]);

  useEffect(() => {
    onSelectedCountChange(selectedUnits.length);
  }, [selectedUnits.length, onSelectedCountChange]);

  useEffect(() => {
    onStartTestRef(handleStartTest);
  }, [handleStartTest, onStartTestRef]);

  const allSelected = selectedUnits.length === allKeys.length;

  return (
    <div className="unit-selector">
      <h2>选择要测试的单元</h2>

      <div className="select-actions">
        <button onClick={handleToggleAll} className="btn btn-secondary">
          {allSelected ? '取消全选' : '全选'}
        </button>
      </div>

      <div className="textbooks">
        {textbooks.map(textbook => (
          <div key={`${textbook.grade}-${textbook.volume}`} className="textbook">
            <div className="textbook-header">
              <h3>{textbook.grade}{textbook.volume}</h3>
            </div>
            <div className="units-grid">
              {textbook.units.map(unit => {
                const key = unitKey(textbook, unit);
                const isSelected = selectedUnits.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleUnitToggle(key)}
                    className={`unit-button ${isSelected ? 'selected' : ''}`}
                  >
                    {unit.unit}
                    <span className="word-count">{unit.words.length}词</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

UnitSelector.displayName = 'UnitSelector';
