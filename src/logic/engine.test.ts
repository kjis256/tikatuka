import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applySpecial,
  canKkagi,
  chooseRoll,
  createGame,
  getLegalMoves,
  isBettingOpen,
  isGameOver,
  placeBonus,
  reroll,
  rollPending,
} from './engine';
import { d, fixedRng, makeState, row, sd } from './testUtils';

describe('createGame', () => {
  it('빈 보드, rolling 단계로 시작', () => {
    const s = createGame({ firstPlayer: 'me' });
    expect(s.phase).toBe('rolling');
    expect(s.currentTurn).toBe('me');
    expect(s.firstPlayer).toBe('me');
    expect(s.placedCount).toBe(0);
    expect(s.rows.every((r) => r.myDice.length === 0 && r.oppDice.length === 0)).toBe(true);
  });
  it('withMeta → meta 초기화, 아니면 null', () => {
    expect(createGame({ withMeta: true }).meta).not.toBeNull();
    expect(createGame().meta).toBeNull();
  });
});

describe('rollPending — 선공 첫 주사위는 실드', () => {
  it('선공 첫 굴림은 isShield:true', () => {
    const s = rollPending(createGame({ firstPlayer: 'me' }), fixedRng(3));
    expect(s.phase).toBe('placing');
    expect(s.pending?.die).toEqual({ value: 3, isShield: true });
  });
  it('이후 굴림은 일반 주사위', () => {
    let s = rollPending(createGame({ firstPlayer: 'me' }), fixedRng(3));
    s = applyMove(s, { kind: 'place', rowIndex: 0 }, fixedRng(1)); // 턴 교대 → opp
    s = rollPending(s, fixedRng(4));
    expect(s.pending?.die).toEqual({ value: 4, isShield: false });
  });
});

describe('reroll / chooseRoll — 타짜의 손놀림 (게임당 1회)', () => {
  it('alt 굴림 후 선택 가능', () => {
    let s = rollPending(createGame({ firstPlayer: 'me' }), fixedRng(2));
    s = reroll(s, fixedRng(6));
    expect(s.pending?.die.value).toBe(2);
    expect(s.pending?.alt?.value).toBe(6);
    s = chooseRoll(s, 'alt');
    expect(s.pending?.die.value).toBe(6);
    expect(s.pending?.alt).toBeNull();
  });
  it('두 번째 reroll 은 거부 (rerollUsed)', () => {
    let s = rollPending(createGame({ firstPlayer: 'me' }), fixedRng(2));
    s = reroll(s, fixedRng(6));
    const before = s.pending?.alt?.value;
    const s2 = reroll(s, fixedRng(1)); // 이미 alt 있고 rerollUsed → 무시
    expect(s2.pending?.alt?.value).toBe(before);
    expect(s2.rerollUsed.me).toBe(true);
  });
  it('reroll 한 번 쓰면 다음 턴 같은 게임에서 또 못 씀', () => {
    let s = rollPending(createGame({ firstPlayer: 'me' }), fixedRng(2));
    s = reroll(s, fixedRng(6));
    s = chooseRoll(s, 'die');
    s = applyMove(s, { kind: 'place', rowIndex: 0 }, fixedRng(1)); // opp 턴
    s = applyMove(rollPending(s, fixedRng(1)), { kind: 'place', rowIndex: 0 }, fixedRng(1)); // 다시 me 턴
    s = rollPending(s, fixedRng(3));
    const tried = reroll(s, fixedRng(5));
    expect(tried.pending?.alt).toBeNull(); // me 는 이미 사용 → 거부
  });
});

