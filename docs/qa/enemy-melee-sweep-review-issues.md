# 적 로스터 S3 — 근접 휘두르기 코드 리뷰 이슈

- **브랜치:** feat/enemy-melee-sweep
- **리뷰 커밋:** `b73bda1`(base) → `a7b6ee2`(head)
- **리뷰 방식:** `superpowers:requesting-code-review` 패턴 — 별도 subagent(general-purpose) dispatch
- **판정:** **Ready to merge: Yes** — Critical 0, Important 0, Minor 3 (전부 비차단)

> 리뷰어 요약: 여섯 요구사항을 계획·설계 정본대로 충실히 구현했고(공격 FSM 재사용·윈드업 회피·추격 정지·이중 피해 방지·마커 수명 관리·발사체 회귀 없음), 신규 순수 함수 두 개 모두 엣지/NaN/0-나눗셈 가드가 갖춰져 있으며 전체 366 테스트 GREEN·lint clean. 발견 항목은 Minor 3개뿐이고 그중 둘은 잠정 미발현이거나 이미 문서화됨.

---

## Minor (Nice to Have)

### M1 — `coneHitsTarget` 각도 무제한 vs 마커 반각 클램프(89°) 비대칭 → 백로그 이월

- **위치:** `EnemyAttackLogic.ts` — `meleeConeMarkerScale`(반각 `[0,89°]` 클램프) vs `coneHitsTarget`(coneAngleDeg 무제한).
- **내용:** 마커는 `tan(90°)=Infinity` 발산을 막으려 반각을 89°로 클램프하지만 명중 판정은 클램프하지 않는다. `coneAngleDeg ≥ ~178°`인 데이터가 생기면 마커가 실제 명중 부채꼴보다 **좁게** 그려져(예고보다 넓게 맞음) 공정성이 깨질 수 있다.
- **현재 영향:** **미발현.** 실 데이터 반각은 75°/60°/45°로 89° 한참 아래. 모든 배포 데이터에서 마커와 판정이 일치한다.
- **처리:** ~~백로그 F25로 이월~~ → **해결됨(리워크).** 이후 7단계 인게임 테스트에서 스프라이트-스케일 마커가 반복적으로 어긋나(방향·anchor·가로세로) 마커를 **Graphics 섹터(호)** 방식으로 전환했다. 이제 마커가 `arc(-coneAngleDeg/2, +coneAngleDeg/2)`로 실제 각을 그려 클램프 자체가 없어졌고, 마커와 `coneHitsTarget`이 어떤 각도에서도 정합한다(피처 테스트가 "호 스팬 = coneAngleDeg" 단언). 백로그 F25는 「완료」로 이동.

### M2 — `scaleY`(far-end 폭)는 꼭짓점=적 삼각형/섹터 모양을 전제 → 이미 QA 문서에 명시(무조치)

- **위치:** `EnemyAttackLogic.ts` `meleeConeMarkerScale` — `scaleY = 2·range·tan(반각)`은 부채꼴 far edge 폭.
- **내용:** placeholder 스프라이트가 삼각형/섹터가 아니라 **사각형**이면 꼭짓점 근처가 실제 부채꼴을 과도하게 덮어 보일 수 있다.
- **처리:** **무조치.** QA 문서(`enemy-melee-sweep-test.md` 씬/프리팹 섹션)가 이미 "부채꼴/삼각형 placeholder + anchor x=0,y=0.5(꼭짓점=적)"로 모양을 명시했다. 7단계 사용자 프리팹 작성 시 이 레시피를 따르면 일치한다.

### M3 — `xpDrop`(35/28/26)이 메모리 "기본 70+" 가이드 아래 → 의도적 밸런스 이월(무조치)

- **내용:** 세 적의 xpDrop이 70 미만이다.
- **처리:** **무조치(의도적).** 계획 §4·QA 문서가 xpDrop을 현 로스터 18~35 대역 placeholder로 두고 밸런싱 단계에서 일괄 확정한다고 명시(S2b와 동일 보류). 프로젝트의 밸런스 예외 규칙이 허용하는 이월이다. [[default_xp_drop_70]]

---

## 결론

코드 품질·타입 안전성·실제 버그에 해당하는 Critical/Important 지적이 없어 즉시 수정 대상이 없다. Minor 3개는 각각 백로그 이월(M1)·이미 문서화(M2)·의도적 밸런스 이월(M3)로 처리하고 `pnpm wf pass review`로 진행한다.
