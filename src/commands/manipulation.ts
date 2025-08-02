// Node manipulation commands

import { CommandParams, CommandResult } from '../types'
import { isValidSceneNode, getNodeByIdSafe } from '../utils/nodes'

// Move Node
export async function moveNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const x = params.x !== undefined ? Number(params.x) : params.X
  const y = params.y !== undefined ? Number(params.y) : params.Y
  const deltaX = params.deltaX !== undefined ? Number(params.deltaX) : params.Delta_X
  const deltaY = params.deltaY !== undefined ? Number(params.deltaY) : params.Delta_Y

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    // Check if node has x and y properties
    if (!('x' in node && 'y' in node)) {
      throw new Error(`Node ${nodeId} cannot be moved (not a scene node)`)
    }

    const sceneNode = node as SceneNode & { x: number; y: number }

    // Apply movement
    if (x !== undefined) {
      sceneNode.x = Number(x)
    } else if (deltaX !== undefined) {
      sceneNode.x += Number(deltaX)
    }

    if (y !== undefined) {
      sceneNode.y = Number(y)
    } else if (deltaY !== undefined) {
      sceneNode.y += Number(deltaY)
    }

    // Select and focus the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      x: sceneNode.x,
      y: sceneNode.y
    }

  } catch (error) {
    console.error('Error moving node:', error)
    throw new Error(`Failed to move node: ${error.message || error}`)
  }
}

// Resize Node
export async function resizeNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const width = params.width !== undefined ? Number(params.width) : params.Width
  const height = params.height !== undefined ? Number(params.height) : params.Height

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (width === undefined && height === undefined) {
    throw new Error('At least one dimension (width or height) is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    // Check if node has width and height properties
    if (!('width' in node && 'height' in node && 'resize' in node)) {
      throw new Error(`Node ${nodeId} cannot be resized`)
    }

    const resizableNode = node as SceneNode & LayoutMixin

    // Get current dimensions
    const newWidth = width !== undefined ? Number(width) : resizableNode.width
    const newHeight = height !== undefined ? Number(height) : resizableNode.height

    // Resize the node
    resizableNode.resize(newWidth, newHeight)

    // Select and focus the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      width: resizableNode.width,
      height: resizableNode.height
    }

  } catch (error) {
    console.error('Error resizing node:', error)
    throw new Error(`Failed to resize node: ${error.message || error}`)
  }
}

// Rotate Node
export async function rotateNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const angle = params.angle !== undefined ? Number(params.angle) : params.Angle
  const delta = params.delta !== undefined ? Number(params.delta) : params.Delta

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (angle === undefined && delta === undefined) {
    throw new Error('Either angle or delta is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    // Check if node has rotation property
    if (!('rotation' in node)) {
      throw new Error(`Node ${nodeId} cannot be rotated`)
    }

    const rotatableNode = node as SceneNode & LayoutMixin

    // Apply rotation
    if (angle !== undefined) {
      rotatableNode.rotation = Number(angle)
    } else if (delta !== undefined) {
      rotatableNode.rotation = (rotatableNode.rotation || 0) + Number(delta)
    }

    // Select and focus the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      rotation: rotatableNode.rotation
    }

  } catch (error) {
    console.error('Error rotating node:', error)
    throw new Error(`Failed to rotate node: ${error.message || error}`)
  }
}

// Set Rotation (alias for rotateNode for compatibility)
export async function setRotation(params: CommandParams): Promise<CommandResult> {
  // Map parameters for compatibility
  const mappedParams = {
    ...params,
    angle: params.rotation !== undefined ? params.rotation : params.Rotation !== undefined ? params.Rotation : params.angle
  }
  return await rotateNode(mappedParams)
}

// Delete Node
export async function deleteNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    const nodeInfo = {
      id: node.id,
      name: node.name,
      type: node.type
    }

    // Remove the node
    node.remove()

    return {
      success: true,
      nodeId: nodeInfo.id,
      name: nodeInfo.name,
      type: nodeInfo.type,
      deleted: true
    }

  } catch (error) {
    console.error('Error deleting node:', error)
    throw new Error(`Failed to delete node: ${error.message || error}`)
  }
}

