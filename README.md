# Figmation - Figma Plugin

Figma 디자인 워크플로우의 외부 자동화를 위한 React 기반 Figma 플러그인입니다. WebSocket 서버를 통해 n8n 워크플로우와 연결되어 Figma API 명령을 실행합니다.

## 주요 기능

- **36개 Figma API 명령 지원**: create_rectangle, create_text, move_node 등
- **WebSocket 통신**: n8n 워크플로우와 실시간 연결
- **채널 기반 격리**: 프로젝트별 멀티 채널 지원
- **자동 재연결**: 연결 실패 시 지수적 백오프로 자동 복구
- **실시간 모니터링**: 연결 상태, 채널 정보, 명령 실행 이력 표시

## 설치 및 사용법

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 모드 (핫 리로드)
npm run dev

# 프로덕션 빌드
npm run build

# 브라우저에서 UI 테스트
npm run preview
```

### Figma에 플러그인 설치

1. `npm run build` 실행
2. Figma에서 플러그인 → 개발 → manifest에서 플러그인 가져오기
3. `dist/manifest.json` 파일 선택

## 아키텍처

### WebSocket 통신 흐름

```
n8n 워크플로우 → WebSocket 서버 → Figma 플러그인 → Figma API
```

### 지원 명령

#### 생성 명령
- `create_rectangle`: 사각형 생성
- `create_frame`: 프레임 생성
- `create_text`: 텍스트 생성
- `create_circle`: 원형 생성
- `create_line`: 선 생성

#### 조작 명령
- `move_node`: 노드 이동
- `resize_node`: 노드 크기 조정
- `set_fill_color`: 채우기 색상 설정
- `set_stroke_color`: 테두리 색상 설정
- `set_text_content`: 텍스트 내용 변경

#### 정보 명령
- `get_document_info`: 문서 정보 조회
- `get_selection`: 선택된 요소 정보
- `get_node_info`: 특정 노드 정보

#### 관리 명령
- `delete_node`: 노드 삭제
- `clone_node`: 노드 복제
- `export_node_as_image`: 노드를 이미지로 내보내기

## 채널 시스템

각 워크플로우는 고유한 채널을 통해 격리된 통신을 제공합니다:

1. **채널 생성**: n8n 트리거 노드가 이름이 있는 채널 생성
2. **클라이언트 등록**: 플러그인이 특정 채널에 연결
3. **명령 라우팅**: 액션이 채널 ID로 특정 채널 지정
4. **격리**: 각 채널은 별도의 클라이언트 목록 유지

## 개발 가이드

### 새로운 명령 추가

1. `src/main.ts`에 명령 핸들러 추가:
```typescript
case 'new_command':
  return await newCommandFunction(params)
```

2. n8n 액션 노드에 명령 등록 (별도 레포지토리)

### 에러 처리

- **연결 실패**: 지수적 백오프를 이용한 자동 재연결
- **명령 타임아웃**: 10초 타임아웃 및 정리
- **채널 에러**: 채널 존재 및 권한 검증
- **Figma API 에러**: 디자인 모드 검증 및 파라미터 체크

## 기술 스택

- **빌드 도구**: Vite + Plugma 프레임워크
- **UI 프레임워크**: React 18 + TypeScript
- **WebSocket**: 네이티브 WebSocket API
- **Figma API**: 공식 플러그인 API 타입

## 라이선스

MIT License

## 관련 프로젝트

- [n8n-nodes-figmation](https://github.com/dandacompany/n8n-nodes-figmation): n8n 커스텀 노드 패키지
