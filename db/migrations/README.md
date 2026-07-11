# PostgreSQL Migrations

## Files
- `001_init_notes.sql`: notes, note_conflict_copies 테이블 생성
- `002_indexes.sql`: 조회/정렬 최적화 인덱스 생성
- `003_note_pages.sql`: note_pages 테이블 및 페이지 조회 인덱스 생성
- `004_note_strokes.sql`: note_strokes 테이블 및 스트로크 조회 인덱스 생성
- `005_conflict_payload_hash.sql`: 충돌 사본 payload hash 컬럼 추가
- `006_conflict_payload_summary.sql`: 충돌 사본 페이지/스트로크 요약 컬럼 추가

## Apply Order
1. 001_init_notes.sql
2. 002_indexes.sql
3. 003_note_pages.sql
4. 004_note_strokes.sql
5. 005_conflict_payload_hash.sql
6. 006_conflict_payload_summary.sql

## Notes
- SQL은 idempotent(`if not exists`)로 작성되어 재실행이 안전합니다.
- 운영 환경에서는 마이그레이션 툴(예: Flyway, Liquibase, dbmate) 연동을 권장합니다.