// Clone Node
export async function cloneNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const offsetX = params.offsetX !== undefined ? Number(params.offsetX) : 20
  const offsetY = params.offsetY !== undefined ? Number(params.offsetY) : 20

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('clone' in node)) {
      throw new Error(`Node ${nodeId} cannot be cloned`)
    }

    const clonableNode = node as SceneNode
    const clonedNode = clonableNode.clone()

    // Position the clone with offset
    if ('x' in clonedNode && 'y' in clonedNode) {
      clonedNode.x = clonedNode.x + offsetX
      clonedNode.y = clonedNode.y + offsetY
    }

    // Update name
    clonedNode.name = `${node.name} (Copy)`

    // Select the cloned node
    figma.currentPage.selection = [clonedNode]
    figma.viewport.scrollAndZoomIntoView([clonedNode])

    return {
      success: true,
      nodeId: clonedNode.id,
      name: clonedNode.name,
      type: clonedNode.type,
      x: 'x' in clonedNode ? clonedNode.x : 0,
      y: 'y' in clonedNode ? clonedNode.y : 0,
      originalNodeId: node.id
    }

  } catch (error) {
    console.error('Error cloning node:', error)
    throw new Error(`Failed to clone node: ${error.message || error}`)
  }
}

// Group Nodes
export async function groupNodes(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter name formats and handle comma-separated string
  let nodeIds = params.nodeIds || params.Node_IDs || params.Node_Ids || params.nodeIdList || []
  const groupName = params.name || params.Name || params.groupName || params.Group_Name || 'Group'
  const parentId = params.parentId || params.Parent_Node_ID || params.parent_node_id || null

  // Handle comma-separated string of node IDs
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }

  console.log('groupNodes received params:', JSON.stringify(params, null, 2))
  console.log('Parsed nodeIds:', nodeIds)
  console.log('Group name:', groupName)

  if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error('Node IDs array is required')
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
        throw new Error(`Node '${nodeId}' cannot be grouped (not a valid scene node type)`)
      }
      nodes.push(node as SceneNode)
    }

    // Create group
    const group = figma.group(nodes, figma.currentPage)
    group.name = groupName

    // Move group to specified parent if provided
    let actualParentId = figma.currentPage.id
    if (parentId) {
      try {
        const parentNode = await getNodeByIdSafe(parentId)
        if (parentNode && 'appendChild' in parentNode) {
          parentNode.appendChild(group)
          actualParentId = parentNode.id
          console.log(`Group moved to parent: ${parentNode.name} (${parentId})`)
        } else {
          console.warn(`Parent node ${parentId} cannot contain children, keeping in current page`)
        }
      } catch (error) {
        console.warn(`Failed to move group to parent ${parentId}:`, error)
      }
    }

    // Select the group
    figma.currentPage.selection = [group]
    figma.viewport.scrollAndZoomIntoView([group])

    return {
      success: true,
      nodeId: group.id,
      name: group.name,
      type: group.type,
      parentId: actualParentId,
      childrenCount: group.children.length,
      groupedNodeIds: nodeIds
    }

  } catch (error) {
    console.error('Error grouping nodes:', error)
    throw new Error(`Failed to group nodes: ${error.message || error}`)
  }
}

// Ungroup Node
export async function ungroupNode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (node.type !== 'GROUP') {
      throw new Error(`Node ${nodeId} is not a group (type: ${node.type})`)
    }

    const group = node as GroupNode
    const childIds = group.children.map(child => child.id)
    const parent = group.parent

    // Ungroup
    figma.ungroup(group)

    return {
      success: true,
      nodeId: nodeId,
      ungrouped: true,
      childrenIds: childIds,
      parentId: parent?.id || null
    }

  } catch (error) {
    console.error('Error ungrouping node:', error)
    throw new Error(`Failed to ungroup node: ${error.message || error}`)
  }
}

