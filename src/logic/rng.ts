/**
 * 주입 가능한 난수원(RNG)과 주사위 굴림 헬퍼.
 *
 * 엔진은 절대 Math.random()을 직접 부르지 않는다. 모든 굴림은 인자로 받은
 * Rng 를 통한다 → QA·AI 가 시드 고정으로 결정적 테스트를 작성할 수 있다.
 */
import type { DiceValue, Rng } from './types';

/**
 * mulberry32: 32비트 시드 기반 결정적 PRNG. 같은 시드 → 같은 수열.
 * 반환 함수는 [0,1) 범위의 number 를 낸다 (Rng 계약).
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1~6 균등 분포 주사위 한 개. 각 눈 기대확률 동일(스펙 §6). */
export function rollDie(rng: Rng): DiceValue {
  return ((rng() * 6) | 0) + 1 as DiceValue;
}
