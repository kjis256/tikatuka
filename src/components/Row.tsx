/**
 * Row — 한 줄: [내 3칸] [점수센터] [상대 3칸]. 좌=나, 우=상대 (ui.png 기준).
 *
 * 각 칸의 클릭 의미:
 *  - 내 빈칸 (placing, placeable)        → MOVE place
 *  - 내 빈칸 (placingBonus)              → PLACE_BONUS field='me'
 *  - 상대 빈칸 (placingBonus)            → PLACE_BONUS field='opponent'
 *  - 상대 주사위 (kkagiTarget)           → MOVE kkagi
 *
 * 어떤 칸이 클릭 가능한지는 useBoardView(=logic 판정)가 내려준다. Row 는 규칙을 모른다.
 */
import type { GameAction, Player, Row as RowModel, RowScore } from '../logic';
import { DiceSlot } from './DiceSlot';
import { ScoreCenter } from './ScoreCenter';
import type { BoardView } from '../hooks/useBoardView';

export interface RowProps {
  row: RowModel;
  score: RowScore;
  view: BoardView;
  dispatch: (action: GameAction) => void;
  /** 입력 잠금 (상대 턴 등). */
  locked: boolean;
}

const SLOT_COUNT = 3;

export function Row({ row, score, view, dispatch, locked }: RowProps): JSX.Element {
  const rowIndex = row.index;

  const renderSide = (owner: Player): JSX.Element[] => {
    const dice = owner === 'me' ? row.myDice : row.oppDice;
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const die = dice[i] ?? null;
      const kkagiTarget =
        die !== null && view.isKkagiTarget(rowIndex, owner, die.value, die.isShield);

      // 빈칸 배치 가능 여부: 내 필드 일반배치(placeRows) 또는 보너스 양 필드 자유배치.
      const canPlace =
        die === null &&
        ((view.myPlacing && owner === 'me' && view.placeRows.has(rowIndex)) || view.myBonus);

      let onClick: (() => void) | undefined;
      if (!locked) {
        if (canPlace && view.myBonus) {
          onClick = () => dispatch({ type: 'PLACE_BONUS', field: owner, rowIndex });
        } else if (canPlace) {
          onClick = () => dispatch({ type: 'MOVE', move: { kind: 'place', rowIndex } });
        } else if (kkagiTarget) {
          onClick = () => dispatch({ type: 'MOVE', move: { kind: 'kkagi', rowIndex } });
        }
      }

      return (
        <DiceSlot
          key={`${owner}-${i}`}
          die={die}
          placeable={canPlace && !locked}
          kkagiTarget={kkagiTarget}
          onClick={onClick}
        />
      );
    });
    // 마주보기(mirror): 내 필드는 칸 0 이 중앙(점수) 옆에 오도록 역순 렌더.
    // 데이터/클릭 매핑은 진짜 인덱스 i 로 유지되므로 강조·배치는 올바른 칸에 표시된다.
    return owner === 'me' ? slots.reverse() : slots;
  };

  return (
    <div className="board-row">
      <div className="row-side row-side--me">{renderSide('me')}</div>
      <ScoreCenter score={score} />
      <div className="row-side row-side--opp">{renderSide('opponent')}</div>
    </div>
  );
}