// Select Nodes - Select multiple nodes at once
export async function selectNodes(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter name formats
  let nodeIds = params.nodeIds || params.Node_IDs || params.Node_Ids || params.nodeIdList || []
  const scrollIntoView = params.scrollIntoView !== undefined ? params.scrollIntoView : true
  
  // Handle comma-separated string
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }

  // Ensure it's an array
  if (!Array.isArray(nodeIds)) {
    nodeIds = [nodeIds]
  }

  if (!nodeIds || nodeIds.length === 0) {
    throw new Error('At least one node ID is required')
  }

  try {
    const validNodes: SceneNode[] = []
    const errors: Array<{ id: string, error: string }> = []

    // Get all valid nodes
    for (const nodeId of nodeIds) {
      try {
        const node = await getNodeByIdSafe(nodeId)
        
        if (!node) {
          errors.push({ id: nodeId, error: 'Node not found' })
          continue
        }

        // Only SceneNodes can be selected
        if (!isValidSceneNode(node)) {
          errors.push({ id: nodeId, error: 'Node cannot be selected (not a scene node)' })
          continue
        }

        // Check if node is on current page
        let parent = node.parent
        let isOnCurrentPage = false
        while (parent) {
          if (parent.id === figma.currentPage.id) {
            isOnCurrentPage = true
            break
          }
          parent = parent.parent
        }

        if (!isOnCurrentPage) {
          errors.push({ id: nodeId, error: 'Node is not on the current page' })
          continue
        }

        validNodes.push(node as SceneNode)

      } catch (error) {
        errors.push({
          id: nodeId,
          error: error.message || 'Unknown error'
        })
      }
    }

    // Set selection to all valid nodes
    figma.currentPage.selection = validNodes

    // Optionally scroll into view
    if (scrollIntoView && validNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(validNodes)
    }

    return {
      success: true,
      selectedNodes: validNodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type
      })),
      selectedCount: validNodes.length,
      errors: errors.length > 0 ? errors : undefined,
      totalRequested: nodeIds.length
    }

  } catch (error) {
    console.error('Error selecting nodes:', error)
    throw new Error(`Failed to select nodes: ${error.message || error}`)
  }
}

// Select Nodes by Type - Select all nodes of a specific type
export async function selectNodesByType(params: CommandParams): Promise<CommandResult> {
  const nodeType = params.nodeType || params.Node_Type || params.type
  const parentId = params.parentId || params.Parent_ID
  const scrollIntoView = params.scrollIntoView !== undefined ? params.scrollIntoView : true
  
  if (!nodeType) {
    throw new Error('Node type is required')
  }

  try {
    let searchScope: BaseNode
    
    if (parentId) {
      const parentNode = await getNodeByIdSafe(parentId)
      if (!parentNode) {
        throw new Error(`Parent node not found with ID: ${parentId}`)
      }
      searchScope = parentNode
    } else {
      searchScope = figma.currentPage
    }

    // Find all nodes of the specified type
    const matchingNodes: SceneNode[] = []
    
    function findNodesByType(node: BaseNode) {
      if (node.type === nodeType.toUpperCase() && isValidSceneNode(node)) {
        matchingNodes.push(node as SceneNode)
      }
      
      if ('children' in node) {
        for (const child of node.children) {
          findNodesByType(child)
        }
      }
    }
    
    findNodesByType(searchScope)
    
    // Set selection
    figma.currentPage.selection = matchingNodes
    
    // Optionally scroll into view
    if (scrollIntoView && matchingNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(matchingNodes)
    }
    
    return {
      success: true,
      selectedNodes: matchingNodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type
      })),
      selectedCount: matchingNodes.length,
      nodeType: nodeType.toUpperCase(),
      searchScope: parentId || 'current page'
    }
    
  } catch (error) {
    console.error('Error selecting nodes by type:', error)
    throw new Error(`Failed to select nodes by type: ${error.message || error}`)
  }
}

// Select Nodes by Name - Select nodes matching a name pattern
export async function selectNodesByName(params: CommandParams): Promise<CommandResult> {
  const namePattern = params.namePattern || params.Name_Pattern || params.pattern || params.name
  const exactMatch = params.exactMatch !== undefined ? params.exactMatch : false
  const caseSensitive = params.caseSensitive !== undefined ? params.caseSensitive : false
  const parentId = params.parentId || params.Parent_ID
  const scrollIntoView = params.scrollIntoView !== undefined ? params.scrollIntoView : true
  
  if (!namePattern) {
    throw new Error('Name pattern is required')
  }

  try {
    let searchScope: BaseNode
    
    if (parentId) {
      const parentNode = await getNodeByIdSafe(parentId)
      if (!parentNode) {
        throw new Error(`Parent node not found with ID: ${parentId}`)
      }
      searchScope = parentNode
    } else {
      searchScope = figma.currentPage
    }

    // Find all nodes matching the name pattern
    const matchingNodes: SceneNode[] = []
    const searchPattern = caseSensitive ? namePattern : namePattern.toLowerCase()
    
    function findNodesByName(node: BaseNode) {
      const nodeName = caseSensitive ? node.name : node.name.toLowerCase()
      
      const matches = exactMatch 
        ? nodeName === searchPattern
        : nodeName.includes(searchPattern)
      
      if (matches && isValidSceneNode(node)) {
        matchingNodes.push(node as SceneNode)
      }
      
      if ('children' in node) {
        for (const child of node.children) {
          findNodesByName(child)
        }
      }
    }
    
    findNodesByName(searchScope)
    
    // Set selection
    figma.currentPage.selection = matchingNodes
    
    // Optionally scroll into view
    if (scrollIntoView && matchingNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(matchingNodes)
    }
    
    return {
      success: true,
      selectedNodes: matchingNodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type
      })),
      selectedCount: matchingNodes.length,
      namePattern: namePattern,
      exactMatch: exactMatch,
      caseSensitive: caseSensitive,
      searchScope: parentId || 'current page'
    }
    
  } catch (error) {
    console.error('Error selecting nodes by name:', error)
    throw new Error(`Failed to select nodes by name: ${error.message || error}`)
  }
}

