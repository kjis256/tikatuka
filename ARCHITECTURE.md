# 티카투카(Tikatuka) — 아키텍처 & 코드 명세서

> 다른 개발자/AI 에이전트가 이 코드베이스를 빠르게 파악하기 위한 단일 문서.
> 게임 규칙·도메인 모델·공개 API·레이어 경계·기여 규칙을 담는다.

---

## 1. 개요

티카투카는 **1:1 주사위 배치 대전 웹게임**이다(로스트아크 인게임 미니게임 기반). 각 플레이어는 자기 필드(3줄 × 줄당 3칸)에 주사위를 배치하고, 줄별 점수로 승패를 가린다. 같은 눈을 모으는 보너스(더블/트리플), 상대 주사위를 제거하는 **알까기**, 제거 불가능한 **실드** 주사위가 핵심 메커니즘이다. 상대는 난이도 ★1~5 AI.

- **스택:** React 18 + TypeScript(strict) + Vite + Vitest. 백엔드 없음(정적 SPA). 배포는 nginx 컨테이너.
- **상태:** 단판 게임 로직 + 선택적 메타(승부사 모드: 실링/TP/레벨/연승).

---

## 2. 핵심 설계 원칙 (먼저 읽을 것)

이 프로젝트는 **계약 우선(contract-first) 3계층** 구조다. 이 원칙을 깨면 경계면 버그가 난다.

1. **`src/logic/types.ts` 의 `GameState` 가 단일 진실 공급원(SSOT).** UI·AI·테스트 전부 이 타입을 import 한다. 타입 변경은 전 계층에 영향.
2. **로직은 순수 함수.** `src/logic/` 의 모든 함수는 부수효과·DOM·전역상태 없이 `GameState`(+인자)를 받아 새 값을 반환한다(불변성).
3. **난수는 주입(injection).** 주사위 굴림 등은 `Rng = () => number` 를 **인자로** 받는다. 엔진 내부에서 `Math.random()` 을 직접 부르지 않는다 → 시드 고정으로 결정적 테스트 가능(`mulberry32`).
4. **UI 는 규칙을 재계산하지 않는다.** 점수·알까기 대상·합법수·승패는 전부 `src/logic` 함수(또는 `useBoardView`)로 얻는다. 컴포넌트는 결과를 읽어 렌더만 한다.
5. **AI 는 로직만 소비한다.** `decideAction` 은 `getLegalMoves`/`scoreIfPlaced` 등으로 의사결정하며 **항상 합법수만** 반환한다. UI 에 접근하지 않는다.

```
                 ┌─────────────────────────────┐
                 │  src/logic  (순수 규칙 엔진)  │  ← SSOT: GameState, 규칙
                 │  types · engine · scoring ·  │
                 │  rng · meta                  │
                 └───────────┬─────────┬───────┘
                  소비        │         │  소비
            ┌───────────────┘         └────────────────┐
   ┌────────▼─────────┐                       ┌─────────▼────────┐
   │ src/ai           │                       │ src/components +  │
   │ decideAction()   │                       │ src/hooks (UI)    │
   │ (난이도별 의사결정)│                       │ useGame/useBoardView│
   └──────────────────┘                       └──────────────────┘
```

---

## 3. 디렉토리 구조

```
src/
├── logic/                  순수 규칙 엔진 (계층 1, SSOT)
│   ├── types.ts            ★ GameState 계약 + 모든 도메인 타입
│   ├── engine.ts           턴 상태머신, 굴림/배치/알까기/홀드/베팅, 합법수, 상수
│   ├── scoring.ts          줄 점수·승패 판정·평가 보조(순수 계산)
│   ├── rng.ts              mulberry32(시드 RNG), rollDie
│   ├── meta.ts             승부사 모드(실링/TP/레벨/연승)
│   ├── index.ts            공개 API 배럴 (← UI/AI/QA 는 'src/logic' 에서 import)
│   └── *.test.ts           Vitest (scoring/engine/meta)
├── ai/                     상대 AI (계층 2, logic 소비)
│   ├── decide.ts           decideAction — 공개 진입점
│   ├── evaluate.ts         보드/수 평가 함수
│   ├── index.ts            배럴
│   └── *.test.ts           결정성·합법성·난이도 단조성·자가대국(selfplay)
├── components/             React UI (계층 3)
│   ├── ProfileBar · WaitingArea · Board · Row · DiceSlot · Die ·
│   │   ScoreCenter · ActionBar · StartScreen · ResultOverlay
├── hooks/
│   ├── useGame.ts          상태 소유(useState)+RNG(useRef)+AI 루프 / applyAction(글루)
│   └── useBoardView.ts     렌더용 규칙 판정(placeRows/kkagiRows/점수)을 logic 으로 산출
├── styles/index.css        전체 스타일(반응형/배터리 최적화 포함)
├── assets/*.webp           아트(배경/보드/로고/마스코트/아바타/주사위면)
└── App.tsx, main.tsx       조립/부트스트랩
```

