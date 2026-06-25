/**
 * 티카투카 로직 공개 API 배럴.
 * UI / AI / QA 는 이 모듈에서 타입과 함수를 import 한다.
 */
export * from './types';
export { mulberry32, rollDie } from './rng';
export { calcRowScore, getRowScores, judge, scoreIfPlaced, emptySlots, hasAnyEmptySlot } from './scoring';
export {
  createGame,
  rollPending,
  reroll,
  chooseRoll,
  getLegalMoves,
  canKkagi,
  applyMove,
  placeBonus,
  applySpecial,
  isBettingOpen,
  isGameOver,
  // 상수
  ROW_COUNT,
  SLOTS_PER_SIDE,
  MAX_DICE_PER_PLAYER,
  TOTAL_SLOTS,
  BETTING_THRESHOLD,
  BETTING_TURNS,
  BET_COST,
  BET_REWARD,
} from './engine';
export type { CreateGameOptions } from './engine';
export {
  applyMatchResult,
  settleMeta,
  upsetBonus,
  levelForTp,
  ENTRY_FEE,
  WIN_TP,
  LOSE_TP,
  STREAK_BONUS_TP,
  STREAK_THRESHOLD,
  MAX_LEVEL,
} from './meta';
export type { MatchResult } from './meta';
