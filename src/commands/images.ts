// Image-related commands

import { CommandParams, CommandResult } from '../types'
import { generateNodeName, appendToParent, createNodeResult, getNodeByIdSafe } from '../utils/nodes'

// Custom base64 decoder for Figma plugin environment
function base64ToUint8Array(base64String: string): Uint8Array {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64 = base64String.replace(/^data:image\/[^;]+;base64,/, '')
  
  // Base64 character set
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  
  // Create lookup table
  const lookup: { [key: string]: number } = {}
  for (let i = 0; i < chars.length; i++) {
    lookup[chars[i]] = i
  }
  
  // Clean base64 string (remove whitespace and invalid characters)
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  const len = cleanBase64.length
  
  // Calculate buffer length
  let bufferLength = Math.floor(len * 0.75)
  
  // Handle padding
  let paddingCount = 0
  if (cleanBase64.endsWith('==')) {
    paddingCount = 2
  } else if (cleanBase64.endsWith('=')) {
    paddingCount = 1
  }
  bufferLength -= paddingCount
  
  const bytes = new Uint8Array(bufferLength)
  let byteIndex = 0
  
  for (let i = 0; i < len; i += 4) {
    // Get characters safely
    const char1 = cleanBase64[i] || 'A'
    const char2 = cleanBase64[i + 1] || 'A'
    const char3 = cleanBase64[i + 2] || '='
    const char4 = cleanBase64[i + 3] || '='
    
    // Get values from lookup table
    const encoded1 = lookup[char1] || 0
    const encoded2 = lookup[char2] || 0
    const encoded3 = char3 === '=' ? 0 : (lookup[char3] || 0)
    const encoded4 = char4 === '=' ? 0 : (lookup[char4] || 0)
    
    // Decode to bytes
    if (byteIndex < bufferLength) {
      bytes[byteIndex++] = (encoded1 << 2) | (encoded2 >> 4)
    }
    if (byteIndex < bufferLength && char3 !== '=') {
      bytes[byteIndex++] = ((encoded2 & 15) << 4) | (encoded3 >> 2)
    }
    if (byteIndex < bufferLength && char4 !== '=') {
      bytes[byteIndex++] = ((encoded3 & 3) << 6) | (encoded4 & 63)
    }
  }
  
  return bytes
}

// Create Image from URL
export async function createImageFromUrl(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  // Support multiple parameter name formats
  const base64Data = params.base64Data || params.Base64_Data || params.base64_data
  const mimeType = params.mimeType || params.Mime_Type || params.mime_type || 'image/png'
  const x = params.x || params.X || params.X_Position || params.x_position || 0
  const y = params.y || params.Y || params.Y_Position || params.y_position || 0
  const width = params.width || params.Width || params.WIDTH || 100
  const height = params.height || params.Height || params.HEIGHT || 100
  const name = generateNodeName('Image', params.name || params.Name || params.NAME)
  const parentId = params.parentIdForNode || params.parentId || params.Parent_Node_ID || params.parent_node_id || null
  const cornerRadius = params.cornerRadius || params.Corner_Radius || params.Image_Corner_Radius || params.image_corner_radius || 0
  const scaleMode = params.scaleMode || params.Scale_Mode || params.scale_mode || 'FILL'

  console.log('createImageFromUrl params received:', JSON.stringify(params, null, 2))
  console.log('Extracted values:', {
    base64Data: base64Data ? `${base64Data.substring(0, 50)}...` : null,
    mimeType, x, y, width, height, name, parentId, cornerRadius, scaleMode
  })

  if (!base64Data) {
    throw new Error('Base64 image data is required')
  }

  try {
    console.log('Step 1: Creating rectangle container')
    // Create rectangle as container
    const rect = figma.createRectangle()
    rect.x = x
    rect.y = y
    rect.resize(width, height)
    rect.name = name

    // Apply corner radius if specified
    if (cornerRadius > 0) {
      rect.cornerRadius = cornerRadius
    }

    console.log('Step 2: Converting base64 to bytes')
    console.log('Base64 data length:', base64Data.length)
    
    // Create image fill from base64 data using custom base64 decoder
    const imageBytes = base64ToUint8Array(base64Data)
    console.log('Converted bytes length:', imageBytes.length)
    
    console.log('Step 3: Creating Figma image from bytes')
    const image = figma.createImage(imageBytes)
    console.log('Image created with hash:', image.hash)
    
    const fill: ImagePaint = {
      type: 'IMAGE',
      scaleMode: scaleMode as 'FILL' | 'FIT' | 'CROP' | 'TILE',
      imageHash: image.hash
    }

    console.log('Step 4: Applying image fill to rectangle')
    rect.fills = [fill]

    console.log('Step 5: Adding to parent node')
    // Add to parent or current page
    const actualParentId = await appendToParent(rect, parentId)

    console.log('Step 6: Selecting and focusing')
    // Select the new image
    figma.currentPage.selection = [rect]
    figma.viewport.scrollAndZoomIntoView([rect])

    console.log('Step 7: Returning result')
    return {
      ...createNodeResult(rect, actualParentId),
      imageHash: image.hash,
      mimeType: mimeType,
      scaleMode: scaleMode
    }

  } catch (error) {
    console.error('Error creating image from URL:', error)
    console.error('Error stack:', error.stack)
    throw new Error(`Failed to create image from URL: ${error.message || error}`)
  }
}

// Replace Image
export async function replaceImage(params: CommandParams): Promise<CommandResult> {
  const nodeId = params.nodeId || params.Node_ID
  const base64Data = params.base64Data || params.Base64_Data || params.base64_data
  const mimeType = params.mimeType || params.Mime_Type || params.mime_type || 'image/png'
  const scaleMode = params.scaleMode || params.Scale_Mode || params.scale_mode || 'FILL'

  if (!nodeId) {
    throw new Error('Node ID is required')
  }

  if (!base64Data) {
    throw new Error('Base64 image data is required')
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

    // Create new image fill from base64 data using custom base64 decoder
    const imageBytes = base64ToUint8Array(base64Data)
    const image = figma.createImage(imageBytes)
    const fill: ImagePaint = {
      type: 'IMAGE',
      scaleMode: scaleMode as 'FILL' | 'FIT' | 'CROP' | 'TILE',
      imageHash: image.hash
    }

    fillableNode.fills = [fill]

    // Select the node
    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])

    return {
      success: true,
      nodeId: node.id,
      name: node.name,
      type: node.type,
      imageHash: image.hash,
      mimeType: mimeType,
      scaleMode: scaleMode
    }

  } catch (error) {
    console.error('Error replacing image:', error)
    throw new Error(`Failed to replace image: ${error.message || error}`)
  }
}