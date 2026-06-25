/**
 * 티카투카 상대 AI — 의사결정자.
 *
 * 공개 함수: decideAction(state, rng) => GameAction
 *   현재 phase 를 보고 다음에 디스패치할 GameAction 1개를 반환한다.
 *   합법수는 전적으로 logic 의 getLegalMoves 에서만 받는다 (불법수 0 보장).
 *
 * 난이도 = 의사결정 품질 (운 아님 — 스펙 §8).
 *   주사위 확률은 모든 ★에서 동일. ★ 차이는 "얼마나 좋은 수를 두는가"로만 낸다.
 *   - ε-탐욕: 확률 ε 로 최선수, (1-ε) 로 무작위 합법수. ε 를 ★에 비례.
 *   - 게이트: 타짜의 손놀림은 ★3+ (스펙 §7.1 명시), 베팅은 ★4+, 홀드는 ★4+.
 *
 * 결정성: 같은 (state, 시드, 난이도) → 같은 GameAction. RNG 는 인자 주입.
 */
import type { Difficulty, GameAction, GameState, Move, Player, RowIndex, Rng } from '../logic';
import { getLegalMoves, isBettingOpen, calcRowScore, emptySlots } from '../logic';
import { evaluateMove, evaluateBoard, ROW_WIN_WEIGHT } from './evaluate';

// ===== 난이도 파라미터 =====
/**
 * ★별 "최선수를 따를 확률" ε. 나머지는 무작위 합법수(근시안·실수).
 * 스펙 §8: 난이도 = 의사결정 품질. ε 가 클수록 실수가 적다(운 동일).
 *
 * 단조성 설계(연속 런 규칙 재튜닝, 2026-06-25):
 *   ★3/4/5 는 **동일한 강한 평가**(potential 항 켜짐, 아래 POTENTIAL 참고)를 공유하고,
 *   차이는 오직 "실수율(ε)+재굴림 활용"으로만 낸다. 즉 높은 ★ = "낮은 ★ + 노이즈 적음".
 *   이 구조가 단조성을 구조적으로 보장한다(강한 두 AI가 동일 eval 을 쓰되 ε 가 큰 쪽이
 *   더 자주 무작위 실수). 연속 런 규칙으로 보드 가치 분포가 바뀌어 상위권 격차가 좁아진
 *   것을 ε 간격을 넓혀(★5=1.0 항상최선 → ★1 거의 무작위) 복원한다.
 */
const EPSILON: Record<Difficulty, number> = {
  1: 0.05,
  2: 0.28,
  3: 0.5,
  4: 0.72,
  5: 1.0,
};

/**
 * ★별 "이득일 때 타짜의 손놀림(재굴림)을 실제로 쓸 확률".
 * 재굴림은 ε 와 함께 상위권(★3~5) 실력차의 보조 레버다(자가대국 검증).
 * 스펙 §7.1(★3+ 사용)을 지키되, ★3 은 가끔만(0.3), ★5 는 항상(1.0) 써서
 * 재굴림 활용도 자체가 ★ 에 비례하도록 한다. (★1·★2 는 0 — 재굴림 미사용.)
 */
const REROLL_PROB: Record<Difficulty, number> = {
  1: 0,
  2: 0,
  3: 0.3,
  4: 0.65,
  5: 1.0,
};

/**
 * ★별 평가 "잠재력(potential) 가중치". 연속 런 규칙에서 인접 더블/트리플 빌드와
 * 상대 콤보 견제를 평가에 반영하는 강도(evaluate.evaluateMove 의 potentialWeight).
 * ★3/4/5 는 동일하게 1.0(강한 eval 공유 — 단조성은 ε 로 낸다). ★1/2 는 0(순수 greedy):
 * 어차피 ε 가 낮아 최선수를 드물게 두므로 잠재력 항을 줄지 않아도 저난이도다움이 유지된다.
 */
const POTENTIAL: Record<Difficulty, number> = {
  1: 0,
  2: 0,
  3: 1.0,
  4: 1.0,
  5: 1.0,
};

/** 타짜의 손놀림(재굴림)을 쓰는 최소 ★ (스펙 §7.1: ★3 이상 사용). */
const REROLL_MIN_STAR = 3;
/** 홀드를 고려하는 최소 ★ (낮은 ★는 끝까지 둠). */
const HOLD_MIN_STAR = 4;
/** 베팅(티카투카 선언)을 고려하는 최소 ★. */
const BET_MIN_STAR = 4;

