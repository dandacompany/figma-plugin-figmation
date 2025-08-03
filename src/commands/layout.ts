// Layout and container commands

import { CommandParams, CommandResult } from '../types'
import { generateNodeName, appendToParent, createNodeResult, normalizeNodeId, getNodeByIdSafe } from '../utils/nodes'
import { createColorPaint } from '../utils/colors'

// Import for component property types
type ComponentPropertyDefinitions = Record<string, ComponentPropertyDefinition>

// Create Frame
export async function createFrame(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const name = generateNodeName('Frame', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  const frame = figma.createFrame()
  frame.x = x
  frame.y = y
  frame.resize(width, height)
  frame.name = name

  // Set background color if provided
  if (params.backgroundColor || params.Background_Color) {
    const bgColor = params.backgroundColor || params.Background_Color
    frame.fills = [createColorPaint(bgColor)]
  }

  // Set layout mode if provided
  if (params.layoutMode || params.Layout_Mode) {
    const layoutMode = params.layoutMode || params.Layout_Mode
    if (layoutMode === 'HORIZONTAL' || layoutMode === 'VERTICAL') {
      frame.layoutMode = layoutMode
      frame.primaryAxisSizingMode = 'AUTO'
      frame.counterAxisSizingMode = 'AUTO'
      
      // Set padding
      const padding = params.padding !== undefined ? params.padding : 10
      frame.paddingLeft = padding
      frame.paddingRight = padding
      frame.paddingTop = padding
      frame.paddingBottom = padding
      
      // Set spacing
      const spacing = params.spacing !== undefined ? params.spacing : 10
      frame.itemSpacing = spacing
    }
  }

  // Add to parent or current page
  const actualParentId = await appendToParent(frame, parentId)

  // Select the new frame
  figma.currentPage.selection = [frame]

  return createNodeResult(frame, actualParentId)
}

// Create Auto Layout
export async function createAutoLayout(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const direction = params.direction || params.Direction || 'HORIZONTAL'
  const spacing = params.spacing !== undefined ? Number(params.spacing) : 10
  const padding = params.padding !== undefined ? Number(params.padding) : 20
  const name = generateNodeName('Auto Layout', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  const frame = figma.createFrame()
  frame.x = x
  frame.y = y
  frame.name = name

  // Set auto-layout properties
  frame.layoutMode = direction
  frame.primaryAxisSizingMode = 'AUTO'
  frame.counterAxisSizingMode = 'AUTO'
  frame.itemSpacing = spacing
  frame.paddingLeft = padding
  frame.paddingRight = padding
  frame.paddingTop = padding
  frame.paddingBottom = padding

  // Set alignment
  const primaryAxisAlign = params.primaryAxisAlign || 'MIN'
  const counterAxisAlign = params.counterAxisAlign || 'MIN'
  
  if (primaryAxisAlign === 'CENTER') {
    frame.primaryAxisAlignItems = 'CENTER'
  } else if (primaryAxisAlign === 'MAX') {
    frame.primaryAxisAlignItems = 'MAX'
  } else {
    frame.primaryAxisAlignItems = 'MIN'
  }

  if (counterAxisAlign === 'CENTER') {
    frame.counterAxisAlignItems = 'CENTER'
  } else if (counterAxisAlign === 'MAX') {
    frame.counterAxisAlignItems = 'MAX'
  } else {
    frame.counterAxisAlignItems = 'MIN'
  }

  // Set background color if provided
  if (params.backgroundColor) {
    frame.fills = [createColorPaint(params.backgroundColor)]
  }

  // Add to parent or current page
  const actualParentId = await appendToParent(frame, parentId)

  // Select the new frame
  figma.currentPage.selection = [frame]

  return {
    ...createNodeResult(frame, actualParentId),
    layoutMode: frame.layoutMode,
    itemSpacing: frame.itemSpacing,
    padding: {
      left: frame.paddingLeft,
      right: frame.paddingRight,
      top: frame.paddingTop,
      bottom: frame.paddingBottom
    }
  }
}

// Create Empty Component (Legacy function - not commonly used)
export async function createEmptyComponent(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Component creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const name = params.name || params.Name || 'Component'
  const description = params.description || params.Description || ''
  const parentId = params.parentIdForNode || params.parentId || null

  // Create a frame first
  const frame = figma.createFrame()
  frame.x = x
  frame.y = y
  frame.resize(width, height)
  frame.name = name

  // Convert to component
  const component = figma.createComponentFromNode(frame)
  if (!component) {
    throw new Error('Failed to create component')
  }

  component.name = name
  if (description) {
    component.description = description
  }

  // Add to parent or current page
  const actualParentId = await appendToParent(component, parentId)

  // Select the new component
  figma.currentPage.selection = [component]

  return {
    ...createNodeResult(component, actualParentId),
    componentId: component.id,
    key: component.key
  }
}

// Create Instance
export async function createInstance(params: CommandParams): Promise<CommandResult> {
  const componentId = params.componentId || params.Component_ID
  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const name = params.name || params.Name
  const parentId = params.parentIdForNode || params.parentId || null
  const componentProperties = params.componentProperties || params.properties || params.variants || {}
  const overrides = params.overrides || {}

  if (!componentId) {
    throw new Error('Component ID is required')
  }

  try {
    // Normalize component ID format
    const normalizedComponentId = normalizeNodeId(componentId)
    const componentNode = await getNodeByIdSafe(normalizedComponentId)
    
    if (!componentNode) {
      throw new Error(`Component not found with ID: ${componentId} (normalized: ${normalizedComponentId})`)
    }

    if (componentNode.type !== 'COMPONENT' && componentNode.type !== 'COMPONENT_SET') {
      throw new Error(`Node ${componentId} is not a component (type: ${componentNode.type})`)
    }

    let instance: InstanceNode

    if (componentNode.type === 'COMPONENT') {
      instance = componentNode.createInstance()
    } else {
      // For component sets, use the default variant
      const defaultVariant = componentNode.defaultVariant as ComponentNode
      if (!defaultVariant) {
        throw new Error('Component set has no default variant')
      }
      instance = defaultVariant.createInstance()
    }

    // Get main component for both property application and details
    const mainComponent = await instance.getMainComponentAsync()
    
    // Apply component properties if provided
    // Note: We need to do this AFTER getting the main component to handle dynamic property keys
    let appliedProperties = {}
    if (Object.keys(componentProperties).length > 0) {
      try {
        if (mainComponent) {
          // Get available properties with their full keys (including dynamic IDs)
          let availableProps: ComponentPropertyDefinitions = {}
          
          // Check if main component is part of a Component Set
          if (mainComponent.parent?.type === 'COMPONENT_SET') {
            const componentSet = mainComponent.parent as ComponentSetNode
            if (componentSet.componentPropertyDefinitions) {
              availableProps = componentSet.componentPropertyDefinitions
            }
          } else if (mainComponent.componentPropertyDefinitions) {
            availableProps = mainComponent.componentPropertyDefinitions
          }
          
          // Create mapping from simple names to full keys (case-insensitive)
          const keyMapping: Record<string, string> = {}
          const lowercaseMapping: Record<string, string> = {}
          Object.keys(availableProps).forEach(fullKey => {
            // Extract simple name by removing ID suffix (e.g., "Title#929:1" -> "Title")
            const simpleName = fullKey.split('#')[0]
            keyMapping[simpleName] = fullKey
            // Also create lowercase mapping for case-insensitive matching
            lowercaseMapping[simpleName.toLowerCase()] = fullKey
          })
          
          console.log('Available property keys:', Object.keys(availableProps))
          console.log('Key mapping created:', keyMapping)
          
          // Map user-provided properties to actual property keys
          const mappedProperties: Record<string, any> = {}
          Object.entries(componentProperties).forEach(([userKey, value]) => {
            // Try exact match first
            let actualKey = keyMapping[userKey]
            
            // If no exact match, try case-insensitive match
            if (!actualKey) {
              actualKey = lowercaseMapping[userKey.toLowerCase()]
            }
            
            // If still no match, use original key as fallback
            if (!actualKey) {
              console.warn(`No mapping found for property "${userKey}", using as-is`)
              actualKey = userKey
            }
            
            mappedProperties[actualKey] = value
          })
          
          // Apply the mapped properties
          if (Object.keys(mappedProperties).length > 0) {
            instance.setProperties(mappedProperties)
            appliedProperties = mappedProperties
            console.log('✅ Applied component properties with key mapping:', {
              userProvided: componentProperties,
              keyMapping: keyMapping,
              actualApplied: mappedProperties
            })
          }
        } else {
          // Fallback to direct application if no main component
          instance.setProperties(componentProperties)
          appliedProperties = componentProperties
        }
      } catch (propError) {
        console.warn('Error setting component properties:', propError)
        // Try fallback without mapping
        try {
          instance.setProperties(componentProperties)
          appliedProperties = componentProperties
          console.log('Applied properties without mapping as fallback')
        } catch (fallbackError) {
          console.warn('Fallback property setting also failed:', fallbackError)
        }
      }
    }

    // Apply position and name
    instance.x = x
    instance.y = y
    if (name) {
      instance.name = name
    }

    // Apply overrides if provided (text, colors, etc.)
    if (Object.keys(overrides).length > 0) {
      applyInstanceOverrides(instance, overrides)
    }

    // Add to parent or current page
    const actualParentId = await appendToParent(instance, parentId)

    // Select the new instance
    figma.currentPage.selection = [instance]
    
    // Scroll and zoom to show the new instance
    figma.viewport.scrollAndZoomIntoView([instance])

    // Main component already fetched above for property application
    
    // Collect detailed instance properties similar to UI
    const instanceDetails: any = {
      mainComponent: mainComponent ? {
        id: mainComponent.id,
        name: mainComponent.name,
        key: mainComponent.key
      } : null,
      componentProperties: instance.componentProperties || {},
      availableProperties: [] as any[] as any[],
      appliedProperties: appliedProperties,
      originalPropertiesInput: componentProperties
    }
    
    // Get available properties from main component (including full property names)
    if (mainComponent) {
      try {
        let availableProps: ComponentPropertyDefinitions = {}
        
        // Check if main component is part of a Component Set
        if (mainComponent.parent?.type === 'COMPONENT_SET') {
          const componentSet = mainComponent.parent as ComponentSetNode
          if (componentSet.componentPropertyDefinitions) {
            availableProps = componentSet.componentPropertyDefinitions
          }
        } else if (mainComponent.componentPropertyDefinitions) {
          availableProps = mainComponent.componentPropertyDefinitions
        }
        
        // Convert to array format with full property names
        if (Object.keys(availableProps).length > 0) {
          instanceDetails.availableProperties = Object.entries(availableProps).map(([key, prop]) => ({
            key, // This will include the full key like "Title#929:0"
            type: prop.type,
            defaultValue: prop.defaultValue,
            currentValue: instance.componentProperties?.[key],
            variantOptions: prop.type === 'VARIANT' ? prop.variantOptions : undefined
          }))
        }
      } catch (err) {
        console.warn('Error getting available properties:', err)
      }
    }
    
    // Get exposed instances
    try {
      const exposedInstances = instance.exposedInstances || []
      instanceDetails.exposedInstances = exposedInstances.map(exp => ({
        name: exp.name,
        type: exp.type
      }))
    } catch (err) {
      console.warn('Error getting exposed instances:', err)
    }

    return {
      ...createNodeResult(instance, actualParentId),
      mainComponentId: mainComponent?.id,
      appliedProperties: appliedProperties,
      originalPropertiesInput: componentProperties,
      hasOverrides: Object.keys(overrides).length > 0,
      // Enhanced instance details for n8n
      instanceDetails: instanceDetails
    }

  } catch (error) {
    console.error('Error creating instance:', error)
    throw new Error(`Failed to create instance: ${error.message || error}`)
  }
}

// Helper function to apply overrides to an instance
function applyInstanceOverrides(instance: InstanceNode, overrides: any) {
  // Apply text overrides
  if (overrides.text || overrides.characters) {
    const textOverrides = overrides.text || overrides.characters
    for (const [nodeId, text] of Object.entries(textOverrides)) {
      const textNode = instance.findOne(node => node.id === nodeId && node.type === 'TEXT') as TextNode
      if (textNode) {
        textNode.characters = text as string
      }
    }
  }

  // Apply fill overrides
  if (overrides.fills) {
    for (const [nodeId, fills] of Object.entries(overrides.fills)) {
      const node = instance.findOne(n => n.id === nodeId)
      if (node && 'fills' in node) {
        (node as any).fills = fills
      }
    }
  }

  // Apply visibility overrides
  if (overrides.visible) {
    for (const [nodeId, visible] of Object.entries(overrides.visible)) {
      const node = instance.findOne(n => n.id === nodeId)
      if (node) {
        node.visible = visible as boolean
      }
    }
  }
}

// Set Layout Grid
export async function setLayoutGrid(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const gridType = params.gridType || params.Grid_Type || 'GRID'
  const count = params.count !== undefined ? Number(params.count) : 12
  const offset = params.offset !== undefined ? Number(params.offset) : 0
  const gutter = params.gutter !== undefined ? Number(params.gutter) : 20
  const color = params.color || { r: 1, g: 0, b: 0, a: 0.1 }

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('layoutGrids' in node)) {
      throw new Error(`Node ${nodeId} does not support layout grids`)
    }

    const gridNode = node as BaseFrameMixin & SceneNode
    let layoutGrid: LayoutGrid

    switch (gridType.toUpperCase()) {
      case 'COLUMNS':
        layoutGrid = {
          pattern: 'COLUMNS',
          alignment: 'STRETCH',
          count: count,
          offset: offset,
          gutterSize: gutter,
          color: color,
          visible: true
        }
        break

      case 'ROWS':
        layoutGrid = {
          pattern: 'ROWS',
          alignment: 'STRETCH',
          count: count,
          offset: offset,
          gutterSize: gutter,
          color: color,
          visible: true
        }
        break

      case 'GRID':
      default:
        layoutGrid = {
          pattern: 'GRID',
          sectionSize: params.sectionSize || 10,
          color: color,
          visible: true
        }
        break
    }

    gridNode.layoutGrids = [layoutGrid]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      layoutGrid: layoutGrid
    }

  } catch (error) {
    console.error('Error setting layout grid:', error)
    throw new Error(`Failed to set layout grid: ${error.message || error}`)
  }
}

