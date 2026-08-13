# Cocos Creator 프로젝트 부트스트랩 플랜

- **날짜:** 2026-05-16
- **브랜치:** feat/cocos-setup (main에 squash merge 완료)
- **상태:** ✅ 완료

## 결과 요약

Cocos Creator 3.8.8 Empty(2D) 프로젝트를 `game/` 서브폴더에 생성하고 개발 환경을 설정했다.

### 생성된 구조

```
monster/
├── game/                          # Cocos Creator 3.8.8 프로젝트
│   ├── assets/
│   │   ├── scripts/
│   │   │   ├── components/
│   │   │   ├── systems/
│   │   │   ├── ui/
│   │   │   └── data/
│   │   ├── scenes/
│   │   │   └── main.scene         # 첫 빈 씬 (Canvas + Camera)
│   │   └── resources/             # 동적 로드 에셋 전용
│   ├── settings/                  # Cocos 프로젝트 설정
│   ├── tsconfig.json              # strict: true (루트 불변, extends 방식)
│   └── .gitignore                 # Cocos 표준 (library/, temp/, local/ 등)
├── .gitignore                     # 루트: Cocos 캐시 game/ 프리픽스로 제외
├── biome.json                     # 포맷팅 + 린팅 (Prettier+ESLint 대체)
├── .editorconfig
├── .vscode/
│   ├── extensions.json            # 권장 확장 (cocos.cocos-creator 필수)
│   └── settings.json              # format-on-save (Biome)
├── docs/decisions/
│   └── 001-cocos-version.md       # ADR: 버전 선택 + resources/ 원칙 + 4.x 비이전 영역
└── docs/etc/todos.md              # defer된 항목 추적
```

### 주요 결정

| 결정 | 내용 |
|------|------|
| 엔진 | Cocos Creator 3.8.8 LTS (Empty 2D 템플릿) |
| 프로젝트 위치 | `game/` 서브폴더 |
| 포맷터 | Biome (Prettier + ESLint 대체) |
| TypeScript | strict mode (`assets/tsconfig.json` extends 방식) |
| Cocos 자동생성 코드 | Biome ignore 초기 적용 → 충돌 검증 후 해제 예정 |

### CEO/Eng 리뷰에서 발견 및 반영된 항목

- tsconfig 수정 방식: 루트 불변, `assets/tsconfig.json` extends만 허용
- .gitignore 보강: `extensions/`, `build/`, `native/`, `profiles/` 추가 / `*.meta` 제외 명시적 금지
- `assets/resources/` 예약 경로 의미 ADR에 명시
- VSCode 확장에 `cocos.cocos-creator` 필수 포함
- 씬 생성 절차: Cocos 에디터에서만 가능 (파일 직접 생성 불가)
- Cocos 자동 생성 중첩 git 레포 (`game/.git`) 제거

## 미완료 / 다음 단계

- [ ] `docs/etc/todos.md` 참고
- [ ] 다음 세션: 첫 게임 코드 — 색깔 사각형 이동 + 프로젝타일 발사

## 참고

- [Cocos 버전 선택 design doc](./2026-05-16-cocos-setup-design.md)
- [ADR 001: Cocos Creator 버전 선택](../../decisions/001-cocos-version.md)
- [프로토타입 스코프 결정](./2026-05-14-prototype-scope.md)