---

## 4. 도메인 모델 (`src/logic/types.ts`)

```ts
type DiceValue = 1|2|3|4|5|6;  type Player = 'me'|'opponent';  type RowIndex = 0|1|2;
type Rng = () => number;       // [0,1)
type Difficulty = 1|2|3|4|5;   // 상대 AI 난이도(운 아닌 의사결정 품질)

interface Die  { value: DiceValue; isShield: boolean; }       // isShield=알까기 불가
interface Row  { index: RowIndex; myDice: Die[]; oppDice: Die[]; } // 각 최대 3
interface PendingRoll { die: Die; alt: Die|null; }            // alt=타짜의손놀림 대안
interface MetaState { shilling: number; tp: number; level: number; winStreak: number; }

type TurnPhase = 'rolling' | 'placing' | 'placingBonus' | 'gameOver';

// pending 주사위로 둘 수 있는 합법수 (getLegalMoves 가 생성)
type Move = { kind:'place'; rowIndex:RowIndex } | { kind:'kkagi'; rowIndex:RowIndex };
// pending 과 무관한 특수행동
type SpecialAction = { kind:'reroll' } | { kind:'hold' } | { kind:'bet' };
// UI reducer(글루)가 dispatch 하는 액션
type GameAction =
  | { type:'NEW_GAME'; difficulty?:Difficulty; withMeta?:boolean }
  | { type:'ROLL' } | { type:'REROLL' } | { type:'CHOOSE_ROLL'; which:'die'|'alt' }
  | { type:'MOVE'; move:Move } | { type:'PLACE_BONUS'; field:Player; rowIndex:RowIndex }
  | { type:'HOLD' } | { type:'BET' } | { type:'AI_STEP' };

interface GameState {
  rows: [Row, Row, Row];
  currentTurn: Player;  phase: TurnPhase;
  pending: PendingRoll | null;     // phase==='placing'
  pendingBonus: Die | null;        // phase==='placingBonus' (알까기 후 실드 보너스)
  firstPlayer: Player;             // 선공(첫 주사위 실드)
  rerollUsed: { me:boolean; opponent:boolean };  // 타짜의손놀림 게임당 1회
  holds: { me:boolean; opponent:boolean };
  tikatukaDeclared: Player | null;
  bettingWindow: { open:boolean; turnsLeft:number };  // 합산 10개부터 3턴
  placedCount: number;  turnCount: number;
  difficulty: Difficulty;  meta: MetaState | null;     // meta=null 이면 단판
  winner: Player | 'draw' | null;  log: string[];
}

interface RowScore { rowIndex:RowIndex; myScore:number; oppScore:number; leader:Player|null; }
```

---

## 5. 게임 규칙 (구현 기준)

| 규칙 | 내용 |
|------|------|
| **보드** | 3줄 × (내 3칸 / 점수 / 상대 3칸). 1인 9칸, 합산 18칸. |
| **점수** | 더블(같은 눈 2개)=눈×3, 트리플(3개)=눈×5, 나머지 단순합. **혼합 줄**은 눈별 카운트로 합산. 예: `4,4,2`→14, `5,5,5`→25. |
| **강제 알까기** ⚠️ | 내 던진 눈 == 상대 **해당 줄** 비보호 주사위 눈 이고 **내 그 줄에 빈칸**이 있으면, 그 줄엔 **일반 배치 불가 — 알까기가 강제된다**. 발동 시 그 줄 상대 같은 눈 비보호 **전부 제거** → 던진 주사위 소모 → 보너스(실드) 1개를 뽑아 양 필드 빈칸 자유 배치 → **즉시 턴 종료**. 매칭 안 되는 다른 줄엔 일반 배치 가능(다른 줄을 골라 알까기 회피 가능). |
| **실드** | `isShield`. 선공 첫 주사위 + 모든 보너스. 알까기 대상 아님. 점수는 동일. |
| **타짜의 손놀림** | `reroll` — 1개 더 굴려 둘 중 선택. **게임당 1회.** AI 는 ★3+ 에서 사용. |
| **홀드** | 자신은 더 안 놓음. 상대는 계속. 양측 홀드 시 즉시 계산. |
| **티카투카 베팅** | 합산 10개 배치 시점부터 **3턴간** 선언 가능. 선언 -200 TP, 승리 시 +400(meta 모드). |
| **승패 판정** | 줄별 승리 수 → 동점 시 총합 점수 → 그래도 동점 시 무승부. |
| **종료** | 18칸 충전 또는 양측 홀드. |
| **승부사 모드(meta)** | 대전료 -1000실링, 승리 +200/패배 -100 TP, 2연승+ +100, 레벨=TP기반(최대10). |

