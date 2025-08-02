// Type definitions for Figma Plugin commands and parameters

export interface CommandParams {
  [key: string]: any
}

export interface CommandResult {
  success: boolean
  nodeId?: string
  id?: string
  name?: string
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  [key: string]: any
}

export interface WebSocketMessage {
  type: string
  id?: string
  command?: string
  params?: CommandParams
  timestamp?: string
  channelId?: string
  serverId?: string
}

export interface ColorRGB {
  r: number
  g: number
  b: number
  a?: number
}