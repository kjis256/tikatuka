/**
 * ActionBar — 하단 행동 버튼: [타짜의 손놀림 ✔] [홀드] [베팅].
 *
 * 활성/비활성 조건은 모두 logic/state 에서 판정한다 (UI 규칙 재계산 금지):
 *  - 타짜의 손놀림: 내 턴 placing & pending.alt 없음 & rerollUsed[me]===false.
 *                  사용 후엔 ✔ 표시 + 비활성.
 *  - 홀드: 내 턴 & 게임 진행 중 & 아직 홀드 안 함.
 *  - 베팅(티카투카): isBettingOpen(state) 이고 내 턴이며 아직 미선언.
 */
import type { GameAction, GameState } from '../logic';
import { isBettingOpen } from '../logic';

export interface ActionBarProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** 내 턴 입력 가능 여부. */
  myTurn: boolean;
}

export function ActionBar({ state, dispatch, myTurn }: ActionBarProps): JSX.Element {
  const rerollUsed = state.rerollUsed.me;
  const canReroll =
    myTurn &&
    state.phase === 'placing' &&
    state.pending !== null &&
    state.pending.alt === null &&
    !rerollUsed;

  const canHold = myTurn && state.phase !== 'gameOver' && !state.holds.me;

  const bettingOpen = isBettingOpen(state);
  const canBet = myTurn && bettingOpen && state.tikatukaDeclared === null;
  const alreadyDeclared = state.tikatukaDeclared === 'me';

  return (
    <footer className="action-bar">
      <button
        type="button"
        className={`act-btn act-btn--reroll${rerollUsed ? ' act-btn--used' : ''}`}
        disabled={!canReroll}
        onClick={() => dispatch({ type: 'REROLL' })}
      >
        타짜의 손놀림 {rerollUsed && <span className="act-check">✔</span>}
      </button>

      <button
        type="button"
        className="act-btn act-btn--hold"
        disabled={!canHold}
        onClick={() => dispatch({ type: 'HOLD' })}
      >
        홀드 {state.holds.me && <span className="act-check">✔</span>}
      </button>

      <button
        type="button"
        className={`act-btn act-btn--bet${alreadyDeclared ? ' act-btn--declared' : ''}`}
        disabled={!canBet}
        onClick={() => dispatch({ type: 'BET' })}
      >
        {alreadyDeclared ? '티카투카 선언됨' : bettingOpen ? '티카투카 베팅' : '베팅 불가'}
      </button>
    </footer>
  );
}