상수: `ROW_COUNT=3, SLOTS_PER_SIDE=3, MAX_DICE_PER_PLAYER=9, TOTAL_SLOTS=18, BETTING_THRESHOLD=10, BETTING_TURNS=3, BET_COST=200, BET_REWARD=400`(engine), `ENTRY_FEE=1000, WIN_TP=200, LOSE_TP=100, STREAK_BONUS_TP=100, STREAK_THRESHOLD=2, MAX_LEVEL=10`(meta).

---

## 6. 턴 상태머신 (`phase`)

```
rolling ──ROLL──▶ placing ──(REROLL→CHOOSE_ROLL 선택 가능, 1회)──▶ placing
   ▲                  │
   │          ┌───────┴── MOVE place ──▶ 점수 갱신 ──▶ 턴 교대 ──┐
   │          │                                                   │
   │          └── MOVE kkagi(강제) ──▶ placingBonus ──PLACE_BONUS──▶ 즉시 턴 종료
   └────────────────────────────────────────────────────────────┘
                         (종료 조건 충족 시 → gameOver)
```

---

## 7. 공개 API

### 7.1 logic (`import { ... } from 'src/logic'`)
순수 함수. RNG 는 인자 주입.

```ts
// 생성/진행
createGame(opts?: CreateGameOptions): GameState         // {difficulty?, withMeta?, rng?, firstPlayer?}
rollPending(state, rng): GameState                       // 'rolling'→'placing'
reroll(state, rng): GameState                            // 타짜의손놀림(게임당 1회) → pending.alt
chooseRoll(state, which: 'die'|'alt'): GameState
applyMove(state, move: Move, rng): GameState             // place 또는 kkagi(강제) — rng는 보너스 굴림용
placeBonus(state, field: Player, rowIndex): GameState    // 'placingBonus'→배치→즉시 턴종료
applySpecial(state, action: SpecialAction): GameState    // hold / bet (reroll은 전용 reroll() 사용)
// 판정/조회
getLegalMoves(state): Move[]                             // ★ 강제 알까기 반영: 매칭 줄은 kkagi만, 그 외 빈칸 줄은 place
canKkagi(state, rowIndex): boolean
calcRowScore(dice: Die[]): number
getRowScores(state): RowScore[]                          // UI 점수+화살표
scoreIfPlaced(state, move): number                       // AI 평가용
emptySlots(state, player): number / hasAnyEmptySlot(state): boolean
isBettingOpen(state): boolean / isGameOver(state): boolean / judge(state): Player|'draw'
// RNG
mulberry32(seed: number): Rng / rollDie(rng): DiceValue
// meta
applyMatchResult(meta, result: MatchResult): MetaState / settleMeta(state): GameState
upsetBonus(difficulty): number / levelForTp(tp): number
```

### 7.2 ai (`import { decideAction } from 'src/ai'`)
```ts
decideAction(state: GameState, rng: Rng): GameAction
// 전제: state.currentTurn 이 AI 측. 현재 phase 를 보고 다음에 dispatch 할 GameAction 1개 반환.
//  rolling→ROLL / placing→REROLL|CHOOSE_ROLL|MOVE / placingBonus→PLACE_BONUS / 상황따라 HOLD|BET.
// 난이도는 state.difficulty. 반환 MOVE 는 항상 getLegalMoves 에 포함(불법수 0).
// 난이도 주 레버: 재굴림 사용확률(★3=0.35, ★4=0.7, ★5=1.0) + ε-탐욕.
evaluateBoard(state) / evaluateMove(state, move) / ROW_WIN_WEIGHT  // 평가 보조
```

