# Cocos Creator 버전 선택 및 프로젝트 초기 세팅 플랜

- **날짜:** 2026-05-16
- **브랜치:** feat/cocos-setup
- **상태:** DRAFT

## 배경

세션 문서(2026-05-14-prototype-scope.md)에서 Cocos 4를 엔진으로 결정했고,
미결 사항으로 "Cocos Creator 3.x 최신 vs Cocos 4 (2026년 오픈소스화) — 버전 선택 필요"가 남아 있다.

프로젝트 목표: TS 프론트 개발자가 Cocos Creator를 학습하며 로그라이크 액션 게임을 개발.
최초 완료 기준: 색깔 사각형이 이동하고 프로젝타일을 발사하는 최소 전투 프로토타입.

## 결정해야 할 것

### 1. Cocos Creator 버전

| 버전 | 상태 | 특징 |
|------|------|------|
| Cocos Creator 3.x (최신) | 안정 | 풍부한 문서, 커뮤니티, TypeScript 지원 |
| Cocos Creator 4.x | 새버전 (2026 오픈소스화) | 최신 아키텍처, 문서 부족 가능성 |

**대상 플랫폼:** 모바일(iOS/Android) + 웹
**개발자 배경:** TypeScript 숙련, Cocos 처음

### 2. 프로젝트 구조 세팅

- 프로젝트 생성 방식 (Cocos Dashboard vs CLI)
- 폴더 구조 컨벤션
- TypeScript 설정 (tsconfig, strict mode)
- VSCode 설정 (.vscode/)
- .gitignore 설정
- 빌드 타겟 설정 (Web Mobile + Native Mobile)

## 구현 범위

### In Scope
- Cocos Creator 버전 최종 결정 및 근거 문서화
- 프로젝트 생성 및 기본 폴더 구조
- TypeScript + VSCode 개발 환경 설정
- .gitignore, README 기본 파일
- 첫 씬(Scene) 생성 — 빈 씬으로 시작

### Out of Scope
- 게임 로직 구현 (이동, 전투, AI)
- 아트 에셋 파이프라인
- 빌드/배포 자동화 (CI/CD)
- 모바일 컨트롤 스킴 결정

## 전제

1. 모바일 퍼스트 타겟 — Android/iOS 네이티브 빌드 필요
2. TypeScript 엄격 모드 선호 — TS 개발자 배경에 맞춤
3. 솔로 개발 — 협업 도구 설정 불필요
4. 학습 목적 — 커뮤니티/문서 접근성이 중요

## 예상 작업

1. Cocos Creator 버전 조사 및 결정
2. Cocos Dashboard 또는 CLI로 프로젝트 생성
3. 기본 폴더 구조 정리 (`assets/scripts/`, `assets/scenes/`, `assets/resources/`)
4. VSCode 플러그인 설치 가이드 작성
5. tsconfig 조정
6. .gitignore 설정 (Cocos 특화)
7. 첫 커밋
8. ADR 작성 — 버전 선택 결정 기록

## 참고

- [프로토타입 스코프 결정](./2026-05-14-prototype-scope.md)
