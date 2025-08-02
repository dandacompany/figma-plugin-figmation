// Node utility functions

import { CommandResult } from '../types'

// Generate node name with counter
export function generateNodeName(baseType: string, customName?: string | null): string {
  if (customName) {
    return customName
  }
  
  // Count existing nodes of the same type
  const allNodes = figma.currentPage.findAll()
  const sameTypeNodes = allNodes.filter(node => node.name.startsWith(baseType))
  return `${baseType} ${sameTypeNodes.length + 1}`
}

// Append node to parent
export async function appendToParent(node: SceneNode, parentId?: string | null): Promise<string | null> {
  if (parentId) {
    try {
      const parentNode = await figma.getNodeByIdAsync(parentId)
      if (!parentNode) {
        throw new Error(`Parent node not found with ID: ${parentId}`)
      }
      if (!('appendChild' in parentNode)) {
        throw new Error(`Parent node does not support children: ${parentId}`)
      }
      ;(parentNode as FrameNode | GroupNode | ComponentNode | InstanceNode).appendChild(node)
      return parentId
    } catch (parentError) {
      console.warn('Failed to add to parent, adding to current page:', parentError.message)
      figma.currentPage.appendChild(node)
      return null
    }
  } else {
    figma.currentPage.appendChild(node)
    return null
  }
}

// Apply drop shadow to node
export function applyDropShadow(node: SceneNode & MinimalFillsMixin & EffectsMixin, params: any): void {
  // Add safety check for params
  if (!params || typeof params !== 'object') {
    return
  }
  
  if (params.addDropShadow) {
    const dropShadow: DropShadowEffect = {
      type: 'DROP_SHADOW',
      color: {
        r: params.shadowColor?.r || 0,
        g: params.shadowColor?.g || 0,
        b: params.shadowColor?.b || 0,
        a: params.shadowColor?.a || 0.25
      },
      offset: {
        x: params.shadowOffsetX || 0,
        y: params.shadowOffsetY || 4
      },
      radius: params.shadowRadius || 4,
      spread: params.shadowSpread || 0,
      visible: true,
      blendMode: 'NORMAL'
    }
    node.effects = [dropShadow]
  }
}

// Create base node result
export function createNodeResult(node: SceneNode, parentId?: string | null): CommandResult {
  return {
    success: true,
    nodeId: node.id,
    id: node.id,
    name: node.name,
    type: node.type,
    x: 'x' in node ? node.x : 0,
    y: 'y' in node ? node.y : 0,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0,
    parentId: parentId || null
  }
}

// Check if node is valid SceneNode type
export function isValidSceneNode(node: any): node is SceneNode {
  return node && 
    'x' in node && 
    'y' in node && 
    'width' in node && 
    'height' in node &&
    'appendChild' in node.parent
}

// Normalize node ID format (convert hyphen to colon format)
export function normalizeNodeId(nodeId: string): string {
  // Convert format like "18-8779" to "18:8779"
  return nodeId.replace(/-/g, ':')
}

// Safe getNodeByIdAsync wrapper that normalizes ID format
export async function getNodeByIdSafe(nodeId: string): Promise<BaseNode | null> {
  const normalizedId = normalizeNodeId(nodeId)
  return await figma.getNodeByIdAsync(normalizedId)
}

// Get or create page
export async function getOrCreatePage(pageName: string): Promise<PageNode> {
  let targetPage = figma.root.children.find(page => page.name === pageName)
  
  if (!targetPage) {
    targetPage = figma.createPage()
    targetPage.name = pageName
  }
  
  return targetPage
}