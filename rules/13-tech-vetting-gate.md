# 13. Technology Vetting & Dependency Gate Policy

> **Title**: Technology Vetting & Dependency Gate Policy  
> **Rule ID**: 13  
> **Scope**: Global (Antigravity, Claude Code, Codex, LazySeries Agents)  
> **Trigger**: When evaluating, recommending, benchmarking, or integrating external open-source tools, models, frameworks, or dependencies into the Lazy ecosystem.

---

## 1. BACKGROUND & PROBLEM STATEMENT

외부 오픈소스나 기술 목록을 검토할 때 마케팅 홍보 문구(README)를 무비판적으로 수용하여 "블록체인형", "변조 불가능", "99% 클린", "즉시 기술적 격차"와 같은 과장된 수식어를 그대로 답습하는 것은 기술적 기만이다.
또한 무거운 런타임 의존성(Docker, GPU A100 등)과 사법적 위험(제3자 프록시 경유에 따른 Chain of Custody 오염)을 은폐한 채 "무조건 좋아진다"는 프레임으로 도입을 추천하는 것은 시스템의 신뢰성을 파괴한다.

모든 외부 기술 조사 및 도입 검토는 반드시 다음 3대 필수 게이트(Hard Gates)를 사전 통과해야 한다.

---

## 2. THE THREE MANDATORY HARD GATES

### Gate 1: 사법·보안 적격성 게이트 (Legal Defensibility Gate)

1. **Chain of Custody(포렌식 증거 무결성) 제1원칙**:
   - 법원·수사기관 제출용 증거 수집/채증 파이프라인에는 어떠한 형태의 제3자 호스티드 프록시(예: `r.jina.ai` 등 외부 중계 서버)도 개입되어서는 안 된다. 제3자 서버를 거친 데이터는 증거의 동일성과 무결성이 법정에서 탄핵된다.
   - 증거는 대상 서버로부터 직접 로컬로 페치한 **원시 바이트(Raw Bytes) + 즉시 로컬 해시(SHA-256)**로만 채증해야 한다.
   - 가공된 마크다운/텍스트는 "파생물"에 불과하므로, 리서치 보조 목적으로만 격리하고 사법 증거물로 포장하지 않는다.

2. **암호학적 용어 엄격성 (Tamper-evident vs Tamper-proof)**:
   - 로컬 append-only 로그 및 해시 체인은 **"변조 탐지 가능(tamper-evident)"**일 뿐이며, **"변조 불가능(tamper-proof / immutable)"**이 아니다.
   - 외부 앵커(RFC 3161 공인시각인증 TSA 서버 타임스탬프, 외부 블록체인/서명된 원격 체크포인트)가 없는 로컬 체인은 공격자의 체인 재계산(rewrite) 공격을 탐지할 수 없다. 사법기관 소명용 기능 설계 시 이 한계와 외부 앵커링 요구사항을 반드시 명시해야 한다.

### Gate 2: 의존성 비용 투명성 게이트 (Dependency Cost Gate)

1. **의존성 비용 은폐 금지**:
   - 외부 도구를 추천할 때 다음 4대 비용 요소를 누락하고 "즉시 적용 가능", "무조건 좋아진다"로 서술하는 행위를 엄격히 금지한다:
     - **하드웨어 제약**: 고사양 GPU(VRAM 용량 등) 필수 여부.
     - **인프라 데몬**: Docker, 외부 DB(MySQL, Redis, ES 등) 상주 필요 여부.
     - **외부 네트워크**: 폐쇄망 오프라인 작동 가능 여부 및 외부 클라우드 API 호출 종속성.
     - **런타임 오버헤드**: 파이썬 인터프리터, 무거운 가상환경, C++ 빌드 툴체인 종속성.

2. **BYOB (Bring-Your-Own-Binary) 격리 원칙**:
   - 코어 경량 CLI(`lazyothers`, `lazyagentic` 등)의 "의존성 최소, 로컬 우선, 폐쇄망 호환" 철칙을 훼손하지 않는다.
   - 무거운 모델이나 외부 데몬이 필요한 기능은 코어 강제 종속성이 아니라, 사용자의 런타임 환경을 사전 검증한 뒤 선택적으로 활성화되는 **BYOB (선택적 격리 모듈)** 패턴으로만 설계한다.

3. **마케팅 수치 인용 금지**:
   - "잡음 99% 제거", "속도 3배/5배 개선", "혁신적" 등 원작자 README의 비공인 홍보 문구를 사실인 것처럼 인용하지 않는다.
   - 성능 수치를 기재할 때는 공인 벤치마크 논문 출처를 병기하거나, 로컬 실행 환경에서의 실측치(ms, TPS, F1)만을 기재한다.

### Gate 3: 수치 실측 영수증 선행 원칙 (Receipt-First Policy)

1. **어림짐작 보고 전면 금지**:
   - "전수 N개", "N선 검토", "통과율 N%"를 사용자에게 진술하기 전에, 반드시 해당 수치를 기계적으로 계측한 스크립트 실행 영수증(JSON/로그)을 먼저 확보해야 한다.
   - 머릿속 단순 덧셈이나 기억에 의존한 어림짐작으로 숫자를 작성하는 행위는 허위 진술로 간주한다.

2. **검증 영수증 구조**:
   - 전수 조사 진술 시 다음 3가지 메타데이터를 반드시 로그나 파일로 입증해야 한다:
     - 1차 출처 파일 경로 (`source_file`)
     - 고유 식별자 수량 실측치 (`unique_ids`)
     - 도메인/지역별 세부 소계 합산 검산식 (`breakdown`)

---

## 3. VIOLATION AUDIT & REMEDIATION

본 규칙을 위반하여 과장된 수식어, 의존성 은폐, 프록시 채증 위험, 비실측 수치를 보고한 경우:
1. 즉시 과장된 수식어를 삭제하고 실제 기술적 실체(tamper-evident, 파생물 등)로 정정한다.
2. 은폐된 시스템 의존성(GPU, Docker 등)을 투명하게 공개하고 BYOB 패턴으로 재배치한다.
3. 기계적 감사 스크립트를 실행하여 생성된 실제 영수증(Receipt)을 사용자에게 제출한다.
