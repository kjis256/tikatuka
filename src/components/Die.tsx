/**
 * Die — 주사위 1개의 시각 표현 (눈 점 배치). 테두리 상태는 부모(DiceSlot)가 결정한다.
 * props 타입은 logic 의 Die 계약에서 파생한다.
 */
import type { Die as DieModel, DiceValue } from '../logic';

/** 6면 각 값의 점 위치(3x3 그리드 셀 인덱스, 0~8). */
const PIP_LAYOUT: Record<DiceValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface DieProps {
  die: DieModel;
  /** 작은 표시(대기영역/보너스 미리보기 등)용 축소. */
  small?: boolean;
}

export function Die({ die, small }: DieProps): JSX.Element {
  const pips = PIP_LAYOUT[die.value];
  return (
    <div className={`die-face${small ? ' die-face--small' : ''}`} aria-label={`주사위 ${die.value}`}>
      <div className="die-pips">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={`die-pip${pips.includes(i) ? ' die-pip--on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