// Set Layout Mode
export async function setLayoutMode(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const layoutMode = params.layoutMode || params.Layout_Mode || params.mode
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (!layoutMode) {
    throw new Error('Layout mode is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('layoutMode' in node)) {
      throw new Error(`Node ${nodeId} does not support layout mode (type: ${node.type})`)
    }

    const layoutNode = node as FrameNode
    
    // Set layout mode
    if (layoutMode === 'NONE') {
      layoutNode.layoutMode = 'NONE'
    } else if (layoutMode === 'HORIZONTAL' || layoutMode === 'VERTICAL') {
      layoutNode.layoutMode = layoutMode
      
      // Set default auto-layout properties if not already set
      if (layoutNode.primaryAxisSizingMode === 'FIXED') {
        layoutNode.primaryAxisSizingMode = 'AUTO'
      }
      if (layoutNode.counterAxisSizingMode === 'FIXED') {
        layoutNode.counterAxisSizingMode = 'AUTO'
      }
    } else {
      throw new Error(`Invalid layout mode: ${layoutMode}. Must be NONE, HORIZONTAL, or VERTICAL`)
    }

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      layoutMode: layoutNode.layoutMode,
      primaryAxisSizingMode: layoutNode.primaryAxisSizingMode,
      counterAxisSizingMode: layoutNode.counterAxisSizingMode
    }

  } catch (error) {
    console.error('Error setting layout mode:', error)
    throw new Error(`Failed to set layout mode: ${error.message || error}`)
  }
}