describe('getLegalMoves / canKkagi', () => {
  it('빈 보드: 세 줄 모두 place 가능, kkagi 없음', () => {
    const s = makeState({ currentTurn: 'me', pendingDie: d(3) });
    const moves = getLegalMoves(s);
    expect(moves.filter((m) => m.kind === 'place')).toHaveLength(3);
    expect(moves.filter((m) => m.kind === 'kkagi')).toHaveLength(0);
  });

  it('상대 같은 눈 비보호 → 그 줄 kkagi 합법수 + canKkagi true', () => {
    const s = makeState({
      rows: [row(0, [], [d(2)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(true);
    expect(canKkagi(s, 1)).toBe(false);
    expect(getLegalMoves(s).some((m) => m.kind === 'kkagi' && m.rowIndex === 0)).toBe(true);
  });

  it('실드 주사위는 알까기 대상 아님', () => {
    const s = makeState({
      rows: [row(0, [], [sd(2)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(false);
  });

  it('빈칸 없으면 알까기 발동 불가', () => {
    // 모든 18칸을 채우되 상대 0번줄에 비보호 2 포함 → 빈칸 0
    const s = makeState({
      rows: [
        row(0, [d(1), d(1), d(1)], [d(2), d(2), d(2)]),
        row(1, [d(1), d(1), d(1)], [d(3), d(3), d(3)]),
        row(2, [d(1), d(1), d(1)], [d(4), d(4), d(4)]),
      ],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(false);
  });

  it('자기 줄이 가득(3개)이면 상대에 비보호 같은 눈 있어도 발동 불가', () => {
    // 공격자(me)의 0번 줄이 3개로 가득 → 그 줄 알까기 불가. 다른 줄엔 빈칸 있음.
    const s = makeState({
      rows: [
        row(0, [d(5), d(5), d(5)], [d(2)]), // me 0줄 가득, 상대 0줄에 비보호 2
        row(1, [], []),
        row(2, [], []),
      ],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(false);
    expect(getLegalMoves(s).some((m) => m.kind === 'kkagi' && m.rowIndex === 0)).toBe(false);
  });

  it('자기 줄에 빈칸이 있으면 발동 가능', () => {
    const s = makeState({
      rows: [
        row(0, [d(5), d(5)], [d(2)]), // me 0줄 2개(빈칸 1), 상대 0줄에 비보호 2
        row(1, [], []),
        row(2, [], []),
      ],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(true);
    expect(getLegalMoves(s).some((m) => m.kind === 'kkagi' && m.rowIndex === 0)).toBe(true);
  });

  it('다른 줄이 가득해도 대상 줄 자기측에 공간 있으면 발동 가능', () => {
    // me의 1·2줄은 가득, 0줄은 비어 있음(공간 있음) → 0줄 알까기 가능.
    const s = makeState({
      rows: [
        row(0, [], [d(2)]), // me 0줄 빈칸, 상대 0줄 비보호 2
        row(1, [d(1), d(1), d(1)], []), // me 1줄 가득
        row(2, [d(1), d(1), d(1)], []), // me 2줄 가득
      ],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    expect(canKkagi(s, 0)).toBe(true);
    expect(getLegalMoves(s).some((m) => m.kind === 'kkagi' && m.rowIndex === 0)).toBe(true);
  });
});

describe('applyMove — 알까기 실행', () => {
  it('한 줄의 같은 눈 비보호 다중을 전부 제거, 다른 줄 불변', () => {
    const s = makeState({
      rows: [
        row(0, [], [d(2), d(2), d(5)]), // 0줄: 2 두개 + 5
        row(1, [], [d(2)]), // 1줄: 2 한개 (영향 없어야)
        row(2, [], []),
      ],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    const next = applyMove(s, { kind: 'kkagi', rowIndex: 0 }, fixedRng(6));
    expect(next.rows[0].oppDice.map((x) => x.value)).toEqual([5]); // 2,2 제거
    expect(next.rows[1].oppDice.map((x) => x.value)).toEqual([2]); // 다른 줄 불변
    expect(next.phase).toBe('placingBonus');
    expect(next.pendingBonus).toEqual({ value: 6, isShield: true });
    expect(next.pending).toBeNull();
  });

  it('실드 대상은 제거되지 않음 (혼합)', () => {
    const s = makeState({
      rows: [row(0, [], [d(2), sd(2), d(5)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    const next = applyMove(s, { kind: 'kkagi', rowIndex: 0 }, fixedRng(1));
    // 비보호 2 만 제거, 실드 2 와 5 는 남음
    expect(next.rows[0].oppDice.map((x) => ({ v: x.value, s: x.isShield }))).toEqual([
      { v: 2, s: true },
      { v: 5, s: false },
    ]);
  });
});

describe('placeBonus — 보너스(실드) 배치 → 즉시 턴 종료', () => {
  it('보너스를 양 필드 빈칸에 배치 가능, 배치 후 턴 종료 + 실드', () => {
    let s = makeState({
      rows: [row(0, [], [d(2)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    s = applyMove(s, { kind: 'kkagi', rowIndex: 0 }, fixedRng(4)); // bonus=4
    // 상대 필드(opponent) 1줄에 보너스 배치
    const after = placeBonus(s, 'opponent', 1);
    expect(after.rows[1].oppDice).toEqual([{ value: 4, isShield: true }]);
    expect(after.phase).toBe('rolling'); // 즉시 턴 종료 → 다음 턴 rolling
    expect(after.currentTurn).toBe('opponent'); // me → opponent
    expect(after.pendingBonus).toBeNull();
  });

  it('보너스를 내 필드에도 배치 가능', () => {
    let s = makeState({
      rows: [row(0, [], [d(3)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(3),
    });
    s = applyMove(s, { kind: 'kkagi', rowIndex: 0 }, fixedRng(5));
    const after = placeBonus(s, 'me', 2);
    expect(after.rows[2].myDice).toEqual([{ value: 5, isShield: true }]);
  });

  it('꽉 찬 칸에는 보너스 배치 거부 (상태 불변)', () => {
    let s = makeState({
      rows: [row(0, [], [d(2)]), row(1, [d(1), d(1), d(1)], []), row(2, [], [])],
      currentTurn: 'me',
      pendingDie: d(2),
    });
    s = applyMove(s, { kind: 'kkagi', rowIndex: 0 }, fixedRng(4));
    const after = placeBonus(s, 'me', 1); // 1줄 my 꽉참
    expect(after).toBe(s); // 불변
    expect(after.phase).toBe('placingBonus');
  });
});

describe('상태머신 — 턴 교대', () => {
  it('place 후 상대 턴 rolling 으로 교대', () => {
    let s = makeState({ currentTurn: 'me', pendingDie: d(3) });
    s = applyMove(s, { kind: 'place', rowIndex: 0 }, fixedRng(1));
    expect(s.currentTurn).toBe('opponent');
    expect(s.phase).toBe('rolling');
    expect(s.pending).toBeNull();
    expect(s.rows[0].myDice).toEqual([{ value: 3, isShield: false }]);
    expect(s.placedCount).toBe(1);
  });
});

describe('베팅 윈도우 — 합산 10개부터 3턴', () => {
  it('10개 도달 전 닫힘', () => {
    const s = makeState({
      rows: [row(0, [d(1), d(1), d(1)], [d(2), d(2), d(2)]), row(1, [], []), row(2, [], [])],
    });
    // placedCount=6
    expect(isBettingOpen(s)).toBe(false);
  });

  it('10개 도달 시 열리고, 3턴 후 닫힘', () => {
    // 9개 배치된 상태에서 한 번 더 place → 10개 → 윈도우 open
    let s = makeState({
      rows: [
        row(0, [d(1), d(1), d(1)], [d(2), d(2), d(2)]),
        row(1, [d(1), d(1), d(1)], []),
        row(2, [], []),
      ],
      currentTurn: 'opponent',
      pendingDie: d(3),
    });
    // placedCount=9, opp 가 0번줄? 0번줄 opp 꽉참 → 2번줄에 place
    s = applyMove(s, { kind: 'place', rowIndex: 2 }, fixedRng(1));
    // placedCount=10 → 윈도우 open, turnsLeft=3
    expect(s.bettingWindow.open).toBe(true);
    expect(s.bettingWindow.turnsLeft).toBe(3); // advanceTurn 에서 한 번 차감? 확인 아래
  });

  it('윈도우 카운트다운: 3턴 진행 후 닫힘', () => {
    let s = makeState({
      rows: [row(0, [], []), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
    });
    s = { ...s, bettingWindow: { open: true, turnsLeft: 3 } };
    expect(isBettingOpen(s)).toBe(true);
    // place 3번 → 매번 advanceTurn 에서 turnsLeft 감소
    s = applyMove({ ...s, pending: { die: d(1), alt: null }, phase: 'placing' }, { kind: 'place', rowIndex: 0 }, fixedRng(1));
    expect(s.bettingWindow.turnsLeft).toBe(2);
    s = applyMove({ ...s, pending: { die: d(1), alt: null }, phase: 'placing' }, { kind: 'place', rowIndex: 0 }, fixedRng(1));
    expect(s.bettingWindow.turnsLeft).toBe(1);
    s = applyMove({ ...s, pending: { die: d(1), alt: null }, phase: 'placing' }, { kind: 'place', rowIndex: 0 }, fixedRng(1));
    expect(s.bettingWindow.turnsLeft).toBe(0);
    expect(s.bettingWindow.open).toBe(false);
    expect(isBettingOpen(s)).toBe(false);
  });

  it('bet 선언은 게임당 1회 (이미 선언되면 거부)', () => {
    let s = makeState({ currentTurn: 'me' });
    s = { ...s, bettingWindow: { open: true, turnsLeft: 3 } };
    s = applySpecial(s, { kind: 'bet' });
    expect(s.tikatukaDeclared).toBe('me');
    expect(isBettingOpen(s)).toBe(false); // 선언 후 닫힘
    // opponent 가 또 선언 시도 → 거부
    const s2 = applySpecial({ ...s, currentTurn: 'opponent' }, { kind: 'bet' });
    expect(s2.tikatukaDeclared).toBe('me'); // 그대로
  });

  it('bet 선언 시 메타 TP -200', () => {
    let s = makeState({ currentTurn: 'me' });
    s = { ...s, meta: { shilling: 0, tp: 1000, level: 1, winStreak: 0 }, bettingWindow: { open: true, turnsLeft: 3 } };
    s = applySpecial(s, { kind: 'bet' });
    expect(s.meta?.tp).toBe(800);
  });
});

describe('홀드', () => {
  it('양측 홀드 → 즉시 종료·계산', () => {
    let s = makeState({
      rows: [row(0, [d(6)], [d(1)]), row(1, [], []), row(2, [], [])],
      currentTurn: 'me',
    });
    s = applySpecial(s, { kind: 'hold' }); // me 홀드 → opp 턴
    s = applySpecial({ ...s, currentTurn: 'opponent' }, { kind: 'hold' }); // opp 홀드
    expect(s.phase).toBe('gameOver');
    expect(s.holds).toEqual({ me: true, opponent: true });
    expect(s.winner).toBe('me'); // 0줄 me 우세 → 줄수 1:0
  });

  it('한쪽만 홀드 → 상대는 계속', () => {
    let s = makeState({ currentTurn: 'me' });
    s = applySpecial(s, { kind: 'hold' }); // me 홀드
    expect(s.phase).not.toBe('gameOver');
    expect(s.currentTurn).toBe('opponent'); // 상대 턴 진행
    expect(s.holds.me).toBe(true);
  });
});

describe('종료 — 18칸 충전', () => {
  it('마지막 칸 배치 시 gameOver + winner 확정', () => {
    // 17칸 채워진 상태, me 마지막 1칸 남음
    const s = makeState({
      rows: [
        row(0, [d(6), d(6), d(6)], [d(1), d(1), d(1)]),
        row(1, [d(6), d(6), d(6)], [d(1), d(1), d(1)]),
        row(2, [d(6), d(6)], [d(1), d(1), d(1)]), // me 2번줄 1칸 빔
      ],
      currentTurn: 'me',
      pendingDie: d(6),
    });
    const next = applyMove(s, { kind: 'place', rowIndex: 2 }, fixedRng(1));
    expect(next.phase).toBe('gameOver');
    expect(next.winner).toBe('me');
    expect(isGameOver(next)).toBe(true);
  });
});

describe('isGameOver', () => {
  it('빈 보드는 종료 아님', () => {
    expect(isGameOver(makeState())).toBe(false);
  });
  it('양측 더 둘 수 없으면 종료 (양측 홀드)', () => {
    const s = makeState();
    expect(isGameOver({ ...s, holds: { me: true, opponent: true } })).toBe(true);
  });
});
