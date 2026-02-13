# Luda Album UI/UX 갭 분석 체크리스트

작성일: 2026-02-13  
대상 버전: 현재 `main` 작업본 (`/photos`, `/guestbook`, `/admin`)  
목적: 경쟁 서비스 분석 결과를 기준으로, 화면별 UX 품질 격차를 빠르게 진단하고 개선 우선순위를 정한다.

## 1) 사용 방법

평가 스코어(각 항목 공통):
- `0점`: 없음/동작 불가
- `1점`: 기본 동작은 가능하지만 불명확하거나 불편
- `2점`: 의도/상태/다음 행동이 명확하고 완성도 높음

진행 방식:
1. 실제 기기 폭 `360`, `390`, `430`에서 화면 확인
2. 항목별 점수 기록
3. `0점` 항목은 즉시 개선 후보, `1점`은 품질 고도화 후보로 분류
4. 섹션 합계로 우선순위 결정

## 2) 공통 진단 항목 (모든 화면)

| 항목 | 통과 기준 | 점수(0-2) | 메모 |
|---|---|---:|---|
| 첫 3초 가치 전달 | "이 앱에서 무엇을 할 수 있는지" 즉시 이해 가능 |  |  |
| 주요 CTA 명확성 | 다음 행동 1개가 시각적으로 분명함 |  |  |
| 상태 피드백 | 로딩/성공/실패 메시지가 명확함 |  |  |
| 터치 접근성 | 주요 터치 요소 높이 44px 이상 |  |  |
| 가독성 | 본문 텍스트 대비, 줄간격, 크기 안정적 |  |  |
| 오류 복구 경로 | 실패 후 재시도 동선이 바로 보임 |  |  |
| 신뢰/프라이버시 | 누가 볼 수 있는지, 데이터 처리 범위 안내 |  |  |

---

## 3) 온보딩 체크리스트 (`/photos` 첫 진입)

목표: 가족 사용자(특히 비기술 사용자)가 10초 안에 앱 구조를 이해하고 첫 행동을 시작.

| 항목 | 기대 상태 | 점수(0-2) | 개선 액션 후보 |
|---|---|---:|---|
| 첫 화면 정보구조 | 헤더/주요 콘텐츠/하단 네비의 역할이 즉시 구분됨 |  |  |
| 사용자 분기 안내 | "보는 사람" vs "업로드 관리자" 동선이 분리됨 |  |  |
| 초회 사용 안내 | 핵심 기능 2~3개를 짧게 안내(툴팁/배너) |  |  |
| 빈 상태 대비 | 사진이 없을 때도 의미 있는 안내/CTA 제공 |  |  |
| 탐색 안정감 | 탭 전환 후 사용자가 현재 위치를 잃지 않음 |  |  |
| 감정적 훅 | 가족 앨범의 감정 가치(기억/성장)가 텍스트나 카드로 전달 |  |  |
| 접근성 | 스킵 링크/포커스/명확한 라벨 유지 |  |  |

경쟁 서비스 벤치마크 포인트:
- Google Photos: 자동 분류/검색 중심 첫 화면 이해도
- FamilyAlbum: 가족 전용 톤과 쉬운 구조
- iCloud Photos: 개인/공유 경계가 명확한 모델

---

## 4) 업로드 체크리스트 (`/admin`)

목표: 관리자가 실수 없이 빠르게 업로드하고, 결과를 신뢰할 수 있어야 함.

| 항목 | 기대 상태 | 점수(0-2) | 개선 액션 후보 |
|---|---|---:|---|
| 인증 UX | 로그인 실패 원인/재시도 방식이 명확함 |  |  |
| 사전 검증 | 파일 형식/용량/개수 제한이 업로드 전 안내됨 |  |  |
| 진행 상태 | 업로드 진행률(파일별/전체) 가시화 |  |  |
| 실패 복구 | 일부 실패 시 재업로드/건너뛰기 가능 |  |  |
| 메타데이터 | 촬영일/캡션/태그 입력 또는 자동 추출 경로 제공 |  |  |
| 완료 확인 | 업로드 후 즉시 결과(썸네일/경로/개수) 확인 가능 |  |  |
| 운영 안전성 | 중복 업로드 탐지 또는 경고 |  |  |