// Set Padding
export async function setPadding(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const padding = params.padding !== undefined ? Number(params.padding) : params.Padding
  const paddingLeft = params.paddingLeft !== undefined ? Number(params.paddingLeft) : params.Padding_Left
  const paddingRight = params.paddingRight !== undefined ? Number(params.paddingRight) : params.Padding_Right
  const paddingTop = params.paddingTop !== undefined ? Number(params.paddingTop) : params.Padding_Top
  const paddingBottom = params.paddingBottom !== undefined ? Number(params.paddingBottom) : params.Padding_Bottom
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('paddingLeft' in node)) {
      throw new Error(`Node ${nodeId} does not support padding (type: ${node.type})`)
    }

    const paddingNode = node as FrameNode

    // If uniform padding is provided, use it for all sides
    if (padding !== undefined) {
      paddingNode.paddingLeft = padding
      paddingNode.paddingRight = padding
      paddingNode.paddingTop = padding
      paddingNode.paddingBottom = padding
    } else {
      // Otherwise set individual paddings
      if (paddingLeft !== undefined) paddingNode.paddingLeft = paddingLeft
      if (paddingRight !== undefined) paddingNode.paddingRight = paddingRight
      if (paddingTop !== undefined) paddingNode.paddingTop = paddingTop
      if (paddingBottom !== undefined) paddingNode.paddingBottom = paddingBottom
    }

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      padding: {
        left: paddingNode.paddingLeft,
        right: paddingNode.paddingRight,
        top: paddingNode.paddingTop,
        bottom: paddingNode.paddingBottom
      }
    }

  } catch (error) {
    console.error('Error setting padding:', error)
    throw new Error(`Failed to set padding: ${error.message || error}`)
  }
}

