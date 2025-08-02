// Information and query commands

import { CommandParams, CommandResult } from '../types'
import { getNodeByIdSafe } from '../utils/nodes'

// Get Document Info
export async function getDocumentInfo(params: CommandParams): Promise<CommandResult> {
  try {
    const pages = figma.root.children.map(page => ({
      id: page.id,
      name: page.name,
      type: page.type
    }))

    const currentPage = figma.currentPage
    const selection = figma.currentPage.selection.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type
    }))

    return {
      success: true,
      document: {
        name: figma.root.name,
        id: figma.root.id,
        type: figma.root.type
      },
      pages: pages,
      currentPage: {
        id: currentPage.id,
        name: currentPage.name,
        type: currentPage.type
      },
      selection: selection,
      selectionCount: selection.length,
      editorType: figma.editorType,
      totalPages: pages.length
    }

  } catch (error) {
    console.error('Error getting document info:', error)
    throw new Error(`Failed to get document info: ${error.message || error}`)
  }
}

// Get Node Info
export async function getNodeInfo(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    const nodeInfo: any = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible
    }

    // Add position and size if available
    if ('x' in node && 'y' in node) {
      nodeInfo.x = node.x
      nodeInfo.y = node.y
    }

    if ('width' in node && 'height' in node) {
      nodeInfo.width = node.width
      nodeInfo.height = node.height
    }

    // Add rotation if available
    if ('rotation' in node) {
      nodeInfo.rotation = node.rotation
    }

    // Add opacity if available
    if ('opacity' in node) {
      nodeInfo.opacity = node.opacity
    }

    // Add fills information
    if ('fills' in node) {
      nodeInfo.fills = node.fills
    }

    // Add strokes information
    if ('strokes' in node) {
      nodeInfo.strokes = node.strokes
      if ('strokeWeight' in node) {
        nodeInfo.strokeWeight = node.strokeWeight
      }
    }

    // Add corner radius if available
    if ('cornerRadius' in node) {
      nodeInfo.cornerRadius = node.cornerRadius
    }

    // Add text-specific properties
    if (node.type === 'TEXT') {
      const textNode = node as TextNode
      nodeInfo.characters = textNode.characters
      nodeInfo.fontSize = textNode.fontSize
      nodeInfo.fontName = textNode.fontName
      nodeInfo.textAlignHorizontal = textNode.textAlignHorizontal
      nodeInfo.textAlignVertical = textNode.textAlignVertical
      nodeInfo.letterSpacing = textNode.letterSpacing
      nodeInfo.lineHeight = textNode.lineHeight
    }

    // Add frame-specific properties
    if (node.type === 'FRAME') {
      const frameNode = node as FrameNode
      nodeInfo.layoutMode = frameNode.layoutMode
      nodeInfo.itemSpacing = frameNode.itemSpacing
      nodeInfo.paddingLeft = frameNode.paddingLeft
      nodeInfo.paddingRight = frameNode.paddingRight
      nodeInfo.paddingTop = frameNode.paddingTop
      nodeInfo.paddingBottom = frameNode.paddingBottom
      nodeInfo.clipsContent = frameNode.clipsContent
    }

    // Add children information
    if ('children' in node) {
      const parentNode = node as ChildrenMixin
      nodeInfo.childrenCount = parentNode.children.length
      nodeInfo.children = parentNode.children.map(child => ({
        id: child.id,
        name: child.name,
        type: child.type
      }))
    }

    // Add parent information
    if (node.parent) {
      nodeInfo.parent = {
        id: node.parent.id,
        name: node.parent.name,
        type: node.parent.type
      }
    }

    return {
      success: true,
      nodeInfo: nodeInfo
    }

  } catch (error) {
    console.error('Error getting node info:', error)
    throw new Error(`Failed to get node info: ${error.message || error}`)
  }
}

