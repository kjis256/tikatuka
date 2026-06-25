/**
 * useGame — UI 상태 훅.
 *
 * 단일 GameState 를 보관(useState)하고, RNG 를 useRef 로 관리한다.
 * 규칙은 전혀 재구현하지 않는다: 각 GameAction 을 logic 의 순수 함수 호출로 매핑하는
 * 얇은 글루(applyAction)만 둔다. 상대(AI) 턴은 ai 의 decideAction 을 setTimeout 루프로
 * 디스패치한다. 게임오버 시 메타 모드면 settleMeta 로 결산한다.
 *
 * 계약: _workspace/01_contract.md "UI ↔ AI 경계면".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty, GameAction, GameState, Rng } from '../logic';
import {
  createGame,
  rollPending,
  reroll,
  chooseRoll,
  applyMove,
  placeBonus,
  applySpecial,
  settleMeta,
  mulberry32,
} from '../logic';
import { decideAction } from '../ai';

/** 상대 턴 1스텝 사이의 자연스러운 딜레이(ms). */
const AI_STEP_DELAY = 700;

/**
 * 단일 GameAction 을 logic 함수 호출로 매핑한다. 규칙 재구현 금지.
 * AI_STEP 은 UI 차원의 신호일 뿐 상태를 바꾸지 않으므로 그대로 반환한다.
 */
export function applyAction(state: GameState, action: GameAction, rng: Rng): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createGame({
        difficulty: action.difficulty,
        withMeta: action.withMeta,
        rng,
      });
    case 'ROLL':
      return rollPending(state, rng);
    case 'REROLL':
      return reroll(state, rng);
    case 'CHOOSE_ROLL':
      return chooseRoll(state, action.which);
    case 'MOVE':
      return applyMove(state, action.move, rng);
    case 'PLACE_BONUS':
      return placeBonus(state, action.field, action.rowIndex);
    case 'HOLD':
      return applySpecial(state, { kind: 'hold' });
    case 'BET':
      return applySpecial(state, { kind: 'bet' });
    case 'AI_STEP':
      return state;
  }
}

export interface UseGameResult {
  state: GameState;
  /** 사용자/UI 가 액션을 디스패치 (내 턴 한정 사용). */
  dispatch: (action: GameAction) => void;
  /** 새 게임 시작 (난이도/메타 지정). */
  newGame: (difficulty: Difficulty, withMeta: boolean) => void;
  /** 현재 턴이 상대(AI)인지. UI 가 입력을 잠그는 데 사용. */
  isOpponentTurn: boolean;
}

/**
 * 초기 상태는 항상 단판·난이도1 의 새 게임. 실제 시작은 StartScreen 에서 newGame 으로.
 * 시드는 시작할 때마다 새로 만든다(매 판 결정적이되 다른 전개).
 */
export function useGame(): UseGameResult {
  const rngRef = useRef<Rng>(mulberry32(Date.now() >>> 0));
  const [state, setState] = useState<GameState>(() => createGame({ rng: rngRef.current }));

  const dispatch = useCallback((action: GameAction) => {
    if (action.type === 'NEW_GAME') {
      // 새 게임마다 시드 갱신.
      rngRef.current = mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    }
    setState((prev) => {
      let next = applyAction(prev, action, rngRef.current);
      if (next.phase === 'gameOver' && next.meta !== null) {
        next = settleMeta(next);
      }
      return next;
    });
  }, []);

  const newGame = useCallback(
    (difficulty: Difficulty, withMeta: boolean) => {
      dispatch({ type: 'NEW_GAME', difficulty, withMeta });
    },
    [dispatch],
  );

  const isOpponentTurn = state.currentTurn === 'opponent' && state.phase !== 'gameOver';

  // ===== 상대(AI) 턴 자동 진행 =====
  // 현재 턴이 상대이고 게임이 끝나지 않았으면, decideAction 으로 다음 액션 1개를
  // 받아 딜레이 후 디스패치한다. state 가 바뀌면 effect 가 다시 돌아 다음 스텝을 진행.
  useEffect(() => {
    if (!isOpponentTurn) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.currentTurn !== 'opponent' || prev.phase === 'gameOver') return prev;
        const action = decideAction(prev, rngRef.current);
        let next = applyAction(prev, action, rngRef.current);
        if (next.phase === 'gameOver' && next.meta !== null) {
          next = settleMeta(next);
        }
        return next;
      });
    }, AI_STEP_DELAY);
    return () => clearTimeout(timer);
    // state 자체를 의존성으로: 매 스텝 후 재실행되어 다음 AI 스텝을 트리거.
  }, [isOpponentTurn, state]);

  return { state, dispatch, newGame, isOpponentTurn };
}
