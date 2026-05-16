---
name: plan-and-build
description: Use when starting feature development that needs planning through implementation — ensures superpowers TDD methodology is activated after autoplan approval instead of being skipped
---

# Plan and Build

## Overview

Chains `/autoplan` → superpowers implementation → `/review` + `/ship` suggestion.  
Prevents the common failure mode where superpowers (TDD + executing-plans) is forgotten after planning and agents write code without the methodology.

## Workflow

```
Phase 1: PLAN
  /autoplan → CEO + Eng review → human approval
       ↓ (approved)
Phase 2: IMPLEMENT
  superpowers:executing-plans + superpowers:test-driven-development → code
       ↓ (all tasks done)
Phase 3: SHIP
  suggest /review → suggest /ship
```

## Steps

### Phase 1: Plan

1. Invoke `/autoplan` — runs CEO + Engineering review
   - Design review (`/plan-design-review`) only if UI/visual work is in scope
2. Present completed plan to human
3. **STOP. Wait for explicit human approval before proceeding.**
   - Do not interpret silence as approval
   - Do not start Phase 2 until the human says "go", "진행해", "ㄱㄱ", or equivalent

### Phase 2: Implement (after approval only)

1. Invoke `superpowers:executing-plans` — sets up task tracking and subagent framework
2. Invoke `superpowers:test-driven-development` — enforces RED-GREEN-REFACTOR per task
3. Implement all planned tasks following superpowers discipline:
   - RED: Write failing test first
   - GREEN: Write minimal code to pass
   - REFACTOR: Clean up while keeping tests green
4. Do NOT skip TDD for "simple" tasks — no exceptions

### Phase 3: Ship

1. After all tasks complete, say: "구현 완료. `/review`와 `/ship` 진행할까요?"
2. Wait for human confirmation — do NOT auto-invoke either skill

## Critical Rules

| Rule | Violation |
|------|-----------|
| Human approval required before Phase 2 | Starting implementation after plan display |
| superpowers skills activated before any code | Writing code without invoking superpowers:test-driven-development |
| TDD applies to every task | "This task is too simple for tests" |
| Suggest /review + /ship, don't auto-run | Invoking /ship without asking |

## When NOT to Use

- Documentation/design only → `/office-hours` or `/autoplan` alone
- Hotfix (no planning needed) → `superpowers:executing-plans` directly
- Planning review only → `/autoplan` directly
- Already past planning phase → start at Phase 2 with superpowers skills

## Baseline Failure This Skill Addresses

Without this skill, agents:
1. Run `/autoplan` and generate a great plan
2. Immediately start writing code — skipping `superpowers:executing-plans` and `superpowers:test-driven-development`
3. Produce untested, unstructured code that violates the superpowers methodology

This skill exists to make the superpowers activation explicit and mandatory.
