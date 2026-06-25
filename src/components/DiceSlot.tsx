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
  /** 빈칸이지만 매칭 줄이라 두면 알까기가 강제 발동되는 칸. */
  forcedKkagi?: boolean;
  /** 같은 필드 같은 줄에 같은 눈이 2개 이상 → 콤보 글로우(표시용). */
  combo?: boolean;
  /** 시각적으로 다음 칸과 눈이 같다 → 사이에 걸쇠(연결선) 표시(표시용). */
  claspToNext?: boolean;
  /** 클릭 가능 여부 (빈칸 배치 또는 알까기 발동). */
  onClick?: () => void;
}

export function DiceSlot({
  die,
  placeable,
  kkagiTarget,
  forcedKkagi = false,
  combo = false,
  claspToNext = false,
  onClick,
}: DiceSlotProps): JSX.Element {
  const classes = ['slot'];
  if (die === null) {
    classes.push('slot--empty');
    if (placeable) classes.push('slot--placeable');
    else if (forcedKkagi) classes.push('slot--kkagi-place');
  } else {
    classes.push(die.isShield ? 'slot--shield' : 'slot--wood');
    if (kkagiTarget) classes.push('slot--kkagi');
    if (combo) classes.push('slot--combo');
  }
  const clickable = onClick !== undefined;
  if (clickable) classes.push('slot--clickable');

  const ariaLabel = die
    ? `주사위 ${die.value}${die.isShield ? ' 실드' : ''}${combo ? ' 콤보' : ''}`
    : forcedKkagi
      ? '알까기 발동'
      : '빈 칸';

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onClick}
      disabled={!clickable}
      aria-label={ariaLabel}
    >
      {die !== null && <Die die={die} />}
      {/* 같은 눈 인접 쌍 사이 걸쇠(브래킷). 칸 우측 gap 위에 얹혀 다음 칸과 연결. */}
      {die !== null && claspToNext && <span className="dice-clasp" aria-hidden="true" />}
      {die === null && placeable && <span className="slot-place-hint">＋</span>}
      {die === null && !placeable && forcedKkagi && <span className="slot-kkagi-hint">✕</span>}
    </button>
  );
}