// Delete Multiple Nodes
export async function deleteMultipleNodes(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter name formats
  let nodeIds = params.nodeIds || params.Node_IDs || params.Node_Ids || params.nodeIdList || []
  
  if (!nodeIds || !nodeIds.length) {
    throw new Error('Node IDs are required')
  }

  // Handle comma-separated string
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }

  // Ensure it's an array
  if (!Array.isArray(nodeIds)) {
    nodeIds = [nodeIds]
  }

  try {
    const deletedNodes: Array<{ id: string, name: string, type: string }> = []
    const errors: Array<{ id: string, error: string }> = []

    // Delete each node
    for (const nodeId of nodeIds) {
      try {
        const node = await getNodeByIdSafe(nodeId)
        
        if (!node) {
          errors.push({ id: nodeId, error: 'Node not found' })
          continue
        }

        // Store node info before deletion
        deletedNodes.push({
          id: node.id,
          name: node.name,
          type: node.type
        })

        // Remove the node
        node.remove()

      } catch (error) {
        errors.push({
          id: nodeId,
          error: error.message || 'Unknown error'
        })
      }
    }

    // Clear selection since nodes are deleted
    figma.currentPage.selection = []

    return {
      success: true,
      deletedNodes: deletedNodes,
      deletedCount: deletedNodes.length,
      errors: errors.length > 0 ? errors : undefined,
      totalRequested: nodeIds.length
    }

  } catch (error) {
    console.error('Error deleting multiple nodes:', error)
    throw new Error(`Failed to delete multiple nodes: ${error.message || error}`)
  }
}

