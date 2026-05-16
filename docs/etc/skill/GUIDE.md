# Custom Skill 설치 가이드

이 폴더의 스킬들은 Claude Code의 개인 스킬 디렉토리에 설치해야 사용할 수 있습니다.

## 설치 경로

| OS | 스킬 설치 경로 |
|----|----------------|
| macOS / Linux | `~/.claude/skills/` |
| Windows | `%USERPROFILE%\.claude\skills\` |

## plan-and-build 스킬 설치

### macOS / Linux

```bash
mkdir -p ~/.claude/skills/plan-and-build
cp docs/etc/skill/plan-and-build/SKILL.md ~/.claude/skills/plan-and-build/SKILL.md
```

### Windows (PowerShell)

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\plan-and-build"
Copy-Item "docs\etc\skill\plan-and-build\SKILL.md" "$env:USERPROFILE\.claude\skills\plan-and-build\SKILL.md"
```

### Windows (명령 프롬프트 cmd)

```cmd
mkdir "%USERPROFILE%\.claude\skills\plan-and-build"
copy "docs\etc\skill\plan-and-build\SKILL.md" "%USERPROFILE%\.claude\skills\plan-and-build\SKILL.md"
```

## 설치 확인

Claude Code에서 다음을 입력해 스킬이 목록에 보이면 설치 완료:

```
/plan-and-build
```

## 스킬 목록

| 스킬 | 설명 |
|------|------|
| [plan-and-build](./plan-and-build/SKILL.md) | autoplan → superpowers TDD 구현 → review/ship 체이닝. 기능 개발 전체 사이클에 사용. |

## 전제 조건

`plan-and-build` 스킬은 아래 도구가 설치되어 있어야 합니다:

- **gstack** — `/autoplan`, `/review`, `/ship` 스킬 제공
- **superpowers** — `superpowers:executing-plans`, `superpowers:test-driven-development` 제공

설치 확인:
```bash
# gstack
ls ~/.claude/skills/gstack/

# superpowers
ls ~/.claude/plugins/cache/claude-plugins-official/superpowers/
```
