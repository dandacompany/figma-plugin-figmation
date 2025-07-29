# FigmaConnector 노드 사용법 가이드

## 개요

FigmaConnector 노드는 n8n에서 Figma 플러그인과 실시간 통신을 위한 웹훅과 WebSocket 서버를 동시에 제공하는 노드입니다.

## 주요 기능

- **웹훅 엔드포인트**: HTTP POST 요청으로 Figma 명령 전송
- **WebSocket 서버**: 실시간 양방향 통신
- **채널 기반 통신**: 여러 프로젝트/플러그인을 구분하여 관리
- **명령 전달**: 웹훅으로 받은 명령을 WebSocket을 통해 Figma 플러그인에 전달

## 설치 및 설정

### 1. n8n 커스텀 노드 설치

```bash
cd n8n-nodes-figma
./install.sh
```

### 2. n8n 재시작

n8n 인스턴스를 재시작하여 커스텀 노드를 로드합니다.

### 3. 워크플로우 생성

1. n8n에서 새 워크플로우 생성
2. "Figma Connector" 노드 추가
3. 노드 설정:
   - **WebSocket Port**: 3055 (기본값)
   - **WebSocket Host**: localhost (기본값)
   - **Channel ID**: 원하는 채널 ID (예: "my-project")
   - **Channel Name**: 채널 이름 (선택사항)

### 4. 워크플로우 활성화

워크플로우를 활성화하면 자동으로:
- WebSocket 서버가 시작됩니다 (ws://localhost:3055)
- 웹훅 엔드포인트가 생성됩니다
- 지정된 채널이 생성됩니다

## Figma 플러그인 설정

### 1. 플러그인 코드 수정

`src/main.ts`에서 WebSocket 연결 설정:

```typescript
// WebSocket 연결 설정
const wsUrl = 'ws://localhost:3055';
const channelId = 'my-project'; // n8n에서 설정한 채널 ID와 동일하게

// 연결 시 채널에 조인
const joinMessage = {
  type: 'join_channel',
  channelId: channelId,
  clientType: 'figma_plugin'
};
```

### 2. 명령 처리 함수 추가

```typescript
// 명령 처리 함수
async function handleCommand(command, params) {
  switch (command) {
    case 'create_frame':
      return await createFrame(params);
    case 'create_rectangle':
      return await createRectangle(params);
    case 'create_text':
      return await createText(params);
    case 'get_selection':
      return await getSelection();
    case 'get_document_info':
      return await getDocumentInfo();
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
```

## 웹훅으로 명령 전송

### 1. 웹훅 URL 확인

n8n 워크플로우에서 Figma Connector 노드의 웹훅 URL을 확인합니다.
예: `http://localhost:5678/webhook/figma-connector`

### 2. 명령 전송 예시

#### create_frame 명령

```bash
curl -X POST "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_frame",
    "params": {
      "x": 100,
      "y": 100,
      "width": 400,
      "height": 300,
      "name": "테스트 프레임",
      "fillColor": {
        "r": 0.2,
        "g": 0.6,
        "b": 1.0,
        "a": 1.0
      }
    },
    "channelId": "my-project"
  }'
```

#### create_rectangle 명령

```bash
curl -X POST "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_rectangle",
    "params": {
      "x": 200,
      "y": 200,
      "width": 200,
      "height": 150,
      "color": {
        "r": 1.0,
        "g": 0.5,
        "b": 0.0,
        "a": 1.0
      }
    },
    "channelId": "my-project"
  }'
```

#### create_text 명령

```bash
curl -X POST "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_text",
    "params": {
      "x": 300,
      "y": 300,
      "text": "안녕하세요! n8n에서 보낸 텍스트입니다.",
      "fontSize": 24,
      "fontColor": {
        "r": 0.0,
        "g": 0.0,
        "b": 0.0,
        "a": 1.0
      }
    },
    "channelId": "my-project"
  }'
```

### 3. 서버 상태 확인

```bash
curl -X GET "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json"
```

## 테스트 도구

### 1. JavaScript 테스터

```bash
node test-webhook-command.js
```

### 2. curl 스크립트

```bash
./test-curl-commands.sh
```

## 지원하는 명령

### 기본 명령

- `create_frame`: 프레임 생성
- `create_rectangle`: 사각형 생성
- `create_text`: 텍스트 생성
- `get_selection`: 선택된 요소 가져오기
- `get_document_info`: 문서 정보 가져오기

### 고급 명령

- `duplicate_selection`: 선택된 요소 복제
- `delete_selection`: 선택된 요소 삭제
- `export_selection`: 선택된 요소 내보내기
- `move_node`: 노드 이동
- `resize_node`: 노드 크기 조정
- `set_fill_color`: 채우기 색상 설정
- `set_stroke_color`: 테두리 색상 설정

## 문제 해결

### 1. WebSocket 연결 실패

- n8n 워크플로우가 활성화되어 있는지 확인
- 포트 3055가 사용 가능한지 확인
- 방화벽 설정 확인

### 2. 웹훅 응답 없음

- 웹훅 URL이 올바른지 확인
- Content-Type이 application/json인지 확인
- 요청 본문이 올바른 JSON 형식인지 확인

### 3. 명령이 Figma에 전달되지 않음

- Figma 플러그인이 WebSocket 서버에 연결되어 있는지 확인
- 채널 ID가 일치하는지 확인
- 플러그인에서 명령 처리 함수가 구현되어 있는지 확인

## 로그 확인

### n8n 로그

n8n 실행 시 콘솔에서 다음 로그를 확인할 수 있습니다:

```
🚀 Figma WebSocket Server started on ws://localhost:3055
📡 Server is ready to accept connections from Figma plugins and n8n nodes
Channel my-project created successfully
WebSocket server and connector connector_xxx initialized successfully
```

### Figma 플러그인 로그

Figma 플러그인 개발자 도구에서 WebSocket 연결 상태를 확인할 수 있습니다.

## 고급 설정

### 인증 설정

FigmaConnector 노드에서 다음 인증 옵션을 설정할 수 있습니다:

- **None**: 인증 없음
- **Basic Auth**: 기본 인증
- **Header Auth**: 헤더 기반 인증 (x-api-key)

### 이벤트 타입 필터링

수신할 이벤트 유형을 선택할 수 있습니다:

- **Webhook Commands**: 웹훅을 통해 전송된 명령
- **Figma Events**: Figma 플러그인에서 발생한 이벤트
- **Connection Events**: 연결/해제 이벤트 