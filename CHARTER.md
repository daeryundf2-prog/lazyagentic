# CHARTER — lazyagentic

## Role
Governance plane — 프롬프트 거버넌스·규칙 라우팅·자문 가드.

## Do
- 규칙 기반 에이전트 행동 지침 (rules-only, 모델 준수 의존)
- `enforced/` 옵트인 훅 — advisory 기본, strict는 명시 설정 시에만

## Don't
- OS 샌드박스/강제 차단을 주장하지 않는다 — 현재 구현은 advisory
- "Fail-Closed Policy Engine", "Jailbreak-resistant" 표현 금지
- 증거 채증·서명 검증 주장 금지

## Contracts
- Consumes: —
- Produces: 거버넌스 판정(ask/allow/block) — `verification_status` 표기
- Vendored: `contracts/` (lazy-contracts, hash-pinned)

## Claims allowed
`advisory` 기본. "fail-closed"는 STRICT 모드 + 실제 블로킹 경로가 검증된 경우에만.