경쟁 서비스 벤치마크 포인트:
- Google Photos: 자동 정렬/검색 가능한 업로드 후 구조
- FamilyAlbum: 가족 공유 맥락에 맞춘 간단한 업로드 경험

---

## 5) 공유 체크리스트 (`/photos`, `/guestbook`, 링크 공유 흐름)

목표: "누구와 어떻게 공유되는지"가 명확하고, 공유 후 상호작용이 이어짐.

| 항목 | 기대 상태 | 점수(0-2) | 개선 액션 후보 |
|---|---|---:|---|
| 공유 진입점 | 화면 내 공유 CTA가 명확하고 찾기 쉬움 |  |  |
| 공유 범위 안내 | 공개 범위(가족 전체/일부/관리자 전용)가 명확 |  |  |
| 권한 모델 | 보기/댓글/업로드 권한이 역할별로 분리됨 |  |  |
| 딥링크 | 특정 사진/월별 앨범을 링크로 직접 공유 가능 |  |  |
| 상호작용 루프 | 덕담/반응/댓글 후 재방문을 유도하는 피드백 제공 |  |  |
| 세대 친화 채널 | 앱 미사용자용 대체 채널(이메일 요약 등) 고려 |  |  |
| 안전장치 | 악성/실수 콘텐츠 대응(숨김/신고/관리) 경로 존재 |  |  |

경쟁 서비스 벤치마크 포인트:
- FamilyAlbum: 가족 구성원 범위/역할 기반 공유
- iCloud: Shared Library 모델의 경계 명확성
- Google Photos: 사람/기간 기반 공유 자동화

---

## 6) 회상(리텐션) 체크리스트 (`/photos`의 하이라이트/월별 아카이브)

목표: 사용자가 다시 방문할 이유를 정기적으로 제공.

| 항목 | 기대 상태 | 점수(0-2) | 개선 액션 후보 |
|---|---|---:|---|
| 기억 트리거 | "오늘의 추억", "이번 달 하이라이트" 등 재방문 장치 |  |  |
| 시간 탐색성 | 월/연 단위 이동이 빠르고 직관적 |  |  |
| 스토리화 | 사진 묶음을 이야기처럼 소비 가능한 모드 제공 |  |  |
| 개인화 | 자주 본 사진/좋아요 기반 추천 |  |  |
| 연간 리캡 | 월간/연간 요약 카드 자동 생성 |  |  |
| 탐색 연속성 | 라이트박스/아카이브 이동 시 맥락 유지 |  |  |
| 감성 완성도 | 캡션/정렬/리듬이 회상 경험을 방해하지 않음 |  |  |

경쟁 서비스 벤치마크 포인트:
- Google Photos / Amazon Photos: "Memories", 날짜 기반 회상
- FamilyAlbum: 1s Movie, 성장기록 중심 회상
- Tinybeans: 마일스톤 기반 저널링

---

## 7) 현재 IA/커뮤니케이션 흐름 (코드 근거)

| 흐름 | 현재 동작 | 코드 근거 | 확인된 갭 |
|---|---|---|---|
| 사진 탐색 (`/photos`) | 상단 셔플 카드 + 하이라이트 + 월별 아카이브 + 라이트박스 | `app/photos/page.tsx`, `components/gallery-section.tsx`, `components/app-shell.tsx`, `lib/gallery/featured.ts` | 공유 CTA/권한 제어가 화면에 없음 |
| 덕담 상호작용 (`/guestbook`) | 목록 조회 + 작성 + optimistic update | `app/guestbook/page.tsx`, `components/guestbook-section.tsx`, `app/api/guestbook/route.ts` | 반응/스레드/알림/가시범위 제어 없음 |
| 관리자 업로드 (`/admin`) | 비밀번호 세션 로그인 후 다중 파일 업로드 | `components/admin-console.tsx`, `app/api/admin/upload/route.ts`, `lib/admin/auth.ts` | 파일별 진행률/부분 실패 복구 없음 |
| 전역 IA | 하단 탭 2개(사진/덕담) 중심 | `components/app-shell.tsx` | 초대/공유 허브/역할 관리 진입점 없음 |

