/**
 * ScoreCenter — 한 줄 중앙의 점수 표시: `내 점수 [화살표] 상대 점수`.
 *
 * 화살표(◀/▶)는 그 줄에서 이기는 쪽(leader)을 향한다. 점수·leader 는 모두 logic 의
 * getRowScores(RowScore)에서 온다. UI 는 방향과 강조색만 결정한다.
 * 강조색: 내 우세=녹색, 상대 우세=적색, 동점=중립.
 */
import type { RowScore } from '../logic';

export interface ScoreCenterProps {
  score: RowScore;
}

export function ScoreCenter({ score }: ScoreCenterProps): JSX.Element {
  const { myScore, oppScore, leader } = score;
  const arrow = leader === 'me' ? '◀' : leader === 'opponent' ? '▶' : '◆';
  const arrowClass =
    leader === 'me' ? 'score-arrow score-arrow--me' : leader === 'opponent' ? 'score-arrow score-arrow--opp' : 'score-arrow score-arrow--tie';

  return (
    <div className="score-center">
      <span className={`score-num score-num--me${leader === 'me' ? ' score-num--lead' : ''}`}>
        {myScore}
      </span>
      <span className={arrowClass}>{arrow}</span>
      <span className={`score-num score-num--opp${leader === 'opponent' ? ' score-num--lead' : ''}`}>
        {oppScore}
      </span>
    </div>
  );
}
