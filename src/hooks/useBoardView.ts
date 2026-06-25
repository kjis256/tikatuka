/**
 * useBoardView — 렌더에 필요한 "규칙 판정 결과"를 logic 함수로 한 번에 계산해 메모한다.
 *
 * 컴포넌트가 자체적으로 "같은 눈인가/배치 가능한가"를 재계산하면 logic 과 어긋난다.
 * 그래서 알까기 대상·합법 배치 줄 같은 판정은 전부 여기서 logic API 로만 산출하고,
 * 컴포넌트는 그 결과(불리언/집합)를 읽어 테두리·하이라이트만 결정한다.
 */
import { useMemo } from 'react';
import type { GameState, Move, Player, RowIndex, RowScore } from '../logic';
import { getLegalMoves, getRowScores } from '../logic';

export interface BoardView {
  /** 줄별 점수 + 화살표 방향(leader). */
  rowScores: RowScore[];
  /** 현재 pending 으로 일반 배치 가능한 내 줄 집합. */
  placeRows: Set<RowIndex>;
  /** 현재 pending 으로 알까기 가능한 줄 집합. */
  kkagiRows: Set<RowIndex>;
  /** 내 차례에 입력을 받는 단계(placing)이며 현재 턴이 나인가. */
  myPlacing: boolean;
  /** 보너스(실드) 배치 단계이며 현재 턴이 나인가. */
  myBonus: boolean;
  /**
   * "이 칸에 배치 시 알까기 대상이 되는 상대 주사위인가"를 판정하는 함수.
   * 알까기 가능한 줄(kkagiRows)에서, 상대 비보호 + 현재 pending 눈과 같은 값이면 대상.
   * 값 비교는 표시용 강조일 뿐, 발동 가능 여부는 logic(getLegalMoves)이 결정한다.
   */
  isKkagiTarget: (rowIndex: RowIndex, owner: Player, value: number, isShield: boolean) => boolean;
}

export function useBoardView(state: GameState): BoardView {
  return useMemo<BoardView>(() => {
    const rowScores = getRowScores(state);
    const myTurn = state.currentTurn === 'me' && state.phase !== 'gameOver';
    const myPlacing = myTurn && state.phase === 'placing' && state.pending !== null;
    const myBonus = myTurn && state.phase === 'placingBonus' && state.pendingBonus !== null;

    const placeRows = new Set<RowIndex>();
    const kkagiRows = new Set<RowIndex>();
    if (myPlacing) {
      const moves: Move[] = getLegalMoves(state);
      for (const m of moves) {
        if (m.kind === 'place') placeRows.add(m.rowIndex);
        else kkagiRows.add(m.rowIndex);
      }
    }

    const pendingValue = state.pending?.die.value ?? null;
    const isKkagiTarget = (
      rowIndex: RowIndex,
      owner: Player,
      value: number,
      isShield: boolean,
    ): boolean => {
      if (!myPlacing || pendingValue === null) return false;
      // 알까기는 상대(비보호) 주사위만 대상. 내 주사위·실드는 절대 대상 아님.
      if (owner === state.currentTurn) return false;
      if (isShield) return false;
      if (!kkagiRows.has(rowIndex)) return false;
      return value === pendingValue;
    };

    return { rowScores, placeRows, kkagiRows, myPlacing, myBonus, isKkagiTarget };
  }, [state]);
}
