import { describe, expect, it } from 'vitest';
import { calcRowScore, getRowScores, judge, scoreIfPlaced } from './scoring';
import { d, makeState, row, sd } from './testUtils';

describe('calcRowScore — 스펙 §3 worked examples', () => {
  it('빈 줄 → 0', () => {
    expect(calcRowScore([])).toBe(0);
  });
  it('일반 합 [3,5] → 8', () => {
    expect(calcRowScore([d(3), d(5)])).toBe(8);
  });
  it('단일 [5] → 5', () => {
    expect(calcRowScore([d(5)])).toBe(5);
  });
  it('더블 [5,5] → 15 (눈×3)', () => {
    expect(calcRowScore([d(5), d(5)])).toBe(15);
  });
  it('트리플 [5,5,5] → 25 (눈×5)', () => {
    expect(calcRowScore([d(5), d(5), d(5)])).toBe(25);
  });
  it('혼합 [4,4,2] → 14 (더블4 + 단일2)', () => {
    expect(calcRowScore([d(4), d(4), d(2)])).toBe(14);
  });
  it('혼합 [3,3,1] → 10 (더블3 + 단일1)', () => {
    expect(calcRowScore([d(3), d(3), d(1)])).toBe(10);
  });
  it('실드 주사위도 점수 동일: [실드5,5] → 15', () => {
    expect(calcRowScore([sd(5), d(5)])).toBe(15);
  });
  it('트리플 1 [1,1,1] → 5', () => {
    expect(calcRowScore([d(1), d(1), d(1)])).toBe(5);
  });
  it('단일 [6] → 6', () => {
    expect(calcRowScore([d(6)])).toBe(6);
  });
});

describe('calcRowScore — 연속(인접) 런만 보너스', () => {
  it('인접 더블 앞 [5,5,2] → 5×3 + 2 = 17', () => {
    expect(calcRowScore([d(5), d(5), d(2)])).toBe(17);
  });
  it('인접 더블 뒤 [2,5,5] → 2 + 5×3 = 17', () => {
    expect(calcRowScore([d(2), d(5), d(5)])).toBe(17);
  });
  it('비인접 같은 눈 [5,2,5] → 5+2+5 = 12 (보너스 없음)', () => {
    expect(calcRowScore([d(5), d(2), d(5)])).toBe(12);
  });
  it('비인접 같은 눈 [3,1,3] → 3+1+3 = 7 (보너스 없음)', () => {
    expect(calcRowScore([d(3), d(1), d(3)])).toBe(7);
  });
  it('실드 여부 무관, 값만 판정: [실드5,5,2] → 17', () => {
    expect(calcRowScore([sd(5), d(5), d(2)])).toBe(17);
  });
  it('비인접인데 사이 실드라도 보너스 없음: [5,실드2,5] → 12', () => {
    expect(calcRowScore([d(5), sd(2), d(5)])).toBe(12);
  });
});

describe('getRowScores — 화살표 리더', () => {
  it('각 줄 리더 방향', () => {
    const s = makeState({
      rows: [
        row(0, [d(6)], [d(1)]), // me 우세
        row(1, [d(1)], [d(6)]), // opp 우세
        row(2, [d(3)], [d(3)]), // 동점
      ],
    });
    const rs = getRowScores(s);
    expect(rs[0].leader).toBe('me');
    expect(rs[1].leader).toBe('opponent');
    expect(rs[2].leader).toBe(null);
    expect(rs[0].myScore).toBe(6);
    expect(rs[1].oppScore).toBe(6);
  });
});

describe('judge — 스펙 §6.2 (줄수 → 총합 → 무승부)', () => {
  it('줄 수 우위: me 2줄 승', () => {
    const s = makeState({
      rows: [
        row(0, [d(6)], [d(1)]), // me
        row(1, [d(6)], [d(1)]), // me
        row(2, [d(1)], [d(6)]), // opp
      ],
    });
    expect(judge(s)).toBe('me');
  });

  it('줄 수 동점 → 총합으로 결정 (opp 총합 우세)', () => {
    const s = makeState({
      rows: [
        row(0, [d(6)], [d(1)]), // me +5
        row(1, [d(1)], [d(6)]), // opp +5
        row(2, [d(1)], [d(2)]), // opp +1 (동점 1:1 → 총합: me 8 vs opp 9)
      ],
    });
    // me total = 6+1+1=8, opp total = 1+6+2=9 → opp
    expect(judge(s)).toBe('opponent');
  });

  it('줄 수 동점 + 총합 동점 → 무승부', () => {
    const s = makeState({
      rows: [
        row(0, [d(6)], [d(2)]), // me
        row(1, [d(2)], [d(6)]), // opp
        row(2, [d(3)], [d(3)]), // 동점
      ],
    });
    // 줄수 1:1, 총합 me 11 vs opp 11
    expect(judge(s)).toBe('draw');
  });

  it('완전 빈 보드 → 무승부', () => {
    expect(judge(makeState())).toBe('draw');
  });
});

describe('scoreIfPlaced — AI 평가 보조', () => {
  it('place: 더블 완성 시 점수', () => {
    const s = makeState({
      rows: [row(0, [d(4)], []), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(4),
    });
    expect(scoreIfPlaced(s, { kind: 'place', rowIndex: 0 })).toBe(12); // 4,4 → 12
  });

  it('kkagi: 상대 줄에서 같은 눈 제거 후 상대 줄 점수', () => {
    const s = makeState({
      rows: [row(0, [], [d(2), d(2), d(5)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    // 상대 줄에서 2,2 제거 → [5] → 5
    expect(scoreIfPlaced(s, { kind: 'kkagi', rowIndex: 0 })).toBe(5);
  });
});