const other = (p: Player): Player => (p === 'me' ? 'opponent' : 'me');

// ===== 합법수 선택 공통 =====
/** 합법수들을 평가해 (최선수, 최선값) 반환. 동점은 안정적으로 첫 번째.
 *  potW = ★별 잠재력 가중치(인접 콤보 빌드/견제 반영). */
function bestMove(state: GameState, moves: Move[], potW: number): { move: Move; value: number } {
  let best = moves[0];
  let bestVal = evaluateMove(state, best, potW);
  for (let i = 1; i < moves.length; i++) {
    const v = evaluateMove(state, moves[i], potW);
    if (v > bestVal) {
      best = moves[i];
      bestVal = v;
    }
  }
  return { move: best, value: bestVal };
}

/**
 * ε-탐욕으로 합법수 1개 선택. 결정적(rng 주입).
 * rng() < ε → 최선수(★별 잠재력 가중 평가), 아니면 무작위 합법수(차선 포함).
 */
function pickMove(state: GameState, moves: Move[], difficulty: Difficulty, rng: Rng): Move {
  if (moves.length === 1) return moves[0];
  if (rng() < EPSILON[difficulty]) {
    return bestMove(state, moves, POTENTIAL[difficulty]).move;
  }
  const idx = Math.floor(rng() * moves.length);
  return moves[Math.min(idx, moves.length - 1)];
}

// ===== 재굴림(타짜의 손놀림) 판단 =====
/**
 * 현재 굴림 die 의 "최선 배치 가치"가 낮으면 재굴림이 이득이다.
 * 기준: 현재 보드 가치 대비 최선수가 줄을 따내지 못하거나(줄 가치 음수권),
 *       기대 개선폭이 작을 때. ★ 높을수록 더 적극적으로 판단.
 */
function shouldReroll(state: GameState, difficulty: Difficulty): boolean {
  if (difficulty < REROLL_MIN_STAR) return false;
  if (state.pending === null || state.pending.alt !== null) return false;
  if (state.rerollUsed[state.currentTurn]) return false;
  const moves = getLegalMoves(state);
  if (moves.length === 0) return false;

  const base = evaluateBoard(state);
  const best = bestMove(state, moves, POTENTIAL[difficulty]).value;
  const gain = best - base;

  // 최선수조차 보드 가치를 (줄 1개분의 절반 미만으로) 거의 못 올리면 나쁜 굴림.
  // 임계값을 ★에 비례시켜 ★5 가 더 까다롭게(더 자주) 재굴림하도록.
  const threshold = difficulty >= 5 ? ROW_WIN_WEIGHT / 2 : ROW_WIN_WEIGHT / 3;
  return gain < threshold;
}

// ===== 굴림 선택 (die vs alt) =====
/** pending.die / pending.alt 중 어느 쪽으로 둘 때가 더 좋은가 (★별 잠재력 가중). */
function chooseBetterRoll(state: GameState, potW: number): 'die' | 'alt' {
  const pending = state.pending!;
  const dieVal = evalRollValue(state, pending.die, potW);
  const altVal = evalRollValue(state, pending.alt!, potW);
  return altVal > dieVal ? 'alt' : 'die';
}

/** 특정 die 로 확정했다고 가정했을 때의 최선 합법수 가치. */
function evalRollValue(
  state: GameState,
  die: GameState['rows'][number]['myDice'][number],
  potW: number,
): number {
  const probe: GameState = {
    ...state,
    pending: { die, alt: null },
  };
  const moves = getLegalMoves(probe);
  if (moves.length === 0) return evaluateBoard(probe);
  return bestMove(probe, moves, potW).value;
}

// ===== 홀드 판단 =====
/**
 * 3줄 모두 충분히 앞서고, 남은 칸이 있어 더 둘수록 (상대가 역전할) 위험만 키울 때 홀드.
 * 보수적으로: 모든 줄에서 리드 + 줄당 리드폭이 안전 마진 이상일 때만.
 */
