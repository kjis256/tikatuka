/**
 * 티카투카 규칙 엔진 — 턴 진행 상태머신 + 행동 적용 (순수 함수, RNG 주입).
 *
 * 모든 함수는 GameState 를 받아 "새" GameState 를 반환한다(불변성). 입력을 변이하지 않는다.
 * 굴림은 인자로 받은 rng 를 통해서만 한다.
 *
 * 규칙 원천: tikatuka_spec.md  /  계약: _workspace/01_contract.md  /  타입: ./types.ts
 *
 * 상태머신:
 *   rolling --ROLL--> placing --(place)--> [점수] --턴교대--> rolling
 *                            \--(kkagi)--> placingBonus --(배치)--> 턴종료 --> rolling
 *   placing --REROLL--> placing(alt 세팅) --CHOOSE--> placing(단일 die)
 *   양측 holds / 양측 더 둘 수 없음 / 18칸 충전 --> gameOver
 */
import type {
  Die,
  DiceValue,
  Difficulty,
  GameState,
  Move,
  Player,
  Row,
  RowIndex,
  Rng,
  SpecialAction,
} from './types';
import { rollDie } from './rng';
import { judge } from './scoring';

// ===== 상수 =====
export const ROW_COUNT = 3;
export const SLOTS_PER_SIDE = 3; // 줄당 한 쪽 칸 수
export const MAX_DICE_PER_PLAYER = 9; // 3줄 × 3칸
export const TOTAL_SLOTS = 18; // 양측 합산
export const BETTING_THRESHOLD = 10; // 합산 배치 10개부터 베팅 윈도우
export const BETTING_TURNS = 3; // 윈도우 지속 턴 수
export const BET_COST = 200; // 티카투카 선언 시 TP 차감
export const BET_REWARD = 400; // 선언 후 승리 시 TP 획득

const ROW_INDICES: readonly RowIndex[] = [0, 1, 2];

// ===== 내부 헬퍼 (불변 보드 조작) =====
const sideKey = (p: Player): 'myDice' | 'oppDice' => (p === 'me' ? 'myDice' : 'oppDice');
const sideOf = (row: Row, p: Player): Die[] => (p === 'me' ? row.myDice : row.oppDice);
const other = (p: Player): Player => (p === 'me' ? 'opponent' : 'me');

const cloneRows = (rows: GameState['rows']): GameState['rows'] =>
  [
    { index: rows[0].index, myDice: [...rows[0].myDice], oppDice: [...rows[0].oppDice] },
    { index: rows[1].index, myDice: [...rows[1].myDice], oppDice: [...rows[1].oppDice] },
    { index: rows[2].index, myDice: [...rows[2].myDice], oppDice: [...rows[2].oppDice] },
  ] as GameState['rows'];

const clone = (s: GameState): GameState => ({
  ...s,
  rows: cloneRows(s.rows),
  rerollUsed: { ...s.rerollUsed },
  holds: { ...s.holds },
  bettingWindow: { ...s.bettingWindow },
  meta: s.meta ? { ...s.meta } : null,
  log: [...s.log],
});

const emptySlotsFor = (s: GameState, p: Player): number => {
  let n = 0;
  for (const r of s.rows) n += SLOTS_PER_SIDE - sideOf(r, p).length;
  return n;
};

const totalPlaced = (s: GameState): number => {
  let n = 0;
  for (const r of s.rows) n += r.myDice.length + r.oppDice.length;
  return n;
};

/** 한 플레이어가 이번 게임에서 더 둘 수 있는가 (홀드 안 했고 자기 빈칸이 있음). */
const canAct = (s: GameState, p: Player): boolean => !s.holds[p] && emptySlotsFor(s, p) > 0;

// ===== createGame =====
export interface CreateGameOptions {
  difficulty?: Difficulty;
  withMeta?: boolean;
  rng?: Rng;
  /** 테스트/명시적 선공 지정. 미지정 시 rng 로 랜덤 결정. */
  firstPlayer?: Player;
}

const emptyRow = (index: RowIndex): Row => ({ index, myDice: [], oppDice: [] });

/**
 * 새 게임 상태 생성. 선공은 firstPlayer 지정값, 없으면 rng 로 랜덤 결정.
 * phase 는 'rolling' 으로 시작한다 (선공이 첫 주사위를 굴린다).
 */
