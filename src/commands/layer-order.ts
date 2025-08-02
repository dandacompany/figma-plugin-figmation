// Layer order manipulation commands

import { CommandParams, CommandResult } from '../types'
import { getNodeByIdSafe } from '../utils/nodes'

// Reorder layer to specific index
export async function reorderLayer(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId
  const targetIndex = params.targetIndex
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }
  
  if (targetIndex === undefined || targetIndex < 0) {
    throw new Error('Valid target index is required (0 or greater)')
  }

  const node = await getNodeByIdSafe(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const parent = node.parent
  if (!parent || !('children' in parent)) {
    throw new Error('Node parent does not support reordering')
  }

  try {
    // Get current index
    const currentIndex = parent.children.indexOf(node as SceneNode)
    if (currentIndex === -1) {
      throw new Error('Node not found in parent children')
    }

    // Clamp target index to valid range
    const maxIndex = parent.children.length - 1
    const clampedIndex = Math.min(Math.max(0, targetIndex), maxIndex)

    // Move node to new position
    if (currentIndex !== clampedIndex) {
      parent.insertChild(clampedIndex, node as SceneNode)
    }

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      previousIndex: currentIndex,
      newIndex: clampedIndex,
      message: `Moved layer from index ${currentIndex} to ${clampedIndex}`
    }

  } catch (error) {
    console.error('Error reordering layer:', error)
    throw new Error(`Failed to reorder layer: ${error.message || error}`)
  }
}

// Move layer to front (top of layer stack)
export async function moveToFront(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  const node = await getNodeByIdSafe(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const parent = node.parent
  if (!parent || !('appendChild' in parent)) {
    throw new Error('Node parent does not support reordering')
  }

  try {
    // appendChild moves the node to the end (which appears at the top in layers panel)
    parent.appendChild(node as SceneNode)

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      message: 'Moved layer to front'
    }

  } catch (error) {
    console.error('Error moving layer to front:', error)
    throw new Error(`Failed to move layer to front: ${error.message || error}`)
  }
}

// Move layer to back (bottom of layer stack)
export async function moveToBack(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  const node = await getNodeByIdSafe(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const parent = node.parent
  if (!parent || !('insertChild' in parent)) {
    throw new Error('Node parent does not support reordering')
  }

  try {
    // insertChild at index 0 moves the node to the beginning (bottom in layers panel)
    parent.insertChild(0, node as SceneNode)

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      message: 'Moved layer to back'
    }

  } catch (error) {
    console.error('Error moving layer to back:', error)
    throw new Error(`Failed to move layer to back: ${error.message || error}`)
  }
}

// Move layer forward (up one position)
export async function moveForward(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  const node = await getNodeByIdSafe(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const parent = node.parent
  if (!parent || !('children' in parent) || !('insertChild' in parent)) {
    throw new Error('Node parent does not support reordering')
  }

  try {
    const currentIndex = parent.children.indexOf(node as SceneNode)
    if (currentIndex === -1) {
      throw new Error('Node not found in parent children')
    }

    // Can't move forward if already at the top
    if (currentIndex === parent.children.length - 1) {
      return {
        success: true,
        nodeId: node.id,
        name: node.name,
        type: node.type,
        message: 'Layer is already at the front'
      }
    }

    // Move one position forward (higher index)
    const newIndex = currentIndex + 1
    parent.insertChild(newIndex, node as SceneNode)

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      previousIndex: currentIndex,
      newIndex: newIndex,
      message: `Moved layer forward from index ${currentIndex} to ${newIndex}`
    }

  } catch (error) {
    console.error('Error moving layer forward:', error)
    throw new Error(`Failed to move layer forward: ${error.message || error}`)
  }
}

// Move layer backward (down one position)
export async function moveBackward(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  const node = await getNodeByIdSafe(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const parent = node.parent
  if (!parent || !('children' in parent) || !('insertChild' in parent)) {
    throw new Error('Node parent does not support reordering')
  }

  try {
    const currentIndex = parent.children.indexOf(node as SceneNode)
    if (currentIndex === -1) {
      throw new Error('Node not found in parent children')
    }

    // Can't move backward if already at the bottom
    if (currentIndex === 0) {
      return {
        success: true,
        nodeId: node.id,
        name: node.name,
        type: node.type,
        message: 'Layer is already at the back'
      }
    }

    // Move one position backward (lower index)
    const newIndex = currentIndex - 1
    parent.insertChild(newIndex, node as SceneNode)

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      previousIndex: currentIndex,
      newIndex: newIndex,
      message: `Moved layer backward from index ${currentIndex} to ${newIndex}`
    }

  } catch (error) {
    console.error('Error moving layer backward:', error)
    throw new Error(`Failed to move layer backward: ${error.message || error}`)
  }
}

