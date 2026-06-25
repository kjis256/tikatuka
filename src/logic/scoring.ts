/**
 * 점수 계산 · 줄별 승패 · 최종 승패 판정 (순수 함수, 보드 상태만 의존).
 *
 * 규칙 원천: tikatuka_spec.md §3 (점수), §6.2 (승패 판정).
 */
import type { Die, DiceValue, GameState, Move, Player, RowScore, RowIndex } from './types';

/**
 * 한 줄의 점수.
 * 눈별 카운트 → 트리플(3개)=눈×5, 더블(2개)=눈×3, 단일=눈×개수.
 * 혼합 줄은 카운트별로 합산한다. (예: 4,4,2 → 4×3 + 2 = 14)
 * 실드 주사위도 점수는 일반과 동일하게 합산된다.
 */
export function calcRowScore(dice: Die[]): number {
  if (dice.length === 0) return 0;
  const counts = new Map<DiceValue, number>();
  for (const d of dice) {
    counts.set(d.value, (counts.get(d.value) ?? 0) + 1);
  }
  let score = 0;
  for (const [value, count] of counts) {
    if (count >= 3) score += value * 5; // 트리플
    else if (count === 2) score += value * 3; // 더블
    else score += value * count; // 단일
  }
  return score;
}

/** UI 점수+화살표용. 각 줄 내/상대 점수와 리더(동점이면 null)를 낸다. */
export function getRowScores(state: GameState): RowScore[] {
  return state.rows.map((row) => {
    const myScore = calcRowScore(row.myDice);
    const oppScore = calcRowScore(row.oppDice);
    const leader: Player | null =
      myScore > oppScore ? 'me' : oppScore > myScore ? 'opponent' : null;
    return { rowIndex: row.index, myScore, oppScore, leader };
  });
}

/**
 * 최종 승패 판정 (스펙 §6.2).
 * 1) 줄별 승리 수가 많은 쪽 승리
 * 2) 줄 수 동점 → 3줄 총합 점수가 높은 쪽 승리
 * 3) 총합도 동점 → 무승부
 */
export function judge(state: GameState): Player | 'draw' {
  let myRows = 0;
  let oppRows = 0;
  let myTotal = 0;
  let oppTotal = 0;
  for (const row of state.rows) {
    const m = calcRowScore(row.myDice);
    const o = calcRowScore(row.oppDice);
    myTotal += m;
    oppTotal += o;
    if (m > o) myRows++;
    else if (o > m) oppRows++;
  }
  if (myRows !== oppRows) return myRows > oppRows ? 'me' : 'opponent';
  if (myTotal !== oppTotal) return myTotal > oppTotal ? 'me' : 'opponent';
  return 'draw';
}

const dice = (player: Player, row: GameState['rows'][number]): Die[] =>
  player === 'me' ? row.myDice : row.oppDice;

/**
 * "이 수를 두면 해당 줄의 (두는 쪽) 점수가 얼마가 되는가" — AI 평가 보조.
 * place: pending 주사위를 그 줄에 추가했을 때 점수.
 * kkagi: 상대의 같은 눈 비보호 주사위를 그 줄에서 모두 제거한 뒤 상대 그 줄 점수.
 *        (알까기는 던진 주사위가 배치되지 않으므로 공격자 점수는 변하지 않는다.)
 */
export function scoreIfPlaced(state: GameState, move: Move): number {
  const row = state.rows[move.rowIndex];
  if (state.pending === null) return calcRowScore(dice(state.currentTurn, row));
  const value = state.pending.die.value;
  const shield = state.pending.die.isShield;

  if (move.kind === 'place') {
    const next = [...dice(state.currentTurn, row), { value, isShield: shield }];
    return calcRowScore(next);
  }
  // kkagi: 대상(상대) 줄에서 같은 눈 비보호 제거 후 상대 줄 점수
  const defender: Player = state.currentTurn === 'me' ? 'opponent' : 'me';
  const remaining = dice(defender, row).filter((d) => !(d.value === value && !d.isShield));
  return calcRowScore(remaining);
}

/** 한 플레이어가 가진 빈 슬롯 수 (줄당 3칸, 9칸 한도). */
export function emptySlots(state: GameState, player: Player): number {
  let n = 0;
  for (const row of state.rows) {
    n += 3 - dice(player, row).length;
  }
  return n;
}

/** 어느 줄이든(양 필드) 빈칸이 하나라도 있는가 (알까기 보너스 배치 공간 판정). */
export function hasAnyEmptySlot(state: GameState): boolean {
  return state.rows.some((r) => r.myDice.length < 3 || r.oppDice.length < 3);
}

/** 줄 인덱스 헬퍼 (타입 안전). */
export const ROW_INDICES: readonly RowIndex[] = [0, 1, 2];