export function createGame(opts: CreateGameOptions = {}): GameState {
  const difficulty: Difficulty = opts.difficulty ?? 1;
  const rng = opts.rng;
  const firstPlayer: Player =
    opts.firstPlayer ?? (rng && rng() < 0.5 ? 'me' : rng ? 'opponent' : 'me');

  return {
    rows: [emptyRow(0), emptyRow(1), emptyRow(2)],
    currentTurn: firstPlayer,
    phase: 'rolling',
    pending: null,
    pendingBonus: null,
    firstPlayer,
    rerollUsed: { me: false, opponent: false },
    holds: { me: false, opponent: false },
    tikatukaDeclared: null,
    bettingWindow: { open: false, turnsLeft: 0 },
    placedCount: 0,
    turnCount: 0,
    difficulty,
    meta: opts.withMeta ? { shilling: 0, tp: 0, level: 1, winStreak: 0 } : null,
    winner: null,
    log: [],
  };
}

// ===== 베팅 윈도우 =====
/**
 * 베팅(티카투카 선언) 가능 여부.
 * 조건: 양 필드 합산 10개 이상 배치된 시점부터 3턴간, 아직 누구도 선언 안 함,
 *       게임 진행 중. (스펙 §7.3)
 */
export function isBettingOpen(state: GameState): boolean {
  return (
    state.phase !== 'gameOver' &&
    state.tikatukaDeclared === null &&
    state.bettingWindow.open &&
    state.bettingWindow.turnsLeft > 0
  );
}

/** 합산 배치 수가 임계치에 처음 도달하면 윈도우를 연다 (배치 직후 호출). */
function maybeOpenBettingWindow(s: GameState): void {
  if (!s.bettingWindow.open && s.placedCount >= BETTING_THRESHOLD) {
    s.bettingWindow.open = true;
    s.bettingWindow.turnsLeft = BETTING_TURNS;
    s.log.push(`베팅 윈도우 열림 (합산 ${s.placedCount}개)`);
  }
}

// ===== 종료 판정 =====
/**
 * 게임 종료 여부 (계산만, 상태 변경 없음).
 * - 양측 18칸 충전
 * - 양측 모두 홀드
 * - 양측 모두 더 둘 수 없음 (홀드 or 자기 빈칸 없음)
 */
export function isGameOver(state: GameState): boolean {
  if (state.phase === 'gameOver') return true;
  if (totalPlaced(state) >= TOTAL_SLOTS) return true;
  if (state.holds.me && state.holds.opponent) return true;
  return !canAct(state, 'me') && !canAct(state, 'opponent');
}

/** 종료 조건이면 phase=gameOver, winner 확정. 아니면 그대로 반환. */
function finalizeIfOver(s: GameState): GameState {
  if (s.phase === 'gameOver') return s;
  if (isGameOver(s)) {
    s.phase = 'gameOver';
    s.pending = null;
    s.pendingBonus = null;
    s.winner = judge(s);
    s.log.push(`게임 종료: ${s.winner}`);
  }
  return s;
}

// ===== 턴 교대 =====
/**
 * 다음 행동 가능한 플레이어에게 턴을 넘기고 phase='rolling' 로.
 * 홀드/빈칸없음인 플레이어는 건너뛴다. 아무도 못 두면 종료.
 * turnCount 증가 및 베팅 윈도우 카운트다운 처리.
 */
function advanceTurn(s: GameState): GameState {
  s.pending = null;
  s.pendingBonus = null;

  // 베팅 윈도우: 이미 열려 있으면 한 턴 소비
  if (s.bettingWindow.open && s.bettingWindow.turnsLeft > 0) {
    s.bettingWindow.turnsLeft -= 1;
    if (s.bettingWindow.turnsLeft === 0) {
      s.bettingWindow.open = false;
      s.log.push('베팅 윈도우 닫힘');
    }
  }

  s.turnCount += 1;

  // 이번 턴의 배치로 합산 10개에 도달했으면 윈도우를 연다 (다음 턴부터 3턴간).
  maybeOpenBettingWindow(s);

  const next = other(s.currentTurn);
  if (canAct(s, next)) {
    s.currentTurn = next;
    s.phase = 'rolling';
    return s;
  }
  // 상대가 못 두면, 현재 플레이어가 계속 (홀드 비대칭 진행: 스펙 §6.1)
  if (canAct(s, s.currentTurn)) {
    s.phase = 'rolling';
    return s;
  }
  // 양측 모두 못 둠 → 종료
  return finalizeIfOver(s);
}

// ===== 굴림 / 타짜의 손놀림 =====
/**
 * 선공 측의 게임 첫 주사위인가? (그 주사위는 실드로 제공된다 — 스펙 §5)
 * 판정: 아직 아무도 배치 안 했고(placedCount===0), 현재 턴이 선공이며 첫 턴.
 */
