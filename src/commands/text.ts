// Text-related commands

import { CommandParams, CommandResult } from '../types'
import { parseColor, createColorPaint } from '../utils/colors'
import { generateNodeName, appendToParent, createNodeResult, getNodeByIdSafe } from '../utils/nodes'

// Map font weights to styles
function getFontStyle(fontWeight?: number | string): string {
  const weight = typeof fontWeight === 'string' ? parseInt(fontWeight) : fontWeight
  
  if (!weight || weight === 400) return 'Regular'
  
  if (weight >= 900) return 'Black'
  if (weight >= 800) return 'Extra Bold'
  if (weight >= 700) return 'Bold'
  if (weight >= 600) return 'Semi Bold'
  if (weight >= 500) return 'Medium'
  if (weight >= 300) return 'Light'
  if (weight >= 200) return 'Extra Light'
  if (weight >= 100) return 'Thin'
  
  return 'Regular'
}

// Create Text
export async function createText(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  // Extract parameters with multiple name support
  const textContent = params.textContent || params.text || params.Text_Content || "Hello World"
  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const fontSize = params.fontSize !== undefined ? Number(params.fontSize) : 16
  const fontFamily = params.fontFamily || params.Font_Family || "Inter"
  const fontWeight = params.fontWeight || params.Font_Weight
  // Support both textColor and fontColor parameter names (n8n uses fontColor)
  let textColor = params.textColor || params.Text_Color || params.fontColor || params.Font_Color
  
  // Support n8n's Font_Color_R/G/B/A format
  if (!textColor && (params.Font_Color_R !== undefined || params.Font_Color_G !== undefined || params.Font_Color_B !== undefined)) {
    textColor = {
      r: params.Font_Color_R !== undefined ? params.Font_Color_R : 0,
      g: params.Font_Color_G !== undefined ? params.Font_Color_G : 0,
      b: params.Font_Color_B !== undefined ? params.Font_Color_B : 0,
      a: params.Font_Color_A !== undefined ? params.Font_Color_A : 1
    }
  }
  
  // Default to black if no color specified
  if (!textColor) {
    textColor = { r: 0, g: 0, b: 0, a: 1 }
  }
  const backgroundColor = params.backgroundColor || params.Background_Color
  const textAlign = params.textAlign || params.Text_Align || params.textAlignHorizontal || "LEFT"
  const letterSpacing = params.letterSpacing || params.Letter_Spacing
  const lineHeight = params.lineHeight || params.Line_Height
  const name = generateNodeName('Text', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  try {
    // Create text node
    const textNode = figma.createText()
    
    // Set position
    textNode.x = x
    textNode.y = y
    textNode.name = name

    // Load and set font
    const fontStyle = getFontStyle(fontWeight)
    try {
      await figma.loadFontAsync({ family: fontFamily, style: fontStyle })
      textNode.fontName = { family: fontFamily, style: fontStyle }
    } catch (fontError) {
      console.warn(`Failed to load font ${fontFamily} ${fontStyle}, falling back to Inter Regular`)
      // Fallback to Inter Regular if specified font fails
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
      textNode.fontName = { family: 'Inter', style: 'Regular' }
    }
    
    // Set text properties
    textNode.fontSize = fontSize
    textNode.characters = textContent

    // Set text color
    if (textColor) {
      const color = typeof textColor === 'string' ? parseColor(textColor) : textColor
      textNode.fills = [createColorPaint(color)]
    }

    // Set background color if provided
    if (backgroundColor) {
      const bgColor = typeof backgroundColor === 'string' ? parseColor(backgroundColor) : backgroundColor
      // Create a frame for background
      const frame = figma.createFrame()
      frame.x = x
      frame.y = y
      frame.resize(textNode.width + 20, textNode.height + 10)
      frame.fills = [createColorPaint(bgColor)]
      frame.name = `${name} Background`
      
      // Move text into frame
      textNode.x = 10
      textNode.y = 5
      frame.appendChild(textNode)
      
      // Add frame to parent
      const actualParentId = await appendToParent(frame, parentId)
      figma.currentPage.selection = [frame]
      
      return {
        ...createNodeResult(frame, actualParentId),
        textNodeId: textNode.id
      }
    }

    // Set text alignment
    if (textAlign) {
      textNode.textAlignHorizontal = textAlign as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
    }

    // Set letter spacing
    if (letterSpacing !== undefined) {
      textNode.letterSpacing = { value: Number(letterSpacing), unit: 'PIXELS' }
    }

    // Set line height
    if (lineHeight !== undefined) {
      textNode.lineHeight = { value: Number(lineHeight), unit: 'PIXELS' }
    }

    // Add to parent or current page
    const actualParentId = await appendToParent(textNode, parentId)

    // Select the new text
    figma.currentPage.selection = [textNode]

    return createNodeResult(textNode, actualParentId)

  } catch (error) {
    console.error('Error creating text:', error)
    throw new Error(`Failed to create text: ${error.message || error}`)
  }
}

// Update Text Content
export async function updateTextContent(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const newContent = params.newContent || params.New_Content || params.textContent

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (newContent === undefined) {
    throw new Error('New content is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (node.type !== 'TEXT') {
      throw new Error(`Node ${nodeId} is not a text node (type: ${node.type})`)
    }

    const textNode = node as TextNode

    // Load font before changing text
    await figma.loadFontAsync(textNode.fontName as FontName)
    
    // Update text content
    textNode.characters = String(newContent)

    // Select the updated text
    figma.currentPage.selection = [textNode]
    figma.viewport.scrollAndZoomIntoView([textNode])

    return {
      success: true,
      nodeId: textNode.id,
      name: textNode.name,
      type: textNode.type,
      characters: textNode.characters,
      previousContent: params.previousContent
    }

  } catch (error) {
    console.error('Error updating text content:', error)
    throw new Error(`Failed to update text content: ${error.message || error}`)
  }
}

// Get Text Content
export async function getTextContent(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (node.type !== 'TEXT') {
      throw new Error(`Node ${nodeId} is not a text node (type: ${node.type})`)
    }

    const textNode = node as TextNode

    return {
      success: true,
      nodeId: textNode.id,
      name: textNode.name,
      type: textNode.type,
      characters: textNode.characters,
      fontSize: textNode.fontSize,
      fontName: textNode.fontName,
      textAlignHorizontal: textNode.textAlignHorizontal,
      letterSpacing: textNode.letterSpacing,
      lineHeight: textNode.lineHeight
    }

  } catch (error) {
    console.error('Error getting text content:', error)
    throw new Error(`Failed to get text content: ${error.message || error}`)
  }
}