### 7.3 UI hooks
```ts
// src/hooks/useGame.ts
applyAction(state, action: GameAction, rng): GameState   // GameAction→logic 함수 매핑(얇은 글루, 규칙 재구현 X)
useGame(): { state, dispatch, newGame, isOpponentTurn }  // useState(state)+useRef(rng)+상대턴 AI 루프

// src/hooks/useBoardView.ts
useBoardView(state): {
  rowScores, placeRows:Set<RowIndex>, kkagiRows:Set<RowIndex>,  // getLegalMoves 로 산출
  myPlacing, myBonus, isKkagiTarget(rowIndex, owner, value, isShield)
}
```

---

## 8. UI 구조 & 주사위 시각 상태

```
App
├ ProfileBar  [내 프로필+TURN | 로고/새게임 | 상대 프로필+★난이도]
├ status-banner [상태문구 + 주사위 굴리기 버튼 + 베팅 플래그]
├ game-area  [내 대기영역(녹) | Board(Row×3) | 상대 대기영역(적)]   (모바일 세로: 상대 위/나 아래로 재배치)
│   └ Row: [내 3칸(미러 역순)] ScoreCenter(점수+화살표) [상대 3칸]
└ ActionBar [타짜의손놀림 / 홀드 / 베팅]   +  StartScreen / ResultOverlay 오버레이
```

**주사위 4상태(DiceSlot, logic 판정으로만 결정):**

| 상태 | 클래스 | 표현 |
|------|--------|------|
| 일반(비보호) | `.slot--wood` | 나무 면(`die_face.webp`) + 핍 |
| 실드 | `.slot--shield` | 녹색 발광 링 |
| 알까기 대상/강제 칸 | `.slot--kkagi` / `.slot--kkagi-place` | 주황 강조(상대 주사위 또는 매칭 줄 내 빈칸 — 클릭 시 알까기) |
| 빈칸·배치가능 | `.slot--placeable` | ＋ 힌트 |

**반응형(`ui.md` 준수):** 360~1366px 무오버플로, 슬롯/주사위 `clamp()` 유동, 터치타깃 ≥44px(`@media (pointer:coarse)`), 전방향 `env(safe-area-inset-*)`, 폭 ≤1280 에선 장식 마스코트 숨김. **배터리:** `background-attachment:fixed` 미사용, 무한 애니메이션은 `opacity` 기반 + `prefers-reduced-motion` 존중.

---

## 9. 테스트

```bash
npm test          # 전체 Vitest
npm run typecheck # tsc --noEmit (strict)
```
커버리지 핵심: 점수(스펙 worked example), 강제 알까기(매칭 줄 place 차단·kkagi만), 실드/홀드/베팅 윈도우/승패, AI 결정성·**불법수 0**·난이도 단조성, **selfplay 자가대국 150케이스**(교착/불법수/미종료 0).

---

## 10. 빌드 / 실행 / 배포

```bash
npm install && npm run dev          # 개발 (http://localhost:5173, 0.0.0.0 바인딩)
npm run build                       # tsc --noEmit && vite build → dist/
docker compose up -d                # nginx 컨테이너 (http://localhost:8080)
```
정적 SPA → nginx 서빙(멀티스테이지 Dockerfile). 해시 자산은 `Cache-Control: immutable, 1y`, `index.html` 은 매번 재검증(배포 시 캐시 무효화).

---

## 11. 기여 규칙 (개발자 & AI 에이전트용 ⚠️)

- **규칙/상태는 `src/logic` 에만.** UI/AI 에서 점수·알까기·승패를 재구현하지 말 것 — 반드시 logic 함수를 호출.
- **`GameState` 타입 변경은 신중히.** UI·AI·테스트가 전부 의존하므로 변경 시 전 계층 동기화 + 테스트 갱신.
- **RNG 는 항상 주입.** 새 무작위 로직도 `rng: Rng` 인자로. (테스트 결정성 보장)
- **AI 는 `getLegalMoves` 만 둔다.** 불법수 금지 — `decide.test.ts` 가 강제.
- **UI 변경은 마크업/CSS 한정**, props 계약·dispatch·상태 기반 조건부 렌더를 깨지 말 것.
- 변경 후 `npm test` + `npm run build` 통과 필수.

### 기능 추가 예시 흐름
1. 규칙이면 `src/logic` 에 순수 함수 + 테스트(스펙 예시로) 추가 → `index.ts` 배럴 export.
2. 필요 시 `GameState`/`GameAction` 확장(전 계층 통보).
3. AI 가 새 수를 써야 하면 `decideAction` 분기 + 합법성 테스트.
4. UI 는 `useBoardView`/`applyAction` 경유로 연결, 컴포넌트는 렌더만.
