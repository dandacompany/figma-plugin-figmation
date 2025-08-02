// Batch style commands for multiple nodes

import { CommandParams, CommandResult } from '../types'
import { parseColor, createColorPaint } from '../utils/colors'
import { getNodeByIdSafe } from '../utils/nodes'

// Apply styles to selected nodes or specific nodes by IDs
export async function applyStylesToSelection(params: CommandParams): Promise<CommandResult> {
  // Support both selection and nodeIds parameters
  let targetNodes: readonly SceneNode[] = []
  
  // Check if nodeIds are provided
  let nodeIds = params.nodeIds || params.Node_IDs || params.Node_Ids || params.nodeIdList || []
  
  // Handle comma-separated string
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }
  
  // Ensure it's an array
  if (!Array.isArray(nodeIds)) {
    nodeIds = [nodeIds]
  }
  
  if (nodeIds && nodeIds.length > 0) {
    // Use specific nodes by IDs
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      try {
        const node = await getNodeByIdSafe(nodeId)
        if (node && 'x' in node) {
          nodes.push(node as SceneNode)
        }
      } catch (error) {
        console.warn(`Node not found: ${nodeId}`)
      }
    }
    targetNodes = nodes
  } else {
    // Use current selection
    targetNodes = figma.currentPage.selection
  }
  
  if (!targetNodes || targetNodes.length === 0) {
    throw new Error('No nodes found. Please select nodes or provide valid node IDs.')
  }

  // Extract style parameters
  const fillColor = params.fillColor || params.Fill_Color
  const strokeColor = params.strokeColor || params.Stroke_Color
  const strokeWeight = params.strokeWeight !== undefined ? Number(params.strokeWeight) : params.Stroke_Weight
  const strokeAlign = params.strokeAlign || params.Stroke_Align || 'INSIDE'
  const opacity = params.opacity !== undefined ? Number(params.opacity) : params.Opacity
  const cornerRadius = params.cornerRadius !== undefined ? Number(params.cornerRadius) : params.Corner_Radius
  const addDropShadow = params.addDropShadow || params.Add_Drop_Shadow || false
  const addInnerShadow = params.addInnerShadow || params.Add_Inner_Shadow || false
  const addBlur = params.addBlur || params.Add_Blur || false
  const blurRadius = params.blurRadius !== undefined ? Number(params.blurRadius) : params.Blur_Radius || 4
  
  const results: Array<{ 
    nodeId: string, 
    name: string, 
    type: string, 
    appliedStyles: string[], 
    error?: string 
  }> = []

  // Process each target node
  for (const node of targetNodes) {
    const appliedStyles: string[] = []
    
    try {
      // Apply fill color
      if (fillColor && 'fills' in node) {
        const paint = createColorPaint(fillColor)
        node.fills = [paint]
        appliedStyles.push('fillColor')
      }

      // Apply stroke
      if ((strokeColor || strokeWeight !== undefined) && 'strokes' in node) {
        if (strokeColor) {
          const paint = createColorPaint(strokeColor)
          node.strokes = [paint]
          appliedStyles.push('strokeColor')
        }
        
        if (strokeWeight !== undefined && 'strokeWeight' in node) {
          node.strokeWeight = strokeWeight
          appliedStyles.push('strokeWeight')
        }
        
        if (strokeAlign && 'strokeAlign' in node) {
          node.strokeAlign = strokeAlign as 'INSIDE' | 'OUTSIDE' | 'CENTER'
          appliedStyles.push('strokeAlign')
        }
      }

      // Apply opacity
      if (opacity !== undefined && 'opacity' in node) {
        node.opacity = Math.max(0, Math.min(1, opacity))
        appliedStyles.push('opacity')
      }

      // Apply corner radius
      if (cornerRadius !== undefined && 'cornerRadius' in node) {
        node.cornerRadius = Math.max(0, cornerRadius)
        appliedStyles.push('cornerRadius')
      }

      // Apply effects
      if ('effects' in node && (addDropShadow || addInnerShadow || addBlur)) {
        const effects = [...(node.effects || [])]
        
        if (addDropShadow) {
          effects.push({
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 4,
            spread: 0,
            visible: true,
            blendMode: 'NORMAL'
          })
          appliedStyles.push('dropShadow')
        }
        
        if (addInnerShadow) {
          effects.push({
            type: 'INNER_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 4,
            spread: 0,
            visible: true,
            blendMode: 'NORMAL'
          })
          appliedStyles.push('innerShadow')
        }
        
        if (addBlur) {
          effects.push({
            type: 'LAYER_BLUR',
            radius: blurRadius,
            visible: true
          })
          appliedStyles.push('blur')
        }
        
        node.effects = effects
      }

      results.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        appliedStyles: appliedStyles
      })

    } catch (error) {
      results.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        appliedStyles: [],
        error: error.message || 'Unknown error'
      })
    }
  }

  // Count successes
  const successCount = results.filter(r => !r.error).length
  const totalStyles = results.reduce((sum, r) => sum + r.appliedStyles.length, 0)

  return {
    success: true,
    results: results,
    targetCount: targetNodes.length,
    successCount: successCount,
    failureCount: targetNodes.length - successCount,
    totalStylesApplied: totalStyles
  }
}

