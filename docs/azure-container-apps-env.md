# Azure Container Apps Environment and Secret Mapping

## 1. Required Variables
- `PORT`: 앱 수신 포트 (기본 3000)
- `ENTRA_AUTH_REQUIRED`: `true` 또는 `false`
- `ENTRA_ISSUER`: Entra 토큰 발급자 URL
- `ENTRA_AUDIENCE`: API audience (`api://...`)
- `ENTRA_JWKS_URI`: (선택) JWKS URL
- `DATABASE_URL`: PostgreSQL 접속 문자열
- `AZURE_BLOB_PDF_CONTAINER`: PDF 저장 컨테이너명
- `AZURE_STORAGE_ACCOUNT_URL`: Blob account URL (Managed Identity 경로)

## 2. Secret vs Plain Env
### Secret으로 관리 권장
- `DATABASE_URL`
- `ENTRA_AUDIENCE` (조직 정책에 따라)

### 일반 Env로 관리 가능
- `PORT`
- `ENTRA_AUTH_REQUIRED`
- `ENTRA_ISSUER`
- `ENTRA_JWKS_URI`
- `AZURE_BLOB_PDF_CONTAINER`
- `AZURE_STORAGE_ACCOUNT_URL`

## 3. Managed Identity 권장 구성
1. Container App에 System-assigned Managed Identity 활성화
2. Storage Account에 `Storage Blob Data Contributor` 역할 부여
3. Key Vault를 사용한다면 Container App identity에 `Key Vault Secrets User` 역할 부여

## 4. ACA 설정 예시 (개념)
- Container App
  - Ingress: External
  - Target port: `3000`
  - Min/Max replicas: `1/3` (MVP)
- Revisions
  - Single revision mode 권장(MVP)

## 5. 운영 체크리스트
1. `/health` 응답 200 확인
2. `POST /notes` 및 `GET /notes` 정상 확인
3. `POST /notes/{id}/export/pdf` 정상 확인
4. Blob 컨테이너에 PDF 파일 생성 확인
5. 로그에서 인증/DB 연결 오류 없음 확인