// Get Instance Overrides
export async function getInstanceOverrides(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.sourceInstanceId || params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }
  
  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }
    
    if (node.type !== 'INSTANCE') {
      throw new Error(`Node ${nodeId} is not an instance (type: ${node.type})`)
    }
    
    const instance = node as InstanceNode
    
    // Get all overridable properties
    const overrides: any = {
      characters: {},
      fills: {},
      visible: {},
      layoutAlign: {},
      layoutGrow: {},
      constraints: {},
      effects: {},
      componentProperties: {}
    }
    
    // Function to recursively find overrides
    async function findOverrides(instanceNode: InstanceNode, componentNode: ComponentNode | ComponentSetNode, path: string = '') {
      // Compare properties between instance and component
      if ('children' in instanceNode && 'children' in componentNode) {
        const instanceChildren = instanceNode.children
        const componentChildren = componentNode.children
        
        for (let i = 0; i < instanceChildren.length && i < componentChildren.length; i++) {
          const instanceChild = instanceChildren[i]
          const componentChild = componentChildren[i]
          const childPath = path ? `${path}.${instanceChild.id}` : instanceChild.id
          
          // Check text overrides
          if (instanceChild.type === 'TEXT' && componentChild.type === 'TEXT') {
            const instanceText = instanceChild as TextNode
            const componentText = componentChild as TextNode
            
            if (instanceText.characters !== componentText.characters) {
              overrides.characters[childPath] = {
                original: componentText.characters,
                override: instanceText.characters
              }
            }
          }
          
          // Check fill overrides
          if ('fills' in instanceChild && 'fills' in componentChild) {
            const instanceFills = JSON.stringify(instanceChild.fills)
            const componentFills = JSON.stringify(componentChild.fills)
            
            if (instanceFills !== componentFills) {
              overrides.fills[childPath] = {
                original: componentChild.fills,
                override: instanceChild.fills
              }
            }
          }
          
          // Check visibility overrides
          if (instanceChild.visible !== componentChild.visible) {
            overrides.visible[childPath] = {
              original: componentChild.visible,
              override: instanceChild.visible
            }
          }
          
          // Check effects overrides
          if ('effects' in instanceChild && 'effects' in componentChild) {
            const instanceEffects = JSON.stringify(instanceChild.effects)
            const componentEffects = JSON.stringify(componentChild.effects)
            
            if (instanceEffects !== componentEffects) {
              overrides.effects[childPath] = {
                original: componentChild.effects,
                override: instanceChild.effects
              }
            }
          }
          
          // Recursively check children if both are instances/frames
          if (instanceChild.type === 'INSTANCE' && componentChild.type === 'INSTANCE') {
            const nestedInstance = instanceChild as InstanceNode
            const nestedComponent = componentChild as InstanceNode
            const nestedMainComponent = await nestedInstance.getMainComponentAsync()
            const nestedComponentMain = await nestedComponent.getMainComponentAsync()
            if (nestedMainComponent && nestedComponentMain) {
              await findOverrides(nestedInstance, nestedMainComponent, childPath)
            }
          } else if ('children' in instanceChild && 'children' in componentChild) {
            await findOverrides(instanceChild as any, componentChild as any, childPath)
          }
        }
      }
    }
    
    // Get component properties overrides (for components with variants)
    if (instance.componentProperties) {
      overrides.componentProperties = instance.componentProperties
    }
    
    // Find overrides if main component exists
    const mainComponent = await instance.getMainComponentAsync()
    if (mainComponent) {
      await findOverrides(instance, mainComponent)
    }
    
    // Clean up empty override categories
    const cleanedOverrides: any = {}
    for (const [key, value] of Object.entries(overrides)) {
      if (Object.keys(value).length > 0) {
        cleanedOverrides[key] = value
      }
    }
    
    // Get available component properties from the main component
    let availableProperties: any = {}
    if (mainComponent) {
      try {
        // Check if main component is part of a Component Set
        if (mainComponent.parent?.type === 'COMPONENT_SET') {
          // Get properties from the Component Set parent
          const componentSet = mainComponent.parent as ComponentSetNode
          if (componentSet.componentPropertyDefinitions) {
            for (const [propName, propDef] of Object.entries(componentSet.componentPropertyDefinitions)) {
              availableProperties[propName] = {
                type: propDef.type,
                defaultValue: propDef.defaultValue,
                variantOptions: propDef.variantOptions,
                currentValue: instance.componentProperties?.[propName] || propDef.defaultValue
              }
            }
          }
        } else if (mainComponent.type === 'COMPONENT' && mainComponent.parent?.type !== 'COMPONENT_SET') {
          // Only non-variant components can have componentPropertyDefinitions
          if (mainComponent.componentPropertyDefinitions) {
            for (const [propName, propDef] of Object.entries(mainComponent.componentPropertyDefinitions)) {
              availableProperties[propName] = {
                type: propDef.type,
                defaultValue: propDef.defaultValue,
                variantOptions: propDef.variantOptions,
                currentValue: instance.componentProperties?.[propName] || propDef.defaultValue
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error getting available properties:', err)
      }
    }
    
    return {
      success: true,
      nodeId: instance.id,
      nodeName: instance.name,
      nodeType: instance.type,
      mainComponentId: mainComponent?.id,
      mainComponentName: mainComponent?.name,
      overrides: cleanedOverrides,
      hasOverrides: Object.keys(cleanedOverrides).length > 0,
      availableProperties: availableProperties,
      componentProperties: instance.componentProperties || {}
    }
    
  } catch (error) {
    console.error('Error getting instance overrides:', error)
    throw new Error(`Failed to get instance overrides: ${error.message || error}`)
  }
}

// Set Instance Overrides
export async function setInstanceOverrides(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const overrides = params.overrides || params.Overrides || {}
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }
  
  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }
    
    if (node.type !== 'INSTANCE') {
      throw new Error(`Node ${nodeId} is not an instance (type: ${node.type})`)
    }
    
    const instance = node as InstanceNode
    let propertiesApplied = 0
    let textOverridesApplied = 0
    let totalRequested = 0
    const appliedProperties: Record<string, any> = {}
    const appliedTextOverrides: Record<string, string> = {}
    
    // Apply component properties (variants) - Only this is supported by Figma Plugin API
    if (overrides.componentProperties) {
      console.log('Setting component properties:', overrides.componentProperties)
      
      // Get main component to check available properties
      const mainComponent = await instance.getMainComponentAsync()
      let availableProperties: any = {}
      
      if (mainComponent) {
        try {
          // Check if main component is part of a Component Set
          if (mainComponent.parent?.type === 'COMPONENT_SET') {
            const componentSet = mainComponent.parent as ComponentSetNode
            if (componentSet.componentPropertyDefinitions) {
              availableProperties = componentSet.componentPropertyDefinitions
              console.log('Available properties from Component Set:', Object.keys(availableProperties))
            }
          } else if (mainComponent.componentPropertyDefinitions) {
            availableProperties = mainComponent.componentPropertyDefinitions
            console.log('Available properties from Component:', Object.keys(availableProperties))
          }
        } catch (err) {
          console.warn('Error getting available properties for validation:', err)
        }
      }
      
      for (const [key, value] of Object.entries(overrides.componentProperties)) {
        totalRequested++
        console.log(`Attempting to set property "${key}" to "${value}"`)
        
        // Check if property exists in available properties
        if (Object.keys(availableProperties).length > 0 && !availableProperties[key]) {
          console.warn(`Property "${key}" is not available in component. Available properties:`, Object.keys(availableProperties))
        }
        
        // Check if value is valid for the property
        if (availableProperties[key]?.variantOptions && !availableProperties[key].variantOptions.includes(value)) {
          console.warn(`Value "${value}" is not valid for property "${key}". Valid options:`, availableProperties[key].variantOptions)
        }
        
        try {
          instance.setProperties({ [key]: value })
          appliedProperties[key] = value
          propertiesApplied++
          console.log(`Successfully set property "${key}" to "${value}"`)
        } catch (error) {
          console.error(`Failed to set property "${key}" to "${value}":`, error)
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            propertyType: availableProperties[key]?.type,
            expectedOptions: availableProperties[key]?.variantOptions
          })
        }
      }
    }
    
    // Select the instance
    figma.currentPage.selection = [instance]
    figma.viewport.scrollAndZoomIntoView([instance])
    
    return {
      success: true,
      nodeId: instance.id,
      nodeName: instance.name,
      nodeType: instance.type,
      componentPropertiesApplied: propertiesApplied,
      totalRequested: totalRequested,
      appliedProperties: appliedProperties,
      message: propertiesApplied > 0 
        ? `Successfully applied ${propertiesApplied} component properties.`
        : 'No component properties were applied.'
    }
    
  } catch (error) {
    console.error('Error setting instance overrides:', error)
    throw new Error(`Failed to set instance overrides: ${error.message || error}`)
  }
}

