/**
 * ProfileBar — 상단: [내 프로필]  [로고/메뉴]  [상대 프로필 + TURN 인디케이터].
 * 좌=나, 우=상대 (ui.png). TURN 은 현재 턴 측 프로필에 표시.
 */
import type { Difficulty, GameState, MetaState } from '../logic';

export interface ProfileBarProps {
  state: GameState;
  onNewGame: () => void;
}

function difficultyStars(d: Difficulty): string {
  return '★'.repeat(d) + '☆'.repeat(5 - d);
}

function MetaBadge({ meta }: { meta: MetaState }): JSX.Element {
  return (
    <div className="meta-badge">
      <span>Lv.{meta.level}</span>
      <span>TP {meta.tp}</span>
      <span>실링 {meta.shilling}</span>
      {meta.winStreak >= 2 && <span className="meta-streak">{meta.winStreak}연승</span>}
    </div>
  );
}

export function ProfileBar({ state, onNewGame }: ProfileBarProps): JSX.Element {
  const myTurn = state.currentTurn === 'me' && state.phase !== 'gameOver';
  const oppTurn = state.currentTurn === 'opponent' && state.phase !== 'gameOver';

  return (
    <header className="profile-bar">
      <div className={`profile profile--me${myTurn ? ' profile--active' : ''}`}>
        <div className="avatar avatar--me" aria-hidden />
        <div className="profile-info">
          <span className="profile-name">나</span>
          {state.firstPlayer === 'me' && <span className="profile-first">선공</span>}
          {state.meta && <MetaBadge meta={state.meta} />}
        </div>
        {myTurn && <span className="turn-badge">TURN</span>}
      </div>

      <div className="logo-menu">
        <div className="logo-sign">
          <span className="logo">티카투카</span>
        </div>
        <button type="button" className="menu-btn" onClick={onNewGame}>
          새 게임
        </button>
      </div>

      <div className={`profile profile--opp${oppTurn ? ' profile--active' : ''}`}>
        {oppTurn && <span className="turn-badge">TURN</span>}
        <div className="profile-info profile-info--right">
          <span className="profile-name">상대 {difficultyStars(state.difficulty)}</span>
          {state.firstPlayer === 'opponent' && <span className="profile-first">선공</span>}
        </div>
        <div className="avatar avatar--opp" aria-hidden />
      </div>
    </header>
  );
}