// Get Selection
export async function getSelection(params: CommandParams): Promise<CommandResult> {
  try {
    const selection = figma.currentPage.selection

    if (selection.length === 0) {
      return {
        success: true,
        selection: [],
        selectionCount: 0,
        message: 'No nodes selected'
      }
    }

    const selectedNodes = selection.map(node => {
      const nodeInfo: any = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible
      }

      // Add position and size if available
      if ('x' in node && 'y' in node) {
        nodeInfo.x = node.x
        nodeInfo.y = node.y
      }

      if ('width' in node && 'height' in node) {
        nodeInfo.width = node.width
        nodeInfo.height = node.height
      }

      return nodeInfo
    })

    return {
      success: true,
      selection: selectedNodes,
      selectionCount: selection.length,
      firstSelected: selectedNodes[0]
    }

  } catch (error) {
    console.error('Error getting selection:', error)
    throw new Error(`Failed to get selection: ${error.message || error}`)
  }
}

// Search Nodes
export async function searchNodes(params: CommandParams): Promise<CommandResult> {
  const query = params.query || params.Query
  const nodeType = params.nodeType || params.Node_Type
  const limit = params.limit || params.Limit || 50

  if (!query && !nodeType) {
    throw new Error('Either query or nodeType is required')
  }

  try {
    let foundNodes: SceneNode[] = []

    if (nodeType) {
      // Search by node type
      foundNodes = figma.currentPage.findAll(node => {
        return node.type === nodeType.toUpperCase()
      })
    } else {
      // Search by name
      foundNodes = figma.currentPage.findAll(node => {
        return node.name.toLowerCase().includes(query.toLowerCase())
      })
    }

    // Limit results
    const limitedNodes = foundNodes.slice(0, limit)

    const searchResults = limitedNodes.map(node => {
      const nodeInfo: any = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible
      }

      // Add position and size if available
      if ('x' in node && 'y' in node) {
        nodeInfo.x = node.x
        nodeInfo.y = node.y
      }

      if ('width' in node && 'height' in node) {
        nodeInfo.width = node.width
        nodeInfo.height = node.height
      }

      return nodeInfo
    })

    return {
      success: true,
      searchResults: searchResults,
      totalFound: foundNodes.length,
      returned: limitedNodes.length,
      query: query,
      nodeType: nodeType
    }

  } catch (error) {
    console.error('Error searching nodes:', error)
    throw new Error(`Failed to search nodes: ${error.message || error}`)
  }
}

// Get Page Info
export async function getPageInfo(params: CommandParams): Promise<CommandResult> {
  const pageId = params.pageId || params.Page_ID

  try {
    let targetPage: PageNode

    if (pageId) {
      const page = await getNodeByIdSafe(pageId)
      if (!page || page.type !== 'PAGE') {
        throw new Error(`Page not found with ID: ${pageId}`)
      }
      targetPage = page as PageNode
    } else {
      targetPage = figma.currentPage
    }

    const allNodes = targetPage.findAll()
    const nodeTypes = allNodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topLevelNodes = targetPage.children.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible
    }))

    return {
      success: true,
      page: {
        id: targetPage.id,
        name: targetPage.name,
        type: targetPage.type
      },
      statistics: {
        totalNodes: allNodes.length,
        topLevelNodes: targetPage.children.length,
        nodeTypes: nodeTypes
      },
      topLevelNodes: topLevelNodes
    }

  } catch (error) {
    console.error('Error getting page info:', error)
    throw new Error(`Failed to get page info: ${error.message || error}`)
  }
}

