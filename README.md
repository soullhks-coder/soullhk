# Pastel Converter

Cloudflare Pages에 바로 배포할 수 있는 정적 파일 변환 서비스입니다.

## 지원 변환

- JPG, PNG, WEBP 이미지 1개를 PDF로 변환
- JPG, PNG, WEBP 이미지 여러 개를 하나의 PDF로 변환
- PDF 각 페이지를 JPG, PNG, WEBP 이미지로 변환
- JPG, PNG, WEBP 이미지끼리 포맷 변환
- 결과가 여러 개일 때 ZIP으로 묶어 다운로드

## 구조

- `index.html`: 페이지 마크업과 정적 엔트리
- `assets/css/styles.css`: 파스텔톤 UI, 반응형 레이아웃, 처리 애니메이션
- `assets/js/app.js`: 업로드, 상태 관리, 버튼 동작
- `assets/js/modules/converter.js`: 실제 변환 로직

## 로컬 실행

```bash
python3 -m http.server 8787
```

브라우저에서 `http://localhost:8787`을 열면 됩니다.

## 사용 라이브러리

- `pdf-lib`: 이미지 PDF 생성
- `pdfjs-dist`: PDF 페이지 렌더링
- `JSZip`: 여러 결과 파일 ZIP 다운로드

모든 변환은 브라우저에서 처리되며, 파일을 별도 서버로 업로드하지 않습니다.
