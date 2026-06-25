/**
 * DiceSlot — 보드 한 칸. 주사위가 있으면 표시하고, 없으면 빈 슬롯.
 *
 * 테두리/하이라이트 결정 규칙(스펙 §12.3):
 *  - 일반(비보호)   → 나무 테두리 (.slot--wood)
 *  - 실드(isShield) → 녹색 테두리 (.slot--shield)
 *  - 알까기 대상    → 주황 점선 (.slot--kkagi)  ← logic 판정 결과(isKkagiTarget)로만
 *  - 빈칸 + 배치가능 → 배치 하이라이트 (.slot--placeable)
 *
 * UI 는 "같은 눈인가" 를 재계산하지 않는다. isKkagiTarget/placeable 은 부모가
 * useBoardView(=logic) 결과로 내려준다.
 */
import type { Die as DieModel } from '../logic';
import { Die } from './Die';

export interface DiceSlotProps {
  die: DieModel | null;
  /** 빈칸이면서 현재 pending 으로 배치 가능한가. */
  placeable: boolean;
  /** 이 주사위가 알까기 대상으로 강조되어야 하는가 (logic 판정 결과). */
  kkagiTarget: boolean;
  /** 클릭 가능 여부 (빈칸 배치 또는 알까기 대상 클릭). */
  onClick?: () => void;
}

export function DiceSlot({ die, placeable, kkagiTarget, onClick }: DiceSlotProps): JSX.Element {
  const classes = ['slot'];
  if (die === null) {
    classes.push('slot--empty');
    if (placeable) classes.push('slot--placeable');
  } else {
    classes.push(die.isShield ? 'slot--shield' : 'slot--wood');
    if (kkagiTarget) classes.push('slot--kkagi');
  }
  const clickable = onClick !== undefined;
  if (clickable) classes.push('slot--clickable');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      disabled={!clickable}
      aria-label={die ? `주사위 ${die.value}${die.isShield ? ' 실드' : ''}` : '빈 칸'}
    >
      {die !== null && <Die die={die} />}
      {die === null && placeable && <span className="slot-place-hint">＋</span>}
    </button>
  );
}