// Update Text (alias for updateTextContent)
export async function updateText(params: CommandParams): Promise<CommandResult> {
  return await updateTextContent(params)
}

// Set Font
export async function setFont(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const fontFamily = params.fontFamily || params.Font_Family || 'Inter'
  const fontWeight = params.fontWeight || params.Font_Weight || 400
  const fontSize = params.fontSize || params.Font_Size

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (node.type !== 'TEXT') {
      throw new Error(`Node ${nodeId} is not a text node (type: ${node.type})`)
    }

    const textNode = node as TextNode
    const fontStyle = getFontStyle(fontWeight)

    // Load and set font
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle })
    textNode.fontName = { family: fontFamily, style: fontStyle }

    // Set font size if provided
    if (fontSize) {
      textNode.fontSize = Number(fontSize)
    }

    // Select the text node
    figma.currentPage.selection = [textNode]
    figma.viewport.scrollAndZoomIntoView([textNode])

    return {
      success: true,
      nodeId: textNode.id,
      name: textNode.name,
      type: textNode.type,
      fontName: textNode.fontName,
      fontSize: textNode.fontSize
    }

  } catch (error) {
    console.error('Error setting font:', error)
    throw new Error(`Failed to set font: ${error.message || error}`)
  }
}

// Scan Text Nodes
export async function scanTextNodes(params: CommandParams): Promise<CommandResult> {
  const containsText = params.containsText || params.Contains_Text || params.searchText
  const parentId = params.parentId || params.Parent_ID
  
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

    // Find all text nodes
    const textNodes: TextNode[] = []
    
    function findTextNodes(node: BaseNode) {
      if (node.type === 'TEXT') {
        const textNode = node as TextNode
        // If search text is provided, filter by content
        if (!containsText || textNode.characters.toLowerCase().includes(containsText.toLowerCase())) {
          textNodes.push(textNode)
        }
      }
      
      if ('children' in node) {
        for (const child of node.children) {
          findTextNodes(child)
        }
      }
    }
    
    findTextNodes(searchScope)
    
    // Return text node information
    const results = textNodes.map(node => ({
      nodeId: node.id,
      name: node.name,
      text: node.characters,
      fontSize: node.fontSize === figma.mixed ? 'mixed' : node.fontSize,
      fontName: node.fontName === figma.mixed ? 'mixed' : node.fontName,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    }))
    
    return {
      success: true,
      textNodes: results,
      count: results.length,
      searchCriteria: containsText || 'all text nodes'
    }
    
  } catch (error) {
    console.error('Error scanning text nodes:', error)
    throw new Error(`Failed to scan text nodes: ${error.message || error}`)
  }
}

