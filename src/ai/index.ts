/**
 * 티카투카 AI 공개 배럴. UI/QA 는 이 모듈에서 import 한다.
 *
 * 핵심 계약: decideAction(state, rng) => GameAction
 */
export { decideAction } from './decide';
export { evaluateBoard, evaluateMove, ROW_WIN_WEIGHT } from './evaluate';