---

## 8) 공식 경쟁 근거 매트릭스 (2026-02-13)

| 영역 | 공식 서비스 확인사항 | 현재 Luda 상태 | 갭 메모 |
|---|---|---|---|
| 멤버/권한 모델 | Google Partner Sharing은 1:1 파트너 공유 중심 `[G1]`, iCloud Shared Library는 최대 6명 공동 라이브러리 `[A1]`, FamilyAlbum은 Admin/Member 권한 분리 `[F2]` | 관리자 인증 외 일반 사용자 역할 구분 없음 | `P0`: 가족 역할/권한 매트릭스 필요 |
| 자동 공유 규칙 | Google은 날짜/얼굴 그룹 필터 공유 `[G1]`, iCloud는 카메라 자동 공유 모드 제공 `[A1]` | 수동 업로드만 존재 | `P1`: 자동 분류/자동 공유 규칙 필요 |
| 프라이버시 가시성 | Google Locked Folder는 검색/추억/공유 제외 `[G2]`, FamilyAlbum은 Admins Only 공개 범위 제공 `[F1]` | 사진/덕담 단위 공개 범위 설정 없음 | `P0`: 항목별 visibility 제어 필요 |
| 회상/리텐션 | Google Recap/Featured Memories `[G4]`, Amazon This Day/Memories `[AM1]`, FamilyAlbum 정기 컴필레이션 `[F3]` | 셔플/월별 아카이브 중심 | `P1`: 주기적 재방문 장치 필요 |
| 알림/세대친화 채널 | Tinybeans는 이메일/푸시 빈도 설정 및 팔로워 이메일 업데이트 제공 `[T1][T2][T3]`, Google 공유 시 앱/푸시/이메일 알림 `[G6]` | 앱 내부 외 대체 채널 없음 | `P1`: 이메일 요약/초대 플로우 필요 |
| 디바이스 확장 | FamilyAlbum Digital Frame `[F4]`, Amazon Echo Show/Fire TV 노출 `[AM1]` | 모바일 웹 단일 채널 | `P2`: 거실 디스플레이 확장 검토 |
| 플랜/제약 설계 | FamilyAlbum free/premium 차등(영상 길이, 공유 옵션 등) `[F3]`, Tinybeans free 월 20개 업로드 `[T4]`, Amazon Prime 무제한 사진(지역/플랜 조건) `[AM1]` | 유료/무료 엔타이틀먼트 없음 | `P2`: 향후 수익화/제약 정책 정의 필요 |

---

## 9) 점수 집계 템플릿

| 섹션 | 항목 수 | 만점 | 현재 점수 | 우선순위 |
|---|---:|---:|---:|---|
| 공통 | 7 | 14 |  |  |
| 온보딩 | 7 | 14 |  |  |
| 업로드 | 7 | 14 |  |  |
| 공유 | 7 | 14 |  |  |
| 회상 | 7 | 14 |  |  |
| 합계 | 35 | 70 |  |  |

우선순위 규칙:
- `P0`: 0점 항목이면서 사용자 목표 달성을 직접 막는 항목
- `P1`: 1점 항목 중 전환/재방문 영향이 큰 항목
- `P2`: 완성도 개선 항목

## 10) 현재 코드 기준 즉시 개선 후보 (재정렬)

아래 항목은 코드 근거 + 공식 벤치마크를 함께 반영한 우선순위 초안이다.

- `P0`: 공유 범위/권한 모델 부재 (현재 탭 구조와 API에 가족 역할/가시범위 모델 없음)  
  근거: `components/app-shell.tsx`, `app/api/guestbook/route.ts`, `[G1][A1][F1][F2]`
