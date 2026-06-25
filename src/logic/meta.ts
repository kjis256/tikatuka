/**
 * 승부사 모드 (메타/진행 시스템) — 순수 함수.
 *
 * 단판 게임 로직과 분리된 상위 진행 시스템. 게임 1판 결과를 받아 메타 상태
 * (실링/TP/연승/레벨)를 갱신한다.
 *
 * 규칙 원천: tikatuka_spec.md §8, §7.3.
 */
import type { Difficulty, GameState, MetaState, Player } from './types';
import { BET_REWARD } from './engine';

// ===== 상수 (스펙 §8) =====
export const ENTRY_FEE = 1000; // 대전료 (실링)
export const WIN_TP = 200; // 승리 TP
export const LOSE_TP = 100; // 패배 TP (차감)
export const STREAK_BONUS_TP = 100; // 2연승+ 보너스
export const STREAK_THRESHOLD = 2; // 연승 보너스 발동 기준
export const MAX_LEVEL = 10;
export const TP_PER_LEVEL = 1000; // 레벨당 TP 폭 [가정]

/** 상위 상대(★3~5) 격파 보너스 TP. ★3=100, ★4=200, ★5=300. (스펙 §8) */
export function upsetBonus(difficulty: Difficulty): number {
  return difficulty >= 3 ? (difficulty - 2) * 100 : 0;
}

/** TP 기반 레벨 (1..10). 음수 TP 는 1레벨. [가정: TP 1000당 1레벨] */
export function levelForTp(tp: number): number {
  if (tp <= 0) return 1;
  const lvl = Math.floor(tp / TP_PER_LEVEL) + 1;
  return Math.min(lvl, MAX_LEVEL);
}

export interface MatchResult {
  /** 단판 결과 (judge 결과). */
  outcome: Player | 'draw';
  /** 상대 난이도 (상위 상대 격파 보너스용). */
  difficulty: Difficulty;
  /** 티카투카(베팅)를 선언한 측 (있으면). */
  tikatukaDeclared: Player | null;
}

/**
 * 한 판 결과를 메타 상태에 반영한 새 메타를 반환.
 *
 * 적용 순서:
 *  1) 대전료 -1000 실링
 *  2) 승: +200 TP, 패: -100 TP, 무: 변화 없음
 *  3) 연승: 승리 시 winStreak+1, 그 결과가 2 이상이면 +100 TP. 패/무는 streak 0.
 *  4) 상위 상대(★3~5) 격파(승리) 시 +100~300 TP
 *  5) 티카투카: 'me' 가 선언했고 'me' 승리면 +400 TP. (선언 시 -200 은 applySpecial 에서 이미 차감)
 *  6) 레벨 = levelForTp(최종 TP)
 *
 * 참고: 무승부의 연승 처리는 스펙 미정 → 보수적으로 streak 리셋. [가정]
 */
export function applyMatchResult(meta: MetaState, result: MatchResult): MetaState {
  const next: MetaState = { ...meta };
  next.shilling -= ENTRY_FEE;

  const win = result.outcome === 'me';
  const lose = result.outcome === 'opponent';

  if (win) {
    next.tp += WIN_TP;
    next.winStreak = meta.winStreak + 1;
    if (next.winStreak >= STREAK_THRESHOLD) next.tp += STREAK_BONUS_TP;
    next.tp += upsetBonus(result.difficulty);
    if (result.tikatukaDeclared === 'me') next.tp += BET_REWARD;
  } else if (lose) {
    next.tp -= LOSE_TP;
    next.winStreak = 0;
  } else {
    // 무승부
    next.winStreak = 0;
  }

  next.level = levelForTp(next.tp);
  return next;
}

/**
 * 게임 종료 상태(GameState)로부터 메타 결산을 적용한 새 GameState.
 * meta 가 null 이면(단판) 그대로 반환. phase 가 gameOver 가 아니면 그대로 반환.
 */
export function settleMeta(state: GameState): GameState {
  if (state.meta === null || state.phase !== 'gameOver' || state.winner === null) return state;
  const result: MatchResult = {
    outcome: state.winner,
    difficulty: state.difficulty,
    tikatukaDeclared: state.tikatukaDeclared,
  };
  return { ...state, meta: applyMatchResult(state.meta, result) };
}
