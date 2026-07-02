import { Color } from 'cc';

// UI 공통 상수 — 색·사이즈·타입스케일의 단일 출처(CSS 변수·디자인 토큰에 대응).
// 값은 전부 placeholder이며, 이후 /design-consultation의 비주얼 시스템이 값만 교체한다.
// cc.Color를 쓰므로 순수 로직이 아니라 UI 상수 모듈이다(테스트 대상 아님).

/** HUD·패널 색 팔레트 (placeholder). */
export const COLORS = {
  /** HP 바 채움 (빨강) */
  HP_FILL: new Color(214, 69, 65, 255),
  /** XP 바 채움 (파랑) */
  XP_FILL: new Color(66, 135, 245, 255),
  /** 바 배경 (어두움) */
  BAR_BG: new Color(30, 30, 36, 200),
  /** 패널 배경 */
  PANEL_BG: new Color(20, 20, 26, 230),
  /** 기본 텍스트 */
  TEXT_PRIMARY: new Color(240, 240, 245, 255),
  /** 보조 텍스트 */
  TEXT_SECONDARY: new Color(170, 170, 180, 255),
  /** placeholder 요소 테두리 */
  PLACEHOLDER_BORDER: new Color(90, 90, 100, 255),
} as const;

/** HUD 공통 사이즈·간격 (px, 1280×720 디자인 해상도 기준, placeholder). */
export const SIZES = {
  /** HP 바 폭 */
  HP_BAR_WIDTH: 200,
  /** HP 바 높이 */
  HP_BAR_HEIGHT: 18,
  /** XP 바 높이 (하단 풀폭) */
  XP_BAR_HEIGHT: 12,
  /** 화면 모서리 여백 */
  EDGE_MARGIN: 24,
  /** 요소 간 간격 */
  GAP: 8,
  /** 스킬 그리드 한 칸 크기 */
  SKILL_SLOT: 48,
} as const;

/** 타입스케일 — 라벨 폰트 크기 단계 (px, placeholder). */
export const FONT = {
  /** 큰 강조 (레벨 등) */
  LG: 28,
  /** 기본 HUD 라벨 */
  MD: 20,
  /** 보조·작은 라벨 */
  SM: 14,
} as const;
