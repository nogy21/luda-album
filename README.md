# Luda Album

루다의 첫 설날을 기념하는 모바일 우선 가족 앨범입니다.

## 기능

- `/photos`: 스토리텔링 히어로, 월별 아카이브 메타데이터, 라이트박스
- `/guestbook`: 닉네임/덕담 입력, `idle/posting/success/error` 상태 피드백
- `/admin`: 관리자 인증, 파일별/전체 업로드 진행률, 실패 파일 재시도

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
`/admin` 업로드는 Supabase Storage 설정이 필요합니다.

`.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# 선택: 서버 전용 권한 키
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=luda-photos
ADMIN_UPLOAD_PASSWORD=...
ADMIN_SESSION_SECRET=...
```

DB 스키마는 `docs/db/guestbook.sql`을 사용하세요.

## 배포

1. Vercel에 프로젝트 연결
2. 환경 변수 설정 (Supabase 사용 시)
3. 프로덕션 URL 공유

## Migration Note (2026-02-14)

### 무엇이 바뀌었나
- 디자인 토큰을 새 팔레트로 교체: `#E96A8D / #FFF9F5 / #1F1720 / #6B5A63 / #F0DDE4`
- `/photos`를 감성형 히어로 + CTA 구조로 재구성하고 월별 카드에 `업데이트 메타데이터`를 추가
- GSAP 사용 범위를 두 지점으로 제한:
  - 첫 방문 히어로 인트로(가벼운 stagger)
  - `용돈 주세요` 버튼 탭 버스트(600ms 이하)
- `/guestbook`에 명시적 전송 상태와 `aria-live` 피드백을 추가
- `/admin`에 관리자 세션 + 파일별/전체 업로드 진행률 + 실패 재시도 플로우를 추가

### 왜 이렇게 바꿨나
- 첫 3초 안에 가치/다음 행동을 이해하게 하고, 가족 사용자에게 읽기 쉬운 계층을 제공하기 위해
- 감성적 인터랙션은 유지하되 성능/유지보수를 위해 GSAP를 고효과 구간에만 제한하기 위해
- 업로드 실패 시 운영자가 복구 가능한 실사용 UX를 만들기 위해
