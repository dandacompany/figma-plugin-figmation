// Style-related commands

import { CommandParams, CommandResult } from '../types'
import { parseColor, createColorPaint, hexToRgb } from '../utils/colors'
import { getNodeByIdSafe } from '../utils/nodes'

// Set Fill Color
export async function setFillColor(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required for setFillColor')
  }

  // Support multiple color formats
  let color = params.color || params.Color
  
  // If color is provided as separate RGB values
  if (!color && (params.r !== undefined || params.R !== undefined)) {
    color = {
      r: params.r !== undefined ? params.r : params.R || 0,
      g: params.g !== undefined ? params.g : params.G || 0,
      b: params.b !== undefined ? params.b : params.B || 0,
      a: params.a !== undefined ? params.a : params.A !== undefined ? params.A : 1
    }
  }

  if (!color) {
    throw new Error('Color is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('fills' in node)) {
      throw new Error(`Node ${nodeId} does not support fills`)
    }

    const fillableNode = node as MinimalFillsMixin & SceneNode
    const paint = createColorPaint(color)
    fillableNode.fills = [paint]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      color: paint.color,
      opacity: paint.opacity
    }

  } catch (error) {
    console.error('Error setting fill color:', error)
    throw new Error(`Failed to set fill color: ${error.message || error}`)
  }
}

// Set Stroke Color
export async function setStrokeColor(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required for setStrokeColor')
  }

  // Support multiple color formats
  let color = params.color || params.Color
  const strokeWeight = params.strokeWeight || params.Stroke_Weight || 1
  
  // If color is provided as separate RGB values
  if (!color && (params.r !== undefined || params.R !== undefined)) {
    color = {
      r: params.r !== undefined ? params.r : params.R || 0,
      g: params.g !== undefined ? params.g : params.G || 0,
      b: params.b !== undefined ? params.b : params.B || 0,
      a: params.a !== undefined ? params.a : params.A !== undefined ? params.A : 1
    }
  }

  if (!color) {
    throw new Error('Color is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('strokes' in node)) {
      throw new Error(`Node ${nodeId} does not support strokes`)
    }

    const strokableNode = node as MinimalStrokesMixin & GeometryMixin & SceneNode
    const paint = createColorPaint(color)
    strokableNode.strokes = [paint]
    strokableNode.strokeWeight = Number(strokeWeight)

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      color: paint.color,
      opacity: paint.opacity,
      strokeWeight: strokableNode.strokeWeight
    }

  } catch (error) {
    console.error('Error setting stroke color:', error)
    throw new Error(`Failed to set stroke color: ${error.message || error}`)
  }
}

// Set Opacity
export async function setOpacity(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const opacity = params.opacity !== undefined ? params.opacity : params.Opacity
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (opacity === undefined) {
    throw new Error('Opacity value is required')
  }

  const opacityValue = Number(opacity)
  if (isNaN(opacityValue) || opacityValue < 0 || opacityValue > 1) {
    throw new Error('Opacity must be a number between 0 and 1')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('opacity' in node)) {
      throw new Error(`Node ${nodeId} does not support opacity`)
    }

    const blendNode = node as BlendMixin & SceneNode
    blendNode.opacity = opacityValue

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      opacity: blendNode.opacity
    }

  } catch (error) {
    console.error('Error setting opacity:', error)
    throw new Error(`Failed to set opacity: ${error.message || error}`)
  }
}

