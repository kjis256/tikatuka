/**
 * AI 평가 함수 — 보드 가치를 AI(현재 턴) 관점에서 점수화한다.
 *
 * 규칙은 일절 재구현하지 않는다. 점수 계산은 logic 의 `calcRowScore` /
 * `scoreIfPlaced` 만 소비한다 (규칙 일원화 — 어긋남 방지).
 *
 * 평가 철학(스펙 §6.2 승패 판정과 정렬):
 *   1순위 = 줄별 승리 수 (가장 무겁게)
 *   2순위 = 3줄 총합 점수 마진 (동률 깨기)
 * 따라서 보드 가치 = ROW_WIN_WEIGHT × (이긴 줄 - 진 줄) + (내 총합 - 상대 총합).
 */
import type { GameState, Move, Player, RowIndex } from '../logic';
import { calcRowScore, scoreIfPlaced } from '../logic';

/** 줄 1개를 가져가는 가치. 총합 마진보다 항상 우선하도록 충분히 크게. */
export const ROW_WIN_WEIGHT = 1000;

const other = (p: Player): Player => (p === 'me' ? 'opponent' : 'me');

const myDice = (state: GameState, player: Player, i: RowIndex) =>
  player === 'me' ? state.rows[i].myDice : state.rows[i].oppDice;

/** 한 줄을 (내 점수, 상대 점수)로 평가해 보드 가치 기여분을 낸다. */
function rowValue(mine: number, theirs: number): number {
  const winPart = mine > theirs ? ROW_WIN_WEIGHT : theirs > mine ? -ROW_WIN_WEIGHT : 0;
  return winPart + (mine - theirs);
}

/**
 * 현재 보드를 AI(state.currentTurn) 관점의 단일 스칼라 가치로 평가한다.
 * 클수록 AI 에게 유리.
 */
export function evaluateBoard(state: GameState): number {
  const me = state.currentTurn;
  const opp = other(me);
  let v = 0;
  for (const i of [0, 1, 2] as RowIndex[]) {
    const mine = calcRowScore(myDice(state, me, i));
    const theirs = calcRowScore(myDice(state, opp, i));
    v += rowValue(mine, theirs);
  }
  return v;
}

/**
 * "이 합법수를 두면" 보드 가치가 얼마가 되는가 (AI 관점).
 *
 * scoreIfPlaced 가 해당 줄의 (두는 쪽) 새 점수를 주므로, 나머지 두 줄은 현재
 * 점수 그대로 두고 해당 줄만 갈아끼워 전체 가치를 합산한다. 규칙 재구현 없음.
 *
 * - place: 그 줄의 내 점수가 scoreIfPlaced 결과로 바뀜. 상대 점수 불변.
 * - kkagi: 그 줄의 상대 점수가 scoreIfPlaced 결과로 바뀜(같은 눈 비보호 제거).
 *          던진 주사위는 소모되어 내 점수는 불변. (이후 보너스 배치는 별도 평가.)
 */
export function evaluateMove(state: GameState, move: Move): number {
  const me = state.currentTurn;
  const opp = other(me);
  const target = move.rowIndex;
  const projected = scoreIfPlaced(state, move);

  let v = 0;
  for (const i of [0, 1, 2] as RowIndex[]) {
    let mine = calcRowScore(myDice(state, me, i));
    let theirs = calcRowScore(myDice(state, opp, i));
    if (i === target) {
      if (move.kind === 'place') mine = projected;
      else theirs = projected; // kkagi: 상대 줄 점수가 줄어듦
    }
    v += rowValue(mine, theirs);
  }
  return v;
}
