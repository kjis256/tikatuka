/**
 * StartScreen — 난이도(★1~5) 선택 + 승부사 모드(메타) 토글 + 시작.
 * 실제 게임 시작은 useGame.newGame 으로 위임.
 */
import { useState } from 'react';
import type { Difficulty } from '../logic';

export interface StartScreenProps {
  onStart: (difficulty: Difficulty, withMeta: boolean) => void;
}

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5];

export function StartScreen({ onStart }: StartScreenProps): JSX.Element {
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [random, setRandom] = useState(false);
  const [withMeta, setWithMeta] = useState(false);

  const handleStart = (): void => {
    // 랜덤 선택 시 시작 시점에 난이도 1~5 무작위 결정 (메뉴 선택용 — 게임 RNG와 무관).
    const chosen: Difficulty = random
      ? ((Math.floor(Math.random() * 5) + 1) as Difficulty)
      : difficulty;
    onStart(chosen, withMeta);
  };

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1 className="start-title">티카투카</h1>
        <p className="start-sub">주사위 전략 보드게임</p>

        <div className="start-section">
          <label className="start-label">난이도</label>
          <div className="difficulty-row">
            {LEVELS.map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-btn${!random && difficulty === d ? ' diff-btn--on' : ''}`}
                onClick={() => {
                  setRandom(false);
                  setDifficulty(d);
                }}
              >
                {'★'.repeat(d)}
              </button>
            ))}
            <button
              type="button"
              className={`diff-btn diff-btn--random${random ? ' diff-btn--on' : ''}`}
              onClick={() => setRandom(true)}
            >
              🎲 랜덤
            </button>
          </div>
        </div>

        <div className="start-section">
          <label className="start-toggle">
            <input
              type="checkbox"
              checked={withMeta}
              onChange={(e) => setWithMeta(e.target.checked)}
            />
            승부사 모드 (실링/TP/연승)
          </label>
        </div>

        <button type="button" className="start-btn" onClick={handleStart}>
          게임 시작
        </button>
      </div>
    </div>
  );
}
