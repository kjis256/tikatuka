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
 *
 * 잠재력(potential) 항(연속 런 규칙 대응):
 *   점수 규칙이 "연속(인접) 런" 기반으로 바뀐 뒤(같은 눈을 인접하게 모아야만
 *   더블=눈×3 / 트리플=눈×5 보너스), 지금 점수만 보는 greedy 평가는 "인접 콤보를
 *   키워가는 배치"의 가치를 과소평가한다. potential 은 각 줄의 끝 런이 미완(단일/더블)이고
 *   빈칸이 남아 같은 눈으로 확장 가능할 때 가산해, 고급 AI 가 인접 더블/트리플을
 *   빌드하고(내 줄) 상대의 인접 콤보 잠재를 깎도록(상대 줄) 유도한다.
 *   potentialWeight=0 이면 순수 greedy(저난이도). 가중치는 decide 가 ★별로 주입한다.
 */
import type { Die, GameState, Move, Player, RowIndex } from '../logic';
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
 * 한 줄의 "미래 런 확장 잠재력" (연속 런 규칙용).
 * 주사위는 줄 끝에 덧붙으므로(런은 배열 순서로 판정), 확장은 끝의 런에서만 가능하다.
 *   - 끝 런 길이 1(단일) + 빈칸 → 더블 잠재: value × 0.5
 *   - 끝 런 길이 2(더블) + 빈칸 → 트리플 잠재(더 큼): value × 1.0
 *   - 이미 트리플이거나 빈칸 없음 → 0
 * 가중치는 호출부가 곱한다.
 */
function rowPotential(dice: Die[], slotsLeft: number): number {
  if (slotsLeft <= 0 || dice.length === 0) return 0;
  let runLen = 1;
  for (let i = dice.length - 1; i > 0; i--) {
    if (dice[i].value === dice[i - 1].value) runLen++;
    else break;
  }
  const last = dice[dice.length - 1].value;
  if (runLen === 1) return last * 0.5;
  if (runLen === 2) return last * 1.0;
  return 0;
}

/**
 * 현재 보드를 AI(state.currentTurn) 관점의 단일 스칼라 가치로 평가한다.
 * 클수록 AI 에게 유리. (재굴림 임계 판단 등에서 기준선으로 쓰므로 잠재력 항은 제외 —
 * "지금 확정된 가치"만 본다. 잠재력은 수 비교(evaluateMove)에서만 가산한다.)
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
 *
 * potentialWeight > 0 이면(고난이도) 각 줄의 인접 런 확장 잠재력을 함께 가산한다
 * (내 줄 +, 상대 줄 −). 이 항이 켜진 수가 "인접 더블/트리플 빌드 / 상대 콤보 견제"를
 * 더 잘 고르게 한다. 0 이면 순수 greedy.
 */
export function evaluateMove(state: GameState, move: Move, potentialWeight = 0): number {
  const me = state.currentTurn;
  const opp = other(me);
  const target = move.rowIndex;
  // pending 이 없으면 둘 주사위가 없다 → 현재 보드 가치(원 동작 보존).
  if (state.pending === null) return evaluateBoard(state);
  const value = state.pending.die.value;
  const shield = state.pending.die.isShield;

  let v = 0;
  for (const i of [0, 1, 2] as RowIndex[]) {
    const mineDice = [...myDice(state, me, i)];
    const oppArr = [...myDice(state, opp, i)];
    let mine = calcRowScore(mineDice);
    let theirs = calcRowScore(oppArr);
    if (i === target) {
      if (move.kind === 'place') {
        mineDice.push({ value, isShield: shield });
        mine = scoreIfPlaced(state, move);
      } else {
        const kept = oppArr.filter((d) => !(d.value === value && !d.isShield));
        oppArr.length = 0;
        oppArr.push(...kept);
        theirs = scoreIfPlaced(state, move); // kkagi: 상대 줄 점수가 줄어듦
      }
    }
    v += rowValue(mine, theirs);
    if (potentialWeight > 0) {
      v += potentialWeight * rowPotential(mineDice, 3 - mineDice.length);
      v -= potentialWeight * rowPotential(oppArr, 3 - oppArr.length);
    }
  }
  return v;
}
