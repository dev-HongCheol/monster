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
if [ "$PLAN_APPROVED" != "true" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] 계획이 승인되지 않았습니다. 계획 문서 작성 후 승인을 요청하세요."}'
  exit 0
fi
if [ "$QA_DOC_READY" != "true" ]; then
  echo '{"permissionDecision":"deny","message":"⛔ [GATE] QA 문서와 테스트 코드를 먼저 작성하세요. 완료 후 구현 준비 완료 확인을 요청하세요."}'
  exit 0
fi
echo '{}'
exit 0