// Apply Effect
export async function applyEffect(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const effectType = params.effectType || params.Effect_Type
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (!effectType) {
    throw new Error('Effect type is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('effects' in node)) {
      throw new Error(`Node ${nodeId} does not support effects`)
    }

    const effectNode = node as EffectsMixin & SceneNode
    let effect: Effect

    switch (effectType.toUpperCase()) {
      case 'DROP_SHADOW':
        effect = {
          type: 'DROP_SHADOW',
          color: params.color ? parseColor(params.color as string) : { r: 0, g: 0, b: 0, a: 0.25 },
          offset: {
            x: params.offsetX || 0,
            y: params.offsetY || 4
          },
          radius: params.radius || 4,
          spread: params.spread || 0,
          visible: true,
          blendMode: 'NORMAL'
        }
        break

      case 'INNER_SHADOW':
        effect = {
          type: 'INNER_SHADOW',
          color: params.color ? parseColor(params.color as string) : { r: 0, g: 0, b: 0, a: 0.25 },
          offset: {
            x: params.offsetX || 0,
            y: params.offsetY || 4
          },
          radius: params.radius || 4,
          spread: params.spread || 0,
          visible: true,
          blendMode: 'NORMAL'
        }
        break

      case 'LAYER_BLUR':
        effect = {
          type: 'LAYER_BLUR',
          radius: params.radius || 4,
          visible: true
        }
        break

      case 'BACKGROUND_BLUR':
        effect = {
          type: 'BACKGROUND_BLUR',
          radius: params.radius || 4,
          visible: true
        }
        break

      default:
        throw new Error(`Unsupported effect type: ${effectType}`)
    }

    // Add the effect to existing effects
    effectNode.effects = [...effectNode.effects, effect]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      effectType: effectType,
      effectsCount: effectNode.effects.length
    }

  } catch (error) {
    console.error('Error applying effect:', error)
    throw new Error(`Failed to apply effect: ${error.message || error}`)
  }
}

// Set Corner Radius
export async function setCornerRadius(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const radius = params.radius !== undefined ? params.radius : params.Radius
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (radius === undefined) {
    throw new Error('Radius value is required')
  }

  const radiusValue = Number(radius)
  if (isNaN(radiusValue) || radiusValue < 0) {
    throw new Error('Radius must be a non-negative number')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('cornerRadius' in node)) {
      throw new Error(`Node ${nodeId} does not support corner radius`)
    }

    const cornerNode = node as CornerMixin & SceneNode
    cornerNode.cornerRadius = radiusValue

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      cornerRadius: cornerNode.cornerRadius
    }

  } catch (error) {
    console.error('Error setting corner radius:', error)
    throw new Error(`Failed to set corner radius: ${error.message || error}`)
  }
}

// Add Drop Shadow
export async function addDropShadow(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  // Shadow parameters with defaults
  const color = params.color || params.Color || { r: 0, g: 0, b: 0, a: 0.25 }
  const offsetX = params.offsetX !== undefined ? Number(params.offsetX) : params.Offset_X !== undefined ? Number(params.Offset_X) : 0
  const offsetY = params.offsetY !== undefined ? Number(params.offsetY) : params.Offset_Y !== undefined ? Number(params.Offset_Y) : 4
  const radius = params.radius !== undefined ? Number(params.radius) : params.Radius !== undefined ? Number(params.Radius) : 4
  const spread = params.spread !== undefined ? Number(params.spread) : params.Spread !== undefined ? Number(params.Spread) : 0

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('effects' in node)) {
      throw new Error(`Node ${nodeId} does not support effects`)
    }

    const effectNode = node as BlendMixin & SceneNode
    
    // Create drop shadow effect
    const dropShadow: Effect = {
      type: 'DROP_SHADOW',
      color: typeof color === 'string' ? parseColor(color) : color,
      offset: { x: offsetX, y: offsetY },
      radius: radius,
      spread: spread,
      visible: true,
      blendMode: 'NORMAL'
    }

    // Add to existing effects or create new array
    const currentEffects = effectNode.effects || []
    effectNode.effects = [...currentEffects, dropShadow]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      effectsCount: effectNode.effects.length,
      dropShadow: {
        color: dropShadow.color,
        offset: dropShadow.offset,
        radius: dropShadow.radius,
        spread: dropShadow.spread
      }
    }

  } catch (error) {
    console.error('Error adding drop shadow:', error)
    throw new Error(`Failed to add drop shadow: ${error.message || error}`)
  }
}