function isFirstShieldRoll(s: GameState): boolean {
  return s.placedCount === 0 && s.turnCount === 0 && s.currentTurn === s.firstPlayer;
}

/**
 * 주사위 1개를 굴려 pending 에 세팅. phase 'rolling' → 'placing'.
 * 선공 첫 주사위는 isShield:true.
 */
export function rollPending(state: GameState, rng: Rng): GameState {
  if (state.phase !== 'rolling') return state;
  const s = clone(state);
  const shield = isFirstShieldRoll(s);
  const die: Die = { value: rollDie(rng), isShield: shield };
  s.pending = { die, alt: null };
  s.phase = 'placing';
  s.log.push(`굴림: ${die.value}${shield ? ' (실드)' : ''}`);
  return s;
}

/**
 * 타짜의 손놀림: 대안 주사위 1개를 더 굴려 pending.alt 에 세팅 (게임당 1회).
 * 이미 사용했거나 placing 단계가 아니거나 이미 alt 가 있으면 무시.
 */
export function reroll(state: GameState, rng: Rng): GameState {
  if (state.phase !== 'placing' || state.pending === null) return state;
  if (state.rerollUsed[state.currentTurn]) return state;
  if (state.pending.alt !== null) return state;
  const s = clone(state);
  // alt 도 동일한 실드 속성을 잇는다 (첫 주사위 실드 보장)
  const shield = s.pending!.die.isShield;
  const alt: Die = { value: rollDie(rng), isShield: shield };
  s.pending = { die: s.pending!.die, alt };
  s.rerollUsed[s.currentTurn] = true;
  s.log.push(`타짜의 손놀림: ${alt.value}`);
  return s;
}

/** 두 굴림 결과 중 하나를 선택해 pending 을 단일 die 로 확정. */
export function chooseRoll(state: GameState, which: 'die' | 'alt'): GameState {
  if (state.phase !== 'placing' || state.pending === null) return state;
  const chosen = which === 'die' ? state.pending.die : state.pending.alt;
  if (chosen === null) return state;
  const s = clone(state);
  s.pending = { die: chosen, alt: null };
  s.log.push(`선택: ${chosen.value}`);
  return s;
}

// ===== 합법수 / 알까기 판정 =====
/** 내부: (값, 공격자, 줄)로 알까기 가능 여부. */
function canKkagiAt(s: GameState, value: DiceValue, attacker: Player, rowIndex: RowIndex): boolean {
  const defender = other(attacker);
  const row = s.rows[rowIndex];
  const hasTarget = sideOf(row, defender).some((d) => d.value === value && !d.isShield);
  // 공격자 자신의 해당 줄에 빈 칸이 있어야 발동 (보너스 배치 공간 — 스펙 §4.1, 자기 줄 한정).
  const ownRowHasSpace = sideOf(row, attacker).length < SLOTS_PER_SIDE;
  return hasTarget && ownRowHasSpace;
}

/**
 * 현재 pending 주사위로 그 줄에서 알까기가 가능한가 (계약 시그니처).
 * 조건: 상대 그 줄에 같은 눈 비보호 주사위 존재 + 어딘가 빈칸 존재.
 */
export function canKkagi(state: GameState, rowIndex: RowIndex): boolean {
  if (state.phase !== 'placing' || state.pending === null) return false;
  return canKkagiAt(state, state.pending.die.value, state.currentTurn, rowIndex);
}

/**
 * 현재 pending 주사위로 가능한 모든 합법수.
 * - place: 현재 플레이어의 빈칸이 있는 줄마다
 * - kkagi: 알까기 조건을 만족하는 줄마다
 */
export function getLegalMoves(state: GameState): Move[] {
  if (state.phase !== 'placing' || state.pending === null) return [];
  const value = state.pending.die.value;
  const me = state.currentTurn;
  const moves: Move[] = [];
  for (const i of ROW_INDICES) {
    if (sideOf(state.rows[i], me).length < SLOTS_PER_SIDE) {
      moves.push({ kind: 'place', rowIndex: i });
    }
    if (canKkagiAt(state, value, me, i)) {
      moves.push({ kind: 'kkagi', rowIndex: i });
    }
  }
  return moves;
}

