import { describe, expect, it } from 'vitest';
import {
  applyMatchResult,
  ENTRY_FEE,
  levelForTp,
  settleMeta,
  upsetBonus,
} from './meta';
import type { MetaState } from './types';
import { makeState, row, d } from './testUtils';

const base = (over: Partial<MetaState> = {}): MetaState => ({
  shilling: 10000,
  tp: 0,
  level: 1,
  winStreak: 0,
  ...over,
});

describe('승부사 모드 메타', () => {
  it('대전료 -1000 실링 매판 차감', () => {
    const m = applyMatchResult(base(), { outcome: 'draw', difficulty: 1, tikatukaDeclared: null });
    expect(m.shilling).toBe(10000 - ENTRY_FEE);
  });

  it('승리 +200 TP', () => {
    const m = applyMatchResult(base(), { outcome: 'me', difficulty: 1, tikatukaDeclared: null });
    expect(m.tp).toBe(200);
    expect(m.winStreak).toBe(1);
  });

  it('패배 -100 TP, 연승 리셋', () => {
    const m = applyMatchResult(base({ tp: 500, winStreak: 3 }), {
      outcome: 'opponent',
      difficulty: 1,
      tikatukaDeclared: null,
    });
    expect(m.tp).toBe(400);
    expect(m.winStreak).toBe(0);
  });

  it('2연승 → +100 보너스 (승리200 + 보너스100 = 300)', () => {
    const m = applyMatchResult(base({ winStreak: 1 }), {
      outcome: 'me',
      difficulty: 1,
      tikatukaDeclared: null,
    });
    expect(m.winStreak).toBe(2);
    expect(m.tp).toBe(300);
  });

  it('상위 상대(★3~5) 격파 보너스', () => {
    expect(upsetBonus(1)).toBe(0);
    expect(upsetBonus(2)).toBe(0);
    expect(upsetBonus(3)).toBe(100);
    expect(upsetBonus(4)).toBe(200);
    expect(upsetBonus(5)).toBe(300);
    // ★5 격파: 승리200 + 격파300 = 500
    const m = applyMatchResult(base(), { outcome: 'me', difficulty: 5, tikatukaDeclared: null });
    expect(m.tp).toBe(500);
  });

  it('티카투카 선언 후 승리 → +400 (선언 시 -200 은 별도)', () => {
    // 선언 시 이미 -200 차감된 상태(tp=-200)에서 승리 결산
    const m = applyMatchResult(base({ tp: -200 }), {
      outcome: 'me',
      difficulty: 1,
      tikatukaDeclared: 'me',
    });
    // -200 + 200(승리) + 400(선언승리) = 400 → 순효과 +200(=400 보상-200 비용)
    expect(m.tp).toBe(400);
  });

  it('레벨: TP 기반, 최대 10', () => {
    expect(levelForTp(0)).toBe(1);
    expect(levelForTp(-50)).toBe(1);
    expect(levelForTp(1000)).toBe(2);
    expect(levelForTp(9500)).toBe(10);
    expect(levelForTp(999999)).toBe(10);
  });

  it('settleMeta: gameOver 상태에서 메타 결산 적용', () => {
    let s = makeState({
      rows: [row(0, [d(6)], [d(1)]), row(1, [d(6)], [d(1)]), row(2, [d(1)], [d(6)])],
    });
    s = {
      ...s,
      phase: 'gameOver',
      winner: 'me',
      meta: base(),
      difficulty: 3,
    };
    const settled = settleMeta(s);
    // 승리200 + ★3격파100 = 300
    expect(settled.meta?.tp).toBe(300);
    expect(settled.meta?.shilling).toBe(10000 - ENTRY_FEE);
  });

  it('settleMeta: meta 없으면 그대로', () => {
    const s = makeState();
    expect(settleMeta({ ...s, phase: 'gameOver', winner: 'draw' })).toEqual({
      ...s,
      phase: 'gameOver',
      winner: 'draw',
    });
  });
});
