/**
 * App — 티카투카 화면 조립.
 *
 * 상태/규칙은 useGame(=logic 글루)이 소유. App 은 화면을 그리고 입력을 모은다.
 * 좌=나, 우=상대 (ui.png).
 *
 * 레이아웃:
 *   ProfileBar (상단)
 *   game-area: [내 대기영역] [보드 3줄] [상대 대기영역]
 *   ActionBar (하단)
 *   StartScreen / ResultOverlay (오버레이)
 */
import { useState } from 'react';
import type { Difficulty } from './logic';
import { useGame } from './hooks/useGame';
import { useBoardView } from './hooks/useBoardView';
import { ProfileBar } from './components/ProfileBar';
import { WaitingArea } from './components/WaitingArea';
import { Board } from './components/Board';
import { ActionBar } from './components/ActionBar';
import { StartScreen } from './components/StartScreen';
import { ResultOverlay } from './components/ResultOverlay';
import mascotMe from './assets/mascot_me.webp';
import mascotOpp from './assets/mascot_opp.webp';

function statusText(phase: string, myTurn: boolean, hasAlt: boolean, isBonus: boolean): string {
  if (!myTurn) return '상대가 생각하는 중…';
  if (isBonus) return '보너스(실드) 주사위를 빈 칸에 배치하세요';
  if (phase === 'rolling') return '주사위를 굴리세요';
  if (phase === 'placing') {
    return hasAlt ? '두 주사위 중 하나를 선택하세요' : '배치할 칸 또는 알까기 대상을 클릭하세요';
  }
  return '';
}

export default function App(): JSX.Element {
  const { state, dispatch, newGame, isOpponentTurn } = useGame();
  const view = useBoardView(state);
  const [started, setStarted] = useState(false);

  const handleStart = (difficulty: Difficulty, withMeta: boolean): void => {
    newGame(difficulty, withMeta);
    setStarted(true);
  };

  const handlePlayAgain = (): void => {
    newGame(state.difficulty, state.meta !== null);
  };

  const handleHome = (): void => {
    setStarted(false);
  };

  const myTurn = state.currentTurn === 'me' && state.phase !== 'gameOver';
  // 입력 잠금: 상대 턴이거나 게임오버.
  const locked = !myTurn;

  const canRoll = myTurn && state.phase === 'rolling';
  const hasAlt = state.pending?.alt != null;
  const isBonus = state.phase === 'placingBonus';

  if (!started) {
    return <StartScreen onStart={handleStart} />;
  }

  return (
    <div className="app">
      <ProfileBar state={state} onNewGame={handleHome} />

      <div className="status-banner">
        <span className="status-text">{statusText(state.phase, myTurn, hasAlt, isBonus)}</span>
        {canRoll && (
          <button type="button" className="roll-btn" onClick={() => dispatch({ type: 'ROLL' })}>
            주사위 굴리기
          </button>
        )}
        {state.bettingWindow.open && state.tikatukaDeclared === null && (
          <span className="betting-flag">베팅 가능 ({state.bettingWindow.turnsLeft}턴 남음)</span>
        )}
        {state.tikatukaDeclared && (
          <span className="betting-flag betting-flag--declared">
            {state.tikatukaDeclared === 'me' ? '내' : '상대'} 티카투카 선언!
          </span>
        )}
      </div>

      <div className="game-area">
        <img className="mascot mascot--me" src={mascotMe} alt="" aria-hidden />
        <img className="mascot mascot--opp" src={mascotOpp} alt="" aria-hidden />
        <WaitingArea player="me" state={state} dispatch={dispatch} locked={locked} />
        <Board state={state} view={view} dispatch={dispatch} locked={locked} />
        <WaitingArea player="opponent" state={state} dispatch={dispatch} locked={isOpponentTurn} />
      </div>

      <ActionBar state={state} dispatch={dispatch} myTurn={myTurn} />

      <ResultOverlay state={state} onPlayAgain={handlePlayAgain} onHome={handleHome} />
    </div>
  );
}