// ===== 행동 적용 =====
/**
 * place 또는 kkagi 실행.
 * - place: pending 주사위를 현재 플레이어의 그 줄에 배치 → 점수 갱신 → 턴 교대.
 * - kkagi: 그 줄의 상대 같은 눈 비보호 주사위 전부 제거 → 던진 주사위 소모 →
 *          보너스(실드) 1개를 뽑아 pendingBonus 로 두고 phase='placingBonus'.
 *          (보너스 배치는 placeBonus 로 별도 호출 → 즉시 턴 종료.)
 * rng 는 알까기 보너스 굴림에만 사용된다.
 */
export function applyMove(state: GameState, move: Move, rng: Rng): GameState {
  if (state.phase !== 'placing' || state.pending === null) return state;
  const me = state.currentTurn;
  const value = state.pending.die.value;

  if (move.kind === 'place') {
    if (sideOf(state.rows[move.rowIndex], me).length >= SLOTS_PER_SIDE) return state;
    const s = clone(state);
    const key = sideKey(me);
    s.rows[move.rowIndex][key] = [...s.rows[move.rowIndex][key], { ...s.pending!.die }];
    s.placedCount += 1;
    s.log.push(`${me} 배치: ${value} → ${move.rowIndex}줄`);
    return advanceTurn(s);
  }

  // kkagi
  if (!canKkagiAt(state, value, me, move.rowIndex)) return state;
  const s = clone(state);
  const defender = other(me);
  const dkey = sideKey(defender);
  const before = s.rows[move.rowIndex][dkey].length;
  s.rows[move.rowIndex][dkey] = s.rows[move.rowIndex][dkey].filter(
    (d) => !(d.value === value && !d.isShield),
  );
  const removed = before - s.rows[move.rowIndex][dkey].length;
  s.log.push(`${me} 알까기: ${move.rowIndex}줄 ${value} ${removed}개 제거`);
  // 던진 주사위 소모 + 보너스(실드) 뽑기
  s.pending = null;
  s.pendingBonus = { value: rollDie(rng), isShield: true };
  s.phase = 'placingBonus';
  s.log.push(`보너스(실드) 뽑음: ${s.pendingBonus.value}`);
  return s;
}

/**
 * 알까기 보너스(실드) 주사위를 양 필드 중 한 곳의 빈칸에 배치. 배치 즉시 턴 종료.
 * field: 'me' | 'opponent' (보너스는 양 필드 자유 배치 — 스펙 §4.2)
 */
export function placeBonus(state: GameState, field: Player, rowIndex: RowIndex): GameState {
  if (state.phase !== 'placingBonus' || state.pendingBonus === null) return state;
  if (sideOf(state.rows[rowIndex], field).length >= SLOTS_PER_SIDE) return state;
  const s = clone(state);
  const key = sideKey(field);
  s.rows[rowIndex][key] = [...s.rows[rowIndex][key], { ...s.pendingBonus! }];
  s.placedCount += 1;
  s.log.push(`보너스 배치: ${field} ${rowIndex}줄 (실드 ${s.pendingBonus!.value})`);
  s.pendingBonus = null;
  return advanceTurn(s); // 즉시 턴 종료
}

// ===== 특수 행동 =====
/**
 * hold / bet 적용. (reroll 은 전용 함수 reroll() 사용.)
 * - hold: 현재 플레이어가 더 이상 두지 않음. 양측 홀드면 즉시 종료. 아니면 턴 교대.
 * - bet : 티카투카 선언. isBettingOpen 일 때만. 메타 있으면 TP -200 즉시 차감.
 *         (승리 시 +400 은 종료 시 메타 결산에서 처리.)
 */
export function applySpecial(state: GameState, action: SpecialAction): GameState {
  if (action.kind === 'reroll') return state; // reroll 은 전용 함수로 (rng 필요)

  if (action.kind === 'hold') {
    if (state.phase === 'gameOver') return state;
    const s = clone(state);
    s.holds[s.currentTurn] = true;
    s.log.push(`${s.currentTurn} 홀드`);
    if (s.holds.me && s.holds.opponent) {
      return finalizeIfOver(s); // 양측 홀드 → 즉시 계산·종료
    }
    // 홀드한 플레이어는 더 안 둠 → 다음으로 넘김 (pending 폐기)
    return advanceTurn(s);
  }

  // bet (티카투카 선언)
  if (!isBettingOpen(state)) return state;
  const s = clone(state);
  s.tikatukaDeclared = s.currentTurn;
  if (s.meta) s.meta.tp -= BET_COST;
  s.bettingWindow.open = false;
  s.bettingWindow.turnsLeft = 0;
  s.log.push(`${s.currentTurn} 티카투카 선언 (-${BET_COST} TP)`);
  return s;
}
