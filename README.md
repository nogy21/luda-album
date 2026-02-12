# Luda Album

루다의 첫 설날을 기념하는 모바일 우선 가족 앨범입니다.

## 기능

- 홈: 대표 이미지와 인사 문구
- 갤러리: 10장 구성, 모바일 그리드 + 탭 확대 보기
- 덕담: 닉네임/내용 입력, 최신순 목록, 실패 메시지 표시

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 테스트/검증

```bash
npm run test
npm run lint
npm run build
```

## Supabase 연결 (선택)

환경 변수가 없으면 덕담 기능은 인메모리 fallback으로 동작합니다.

`.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# 선택: 서버 전용 권한 키
SUPABASE_SERVICE_ROLE_KEY=...
```

DB 스키마는 `docs/db/guestbook.sql`을 사용하세요.

## 배포

1. Vercel에 프로젝트 연결
2. 환경 변수 설정 (Supabase 사용 시)
3. 프로덕션 URL 공유
