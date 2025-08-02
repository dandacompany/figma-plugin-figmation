// Boolean operations commands

import { CommandParams, CommandResult } from '../types'
import { isValidSceneNode, getNodeByIdSafe } from '../utils/nodes'

// Boolean Union
export async function booleanUnion(params: CommandParams): Promise<CommandResult> {
  const nodeIds = params.nodeIds || params.Node_IDs || []
  const name = params.name || params.Name || 'Union'

  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new Error('At least 2 node IDs are required for boolean union')
  }

  try {
    // Get all nodes
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      if (!isValidSceneNode(node)) {
        throw new Error(`Node '${nodeId}' cannot be used in boolean operations`)
      }
      nodes.push(node as SceneNode)
    }

    // Create boolean union
    const union = figma.union(nodes, figma.currentPage)
    union.name = name

    // Select the result
    figma.currentPage.selection = [union]
    figma.viewport.scrollAndZoomIntoView([union])

    return {
      success: true,
      nodeId: union.id,
      name: union.name,
      type: union.type,
      operation: 'UNION',
      inputNodeIds: nodeIds
    }

  } catch (error) {
    console.error('Error creating boolean union:', error)
    throw new Error(`Failed to create boolean union: ${error.message || error}`)
  }
}

// Boolean Subtract
export async function booleanSubtract(params: CommandParams): Promise<CommandResult> {
  const nodeIds = params.nodeIds || params.Node_IDs || []
  const name = params.name || params.Name || 'Subtract'

  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new Error('At least 2 node IDs are required for boolean subtract')
  }

  try {
    // Get all nodes
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      if (!isValidSceneNode(node)) {
        throw new Error(`Node '${nodeId}' cannot be used in boolean operations`)
      }
      nodes.push(node as SceneNode)
    }

    // Create boolean subtract
    const subtract = figma.subtract(nodes, figma.currentPage)
    subtract.name = name

    // Select the result
    figma.currentPage.selection = [subtract]
    figma.viewport.scrollAndZoomIntoView([subtract])

    return {
      success: true,
      nodeId: subtract.id,
      name: subtract.name,
      type: subtract.type,
      operation: 'SUBTRACT',
      inputNodeIds: nodeIds
    }

  } catch (error) {
    console.error('Error creating boolean subtract:', error)
    throw new Error(`Failed to create boolean subtract: ${error.message || error}`)
  }
}

// Boolean Intersect
export async function booleanIntersect(params: CommandParams): Promise<CommandResult> {
  const nodeIds = params.nodeIds || params.Node_IDs || []
  const name = params.name || params.Name || 'Intersect'

  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new Error('At least 2 node IDs are required for boolean intersect')
  }

  try {
    // Get all nodes
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      if (!isValidSceneNode(node)) {
        throw new Error(`Node '${nodeId}' cannot be used in boolean operations`)
      }
      nodes.push(node as SceneNode)
    }

    // Create boolean intersect
    const intersect = figma.intersect(nodes, figma.currentPage)
    intersect.name = name

    // Select the result
    figma.currentPage.selection = [intersect]
    figma.viewport.scrollAndZoomIntoView([intersect])

    return {
      success: true,
      nodeId: intersect.id,
      name: intersect.name,
      type: intersect.type,
      operation: 'INTERSECT',
      inputNodeIds: nodeIds
    }

  } catch (error) {
    console.error('Error creating boolean intersect:', error)
    throw new Error(`Failed to create boolean intersect: ${error.message || error}`)
  }
}

// Boolean Exclude
export async function booleanExclude(params: CommandParams): Promise<CommandResult> {
  const nodeIds = params.nodeIds || params.Node_IDs || []
  const name = params.name || params.Name || 'Exclude'

  if (!Array.isArray(nodeIds) || nodeIds.length < 2) {
    throw new Error('At least 2 node IDs are required for boolean exclude')
  }

  try {
    // Get all nodes
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      if (!isValidSceneNode(node)) {
        throw new Error(`Node '${nodeId}' cannot be used in boolean operations`)
      }
      nodes.push(node as SceneNode)
    }

    // Create boolean exclude
    const exclude = figma.exclude(nodes, figma.currentPage)
    exclude.name = name

    // Select the result
    figma.currentPage.selection = [exclude]
    figma.viewport.scrollAndZoomIntoView([exclude])

    return {
      success: true,
      nodeId: exclude.id,
      name: exclude.name,
      type: exclude.type,
      operation: 'EXCLUDE',
      inputNodeIds: nodeIds
    }

  } catch (error) {
    console.error('Error creating boolean exclude:', error)
    throw new Error(`Failed to create boolean exclude: ${error.message || error}`)
  }
}

// Create Boolean Operation (general purpose)
export async function createBooleanOperation(params: CommandParams): Promise<CommandResult> {
  const operation = params.operation || params.Operation || params.type
  
  if (!operation) {
    throw new Error('Operation type is required')
  }

  // Map operation to specific function
  switch (operation.toUpperCase()) {
    case 'UNION':
      return await booleanUnion(params)
    case 'SUBTRACT':
      return await booleanSubtract(params)
    case 'INTERSECT':
      return await booleanIntersect(params)
    case 'EXCLUDE':
      return await booleanExclude(params)
    default:
      throw new Error(`Invalid boolean operation: ${operation}. Must be UNION, SUBTRACT, INTERSECT, or EXCLUDE`)
  }
}