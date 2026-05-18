# 향후 작업 목록

부트스트랩 단계에서 의도적으로 미룬 항목들. 각 항목은 별도 세션/플랜으로 진행.

## 개발 환경

- [ ] **iOS/Android 빌드 환경 설정** — Xcode (macOS), Android Studio, Cocos 네이티브 빌드 설정
  - 선결 조건: 전투 루프 프로토타입 완성 후
- [ ] **Biome ignore 해제 검토** — `game/assets/scripts/**/*.ts` 를 Biome 포맷팅 대상으로 전환
  - 선결 조건: Cocos 에디터와 format-on-save 충돌 없음 확인 후

## 코드 품질

- [ ] **ESLint 도입 검토** — Biome linter로 충분한지 평가 후 결정
- [ ] **CI/CD 파이프라인** — GitHub Actions로 빌드 자동화 (웹 + 모바일)

## 장기 계획

- [ ] **COCOS 4 전환 평가** — 전투 루프 완성 후 4.x 생태계 성숙도 재평가
  - 비이전 영역: ECS 아키텍처, `@ccclass`/`@property` 데코레이터 패턴
  - 이전 가능: 게임 로직 알고리즘, 씬 구조 개념
- [ ] **아트 에셋 파이프라인** — 색깔 사각형 → 실제 스프라이트 교체 시점 결정
- [ ] **모바일 컨트롤 스킴** — 터치 패드 vs 버추얼 조이스틱 결정