function shouldHold(state: GameState, difficulty: Difficulty): boolean {
  if (difficulty < HOLD_MIN_STAR) return false;
  if (state.holds[state.currentTurn]) return false;
  const me = state.currentTurn;
  const opp = other(me);

  let leadingRows = 0;
  let safe = true;
  for (const i of [0, 1, 2] as RowIndex[]) {
    const mine = calcRowScore(me === 'me' ? state.rows[i].myDice : state.rows[i].oppDice);
    const theirs = calcRowScore(opp === 'me' ? state.rows[i].myDice : state.rows[i].oppDice);
    if (mine > theirs) {
      leadingRows++;
      // 상대가 그 줄에 빈칸이 있으면 안전 마진(트리플 한 방 ~ 큰 폭) 필요.
      const oppSlotsLeft = 3 - (opp === 'me' ? state.rows[i].myDice : state.rows[i].oppDice).length;
      if (oppSlotsLeft > 0 && mine - theirs < 15) safe = false;
    } else {
      safe = false; // 안 이기는 줄이 하나라도 있으면 홀드 안 함
    }
  }
  // 내가 더 둘 칸이 남아있어야 "굳히기"가 의미. (없으면 어차피 끝)
  return leadingRows === 3 && safe && emptySlots(state, me) > 0;
}

// ===== 베팅(티카투카 선언) 판단 =====
/**
 * 승리를 거의 확신할 때만 선언. 조건: 베팅 윈도우 열림(합산 10+, 3턴 내) + ★4+ +
 * 줄별 우세가 굳어짐(2줄 이상 확정적 리드, 또는 3줄 모두 리드).
 */
function shouldBet(state: GameState, difficulty: Difficulty): boolean {
  if (difficulty < BET_MIN_STAR) return false;
  if (!isBettingOpen(state)) return false;
  const me = state.currentTurn;
  const opp = other(me);

  let secureRows = 0;
  let leadRows = 0;
  for (const i of [0, 1, 2] as RowIndex[]) {
    const mine = calcRowScore(me === 'me' ? state.rows[i].myDice : state.rows[i].oppDice);
    const theirs = calcRowScore(opp === 'me' ? state.rows[i].myDice : state.rows[i].oppDice);
    const oppSlotsLeft = 3 - (opp === 'me' ? state.rows[i].myDice : state.rows[i].oppDice).length;
    if (mine > theirs) {
      leadRows++;
      // 상대가 그 줄을 더 채울 수 없거나 리드폭이 매우 크면 "확정 리드".
      if (oppSlotsLeft === 0 || mine - theirs >= 20) secureRows++;
    }
  }
  // 과반 줄을 확정적으로 가져갔다고 보일 때만(2줄 이상). ★5 는 leadRows===3 도 허용.
  if (secureRows >= 2) return true;
  if (difficulty >= 5 && leadRows === 3 && secureRows >= 1) return true;
  return false;
}

// ===== 보너스(실드) 배치 판단 =====
/**
 * 알까기 후 받은 실드 보너스를 어디에 둘지. 양 필드 자유 배치(스펙 §4.2).
 * 모든 (field,row) 빈칸 후보에 대해, 그 배치 후 보드 가치(AI 관점)를 최대화.
 * - 내 줄에 두면 내 점수↑(특히 더블/트리플 완성), 상대 줄에 두면 상대 칸을 막아
 *   상대의 향후 더블/트리플 기회를 줄임. 가치 함수가 둘을 함께 비교한다.
 */
function decideBonus(state: GameState, difficulty: Difficulty, rng: Rng): GameAction {
  const me = state.currentTurn;
  const opp = other(me);
  const bonus = state.pendingBonus!;

  type Cand = { field: Player; rowIndex: RowIndex; value: number };
  const cands: Cand[] = [];
  for (const i of [0, 1, 2] as RowIndex[]) {
    for (const field of [me, opp] as Player[]) {
      const side = field === 'me' ? state.rows[i].myDice : state.rows[i].oppDice;
      if (side.length >= 3) continue;
      cands.push({ field, rowIndex: i, value: bonusValue(state, field, i, bonus) });
    }
  }
  // 빈칸은 알까기 발동 전제이므로 최소 1개 존재. 안전망으로 첫 빈칸 fallback.
  if (cands.length === 0) {
    return { type: 'PLACE_BONUS', field: me, rowIndex: firstEmptyRow(state, me) };
  }

  let best = cands[0];
  for (const c of cands) if (c.value > best.value) best = c;

  // ε-탐욕: 낮은 ★는 가끔 무작위 빈칸.
  const chosen =
    rng() < EPSILON[difficulty] ? best : cands[Math.min(Math.floor(rng() * cands.length), cands.length - 1)];
  return { type: 'PLACE_BONUS', field: chosen.field, rowIndex: chosen.rowIndex };
}

