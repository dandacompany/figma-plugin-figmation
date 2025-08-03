// WebSocket utility functions

import { WebSocketMessage } from '../types'

// Factory function to create WebSocket client
export function createWebSocketClient(port: number, channelId: string) {
  const url = `ws://localhost:${port}`
  const client = new WebSocketClient(url)
  
  return {
    connect: () => client.connect(channelId),
    disconnect: () => client.disconnect(),
    isConnected: () => client.isConnected(),
    onMessage: null as ((message: any) => void) | null,
    onConnectionChange: null as ((isConnected: boolean) => void) | null,
    
    // Set up message handler
    setMessageHandler: (handler: (message: any) => void) => {
      client.onCommand(handler)
    }
  }
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectInterval: number = 5000
  private maxReconnectInterval: number = 30000
  private reconnectDecay: number = 1.5
  private reconnectAttempts: number = 0
  private url: string
  private channelId: string | null = null
  private serverId: string | null = null
  private messageHandlers: Map<string, (data: any) => void> = new Map()

  constructor(url: string) {
    this.url = url
  }

  connect(channelId?: string): void {
    if (channelId) {
      this.channelId = channelId
    }

    try {
      this.ws = new WebSocket(this.url)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        
        // Send registration message
        this.send({
          type: 'register',
          channelId: this.channelId
        })
        
        // Start ping interval
        setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' })
          }
        }, 30000)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.reconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (e) {
      // console.error('Failed to create WebSocket:', e)
      this.reconnect()
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'channel_assigned':
        this.channelId = data.channelId
        this.serverId = data.serverId
        console.log(`Connected to channel: ${this.channelId}`)
        break
      
      case 'command':
        const handler = this.messageHandlers.get('command')
        if (handler) {
          handler(data)
        }
        break
      
      case 'pong':
        // Handle pong response
        break
      
      default:
        console.log('Unknown message type:', data.type)
    }
  }

  onCommand(handler: (data: any) => void): void {
    this.messageHandlers.set('command', handler)
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected')
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= 10) {
      console.error('Max reconnection attempts reached')
      return
    }

    const timeout = Math.min(
      this.reconnectInterval * Math.pow(this.reconnectDecay, this.reconnectAttempts),
      this.maxReconnectInterval
    )

    this.reconnectAttempts++
    // console.log(`Reconnecting in ${timeout / 1000} seconds...`)

    setTimeout(() => {
      // console.log('Attempting to reconnect...')
      this.connect()
    }, timeout)
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  getChannelId(): string | null {
    return this.channelId
  }

  getServerId(): string | null {
    return this.serverId
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}