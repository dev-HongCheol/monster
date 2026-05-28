#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).file_path||'')}catch(e){}})")
[ -z "$FILE" ] && echo '{}' && exit 0
[[ "$FILE" == *"tests/"* ]] && echo '{}' && exit 0
[[ "$FILE" == *"docs/"* ]] && echo '{}' && exit 0
[[ "$FILE" == *".claude/"* ]] && echo '{}' && exit 0
[[ "$FILE" != *"game/assets/scripts"* ]] && echo '{}' && exit 0
[[ "$FILE" != *.ts ]] && echo '{}' && exit 0
STATE="$CLAUDE_PROJECT_DIR/.claude/workflow-state.json"
if [ ! -f "$STATE" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] workflow-state.json 없음. 먼저 계획을 작성하고 승인받으세요."}'
  exit 0
fi
PLAN_APPROVED=$(node -p "require('$STATE').plan_approved" 2>/dev/null)
QA_DOC_READY=$(node -p "require('$STATE').qa_doc_ready" 2>/dev/null)
CSO_DONE=$(node -p "require('$STATE').cso_done" 2>/dev/null)
TS_CHECK_CLEAN=$(node -p "require('$STATE').ts_check_clean" 2>/dev/null)
LINT_CLEAN=$(node -p "require('$STATE').lint_clean" 2>/dev/null)
CODE_REVIEW_CLEAN=$(node -p "require('$STATE').code_review_clean" 2>/dev/null)
if [ "$PLAN_APPROVED" != "true" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] 계획이 승인되지 않았습니다. 계획 문서 작성 후 승인을 요청하세요."}'
  exit 0
fi
if [ "$QA_DOC_READY" != "true" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] QA 문서와 테스트 코드를 먼저 작성하세요. 완료 후 구현 준비 완료 확인을 요청하세요."}'
  exit 0
fi
# 검증이 모두 완료된 상태(cso + ts + lint + code_review 전부 clean)에서는 스크립트 수정 불가
# 코드 리뷰 수정 중에는 cso_done/ts_check_clean/lint_clean이 false로 리셋되므로 이 블록을 통과함
if [ "$CSO_DONE" = "true" ] && [ "$TS_CHECK_CLEAN" = "true" ] && [ "$LINT_CLEAN" = "true" ] && [ "$CODE_REVIEW_CLEAN" = "true" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] 검증 완료 상태입니다. 코드 수정이 필요하면 cso_done, ts_check_clean, lint_clean을 false로 초기화하고 8번(/cso)부터 재실행하세요."}'
  exit 0
fi
echo '{}'
exit 0
