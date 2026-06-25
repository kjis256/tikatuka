/**
 * 티카투카 GameState 계약 — 단일 진실 공급원(Single Source of Truth).
 *
 * logic / ai / ui / qa 전원이 이 파일을 import 한다.
 * 이 계약을 변경할 때는 반드시 팀 전원에게 통보하고 합의한다 (경계면 버그 방지).
 *
 * 규칙 원천: tikatuka_spec.md  /  시각 원천: ui.png
 */

// ===== 기본 값 타입 =====
export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
export type Player = 'me' | 'opponent';
export type RowIndex = 0 | 1 | 2;

/** 한 칸의 주사위. isShield=true 면 알까기로 제거 불가(녹색 테두리). */
export interface Die {
  value: DiceValue;
  isShield: boolean;
}

/** 한 줄: 내 최대 3칸 / 상대 최대 3칸. */
export interface Row {
  index: RowIndex;
  myDice: Die[]; // 최대 3
  oppDice: Die[]; // 최대 3
}

/** 주입 가능한 난수원. [0,1). QA·AI가 시드 고정으로 결정적 테스트를 작성하기 위함. */
export type Rng = () => number;

// ===== 턴 진행 상태머신 =====
export type TurnPhase =
  | 'rolling' // 굴릴 차례 (pending 없음)
  | 'placing' // pending 주사위를 배치/알까기 선택 중
  | 'placingBonus' // 알까기 후 보너스(실드) 주사위를 빈칸에 배치 중
  | 'gameOver';

/** 굴려서 배치 대기 중인 주사위. alt 는 타짜의 손놀림으로 굴린 대안(선택 대기). */
export interface PendingRoll {
  die: Die;
  alt: Die | null;
}

// ===== 메타(승부사 모드) =====
export interface MetaState {
  shilling: number; // 실링 (대전료 -1000)
  tp: number; // 티카투카 포인트
  level: number; // 1..10 (TP 기반)
  winStreak: number; // 연승 (2연승+ 보너스)
}

// ===== 행동(Move/Action) =====
/**
 * 현재 pending 주사위로 둘 수 있는 합법수. logic 의 getLegalMoves()가 생성한다.
 * - place: 내 필드 빈칸에 일반 배치
 * - kkagi: 해당 줄에서 알까기 발동 (조건 충족 시)
 */
export type Move =
  | { kind: 'place'; rowIndex: RowIndex }
  | { kind: 'kkagi'; rowIndex: RowIndex };

/** pending 주사위 배치와 무관한 특수 행동. */
export type SpecialAction =
  | { kind: 'reroll' } // 타짜의 손놀림 (게임당 1회)
  | { kind: 'hold' }
  | { kind: 'bet' }; // 티카투카 선언

/** UI reducer 가 dispatch 하는 액션의 합집합 (ui-dev 가 확장 가능). */
export type GameAction =
  | { type: 'NEW_GAME'; difficulty?: Difficulty; withMeta?: boolean }
  | { type: 'ROLL' }
  | { type: 'REROLL' } // 타짜의 손놀림: 대안 주사위 굴림
  | { type: 'CHOOSE_ROLL'; which: 'die' | 'alt' } // 두 결과 중 선택
  | { type: 'MOVE'; move: Move }
  | { type: 'PLACE_BONUS'; field: Player; rowIndex: RowIndex }
  | { type: 'HOLD' }
  | { type: 'BET' }
  | { type: 'AI_STEP' }; // 상대 턴 1스텝 진행

export type Difficulty = 1 | 2 | 3 | 4 | 5;

// ===== 최상위 상태 =====
export interface GameState {
  rows: [Row, Row, Row];
  currentTurn: Player;
  phase: TurnPhase;

  /** 굴려서 배치 대기 중인 주사위 (phase==='placing'). */
  pending: PendingRoll | null;
  /** 알까기 후 배치 대기 중인 실드 보너스 주사위 (phase==='placingBonus'). */
  pendingBonus: Die | null;

  firstPlayer: Player; // 선공 (첫 주사위는 실드)
  rerollUsed: { me: boolean; opponent: boolean }; // 타짜의 손놀림 1회 제한
  holds: { me: boolean; opponent: boolean };

  // 티카투카 베팅
  tikatukaDeclared: Player | null;
  /** 양 필드 합산 10개 배치 시점부터 3턴간 선언 가능. */
  bettingWindow: { open: boolean; turnsLeft: number };

  placedCount: number; // 양측 합산 배치 개수
  turnCount: number;

  difficulty: Difficulty; // 상대 AI 난이도 ★1~5
  meta: MetaState | null; // 승부사 모드 (null 이면 단판)

  winner: Player | 'draw' | null; // phase==='gameOver' 시 확정
  log: string[]; // 이벤트 로그 (다시보기/디버그)
}

// ===== 줄별 점수 표시용 파생값 (UI 가 logic 에서 받아 렌더) =====
export interface RowScore {
  rowIndex: RowIndex;
  myScore: number;
  oppScore: number;
  /** 그 줄에서 이기는 쪽. 화살표 방향(◀/▶). 동점이면 null. */
  leader: Player | null;
}
