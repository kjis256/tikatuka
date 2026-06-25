/**
 * 테스트 전용 헬퍼 (런타임 의존성 아님). 결정적 시드 RNG, 주사위/줄 빌더.
 */
import type { Die, DiceValue, GameState, Player, Row, Rng, RowIndex } from './types';
import { mulberry32 } from './rng';

/** 일반(비보호) 주사위. */
export const d = (value: DiceValue): Die => ({ value, isShield: false });
/** 실드(보호) 주사위. */
export const sd = (value: DiceValue): Die => ({ value, isShield: true });

/** 시드 고정 RNG. */
export const seeded = (seed = 1): Rng => mulberry32(seed);

/** 항상 같은 값을 내는 RNG (rollDie 가 value 를 내도록). */
export const fixedRng = (value: DiceValue): Rng => {
  // rollDie = (rng()*6|0)+1 → value 를 내려면 rng()*6 in [value-1, value)
  const r = (value - 1 + 0.5) / 6;
  return () => r;
};

/** 빈 줄 셋. */
export const emptyRows = (): GameState['rows'] => [
  { index: 0, myDice: [], oppDice: [] },
  { index: 1, myDice: [], oppDice: [] },
  { index: 2, myDice: [], oppDice: [] },
];

interface MakeStateOpts {
  rows?: GameState['rows'];
  currentTurn?: Player;
  firstPlayer?: Player;
  pendingDie?: Die;
  phase?: GameState['phase'];
}

/** 테스트용 GameState 빌더 (필요한 필드만 덮어쓰기). */
export function makeState(opts: MakeStateOpts = {}): GameState {
  const rows = opts.rows ?? emptyRows();
  const placedCount = rows.reduce((n, r) => n + r.myDice.length + r.oppDice.length, 0);
  return {
    rows,
    currentTurn: opts.currentTurn ?? 'me',
    phase: opts.phase ?? (opts.pendingDie ? 'placing' : 'rolling'),
    pending: opts.pendingDie ? { die: opts.pendingDie, alt: null } : null,
    pendingBonus: null,
    firstPlayer: opts.firstPlayer ?? 'me',
    rerollUsed: { me: false, opponent: false },
    holds: { me: false, opponent: false },
    tikatukaDeclared: null,
    bettingWindow: { open: false, turnsLeft: 0 },
    placedCount,
    turnCount: 0,
    difficulty: 1,
    meta: null,
    winner: null,
    log: [],
  };
}

/** 줄 빌더. */
export const row = (index: RowIndex, myDice: Die[], oppDice: Die[]): Row => ({
  index,
  myDice,
  oppDice,
});