// Set Item Spacing
export async function setItemSpacing(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const spacing = params.spacing !== undefined ? Number(params.spacing) : params.Item_Spacing !== undefined ? Number(params.Item_Spacing) : params.itemSpacing
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (spacing === undefined) {
    throw new Error('Spacing value is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('itemSpacing' in node)) {
      throw new Error(`Node ${nodeId} does not support item spacing (type: ${node.type})`)
    }

    const spacingNode = node as FrameNode
    
    // Node must have auto-layout enabled
    if (spacingNode.layoutMode === 'NONE') {
      throw new Error(`Node ${nodeId} must have auto-layout enabled to set item spacing`)
    }

    spacingNode.itemSpacing = Number(spacing)

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      itemSpacing: spacingNode.itemSpacing,
      layoutMode: spacingNode.layoutMode
    }

  } catch (error) {
    console.error('Error setting item spacing:', error)
    throw new Error(`Failed to set item spacing: ${error.message || error}`)
  }
}

// Create Component from existing nodes
export async function createComponent(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Component creation is only available in Design mode')
  }

  // Get node IDs array
  let nodeIds = params.nodeIds || []
  
  // Handle comma-separated string
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }
  
  // Ensure it's an array
  if (!Array.isArray(nodeIds)) {
    nodeIds = [nodeIds]
  }
  
  if (!nodeIds || nodeIds.length === 0) {
    throw new Error('At least one node ID is required to create a component')
  }

  const componentName = params.name || params.Name || 'Component'
  const description = params.description || params.Description || ''

  try {
    // Collect all nodes
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      // Normalize node ID format
      const normalizedId = normalizeNodeId(nodeId)
      const node = await getNodeByIdSafe(normalizedId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId} (normalized: ${normalizedId})`)
      }
      nodes.push(node as SceneNode)
    }

    // Check if nodes are valid scene nodes
    for (const node of nodes) {
      if (!('x' in node && 'y' in node)) {
        throw new Error(`Node ${node.id} (${node.type}) cannot be converted to component`)
      }
    }

    let component: ComponentNode

    if (nodes.length === 1) {
      // Single node - convert directly if it's a frame, otherwise wrap in frame
      const node = nodes[0]
      
      if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
        // Can be converted directly
        component = figma.createComponentFromNode(node)
        if (!component) {
          throw new Error('Failed to create component from node')
        }
      } else {
        // Need to wrap in a frame first
        const frame = figma.createFrame()
        
        // Calculate bounds
        const bounds = {
          x: node.x,
          y: node.y,
          width: 'width' in node ? node.width : 100,
          height: 'height' in node ? node.height : 100
        }
        
        // Set frame properties
        frame.x = bounds.x
        frame.y = bounds.y
        frame.resize(bounds.width, bounds.height)
        frame.name = componentName
        
        // Get parent
        const parent = node.parent
        if (parent && 'appendChild' in parent) {
          parent.appendChild(frame)
        }
        
        // Move node into frame
        node.x = 0
        node.y = 0
        frame.appendChild(node)
        
        // Convert frame to component
        component = figma.createComponentFromNode(frame)
        if (!component) {
          throw new Error('Failed to create component from frame')
        }
      }
    } else {
      // Multiple nodes - need to group them first
      
      // Calculate bounds
      let minX = Infinity, minY = Infinity
      let maxX = -Infinity, maxY = -Infinity
      
      for (const node of nodes) {
        minX = Math.min(minX, node.x)
        minY = Math.min(minY, node.y)
        if ('width' in node && 'height' in node) {
          maxX = Math.max(maxX, node.x + node.width)
          maxY = Math.max(maxY, node.y + node.height)
        }
      }
      
      const width = maxX - minX
      const height = maxY - minY
      
      // Create frame
      const frame = figma.createFrame()
      frame.x = minX
      frame.y = minY
      frame.resize(width, height)
      frame.name = componentName
      
      // Get common parent
      const parent = nodes[0].parent
      if (parent && 'appendChild' in parent) {
        parent.appendChild(frame)
      }
      
      // Move all nodes into frame and adjust positions
      for (const node of nodes) {
        const relativeX = node.x - minX
        const relativeY = node.y - minY
        frame.appendChild(node)
        node.x = relativeX
        node.y = relativeY
      }
      
      // Convert to component
      component = figma.createComponentFromNode(frame)
      if (!component) {
        throw new Error('Failed to create component from frame')
      }
    }

    // Set component properties
    component.name = componentName
    if (description) {
      component.description = description
    }

    // Select the new component
    figma.currentPage.selection = [component]
    figma.viewport.scrollAndZoomIntoView([component])

    return {
      success: true,
      nodeId: component.id,
      name: component.name,
      type: component.type,
      componentId: component.id,
      key: component.key,
      childrenCount: 'children' in component ? component.children.length : 0,
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height
    }

  } catch (error) {
    console.error('Error creating component from nodes:', error)
    throw new Error(`Failed to create component from nodes: ${error.message || error}`)
  }
}

// Set Axis Alignment (for auto-layout frames)
export async function setAxisAlign(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const primaryAlign = params.primaryAlign || params.Primary_Align
  const counterAlign = params.counterAlign || params.Counter_Align
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('layoutMode' in node)) {
      throw new Error(`Node ${nodeId} does not support layout alignment (type: ${node.type})`)
    }

    const layoutNode = node as FrameNode
    
    // Node must have auto-layout enabled
    if (layoutNode.layoutMode === 'NONE') {
      throw new Error(`Node ${nodeId} must have auto-layout enabled to set axis alignment`)
    }

    // Set primary axis alignment
    if (primaryAlign) {
      const alignValue = primaryAlign.toUpperCase()
      if (['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'].includes(alignValue)) {
        layoutNode.primaryAxisAlignItems = alignValue as 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
      } else {
        throw new Error(`Invalid primary align value: ${primaryAlign}. Must be MIN, CENTER, MAX, or SPACE_BETWEEN`)
      }
    }

    // Set counter axis alignment
    if (counterAlign) {
      const alignValue = counterAlign.toUpperCase()
      if (['MIN', 'CENTER', 'MAX'].includes(alignValue)) {
        layoutNode.counterAxisAlignItems = alignValue as 'MIN' | 'CENTER' | 'MAX'
      } else {
        throw new Error(`Invalid counter align value: ${counterAlign}. Must be MIN, CENTER, or MAX`)
      }
    }

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      layoutMode: layoutNode.layoutMode,
      primaryAxisAlignItems: layoutNode.primaryAxisAlignItems,
      counterAxisAlignItems: layoutNode.counterAxisAlignItems
    }

  } catch (error) {
    console.error('Error setting axis alignment:', error)
    throw new Error(`Failed to set axis alignment: ${error.message || error}`)
  }
}

// Set Layout Sizing (for auto-layout frames)
export async function setLayoutSizing(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const primarySizing = params.primarySizing || params.Primary_Sizing
  const counterSizing = params.counterSizing || params.Counter_Sizing
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('layoutMode' in node)) {
      throw new Error(`Node ${nodeId} does not support layout sizing (type: ${node.type})`)
    }

    const layoutNode = node as FrameNode
    
    // Node must have auto-layout enabled
    if (layoutNode.layoutMode === 'NONE') {
      throw new Error(`Node ${nodeId} must have auto-layout enabled to set layout sizing`)
    }

    // Set primary axis sizing mode
    if (primarySizing) {
      const sizingValue = primarySizing.toUpperCase()
      if (['FIXED', 'AUTO'].includes(sizingValue)) {
        layoutNode.primaryAxisSizingMode = sizingValue as 'FIXED' | 'AUTO'
      } else {
        throw new Error(`Invalid primary sizing value: ${primarySizing}. Must be FIXED or AUTO`)
      }
    }

    // Set counter axis sizing mode
    if (counterSizing) {
      const sizingValue = counterSizing.toUpperCase()
      if (['FIXED', 'AUTO'].includes(sizingValue)) {
        layoutNode.counterAxisSizingMode = sizingValue as 'FIXED' | 'AUTO'
      } else {
        throw new Error(`Invalid counter sizing value: ${counterSizing}. Must be FIXED or AUTO`)
      }
    }

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      layoutMode: layoutNode.layoutMode,
      primaryAxisSizingMode: layoutNode.primaryAxisSizingMode,
      counterAxisSizingMode: layoutNode.counterAxisSizingMode
    }

  } catch (error) {
    console.error('Error setting layout sizing:', error)
    throw new Error(`Failed to set layout sizing: ${error.message || error}`)
  }
}

// Set Annotation (for dev mode annotations)
export async function setAnnotation(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const annotation = params.annotation || params.Annotation || params.text
  const type = params.type || params.Type || 'NOTE'
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (!annotation) {
    throw new Error('Annotation text is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    // Create annotation data
    const annotationData = {
      type: type,
      text: annotation,
      timestamp: new Date().toISOString()
    }

    // Method 1: Try to store as description (for nodes that support it)
    let storedAsDescription = false
    if ('description' in node) {
      try {
        const currentDescription = node.description || ''
        const annotationText = `[${type}] ${annotation}`
        
        // Append annotation if description exists, otherwise set as new description
        if (currentDescription) {
          node.description = `${currentDescription}\n${annotationText}`
        } else {
          node.description = annotationText
        }
        storedAsDescription = true
      } catch (error) {
        console.warn('Failed to set description:', error)
      }
    }

    // Method 2: Always store as plugin data (universal fallback)
    try {
      // Get existing annotations
      const existingData = node.getPluginData('figmation-annotations')
      let annotations = []
      
      if (existingData) {
        try {
          annotations = JSON.parse(existingData)
        } catch (e) {
          console.warn('Failed to parse existing annotation data:', e)
        }
      }
      
      // Add new annotation
      annotations.push(annotationData)
      
      // Store back to plugin data
      node.setPluginData('figmation-annotations', JSON.stringify(annotations))
      
    } catch (error) {
      console.warn('Failed to store annotation as plugin data:', error)
    }

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      annotation: annotationData,
      storedAsDescription: storedAsDescription,
      storedAsPluginData: true,
      description: 'description' in node ? node.description : undefined
    }

  } catch (error) {
    console.error('Error setting annotation:', error)
    throw new Error(`Failed to set annotation: ${error.message || error}`)
  }
}

// Get Annotations (retrieve annotations from a node)
export async function getAnnotations(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    const result: any = {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      annotations: [],
      description: null
    }

    // Get annotations from plugin data
    try {
      const pluginData = node.getPluginData('figmation-annotations')
      if (pluginData) {
        result.annotations = JSON.parse(pluginData)
      }
    } catch (error) {
      console.warn('Failed to get plugin data annotations:', error)
    }

    // Get description if available
    if ('description' in node) {
      result.description = node.description || null
    }

    return result

  } catch (error) {
    console.error('Error getting annotations:', error)
    throw new Error(`Failed to get annotations: ${error.message || error}`)
  }
}