// Detach Instance - Detach instance from its main component
export async function detachInstance(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID || params.instanceId
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }
  
  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }
    
    if (node.type !== 'INSTANCE') {
      throw new Error(`Node ${nodeId} is not an instance (type: ${node.type})`)
    }
    
    const instance = node as InstanceNode
    
    // Get main component info before detaching
    const mainComponent = await instance.getMainComponentAsync()
    const mainComponentInfo = mainComponent ? {
      id: mainComponent.id,
      name: mainComponent.name,
      key: mainComponent.key
    } : null
    
    // Store instance info before detaching
    const instanceInfo = {
      id: instance.id,
      name: instance.name,
      x: instance.x,
      y: instance.y,
      width: instance.width,
      height: instance.height,
      componentProperties: instance.componentProperties || {}
    }
    
    // Detach the instance
    const detachedNode = instance.detachInstance()
    
    if (!detachedNode) {
      throw new Error('Failed to detach instance - detachInstance returned null')
    }
    
    // Select the detached node
    figma.currentPage.selection = [detachedNode]
    figma.viewport.scrollAndZoomIntoView([detachedNode])
    
    return {
      success: true,
      nodeId: detachedNode.id,
      name: detachedNode.name,
      type: detachedNode.type,
      x: 'x' in detachedNode ? detachedNode.x : 0,
      y: 'y' in detachedNode ? detachedNode.y : 0,
      width: 'width' in detachedNode ? detachedNode.width : 0,
      height: 'height' in detachedNode ? detachedNode.height : 0,
      wasInstance: true,
      originalInstanceId: instanceInfo.id,
      mainComponent: mainComponentInfo,
      detachedFrom: mainComponentInfo?.name || 'Unknown Component',
      message: `Successfully detached instance from component: ${mainComponentInfo?.name || 'Unknown'}`
    }
    
  } catch (error) {
    console.error('Error detaching instance:', error)
    throw new Error(`Failed to detach instance: ${error.message || error}`)
  }
}