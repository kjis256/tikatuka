/**
 * useDiceLinks — 한 줄/한 필드 안에서 "같은 눈" 주사위를 시각적으로 묶기 위한
 * 순수 표시용 그룹핑. (게임 규칙/점수 계산이 아니라 시각 표현이므로 UI 에서 산출한다.)
 *
 * - combo: **연속(인접) 런**의 일부(앞/뒤 칸과 같은 눈)일 때만 콤보(글로우 대상).
 *   점수 보너스가 "인접 런에만" 적용되므로, 비인접 같은 눈은 콤보로 묶지 않는다.
 * - claspToNext: 시각적으로 인접한 다음 칸과 눈이 같으면 사이에 걸쇠(브래킷)를 그린다.
 *   (데이터는 앞에서부터 연속 채움 → 시각적으로 인접한 dice[i],dice[i+1] 만 물리 연결.)
 *
 * 입력은 **시각 순서**(미러 반영 후)의 주사위 배열이어야 한다. 그래야 역순 렌더되는
 * 내 필드에서도 걸쇠가 올바른 같은 눈 쌍 사이에 그려진다.
 */
import type { Die } from '../logic';

export interface DiceLinkInfo {
  /** 연속(인접) 런의 일부 → 콤보(둥근 글로우) 대상. 점수 보너스 규칙과 일치. */
  combo: boolean;
  /** 시각적으로 다음 칸과 눈이 같다 → 사이에 걸쇠(연결선) 표시. */
  claspToNext: boolean;
}

/** 시각 순서 주사위 배열에 대해 칸별 링크 정보를 산출한다. */
export function computeDiceLinks(visualDice: (Die | null)[]): DiceLinkInfo[] {
  return visualDice.map((d, i) => {
    if (!d) return { combo: false, claspToNext: false };
    const prev = visualDice[i - 1] ?? null;
    const next = visualDice[i + 1] ?? null;
    // 인접한 같은 눈이 앞/뒤에 있을 때만 콤보 → 비인접 같은 눈은 묶지 않음(보너스 규칙과 일치).
    const combo =
      (prev !== null && prev.value === d.value) || (next !== null && next.value === d.value);
    const claspToNext = next !== null && next.value === d.value;
    return { combo, claspToNext };
  });
}
