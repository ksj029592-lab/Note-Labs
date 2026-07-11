# NoteLabs Web App (TDD Start)

이 저장소는 TDD(RED -> GREEN -> REFACTOR)로 개발을 시작한 초기 상태입니다.

## 현재 구현 상태
- Note 도메인 규칙 구현
  - 생성 시 제목 공백 금지
  - 이름 변경
  - 소프트 삭제
  - 버전 증가
- Notes 애플리케이션 서비스 구현
  - 노트 생성
  - 사용자별 노트 조회
  - 버전 기반 이름 변경
  - 충돌 사본 생성 정책
- HTTP 인터페이스 구현
  - `POST /notes`
  - `GET /notes?userId=`
  - `POST /notes/rename` (충돌 시 `409`)
  - `POST /notes/:noteId/export/pdf`
- Express 서버 어댑터 구현
  - `GET /health`
  - 인증 선택 모드(`requireAuth`) 지원
- Azure 인증 미들웨어 기초
  - Bearer 토큰 파싱
  - Entra 토큰 검증 함수 주입 방식
- Entra JWT 검증기 구현
  - issuer/audience 검증
  - JWKS 기반 서명 검증(jose)
- 오프라인 동기화 큐 로직
  - FIFO 처리
  - 실패 항목 재시도 유지
- PostgreSQL 저장소 어댑터 구현
  - 노트 upsert/find/list
  - conflict copy 저장/조회
- PostgreSQL 저장소 선택 팩토리
  - `DATABASE_URL` 유무로 InMemory/Postgres 자동 선택
- Azure Blob PDF 저장 어댑터 구현
  - Managed Identity 우선 팩토리
  - PDF content-type 업로드
- PostgreSQL 마이그레이션 러너 구현
  - `npm run db:migrate`
- Azure Container Apps 환경/시크릿 매핑 문서화
  - `docs/azure-container-apps-env.md`
- 테스트/타입체크 파이프라인 구성

## 실행
```bash
npm install
npm test
npm run typecheck
npm run test:watch
npm run dev:server
npm run db:migrate
```

## 현재 TDD 사이클
1. 도메인 사이클: 노트 생성/수정/삭제 규칙
2. 애플리케이션 사이클: 노트 생성/조회 서비스
3. 인터페이스 사이클: HTTP 핸들러(`POST/GET`)
4. 동기화 사이클: rename 버전 충돌 + conflict copy
5. 서버 사이클: Express 어댑터 + 통합 테스트
6. 인증 사이클: Entra 인증 미들웨어 + 앱 통합
7. 오프라인 사이클: 재전송 큐 로직
8. 인프라 사이클: PostgreSQL 저장소 어댑터
9. 보안 사이클: Entra JWT 검증기
10. 런타임 사이클: env 기반 저장소 선택 팩토리
11. 스토리지 사이클: Azure Blob PDF 저장 어댑터
12. 유스케이스 사이클: PDF export API 연결
13. 운영 사이클: PostgreSQL 마이그레이션 러너

## 다음 추천 사이클
1. PDF 생성 로직을 `pdf-lib` 기반 실제 문서 렌더링으로 교체
2. DB 마이그레이션 버전 테이블 도입(이미 적용된 스크립트 추적)
3. App Insights 연동 및 요청 단위 추적 ID 로깅