// Apply text styles to selected text nodes or specific nodes by IDs
export async function applyTextStylesToSelection(params: CommandParams): Promise<CommandResult> {
  // Support both selection and nodeIds parameters
  let targetNodes: readonly SceneNode[] = []
  
  // Check if nodeIds are provided
  let nodeIds = params.nodeIds || params.Node_IDs || params.Node_Ids || params.nodeIdList || []
  
  // Handle comma-separated string
  if (typeof nodeIds === 'string') {
    nodeIds = nodeIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
  }
  
  // Ensure it's an array
  if (!Array.isArray(nodeIds)) {
    nodeIds = [nodeIds]
  }
  
  if (nodeIds && nodeIds.length > 0) {
    // Use specific nodes by IDs
    const nodes: SceneNode[] = []
    for (const nodeId of nodeIds) {
      try {
        const node = await getNodeByIdSafe(nodeId)
        if (node && 'x' in node) {
          nodes.push(node as SceneNode)
        }
      } catch (error) {
        console.warn(`Node not found: ${nodeId}`)
      }
    }
    targetNodes = nodes
  } else {
    // Use current selection
    targetNodes = figma.currentPage.selection
  }
  
  if (!targetNodes || targetNodes.length === 0) {
    throw new Error('No nodes found. Please select text nodes or provide valid node IDs.')
  }

  // Extract text style parameters
  const fontSize = params.fontSize !== undefined ? Number(params.fontSize) : params.Font_Size
  const fontFamily = params.fontFamily || params.Font_Family
  const fontWeight = params.fontWeight || params.Font_Weight
  const textColor = params.textColor || params.Text_Color || params.fontColor || params.Font_Color
  const textAlign = params.textAlign || params.Text_Align || params.textAlignHorizontal
  const letterSpacing = params.letterSpacing !== undefined ? Number(params.letterSpacing) : params.Letter_Spacing
  const lineHeight = params.lineHeight !== undefined ? Number(params.lineHeight) : params.Line_Height
  
  const results: Array<{ 
    nodeId: string, 
    name: string, 
    type: string, 
    appliedStyles: string[], 
    error?: string 
  }> = []

  // Process each target node
  for (const node of targetNodes) {
    const appliedStyles: string[] = []
    
    try {
      // Only process text nodes
      if (node.type !== 'TEXT') {
        results.push({
          nodeId: node.id,
          name: node.name,
          type: node.type,
          appliedStyles: [],
          error: 'Not a text node'
        })
        continue
      }

      const textNode = node as TextNode

      // Handle font loading
      if (fontFamily || fontWeight !== undefined) {
        const family = fontFamily || (textNode.fontName !== figma.mixed ? textNode.fontName.family : 'Inter')
        const style = fontWeight ? getFontStyle(fontWeight) : (textNode.fontName !== figma.mixed ? textNode.fontName.style : 'Regular')
        
        try {
          await figma.loadFontAsync({ family, style })
          textNode.fontName = { family, style }
          appliedStyles.push('font')
        } catch (fontError) {
          // Fallback to Inter if font loading fails
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
          textNode.fontName = { family: 'Inter', style: 'Regular' }
          appliedStyles.push('font (fallback)')
        }
      }

      // Apply font size
      if (fontSize !== undefined) {
        textNode.fontSize = fontSize
        appliedStyles.push('fontSize')
      }

      // Apply text color
      if (textColor) {
        const paint = createColorPaint(textColor)
        textNode.fills = [paint]
        appliedStyles.push('textColor')
      }

      // Apply text alignment
      if (textAlign) {
        textNode.textAlignHorizontal = textAlign as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
        appliedStyles.push('textAlign')
      }

      // Apply letter spacing
      if (letterSpacing !== undefined) {
        textNode.letterSpacing = { value: letterSpacing, unit: 'PIXELS' }
        appliedStyles.push('letterSpacing')
      }

      // Apply line height
      if (lineHeight !== undefined) {
        textNode.lineHeight = { value: lineHeight, unit: 'PIXELS' }
        appliedStyles.push('lineHeight')
      }

      results.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        appliedStyles: appliedStyles
      })

    } catch (error) {
      results.push({
        nodeId: node.id,
        name: node.name,
        type: node.type,
        appliedStyles: [],
        error: error.message || 'Unknown error'
      })
    }
  }

  // Count successes
  const successCount = results.filter(r => !r.error).length
  const textNodeCount = results.filter(r => r.type === 'TEXT').length
  const totalStyles = results.reduce((sum, r) => sum + r.appliedStyles.length, 0)

  return {
    success: true,
    results: results,
    targetCount: targetNodes.length,
    textNodeCount: textNodeCount,
    successCount: successCount,
    failureCount: targetNodes.length - successCount,
    totalStylesApplied: totalStyles
  }
}


// Helper function to map font weight to style
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