/** 보너스를 (field, row)에 두었을 때의 보드 가치(AI 관점). */
function bonusValue(
  state: GameState,
  field: Player,
  rowIndex: RowIndex,
  bonus: GameState['rows'][number]['myDice'][number],
): number {
  const me = state.currentTurn;
  const opp = other(me);
  let v = 0;
  for (const i of [0, 1, 2] as RowIndex[]) {
    const mineArr = [...state.rows[i].myDice];
    const oppArr = [...state.rows[i].oppDice];
    if (i === rowIndex) {
      if (field === 'me') mineArr.push(bonus);
      else oppArr.push(bonus);
    }
    const mine = calcRowScore(me === 'me' ? mineArr : oppArr);
    const theirs = calcRowScore(opp === 'me' ? mineArr : oppArr);
    const winPart = mine > theirs ? ROW_WIN_WEIGHT : theirs > mine ? -ROW_WIN_WEIGHT : 0;
    v += winPart + (mine - theirs);
  }
  return v;
}

function firstEmptyRow(state: GameState, player: Player): RowIndex {
  for (const i of [0, 1, 2] as RowIndex[]) {
    const side = player === 'me' ? state.rows[i].myDice : state.rows[i].oppDice;
    if (side.length < 3) return i;
  }
  return 0;
}

// ===== 공개 진입점 =====
/**
 * AI 의 다음 한 수를 결정한다. 전제: state.currentTurn 이 AI 측.
 * phase 에 따라 정확히 1개의 GameAction 을 반환한다.
 */
export function decideAction(state: GameState, rng: Rng): GameAction {
  const difficulty = state.difficulty;

  if (state.phase === 'rolling') {
    return { type: 'ROLL' };
  }

  if (state.phase === 'placingBonus') {
    return decideBonus(state, difficulty, rng);
  }

  if (state.phase === 'placing') {
    // 1) 대안 굴림이 떠 있으면 둘 중 더 나은 쪽을 선택.
    if (state.pending && state.pending.alt !== null) {
      // ε-탐욕: 낮은 ★는 가끔 잘못 선택.
      const which: 'die' | 'alt' =
        rng() < EPSILON[difficulty]
          ? chooseBetterRoll(state, POTENTIAL[difficulty])
          : rng() < 0.5
            ? 'die'
            : 'alt';
      return { type: 'CHOOSE_ROLL', which };
    }

    // 2) 베팅: 승리 확신 + 조건 충족 시 (★4+).
    if (shouldBet(state, difficulty)) {
      return { type: 'BET' };
    }

    // 3) 타짜의 손놀림: 굴림이 나쁘고 아직 미사용 (★3+).
    //    "이득일 때" 판단(shouldReroll)에 더해, ★별 사용확률(REROLL_PROB)로 한 번 더
    //    게이트한다 — 재굴림 활용도가 ★ 에 비례하도록(강제 알까기 환경의 주 난이도 레버).
    if (shouldReroll(state, difficulty) && rng() < REROLL_PROB[difficulty]) {
      return { type: 'REROLL' };
    }

    // 4) 홀드: 모든 줄에서 충분히 앞서 굳히기가 이득 (★4+).
    if (shouldHold(state, difficulty)) {
      return { type: 'HOLD' };
    }

    // 5) 합법수 중 평가 최선 (ε-탐욕).
    const moves = getLegalMoves(state);
    if (moves.length === 0) {
      // 둘 곳이 없으면 홀드로 턴을 넘긴다 (방어적: 정상 흐름에선 발생하지 않음).
      return { type: 'HOLD' };
    }
    return { type: 'MOVE', move: pickMove(state, moves, difficulty, rng) };
  }

  // gameOver 등: 호출되지 않아야 하지만 방어적으로 HOLD.
  return { type: 'HOLD' };
}