// Set Multiple Text Contents
export async function setMultipleTextContents(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter formats
  let updates = params.updates || params.Updates || params.textUpdates || []
  
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('Updates array is required with nodeId and text pairs')
  }
  
  try {
    const results: Array<{ nodeId: string, name: string, success: boolean, error?: string }> = []
    
    for (const update of updates) {
      const nodeId = update.nodeId || update.Node_ID
      const text = update.text || update.Text || update.content
      
      if (!nodeId) {
        results.push({
          nodeId: 'unknown',
          name: 'unknown',
          success: false,
          error: 'Node ID is required'
        })
        continue
      }
      
      try {
        const node = await getNodeByIdSafe(nodeId)
        
        if (!node) {
          results.push({
            nodeId: nodeId,
            name: 'not found',
            success: false,
            error: 'Node not found'
          })
          continue
        }
        
        if (node.type !== 'TEXT') {
          results.push({
            nodeId: nodeId,
            name: node.name,
            success: false,
            error: `Node is not a text node (type: ${node.type})`
          })
          continue
        }
        
        const textNode = node as TextNode
        
        // Load font if needed
        if (textNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(textNode.fontName)
        } else {
          // Default to Inter Regular for mixed fonts
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
          textNode.fontName = { family: 'Inter', style: 'Regular' }
        }
        
        // Update text
        textNode.characters = text || ''
        
        results.push({
          nodeId: node.id,
          name: node.name,
          success: true
        })
        
      } catch (error) {
        results.push({
          nodeId: nodeId,
          name: 'unknown',
          success: false,
          error: error.message || 'Unknown error'
        })
      }
    }
    
    // Count successes
    const successCount = results.filter(r => r.success).length
    
    return {
      success: true,
      results: results,
      totalRequested: updates.length,
      successCount: successCount,
      failureCount: updates.length - successCount
    }
    
  } catch (error) {
    console.error('Error setting multiple text contents:', error)
    throw new Error(`Failed to set multiple text contents: ${error.message || error}`)
  }
}

// Search Available Fonts
export async function searchAvailableFonts(params: CommandParams): Promise<CommandResult> {
  try {
    // Support multiple parameter names for keyword
    const keyword = params.keyword || params.Keyword || params.query || params.searchQuery || params.Search_Query || ''
    
    // Get all available fonts from Figma
    const availableFonts = await figma.listAvailableFontsAsync()
    
    let filteredFonts = availableFonts
    
    // Filter fonts if keyword is provided
    if (keyword) {
      const query = keyword.toLowerCase()
      filteredFonts = availableFonts.filter(font => 
        font.fontName.family.toLowerCase().includes(query) ||
        font.fontName.style.toLowerCase().includes(query)
      )
    }
    
    // Format the results
    const fontList = filteredFonts.map(font => ({
      family: font.fontName.family,
      style: font.fontName.style,
      fullName: `${font.fontName.family} ${font.fontName.style}`
    }))
    
    // Group by family for better organization
    const fontsByFamily = filteredFonts.reduce((acc, font) => {
      const family = font.fontName.family
      if (!acc[family]) {
        acc[family] = []
      }
      acc[family].push(font.fontName.style)
      return acc
    }, {} as Record<string, string[]>)
    
    return {
      success: true,
      fonts: fontList,
      fontsByFamily: fontsByFamily,
      totalCount: filteredFonts.length,
      searchQuery: keyword || 'all fonts',
      availableFamilies: Object.keys(fontsByFamily).sort()
    }
    
  } catch (error) {
    console.error('Error searching available fonts:', error)
    throw new Error(`Failed to search available fonts: ${error.message || error}`)
  }
}