- `P0`: 업로드 실패 복구/진행 상태 부족 (업로드 중 상태 텍스트는 있으나 파일별 진행률, 부분 실패 재시도 없음)  
  근거: `components/admin-console.tsx`, `app/api/admin/upload/route.ts`
- `P1`: 알림/세대친화 채널 부재 (앱 미사용 가족을 위한 이메일 루프 없음)  
  근거: `[T1][T2][T3][G6]`
- `P1`: 회상 자동화 약함 (정기 리캡/"오늘" 기반 재방문 루프 부재)  
  근거: `components/gallery-section.tsx`, `[G4][AM1][F3]`
- `P2`: 디바이스 확장 및 플랜 정책 미정의  
  근거: `[F4][AM1][F3][T4]`

## 11) 다음 스프린트 실행 제안 (2주)

1. 권한 모델 MVP: `가족 전체/일부 그룹/관리자 전용` 공개 범위 + 역할 정의
2. `/admin` 업로드 UX 개선: 파일별 진행률, 부분 실패 목록, 재시도 액션
3. 초대/알림 MVP: 가족 초대 + 덕담/사진 업데이트 이메일 알림(주기 선택)
4. 회상 카드 MVP: "오늘의 추억" + 월간 하이라이트 자동 생성 규칙
5. 공유 딥링크 MVP: 단일 사진/월별 앨범 링크 + 접근 정책 표기

## 12) 공식 출처 링크 (검증용)

- `[G1]` Google Photos Partner Sharing: `https://support.google.com/photos/answer/7378858`
- `[G2]` Google Photos Locked Folder: `https://support.google.com/photos/answer/10694388`
- `[G3]` Google Photos Ask Photos: `https://support.google.com/photos/answer/15318661`
- `[G4]` Google Photos Recap: `https://support.google.com/photos/answer/15706520`
- `[G5]` Google Photos Gemini eligibility/privacy: `https://support.google.com/photos/answer/15344015`
- `[G6]` Google Photos sharing notifications/flows: `https://support.google.com/photos/answer/6131416`
- `[A1]` Apple iCloud Shared Photo Library: `https://support.apple.com/en-us/118229`
- `[F1]` FamilyAlbum visibility options: `https://help.family-album.com/hc/en-us/articles/360038721473-What-do-the-Share-with-Family-and-Share-with-options-mean-when-I-upload-something`
- `[F2]` FamilyAlbum Admin vs Member: `https://help.family-album.com/hc/en-us/articles/4404247061529-What-s-the-difference-between-Album-Admins-and-Album-Members`
- `[F3]` FamilyAlbum free vs premium: `https://help.family-album.com/hc/en-us/articles/4404344217113-What-s-the-difference-between-FamilyAlbum-Premium-and-the-free-version-What-features-are-included-in-each-service`
- `[F4]` FamilyAlbum Digital Frame: `https://help.family-album.com/hc/en-us/articles/52544992189465-What-is-the-FamilyAlbum-Digital-Frame`
- `[T1]` Tinybeans notification preferences: `https://tinybeans.helpscoutdocs.com/article/21-how-can-i-change-the-way-tinybeans-notifies-me-about-updates-on-my-journal`
- `[T2]` Tinybeans invite family/friends: `https://tinybeans.helpscoutdocs.com/article/73-how-do-i-invite-my-family-and-friends-to-tinybeans`
- `[T3]` Tinybeans app not required + inbox updates: `https://tinybeans.helpscoutdocs.com/article/16-do-you-have-to-download-the-app-to-be-part-of-tinybeans`
- `[T4]` Tinybeans free plan limit: `https://tinybeans.helpscoutdocs.com/article/83-whats-the-difference-between-free-tinybeans-and-tinybeans`
- `[AM1]` Amazon Photos iOS App Store listing (storage, This Day, Memories, Fire TV/Echo Show, Groups): `https://apps.apple.com/us/app/amazon-photos-storage-backup/id621574163`
- `[C1]` Cluster iOS App Store listing (private groups, invited members, relevant notifications): `https://apps.apple.com/us/app/cluster-for-iphone/id596595032`
