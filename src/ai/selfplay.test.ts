/**
 * 자가대국(self-play) 회귀 테스트 — 단일 RNG 경로.
 *
 * QA 지적 커버리지 공백: 기존 AI 테스트는 "주사위 RNG"와 "AI 결정 RNG"를 분리해
 * 돌렸지만, 실제 UI(src/hooks/useGame.ts)는 단일 Rng 인스턴스 하나로 굴림과 AI
 * 결정을 모두 처리한다. 이 단일 RNG 경로에서 풀게임이 교착/무한루프 없이 끝나는지,
 * 모든 수가 합법인지 상시 검증이 없었다(QA 수동 100판). 그 공백을 영구 회귀로 막는다.
 *
 * 방식: mulberry32(seed)로 만든 단일 rng 하나를 게임 내내 공유(굴림·AI결정 공유 —
 *       실제 UI 경로 재현). 양 플레이어를 모두 decideAction 으로 구동한다.
 *       decideAction 전제는 "currentTurn 이 AI 측"이므로, 둘 다 AI인 자가대국에서는
 *       매 스텝 currentTurn 측을 그대로 구동하면 된다.
 *
 * 단언:
 *   1) 종료성  : 스텝 상한 내 phase==='gameOver' 도달 (교착/무한루프 없음).
 *   2) 합법성  : 매 MOVE 는 그 시점 getLegalMoves 에 포함 (불법수 0).
 *   3) 유효결과: 종료 시 winner ∈ {'me','opponent','draw'}.
 *
 * 견고성: 시드 1~50 × 난이도 {1,3,5} = 150 게임.
 */
import { describe, expect, it } from 'vitest';
import type { Difficulty, GameAction, GameState, Move, Rng } from '../logic';
import {
  createGame,
  rollPending,
  reroll,
  chooseRoll,
  applyMove,
  placeBonus,
  applySpecial,
  getLegalMoves,
  mulberry32,
} from '../logic';
import { decideAction } from './decide';

/** UI 의 applyAction 미러: GameAction 을 logic 함수 호출로 매핑하는 얇은 글루. */
function applyAction(state: GameState, action: GameAction, rng: Rng): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createGame({ difficulty: action.difficulty, withMeta: action.withMeta, rng });
    case 'ROLL':
      return rollPending(state, rng);
    case 'REROLL':
      return reroll(state, rng);
    case 'CHOOSE_ROLL':
      return chooseRoll(state, action.which);
    case 'MOVE':
      return applyMove(state, action.move, rng);
    case 'PLACE_BONUS':
      return placeBonus(state, action.field, action.rowIndex);
    case 'HOLD':
      return applySpecial(state, { kind: 'hold' });
    case 'BET':
      return applySpecial(state, { kind: 'bet' });
    case 'AI_STEP':
      return state;
  }
}

/** Move 가 합법수 목록에 들어있는지 (kind+rowIndex 일치). */
function isLegalMove(move: Move, legal: Move[]): boolean {
  return legal.some((m) => m.kind === move.kind && m.rowIndex === move.rowIndex);
}

/** 자가대국 결과. */
interface SelfPlayResult {
  state: GameState;
  steps: number;
  /** 불법수가 발생한 스텝의 진단(없으면 null). */
  illegal: { step: number; move: Move; legal: Move[] } | null;
}

const MAX_STEPS = 500;

/**
 * 단일 rng 로 양 플레이어를 decideAction 으로 구동하는 풀게임 시뮬레이션.
 * 매 MOVE 의 합법성을 즉시 검사해 첫 불법수를 진단으로 남긴다.
 */
function playSelfGame(seed: number, difficulty: Difficulty): SelfPlayResult {
  const rng = mulberry32(seed);
  let state = createGame({ difficulty, rng });
  let illegal: SelfPlayResult['illegal'] = null;
  let steps = 0;

  for (; steps < MAX_STEPS && state.phase !== 'gameOver'; steps++) {
    const action = decideAction(state, rng);
    if (action.type === 'MOVE') {
      const legal = getLegalMoves(state);
      if (!isLegalMove(action.move, legal) && illegal === null) {
        illegal = { step: steps, move: action.move, legal };
      }
    }
    state = applyAction(state, action, rng);
  }

  return { state, steps, illegal };
}

const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);
const DIFFICULTIES: Difficulty[] = [1, 3, 5];

const CASES: { seed: number; difficulty: Difficulty }[] = [];
for (const difficulty of DIFFICULTIES) {
  for (const seed of SEEDS) {
    CASES.push({ seed, difficulty });
  }
}

describe('self-play (single RNG path, both players AI)', () => {
  it.each(CASES)('seed=$seed ★$difficulty 풀게임이 합법·종료한다', ({ seed, difficulty }) => {
    const { state, steps, illegal } = playSelfGame(seed, difficulty);

    // 2) 합법성: 불법수 0 (먼저 검사 — 실패 시 진단을 명확히)
    expect(illegal, illegal ? `불법수 발생: ${JSON.stringify(illegal)}` : '').toBeNull();

    // 1) 종료성: 상한 내 gameOver 도달 (교착/무한루프 없음)
    expect(steps).toBeLessThan(MAX_STEPS);
    expect(state.phase).toBe('gameOver');

    // 3) 유효 결과: winner ∈ {'me','opponent','draw'}
    expect(['me', 'opponent', 'draw']).toContain(state.winner);
  });
});
