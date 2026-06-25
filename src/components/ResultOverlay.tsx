/**
 * ResultOverlay — 게임 종료 시 승/패/무 결과 + 다시하기. winner 는 logic(judge)이 확정한 값.
 * 메타 모드면 결산 결과(메타)도 표시.
 */
import type { GameState } from '../logic';

export interface ResultOverlayProps {
  state: GameState;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultOverlay({ state, onPlayAgain, onHome }: ResultOverlayProps): JSX.Element | null {
  if (state.phase !== 'gameOver' || state.winner === null) return null;

  const title = state.winner === 'me' ? '승리!' : state.winner === 'opponent' ? '패배' : '무승부';
  const titleClass =
    state.winner === 'me'
      ? 'result-title result-title--win'
      : state.winner === 'opponent'
        ? 'result-title result-title--lose'
        : 'result-title result-title--draw';

  return (
    <div className="result-overlay">
      <div className="result-card">
        <h2 className={titleClass}>{title}</h2>
        {state.meta && (
          <div className="result-meta">
            <div>Lv.{state.meta.level}</div>
            <div>TP {state.meta.tp}</div>
            <div>실링 {state.meta.shilling}</div>
            {state.meta.winStreak >= 2 && <div className="meta-streak">{state.meta.winStreak}연승!</div>}
          </div>
        )}
        <div className="result-actions">
          <button type="button" className="start-btn" onClick={onPlayAgain}>
            다시 하기
          </button>
          <button type="button" className="menu-btn" onClick={onHome}>
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
