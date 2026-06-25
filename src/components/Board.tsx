/**
 * Board — 3줄을 세로로 쌓는다. 줄별 데이터/점수/판정뷰를 Row 에 전달.
 */
import type { GameAction, GameState } from '../logic';
import { Row } from './Row';
import type { BoardView } from '../hooks/useBoardView';

export interface BoardProps {
  state: GameState;
  view: BoardView;
  dispatch: (action: GameAction) => void;
  locked: boolean;
}

export function Board({ state, view, dispatch, locked }: BoardProps): JSX.Element {
  return (
    <div className="board">
      {state.rows.map((row) => (
        <Row
          key={row.index}
          row={row}
          score={view.rowScores[row.index]}
          view={view}
          dispatch={dispatch}
          locked={locked}
        />
      ))}
    </div>
  );
}
