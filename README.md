# H₂ Station — 수소충전소 이력 관리 데모

## 실행
1. `index.html`, `style.css`, `app.js`를 같은 폴더에 둡니다.
2. `index.html`을 브라우저에서 엽니다. 외부 라이브러리 없이 기본 기능이 동작합니다.
3. 개발 중에는 VS Code의 Live Server를 사용해도 됩니다.

## 포함 기능
- 반응형 데스크톱/모바일 UI
- 충전소 목록 및 통합 검색: 충전소 기본정보와 과거 이력 내용 검색
- 빠른 필터: 전체 / 이력 있음 / 최근 이력
- 충전소 상세정보와 최신순 이력 타임라인
- 이력 추가 및 브라우저 `localStorage` 저장
- 전체 이력 조회 및 검색
- Excel에서 열 수 있는 UTF-8 BOM CSV 내보내기
- CSV 이력 가져오기 (`history_id`, `no`, `date`, `category`, `content`, `memo` 컬럼 권장)

## 데모 데이터 주의
화면의 충전소와 이력은 가상 데이터입니다. 실제 충전소 현황이나 실제 운영 기록으로 사용하지 마세요. 현재 데이터는 사용 중인 브라우저에만 저장되므로 다른 PC/브라우저와 공유되지 않으며, 브라우저 저장소를 지우면 데이터가 사라질 수 있습니다.

## PostgreSQL 연동을 고려한 구조
`app.js`의 `DemoRepository`가 화면과 데이터 접근을 분리합니다. 실제 배포 시에는 같은 메서드 계약을 갖는 `APIRepository`로 교체하고, 백엔드 API가 PostgreSQL을 조회·갱신하도록 구성하면 됩니다. 브라우저에서 PostgreSQL에 직접 접속하거나 DB 비밀번호를 프론트엔드에 넣으면 안 됩니다.

권장 테이블 구분:
- `stations`: 충전소 기본정보 (`no` 또는 별도 `station_id`를 PK로 사용)
- `station_metadata`: 유형, 압력, 검사 등 상세 메타정보
- `station_history`: `history_id` PK, `station_id` FK, `occurred_at`, `category`, `content`, `memo`, `created_at`, `created_by`

현재 샘플의 `history_id`와 `no`는 데모 편의를 위해 문자열로 처리했습니다. 운영 DB에서는 고유한 PK/FK, 작성자, 생성·수정 시각, 입력 검증, 인증·권한 및 변경 이력을 추가하는 편이 안전합니다.

## Excel 가져오기/내보내기 확장
현재는 Excel에서 열고 저장할 수 있는 CSV를 지원합니다. 실제 `.xlsx` 파일 직접 업로드가 필요하면 프론트엔드에 SheetJS 같은 XLSX 파서를 추가하거나, 백엔드에서 업로드 파일을 검증·변환하는 방식으로 확장할 수 있습니다. 운영 환경에서는 충전소 번호 불일치, 중복 이력, 날짜 형식, 빈 필드 등을 미리 검증하고 가져오기 전 미리보기 화면을 두는 것을 권장합니다.
