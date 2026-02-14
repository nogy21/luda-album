# 2026-02-14 Photo-First Migration Note

## 무엇이 바뀌었나
- `/`를 랜딩 페이지로 전환하고 사진 중심 가치 문구 + CTA 2개를 배치했다.
- `/photos`를 cursor 기반 탐색 구조로 재편했다.
- `/api/photos`, `/api/photos/highlights`를 추가해 대량 사진 탐색/대표컷 데이터를 분리 제공한다.
- `gallery_photos` 확장 컬럼(`thumb_src`, `updated_at`, `visibility`, `is_featured`, `featured_rank`)을 읽고 쓰도록 리포지토리를 확장했다.
- `/admin` 업로드 성공 결과에서 대표컷 토글 API(`PATCH /api/admin/photos/[photoId]`)를 연결했다.

## 왜 이렇게 바꿨나
- 제품 원칙을 `사진 탐색 속도 + 회상 경험`으로 고정하기 위해 사진 중심 IA와 탐색 흐름을 우선했다.
- 대표컷/하이라이트를 분리해 첫 방문 감정선 진입 속도를 높였다.
- 월/연 점프 + 무한 스크롤 조합으로 많은 사진에서도 스캔 비용을 낮췄다.
- 카드(thumb)와 라이트박스(원본) 렌더링을 분리해 체감 성능과 품질을 함께 확보했다.

## 체크리스트
- [x] 랜딩 `/` 신설 + GSAP 첫 방문 인트로
- [x] `/photos` 히어로/CTA/대표컷/하이라이트 반영
- [x] 월/연 아카이브 점프 + 자동 추가 로딩
- [x] 라이트박스 이전/다음 + 닫기 후 위치/포커스 복귀
- [x] 빈 상태 CTA(`첫 사진 올리기`) 완성
- [x] `GET /api/photos` cursor pagination + summary 응답
- [x] `GET /api/photos/highlights` 대표컷/하이라이트 응답
- [x] 업로드 시 `visibility`, `thumb_src` DB 저장
- [x] 업로드 결과에서 대표컷 지정/해제 PATCH 연결
- [x] `npm run lint`, `npm run test`, `npm run build` 통과