// Sort layers by name
export async function sortLayersByName(params: CommandParams): Promise<CommandResult> {
  const parentNodeId = params.parentNodeId
  const sortOrder = params.sortOrder || 'ascending' // 'ascending' or 'descending'
  const caseSensitive = params.caseSensitive !== false // default true
  
  // Get parent node - if not specified, use current page
  let parentNode: BaseNode & ChildrenMixin
  if (parentNodeId) {
    const node = await getNodeByIdSafe(parentNodeId)
    if (!node) {
      throw new Error(`Parent node not found with ID: ${parentNodeId}`)
    }
    if (!('children' in node)) {
      throw new Error('Specified node does not support children')
    }
    parentNode = node as BaseNode & ChildrenMixin
  } else {
    parentNode = figma.currentPage
  }

  try {
    // Get all children and sort them
    const children = [...parentNode.children]
    
    children.sort((a, b) => {
      const nameA = caseSensitive ? a.name : a.name.toLowerCase()
      const nameB = caseSensitive ? b.name : b.name.toLowerCase()
      
      if (sortOrder === 'descending') {
        return nameB.localeCompare(nameA)
      }
      return nameA.localeCompare(nameB)
    })

    // Reorder children
    children.forEach((child, index) => {
      parentNode.insertChild(index, child)
    })

    return {
      success: true,
      parentNodeId: parentNode.id,
      parentNodeName: parentNode.name,
      sortedCount: children.length,
      sortOrder,
      caseSensitive,
      message: `Sorted ${children.length} layers by name (${sortOrder})`
    }

  } catch (error) {
    console.error('Error sorting layers by name:', error)
    throw new Error(`Failed to sort layers by name: ${error.message || error}`)
  }
}

// Sort layers by position (X, Y coordinates)
export async function sortLayersByPosition(params: CommandParams): Promise<CommandResult> {
  const parentNodeId = params.parentNodeId
  const sortBy = params.sortBy || 'x' // 'x', 'y', or 'xy' (top-left to bottom-right)
  const sortOrder = params.sortOrder || 'ascending'
  
  // Get parent node - if not specified, use current page
  let parentNode: BaseNode & ChildrenMixin
  if (parentNodeId) {
    const node = await getNodeByIdSafe(parentNodeId)
    if (!node) {
      throw new Error(`Parent node not found with ID: ${parentNodeId}`)
    }
    if (!('children' in node)) {
      throw new Error('Specified node does not support children')
    }
    parentNode = node as BaseNode & ChildrenMixin
  } else {
    parentNode = figma.currentPage
  }

  try {
    // Filter children that have position properties
    const positionedChildren = parentNode.children.filter(child => 
      'x' in child && 'y' in child
    ) as Array<SceneNode & { x: number; y: number }>

    // Sort by specified criteria
    positionedChildren.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'x':
          comparison = a.x - b.x
          break
        case 'y':
          comparison = a.y - b.y
          break
        case 'xy':
          // Sort by Y first, then by X (reading order)
          comparison = a.y - b.y
          if (comparison === 0) {
            comparison = a.x - b.x
          }
          break
      }
      
      return sortOrder === 'descending' ? -comparison : comparison
    })

    // Reorder positioned children
    positionedChildren.forEach((child, index) => {
      parentNode.insertChild(index, child)
    })

    return {
      success: true,
      parentNodeId: parentNode.id,
      parentNodeName: parentNode.name,
      sortedCount: positionedChildren.length,
      totalChildren: parentNode.children.length,
      sortBy,
      sortOrder,
      message: `Sorted ${positionedChildren.length} positioned layers by ${sortBy} (${sortOrder})`
    }

  } catch (error) {
    console.error('Error sorting layers by position:', error)
    throw new Error(`Failed to sort layers by position: ${error.message || error}`)
  }
}

// Reorder multiple layers
export async function reorderMultipleLayers(params: CommandParams): Promise<CommandResult> {
  const nodeIds = params.nodeIds
  const startIndex = params.startIndex || 0
  
  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error('Node IDs array is required')
  }

  try {
    // Get all nodes and verify they have the same parent
    const nodes: SceneNode[] = []
    let commonParent: BaseNode & ChildrenMixin | null = null
    
    for (const nodeId of nodeIds) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      
      if (!commonParent) {
        commonParent = node.parent as BaseNode & ChildrenMixin
        if (!commonParent || !('children' in commonParent)) {
          throw new Error('Node parent does not support reordering')
        }
      } else if (node.parent !== commonParent) {
        throw new Error('All nodes must have the same parent')
      }
      
      nodes.push(node as SceneNode)
    }

    // Reorder nodes starting from startIndex
    let currentIndex = Math.max(0, Math.min(startIndex, commonParent!.children.length - nodes.length))
    
    for (const node of nodes) {
      commonParent!.insertChild(currentIndex, node)
      currentIndex++
    }

    return {
      success: true,
      reorderedCount: nodes.length,
      parentNodeId: commonParent!.id,
      parentNodeName: commonParent!.name,
      startIndex: Math.max(0, Math.min(startIndex, commonParent!.children.length - nodes.length)),
      message: `Reordered ${nodes.length} layers starting at index ${currentIndex - nodes.length}`
    }

  } catch (error) {
    console.error('Error reordering multiple layers:', error)
    throw new Error(`Failed to reorder multiple layers: ${error.message || error}`)
  }
}