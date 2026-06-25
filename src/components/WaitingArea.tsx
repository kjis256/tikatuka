/**
 * WaitingArea — 대기 영역. 내=녹색(좌), 상대=적색(우). (ui.png)
 *
 * 현재 턴인 플레이어 쪽에 굴린 주사위(pending)가 배치 전 대기한다.
 *  - placing & pending.alt 있음(타짜의 손놀림 후) → 두 주사위 + 선택 버튼(내 턴 한정)
 *  - placingBonus → 보너스(실드) 주사위 대기
 * 규칙은 모른다. state 를 읽어 표시만 한다.
 */
import type { GameAction, GameState, Player } from '../logic';
import { Die } from './Die';

export interface WaitingAreaProps {
  player: Player;
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** 입력 잠금(상대 턴). */
  locked: boolean;
}

export function WaitingArea({ player, state, dispatch, locked }: WaitingAreaProps): JSX.Element {
  const isActiveSide = state.currentTurn === player && state.phase !== 'gameOver';
  const colorClass = player === 'me' ? 'waiting--me' : 'waiting--opp';

  // 내 대기영역 클릭으로 굴리기: 내 턴 + rolling 단계 + 입력 잠금 아닐 때만.
  // (placing/보너스/상대턴/게임오버에는 비활성 — 기존 pending 표시·선택 동작 유지.)
  const canRollByClick = player === 'me' && !locked && isActiveSide && state.phase === 'rolling';
  const handleAreaClick = canRollByClick ? () => dispatch({ type: 'ROLL' }) : undefined;

  let content: JSX.Element | null = null;

  if (isActiveSide && state.phase === 'placing' && state.pending !== null) {
    const { die, alt } = state.pending;
    if (alt === null) {
      content = (
        <div className="waiting-die waiting-die--single">
          <Die die={die} />
        </div>
      );
    } else {
      // 타짜의 손놀림 후: 둘 중 선택 (내 턴이면 클릭 가능)
      content = (
        <div className="waiting-choice">
          <button
            type="button"
            className="waiting-die waiting-die--choice"
            disabled={locked}
            onClick={() => dispatch({ type: 'CHOOSE_ROLL', which: 'die' })}
            aria-label={`첫 굴림 ${die.value} 선택`}
          >
            <Die die={die} />
          </button>
          <span className="waiting-vs">vs</span>
          <button
            type="button"
            className="waiting-die waiting-die--choice"
            disabled={locked}
            onClick={() => dispatch({ type: 'CHOOSE_ROLL', which: 'alt' })}
            aria-label={`재굴림 ${alt.value} 선택`}
          >
            <Die die={alt} />
          </button>
        </div>
      );
    }
  } else if (isActiveSide && state.phase === 'placingBonus' && state.pendingBonus !== null) {
    content = (
      <div className="waiting-die waiting-die--bonus">
        <Die die={state.pendingBonus} />
        <span className="waiting-bonus-label">보너스</span>
      </div>
    );
  }

  const className = `waiting ${colorClass}${isActiveSide ? ' waiting--active' : ''}${
    canRollByClick ? ' waiting--rollable' : ''
  }`;

  if (canRollByClick && handleAreaClick) {
    return (
      <div
        className={className}
        role="button"
        tabIndex={0}
        onClick={handleAreaClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAreaClick();
          }
        }}
        aria-label="대기영역 클릭으로 주사위 굴리기"
      >
        <div className="waiting-label">주사위 굴리기</div>
        <div className="waiting-slot">{content}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="waiting-label">{player === 'me' ? '내 대기' : '상대 대기'}</div>
      <div className="waiting-slot">{content}</div>
    </div>
  );
}