// Add Inner Shadow
export async function addInnerShadow(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  // Shadow parameters with defaults
  const color = params.color || params.Color || { r: 0, g: 0, b: 0, a: 0.25 }
  const offsetX = params.offsetX !== undefined ? Number(params.offsetX) : params.Offset_X !== undefined ? Number(params.Offset_X) : 0
  const offsetY = params.offsetY !== undefined ? Number(params.offsetY) : params.Offset_Y !== undefined ? Number(params.Offset_Y) : 4
  const radius = params.radius !== undefined ? Number(params.radius) : params.Radius !== undefined ? Number(params.Radius) : 4
  const spread = params.spread !== undefined ? Number(params.spread) : params.Spread !== undefined ? Number(params.Spread) : 0

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('effects' in node)) {
      throw new Error(`Node ${nodeId} does not support effects`)
    }

    const effectNode = node as BlendMixin & SceneNode
    
    // Create inner shadow effect
    const innerShadow: Effect = {
      type: 'INNER_SHADOW',
      color: typeof color === 'string' ? parseColor(color) : color,
      offset: { x: offsetX, y: offsetY },
      radius: radius,
      spread: spread,
      visible: true,
      blendMode: 'NORMAL'
    }

    // Add to existing effects or create new array
    const currentEffects = effectNode.effects || []
    effectNode.effects = [...currentEffects, innerShadow]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      effectsCount: effectNode.effects.length,
      innerShadow: {
        color: innerShadow.color,
        offset: innerShadow.offset,
        radius: innerShadow.radius,
        spread: innerShadow.spread
      }
    }

  } catch (error) {
    console.error('Error adding inner shadow:', error)
    throw new Error(`Failed to add inner shadow: ${error.message || error}`)
  }
}

// Add Blur
export async function addBlur(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const blurType = params.blurType || params.Blur_Type || 'LAYER_BLUR'
  const radius = params.radius !== undefined ? Number(params.radius) : params.Radius !== undefined ? Number(params.Radius) : 4
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (!['LAYER_BLUR', 'BACKGROUND_BLUR'].includes(blurType)) {
    throw new Error('Blur type must be LAYER_BLUR or BACKGROUND_BLUR')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('effects' in node)) {
      throw new Error(`Node ${nodeId} does not support effects`)
    }

    const effectNode = node as BlendMixin & SceneNode
    
    // Create blur effect
    const blur: Effect = {
      type: blurType as 'LAYER_BLUR' | 'BACKGROUND_BLUR',
      radius: radius,
      visible: true
    }

    // Add to existing effects or create new array
    const currentEffects = effectNode.effects || []
    effectNode.effects = [...currentEffects, blur]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      effectsCount: effectNode.effects.length,
      blur: {
        type: blur.type,
        radius: blur.radius
      }
    }

  } catch (error) {
    console.error('Error adding blur:', error)
    throw new Error(`Failed to add blur: ${error.message || error}`)
  }
}

// Set Individual Corner Radius
export async function setIndividualCornerRadius(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const topLeft = params.topLeft !== undefined ? Number(params.topLeft) : params.Top_Left_Radius
  const topRight = params.topRight !== undefined ? Number(params.topRight) : params.Top_Right_Radius
  const bottomLeft = params.bottomLeft !== undefined ? Number(params.bottomLeft) : params.Bottom_Left_Radius
  const bottomRight = params.bottomRight !== undefined ? Number(params.bottomRight) : params.Bottom_Right_Radius
  
  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  try {
    const node = await getNodeByIdSafe(nodeId)
    
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`)
    }

    if (!('topLeftRadius' in node)) {
      throw new Error(`Node ${nodeId} does not support individual corner radius`)
    }

    const cornerNode = node as RectangleNode | FrameNode | ComponentNode | InstanceNode

    // Set individual corner radii
    if (topLeft !== undefined) cornerNode.topLeftRadius = Number(topLeft)
    if (topRight !== undefined) cornerNode.topRightRadius = Number(topRight)
    if (bottomLeft !== undefined) cornerNode.bottomLeftRadius = Number(bottomLeft)
    if (bottomRight !== undefined) cornerNode.bottomRightRadius = Number(bottomRight)

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      cornerRadius: {
        topLeft: cornerNode.topLeftRadius,
        topRight: cornerNode.topRightRadius,
        bottomLeft: cornerNode.bottomLeftRadius,
        bottomRight: cornerNode.bottomRightRadius
      }
    }

  } catch (error) {
    console.error('Error setting individual corner radius:', error)
    throw new Error(`Failed to set individual corner radius: ${error.message || error}`)
  }
}