// Export Node as Image
export async function exportNodeAsImage(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const format = params.format || params.Format || 'PNG'
  const scale = params.scale || params.Scale || 1

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('exportAsync' in node)) {
      throw new Error(`Node ${nodeId} cannot be exported`)
    }

    const exportableNode = node as ExportMixin

    const exportSettings: ExportSettings = {
      format: format.toUpperCase() as 'PNG' | 'JPG' | 'SVG' | 'PDF',
      constraint: {
        type: 'SCALE',
        value: scale
      }
    }

    const exportedBytes = await exportableNode.exportAsync(exportSettings)
    
    // Convert to base64 for transmission
    let base64String = ''
    const bytes = new Uint8Array(exportedBytes)
    for (let i = 0; i < bytes.length; i++) {
      base64String += String.fromCharCode(bytes[i])
    }
    const base64Data = btoa(base64String)

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      format: format,
      scale: scale,
      imageData: base64Data,
      size: exportedBytes.byteLength
    }

  } catch (error) {
    console.error('Error exporting node as image:', error)
    throw new Error(`Failed to export node as image: ${error.message || error}`)
  }
}

// Get Multiple Nodes Info
export async function getNodesInfo(params: CommandParams): Promise<CommandResult> {
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
    const nodesInfo = []
    const errors = []

    // Get info for each node
    for (const nodeId of nodeIds) {
      try {
        const node = await getNodeByIdSafe(nodeId)
        
        if (!node) {
          errors.push({ id: nodeId, error: 'Node not found' })
          continue
        }

        const nodeInfo: any = {
          id: node.id,
          name: node.name,
          type: node.type,
          visible: node.visible
        }

        // Add position and size if available
        if ('x' in node && 'y' in node) {
          nodeInfo.x = node.x
          nodeInfo.y = node.y
        }

        if ('width' in node && 'height' in node) {
          nodeInfo.width = node.width
          nodeInfo.height = node.height
        }

        // Add rotation if available
        if ('rotation' in node) {
          nodeInfo.rotation = node.rotation
        }

        // Add opacity if available
        if ('opacity' in node) {
          nodeInfo.opacity = node.opacity
        }

        // Add fills information
        if ('fills' in node) {
          nodeInfo.fills = node.fills
        }

        // Add strokes information
        if ('strokes' in node) {
          nodeInfo.strokes = node.strokes
          if ('strokeWeight' in node) {
            nodeInfo.strokeWeight = node.strokeWeight
          }
        }

        // Add text-specific properties
        if (node.type === 'TEXT') {
          const textNode = node as TextNode
          nodeInfo.characters = textNode.characters
          nodeInfo.fontSize = textNode.fontSize
          nodeInfo.fontName = textNode.fontName
        }

        // Add parent info
        if (node.parent) {
          nodeInfo.parentId = node.parent.id
          nodeInfo.parentName = node.parent.name
          nodeInfo.parentType = node.parent.type
        }

        // Add children count if it's a container
        if ('children' in node) {
          nodeInfo.childrenCount = (node as ChildrenMixin).children.length
        }

        nodesInfo.push(nodeInfo)

      } catch (error) {
        errors.push({
          id: nodeId,
          error: error.message || 'Unknown error'
        })
      }
    }

    return {
      success: true,
      nodes: nodesInfo,
      foundCount: nodesInfo.length,
      errors: errors.length > 0 ? errors : undefined,
      totalRequested: nodeIds.length
    }

  } catch (error) {
    console.error('Error getting multiple nodes info:', error)
    throw new Error(`Failed to get multiple nodes info: ${error.message || error}`)
  }
}

