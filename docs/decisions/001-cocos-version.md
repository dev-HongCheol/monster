# ADR 001: Cocos Creator 버전 선택

- **날짜:** 2026-05-16
- **상태:** 결정됨
- **브랜치:** feat/cocos-setup

## 컨텍스트

TypeScript 숙련 개발자가 Cocos Creator를 처음 학습하며 로그라이크 액션 게임을 개발한다.
목표 플랫폼: iOS, Android, Web. 솔로 개발, macOS 환경.

두 가지 선택지를 검토했다:
- **Cocos Creator 3.8 LTS** — 안정 버전, 공식 문서 완비, Creator IDE 제공
- **COCOS 4** — 2026.01 출시, MIT 완전 오픈소스, PinK IDE 아직 미성숙

## 결정

**Cocos Creator 3.8 LTS 사용.**

## 근거

1. 공식 문서(한국어 포함), 커뮤니티, 예제가 풍부해 학습 속도를 보장한다.
2. COCOS 4 / PinK IDE는 2026년 현재 문서와 에코시스템이 미성숙 상태다.
3. 전투 루프 완성 후 4.x 전환을 재평가하는 것이 합리적이다.

## 결과

### 라이선스

| 구분 | Cocos Creator 3.8 LTS | COCOS 4 |
|---|---|---|
| 엔진 코어 | MIT | MIT |
| 에디터/IDE | Cocos User Service Agreement (무료, 로열티 없음) | MIT |
| 수익화 | 제한 없음 | 제한 없음 |

실질적으로 무료 + 앱스토어 출시 모두 가능.

### assets/resources/ 사용 원칙

`assets/resources/`는 Cocos 예약 경로로, `cc.resources.load()` API가 런타임에 동적으로 로드하는 에셋만 배치한다.

- **올바른 배치:** 동적 로드가 필요한 에셋 (런타임에 조건부로 로드하는 스프라이트, JSON 데이터 등)
- **잘못된 배치:** 씬에서 직접 참조하는 에셋 (씬 로드 시 자동으로 번들에 포함됨)

이 규칙을 지키지 않으면 빌드 번들 사이즈가 불필요하게 커진다.

### COCOS 4.x 비이전 영역

3.8 LTS에서 학습한 내용 중 4.x로 이전할 수 없는 부분:

| 항목 | 3.8 LTS | COCOS 4 | 비고 |
|---|---|---|---|
| 아키텍처 | OOP 컴포넌트 시스템 | ECS (Entity Component System) | 컴포넌트 작성 패턴 완전히 다름 |
| 데코레이터 | `@ccclass`, `@property` | 미결정 (ECS 전환) | 컴포넌트 노출 방식 다름 |
| 에디터 | Cocos Creator IDE | PinK IDE | 워크플로우 다름 |

이전 가능한 부분: 게임 로직 알고리즘, 씬 계층 구조 개념, TypeScript 코드 패턴.

## 전환 결정 시점

전투 루프(이동 + 프로젝타일 발사) 완성 후 COCOS 4 생태계 성숙도를 재평가.
평가 기준: PinK IDE 안정성, 공식 문서 완성도, 커뮤니티 규모.

## 참고

- [Cocos 버전 선택 design doc](../development/sessions/2026-05-16-cocos-setup-design.md)
- [프로토타입 스코프 결정](../development/sessions/2026-05-14-prototype-scope.md)
