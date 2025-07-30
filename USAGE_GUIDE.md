# FigmaConnector Node Usage Guide

## Overview

The FigmaConnector node provides both webhook and WebSocket server functionality for real-time communication between n8n and Figma plugins.

## Key Features

- **Webhook Endpoint**: Send Figma commands via HTTP POST requests
- **WebSocket Server**: Real-time bidirectional communication
- **Channel-based Communication**: Manage multiple projects/plugins separately
- **Command Relay**: Relay commands received via webhook to Figma plugin through WebSocket

## Installation and Setup

### 1. Install n8n Custom Nodes

```bash
cd n8n-nodes-figma
./install.sh
```

### 2. Restart n8n

Restart your n8n instance to load the custom nodes.

### 3. Create Workflow

1. Create a new workflow in n8n
2. Add "Figma Connector" node
3. Configure the node:
   - **WebSocket Port**: 3055 (default)
   - **WebSocket Host**: localhost (default)
   - **Channel ID**: Desired channel ID (e.g., "my-project")
   - **Channel Name**: Channel name (optional)

### 4. Activate Workflow

When you activate the workflow, it automatically:
- Starts the WebSocket server (ws://localhost:3055)
- Creates webhook endpoints
- Creates the specified channel

## Figma Plugin Configuration

### 1. Modify Plugin Code

Configure WebSocket connection in `src/main.ts`:

```typescript
// WebSocket connection settings
const wsUrl = 'ws://localhost:3055';
const channelId = 'my-project'; // Same as channel ID set in n8n

// Join channel on connection
const joinMessage = {
  type: 'join_channel',
  channelId: channelId,
  clientType: 'figma_plugin'
};
```

### 2. Add Command Handler Function

```typescript
// Command handler function
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

## Sending Commands via Webhook

### 1. Check Webhook URL

Verify the webhook URL in the Figma Connector node in your n8n workflow.
Example: `http://localhost:5678/webhook/figma-connector`

### 2. Command Examples

#### create_frame Command

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
      "name": "Test Frame",
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

#### create_rectangle Command

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

#### create_text Command

```bash
curl -X POST "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_text",
    "params": {
      "x": 300,
      "y": 300,
      "text": "Hello! This text was sent from n8n.",
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

### 3. Check Server Status

```bash
curl -X GET "http://localhost:5678/webhook/figma-connector" \
  -H "Content-Type: application/json"
```

## Testing Tools

### 1. JavaScript Tester

```bash
node test-webhook-command.js
```

### 2. curl Scripts

```bash
./test-curl-commands.sh
```

## Supported Commands

### Basic Commands

- `create_frame`: Create frame
- `create_rectangle`: Create rectangle
- `create_text`: Create text
- `get_selection`: Get selected elements
- `get_document_info`: Get document information

### Advanced Commands

- `duplicate_selection`: Duplicate selected elements
- `delete_selection`: Delete selected elements
- `export_selection`: Export selected elements
- `move_node`: Move node
- `resize_node`: Resize node
- `set_fill_color`: Set fill color
- `set_stroke_color`: Set stroke color or remove stroke completely

## Troubleshooting

### 1. WebSocket Connection Failure

- Check if n8n workflow is activated
- Verify port 3055 is available
- Check firewall settings

### 2. No Webhook Response

- Verify webhook URL is correct
- Ensure Content-Type is application/json
- Check if request body is valid JSON format

### 3. Commands Not Reaching Figma

- Check if Figma plugin is connected to WebSocket server
- Verify channel ID matches
- Ensure command handler functions are implemented in plugin

## Log Monitoring

### n8n Logs

You can see the following logs in the console when running n8n:

```
🚀 Figma WebSocket Server started on ws://localhost:3055
📡 Server is ready to accept connections from Figma plugins and n8n nodes
Channel my-project created successfully
WebSocket server and connector connector_xxx initialized successfully
```

### Figma Plugin Logs

Check WebSocket connection status in Figma plugin developer tools.

## Advanced Configuration

### Authentication Settings

Configure the following authentication options in the FigmaConnector node:

- **None**: No authentication
- **Basic Auth**: Basic authentication
- **Header Auth**: Header-based authentication (x-api-key)

### Event Type Filtering

Select which event types to receive:

- **Webhook Commands**: Commands sent via webhook
- **Figma Events**: Events from Figma plugin
- **Connection Events**: Connection/disconnection events 