// Get Components from entire document (all pages)
export async function getComponents(params: CommandParams): Promise<CommandResult> {
  const searchLocal = params.searchLocal !== false // Default to true
  const searchRemote = params.searchRemote || false
  const includeVariants = params.includeVariants || false
  
  try {
    const components: any[] = []
    
    if (searchLocal) {
      // Load all pages first to enable document-wide search
      await figma.loadAllPagesAsync()
      
      // Search for local components across all pages in the document
      const allNodes = figma.root.findAll(node => {
        if (includeVariants) {
          return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
        }
        return node.type === 'COMPONENT'
      })
      
      for (const node of allNodes) {
        if (node.type === 'COMPONENT') {
          const component = node as ComponentNode
          // Find the page this component belongs to
          let currentNode: BaseNode | null = component as BaseNode
          let pageName = 'Unknown'
          let pageId = ''
          
          while (currentNode && currentNode.type !== 'PAGE') {
            currentNode = currentNode.parent
          }
          
          if (currentNode && currentNode.type === 'PAGE') {
            pageName = currentNode.name
            pageId = currentNode.id
          }
          
          const componentInfo: any = {
            id: component.id,
            key: component.key,
            name: component.name,
            description: component.description,
            type: 'COMPONENT',
            pageName: pageName,
            pageId: pageId,
            remote: false
          }
          
          // Add component properties if available
          try {
            // Only non-variant components can have componentPropertyDefinitions
            if (component.parent?.type !== 'COMPONENT_SET' && component.componentPropertyDefinitions) {
              componentInfo.properties = {}
              for (const [propName, propDef] of Object.entries(component.componentPropertyDefinitions)) {
                componentInfo.properties[propName] = {
                  type: propDef.type,
                  defaultValue: propDef.defaultValue,
                  variantOptions: propDef.variantOptions // For VARIANT type properties
                }
              }
            }
            
            // For variant components, get properties from parent Component Set
            if (component.parent?.type === 'COMPONENT_SET') {
              const parentSet = component.parent as ComponentSetNode
              if (parentSet.componentPropertyDefinitions) {
                componentInfo.properties = {}
                componentInfo.isVariant = true
                componentInfo.parentSetId = parentSet.id
                componentInfo.parentSetName = parentSet.name
                
                for (const [propName, propDef] of Object.entries(parentSet.componentPropertyDefinitions)) {
                  componentInfo.properties[propName] = {
                    type: propDef.type,
                    defaultValue: propDef.defaultValue,
                    variantOptions: propDef.variantOptions
                  }
                }
                
                // Add this component's variant property values
                if (component.name) {
                  componentInfo.variantProperties = {}
                  // Parse variant properties from component name (e.g., "State=Default, Size=Large")
                  const pairs = component.name.split(',').map(s => s.trim())
                  for (const pair of pairs) {
                    const [key, value] = pair.split('=').map(s => s.trim())
                    if (key && value) {
                      componentInfo.variantProperties[key] = value
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`Error getting properties for component ${component.id}:`, err)
            // Continue without properties
          }
          
          components.push(componentInfo)
        } else if (node.type === 'COMPONENT_SET' && includeVariants) {
          const componentSet = node as ComponentSetNode
          
          // Find the page this component set belongs to
          let currentNode: BaseNode | null = componentSet as BaseNode
          let pageName = 'Unknown'
          let pageId = ''
          
          while (currentNode && currentNode.type !== 'PAGE') {
            currentNode = currentNode.parent
          }
          
          if (currentNode && currentNode.type === 'PAGE') {
            pageName = currentNode.name
            pageId = currentNode.id
          }
          
          const componentSetInfo: any = {
            id: componentSet.id,
            key: componentSet.key,
            name: componentSet.name,
            description: componentSet.description,
            type: 'COMPONENT_SET',
            pageName: pageName,
            pageId: pageId,
            remote: false,
            defaultVariantId: componentSet.defaultVariant?.id
          }
          
          // Add component set properties
          if (componentSet.componentPropertyDefinitions) {
            componentSetInfo.properties = {}
            for (const [propName, propDef] of Object.entries(componentSet.componentPropertyDefinitions)) {
              componentSetInfo.properties[propName] = {
                type: propDef.type,
                defaultValue: propDef.defaultValue,
                variantOptions: propDef.variantOptions // For VARIANT type properties
              }
            }
          }
          
          // Add variant combinations
          if (componentSet.variantGroupProperties) {
            componentSetInfo.variantGroupProperties = componentSet.variantGroupProperties
          }
          
          components.push(componentSetInfo)
        }
      }
    }
    
    if (searchRemote) {
      // Note: Figma plugin API doesn't provide direct access to remote components
      // This would need to be implemented differently if remote component access is needed
      console.log('Remote component search is not currently supported')
    }
    
    // Create a summary of components by page
    const pagesSummary: { [pageId: string]: { pageName: string, componentCount: number } } = {}
    
    for (const component of components) {
      if (component.pageId) {
        if (!pagesSummary[component.pageId]) {
          pagesSummary[component.pageId] = {
            pageName: component.pageName,
            componentCount: 0
          }
        }
        pagesSummary[component.pageId].componentCount++
      }
    }
    
    // Get all pages in the document
    const allPages = figma.root.children.map(page => ({
      id: page.id,
      name: page.name,
      type: page.type
    }))
    
    return {
      success: true,
      components: components,
      totalFound: components.length,
      searchLocal: searchLocal,
      searchRemote: searchRemote,
      includeVariants: includeVariants,
      pages: allPages,
      pagesSummary: pagesSummary,
      documentName: figma.root.name
    }
    
  } catch (error) {
    console.error('Error getting components:', error)
    throw new Error(`Failed to get components: ${error.message || error}`)
  }
}

// Scan Nodes by Types
export async function scanNodesByTypes(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter formats
  let nodeTypes = params.nodeTypes || params.Node_Types || ['TEXT']
  const nodeId = params.nodeId || params.Node_ID || null
  const limit = params.limit || params.Limit || 100
  
  // Handle comma-separated string
  if (typeof nodeTypes === 'string') {
    nodeTypes = nodeTypes.split(',').map(type => type.trim().toUpperCase()).filter(type => type.length > 0)
  }
  
  // Ensure it's an array
  if (!Array.isArray(nodeTypes)) {
    nodeTypes = [nodeTypes]
  }
  
  // Validate node types - convert to uppercase
  nodeTypes = nodeTypes.map(type => type.toUpperCase())
  
  try {
    let searchScope: BaseNode
    
    if (nodeId) {
      const node = await getNodeByIdSafe(nodeId)
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`)
      }
      searchScope = node
    } else {
      searchScope = figma.currentPage
    }
    
    // Find all nodes of specified types
    const foundNodes: SceneNode[] = []
    
    function findNodesByTypes(node: BaseNode) {
      if (nodeTypes.includes(node.type)) {
        foundNodes.push(node as SceneNode)
      }
      
      if ('children' in node) {
        for (const child of node.children) {
          findNodesByTypes(child)
        }
      }
    }
    
    findNodesByTypes(searchScope)
    
    // Limit results
    const limitedNodes = foundNodes.slice(0, limit)
    
    // Map node information
    const results = limitedNodes.map(node => {
      const nodeInfo: any = {
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible
      }
      
      // Add position and size if available
      if ('x' in node && 'y' in node) {
        nodeInfo.x = node.x
        nodeInfo.y = node.y
      }
      
      if ('width' in node && 'height' in node) {
        nodeInfo.width = node.width
        nodeInfo.height = node.height
      }
      
      // Add text content for text nodes
      if (node.type === 'TEXT') {
        const textNode = node as TextNode
        nodeInfo.characters = textNode.characters
      }
      
      // Add parent info
      if (node.parent) {
        nodeInfo.parentId = node.parent.id
        nodeInfo.parentName = node.parent.name
        nodeInfo.parentType = node.parent.type
      }
      
      return nodeInfo
    })
    
    return {
      success: true,
      nodes: results,
      totalFound: foundNodes.length,
      returned: limitedNodes.length,
      nodeTypes: nodeTypes,
      searchScope: nodeId || 'current page'
    }
    
  } catch (error) {
    console.error('Error scanning nodes by types:', error)
    throw new Error(`Failed to scan nodes by types: ${error.message || error}`)
  }
}