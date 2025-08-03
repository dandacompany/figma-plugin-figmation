// SVG-related commands

import { CommandParams, CommandResult } from '../types'
import { parseColor, hexToRgb } from '../utils/colors'
import { generateNodeName, appendToParent, createNodeResult } from '../utils/nodes'

// Create Design from SVG
export async function createDesignFromSvg(params: CommandParams): Promise<CommandResult> {
  // Support multiple parameter name formats (lowercase, camelCase, and capitalized)
  const svgContent = params?.svgContent || params?.SVG_Content || params?.svg_content
  const x = params?.x || params?.X || 0
  const y = params?.y || params?.Y || 0
  const name = params?.name || params?.Name || 'Design'
  const parentId = params?.parentId || params?.Parent_Node_ID || params?.parentIdForNode

  // Check Design mode
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  if (!svgContent) {
    throw new Error('SVG content is required')
  }

  // Extract viewBox dimensions from SVG
  function extractViewBoxDimensions(svgContent: string): { width: number, height: number } {
    // Default fallback size
    let width = 100
    let height = 100

    try {
      // First try to extract viewBox attribute
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/i)
      if (viewBoxMatch) {
        const viewBoxValues = viewBoxMatch[1].split(/\s+/)
        if (viewBoxValues.length >= 4) {
          // viewBox format: "minX minY width height"
          width = parseFloat(viewBoxValues[2])
          height = parseFloat(viewBoxValues[3])
          console.log(`Extracted dimensions from viewBox: ${width}x${height}`)
          return { width, height }
        }
      }

      // If no viewBox, try to extract width and height attributes from SVG element
      const widthMatch = svgContent.match(/<svg[^>]+width="([^"]+)"/i)
      const heightMatch = svgContent.match(/<svg[^>]+height="([^"]+)"/i)
      
      if (widthMatch && heightMatch) {
        const svgWidth = widthMatch[1]
        const svgHeight = heightMatch[1]
        
        // Parse numeric values (remove units like px, pt, etc.)
        const numericWidth = parseFloat(svgWidth.replace(/[^\d.]/g, ''))
        const numericHeight = parseFloat(svgHeight.replace(/[^\d.]/g, ''))
        
        if (!isNaN(numericWidth) && !isNaN(numericHeight)) {
          width = numericWidth
          height = numericHeight
          console.log(`Extracted dimensions from width/height attributes: ${width}x${height}`)
          return { width, height }
        }
      }

      console.log(`No valid dimensions found in SVG, using default: ${width}x${height}`)
    } catch (error) {
      console.warn('Error extracting SVG dimensions:', error)
    }

    return { width, height }
  }

  // Get dimensions from SVG content
  const { width, height } = extractViewBoxDimensions(svgContent)

  // Debug parameter extraction
  console.log('createDesignFromSvg params received:', JSON.stringify(params, null, 2))
  console.log('Extracted values:', {
    svgContent: svgContent ? `${svgContent.substring(0, 100)}...` : null,
    x, y, width, height, name, parentId
  })

  try {
    console.log('Creating design from SVG with params:', { svgContent: svgContent?.substring(0, 100), width, height })
    
    // Try using figma.createNodeFromSvg first
    console.log('Using figma.createNodeFromSvg with SVG content')
    try {
      const svgNode = figma.createNodeFromSvg(svgContent)
      
      if (svgNode) {
        // Set position and name
        svgNode.x = x
        svgNode.y = y
        svgNode.name = name
        
        // Resize if needed
        if (width && height && svgNode.width && svgNode.height) {
          const scaleX = width / svgNode.width
          const scaleY = height / svgNode.height
          const scale = Math.min(scaleX, scaleY) // Maintain aspect ratio
          
          svgNode.resize(svgNode.width * scale, svgNode.height * scale)
        }

        // Add to parent or current page
        const actualParentId = await appendToParent(svgNode, parentId)

        // Select the created vector
        figma.currentPage.selection = [svgNode]
        figma.viewport.scrollAndZoomIntoView([svgNode])

        console.log('Successfully created SVG using figma.createNodeFromSvg')
        return {
          ...createNodeResult(svgNode, actualParentId),
          success: true
        }
      }
    } catch (svgApiError) {
      console.log('figma.createNodeFromSvg failed, falling back to manual parsing:', svgApiError.message)
      // Continue with manual parsing below
    }
    
    // Create icon frame for manual parsing (fallback)
    const iconFrame = figma.createFrame()
    iconFrame.name = name
    iconFrame.x = x
    iconFrame.y = y
    iconFrame.resize(width, height)
    iconFrame.fills = [] // Transparent background
    iconFrame.clipsContent = false

    // Parse SVG content for geometric elements
    console.log('Parsing SVG content for geometric elements')
    
    // Helper function to process SVG elements recursively
    async function processSvgElement(svgContent: string, parentFrame: FrameNode, groupTransform = null) {
      // Extract circles from SVG
      const circleMatches = svgContent.match(/<circle[^>]+>/g)
      if (circleMatches) {
        console.log('Found circles:', circleMatches.length)
        circleMatches.forEach((circleMatch, index) => {
          const cxMatch = circleMatch.match(/cx="([^"]+)"/)
          const cyMatch = circleMatch.match(/cy="([^"]+)"/)
          const rMatch = circleMatch.match(/r="([^"]+)"/)
          const fillMatch = circleMatch.match(/fill="([^"]+)"/)
          
          if (cxMatch && cyMatch && rMatch) {
            const cx = parseFloat(cxMatch[1])
            const cy = parseFloat(cyMatch[1])
            const r = parseFloat(rMatch[1])
            const fill = fillMatch ? fillMatch[1] : '#000000'
            
            // Create ellipse for each circle
            const ellipse = figma.createEllipse()
            ellipse.name = `Circle ${index + 1}`
            ellipse.resize(r * 2, r * 2)
            ellipse.x = cx - r
            ellipse.y = cy - r
            
            // Set fill color
            if (fill !== 'none') {
              const color = hexToRgb(fill)
              ellipse.fills = [{
                type: 'SOLID',
                color: color
              }]
            }
            
            parentFrame.appendChild(ellipse)
            console.log(`Created circle at (${cx}, ${cy}) with radius ${r}`)
          }
        })
      }
    
      // Extract rectangles from SVG
      const rectMatches = svgContent.match(/<rect[^>]+>/g)
      if (rectMatches) {
        console.log('Found rectangles:', rectMatches.length)
        rectMatches.forEach((rectMatch, index) => {
          const xMatch = rectMatch.match(/x="([^"]+)"/)
          const yMatch = rectMatch.match(/y="([^"]+)"/)
          const widthMatch = rectMatch.match(/width="([^"]+)"/)
          const heightMatch = rectMatch.match(/height="([^"]+)"/)
          const fillMatch = rectMatch.match(/fill="([^"]+)"/)
          const rxMatch = rectMatch.match(/rx="([^"]+)"/)
          const strokeMatch = rectMatch.match(/stroke="([^"]+)"/)
          const strokeWidthMatch = rectMatch.match(/stroke-width="([^"]+)"/)
          
          if (widthMatch && heightMatch) {
            const rectX = xMatch ? parseFloat(xMatch[1]) : 0
            const rectY = yMatch ? parseFloat(yMatch[1]) : 0
            const rectWidth = parseFloat(widthMatch[1])
            const rectHeight = parseFloat(heightMatch[1])
            const fill = fillMatch ? fillMatch[1] : '#000000'
            const rx = rxMatch ? parseFloat(rxMatch[1]) : 0
            
            // Create rectangle
            const rect = figma.createRectangle()
            rect.name = `Rectangle ${index + 1}`
            rect.x = rectX
            rect.y = rectY
            rect.resize(rectWidth, rectHeight)
            
            if (rx > 0) {
              rect.cornerRadius = rx
            }
            
            // Set fill
            if (fill !== 'none' && !fill.includes('url(')) {
              const color = parseColor(fill)
              rect.fills = [{
                type: 'SOLID',
                color: color
              }]
            } else {
              rect.fills = []
            }
            
            // Set stroke if present
            if (strokeMatch && strokeMatch[1] !== 'none') {
              const strokeColor = parseColor(strokeMatch[1])
              const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 1
              rect.strokes = [{
                type: 'SOLID',
                color: strokeColor
              }]
              rect.strokeWeight = strokeWidth
            }
            
            parentFrame.appendChild(rect)
            console.log(`Created rectangle at (${rectX}, ${rectY}) with size ${rectWidth}x${rectHeight}`)
          }
        })
      }
    
      // Extract ellipses from SVG
      const ellipseMatches = svgContent.match(/<ellipse[^>]+>/g)
      if (ellipseMatches) {
        console.log('Found ellipses:', ellipseMatches.length)
        ellipseMatches.forEach((ellipseMatch, index) => {
          const cxMatch = ellipseMatch.match(/cx="([^"]+)"/)
          const cyMatch = ellipseMatch.match(/cy="([^"]+)"/)
          const rxMatch = ellipseMatch.match(/rx="([^"]+)"/)
          const ryMatch = ellipseMatch.match(/ry="([^"]+)"/)
          const fillMatch = ellipseMatch.match(/fill="([^"]+)"/)
          
          if (cxMatch && cyMatch && rxMatch && ryMatch) {
            const cx = parseFloat(cxMatch[1])
            const cy = parseFloat(cyMatch[1])
            const rx = parseFloat(rxMatch[1])
            const ry = parseFloat(ryMatch[1])
            const fill = fillMatch ? fillMatch[1] : '#000000'
            
            // Create ellipse
            const ellipse = figma.createEllipse()
            ellipse.name = `Ellipse ${index + 1}`
            ellipse.resize(rx * 2, ry * 2)
            ellipse.x = cx - rx
            ellipse.y = cy - ry
            
            // Set fill color
            if (fill !== 'none' && !fill.includes('url(')) {
              const color = parseColor(fill)
              ellipse.fills = [{
                type: 'SOLID',
                color: color
              }]
            }
            
            parentFrame.appendChild(ellipse)
            console.log(`Created ellipse at (${cx}, ${cy}) with radii ${rx}x${ry}`)
          }
        })
      }
    
      // Extract text elements from SVG
      const textMatches = svgContent.match(/<text[^>]*>([^<]*)<\/text>/g)
      if (textMatches) {
        console.log('Found text elements:', textMatches.length)
        for (let index = 0; index < textMatches.length; index++) {
          const textMatch = textMatches[index]
          const xMatch = textMatch.match(/x="([^"]+)"/)
          const yMatch = textMatch.match(/y="([^"]+)"/)
          const fontSizeMatch = textMatch.match(/font-size="([^"]+)"/)
          const fontFamilyMatch = textMatch.match(/font-family="([^"]+)"/)
          const fontWeightMatch = textMatch.match(/font-weight="([^"]+)"/)
          const fillMatch = textMatch.match(/fill="([^"]+)"/)
          const textAnchorMatch = textMatch.match(/text-anchor="([^"]+)"/)
          const contentMatch = textMatch.match(/>([^<]+)</)
          
          if (xMatch && yMatch && contentMatch) {
            const textX = parseFloat(xMatch[1])
            const textY = parseFloat(yMatch[1])
            const content = contentMatch[1].trim()
            const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16
            const fontFamily = fontFamilyMatch ? fontFamilyMatch[1].split(',')[0].replace(/['"]/g, '') : 'Inter'
            const fontWeight = fontWeightMatch ? parseInt(fontWeightMatch[1]) : 400
            const fill = fillMatch ? fillMatch[1] : '#000000'
            const textAnchor = textAnchorMatch ? textAnchorMatch[1] : 'start'
            
            try {
              // Create text node
              const textNode = figma.createText()
              textNode.name = `Text ${index + 1}`
              
              // Map font weight to style
              let fontStyle = 'Regular'
              if (fontWeight >= 700) fontStyle = 'Bold'
              else if (fontWeight >= 600) fontStyle = 'Semi Bold'
              else if (fontWeight >= 500) fontStyle = 'Medium'
              
              // Load font
              await figma.loadFontAsync({ family: 'Inter', style: fontStyle })
              textNode.fontName = { family: 'Inter', style: fontStyle }
              textNode.fontSize = fontSize
              textNode.characters = content
              
              // Set fill color
              if (fill !== 'none' && !fill.includes('url(')) {
                const color = parseColor(fill)
                textNode.fills = [{
                  type: 'SOLID',
                  color: color
                }]
              }
              
              // Position text based on anchor
              if (textAnchor === 'middle') {
                textNode.x = textX - (textNode.width / 2)
              } else if (textAnchor === 'end') {
                textNode.x = textX - textNode.width
              } else {
                textNode.x = textX
              }
              textNode.y = textY - fontSize
              
              parentFrame.appendChild(textNode)
              console.log(`Created text "${content}" at (${textX}, ${textY}) with size ${fontSize}`)
            } catch (textError) {
              console.warn(`Failed to create text ${index + 1}:`, textError.message)
            }
          }
        }
      }
    
      // Extract paths from SVG
      const pathMatches = svgContent.match(/<path[^>]+d="([^"]+)"[^>]*>/g)
      if (pathMatches) {
        console.log('Found paths:', pathMatches.length)
        pathMatches.forEach((pathMatch, index) => {
          const pathDataMatch = pathMatch.match(/d="([^"]+)"/)
          const fillMatch = pathMatch.match(/fill="([^"]+)"/)
          const strokeMatch = pathMatch.match(/stroke="([^"]+)"/)
          const strokeWidthMatch = pathMatch.match(/stroke-width="([^"]+)"/)
          
          if (pathDataMatch) {
            const pathData = pathDataMatch[1]
            const fill = fillMatch ? fillMatch[1] : '#000000'
            
            try {
              const pathVector = figma.createVector()
              pathVector.name = `Path ${index + 1}`
              pathVector.vectorPaths = [{
                windingRule: 'NONZERO',
                data: pathData
              }]
              
              // Set fill color
              if (fill !== 'none' && !fill.includes('url(')) {
                const color = parseColor(fill)
                pathVector.fills = [{
                  type: 'SOLID',
                  color: color
                }]
              }
              
              // Set stroke if present
              if (strokeMatch && strokeMatch[1] !== 'none') {
                const strokeColor = parseColor(strokeMatch[1])
                const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 1
                pathVector.strokes = [{
                  type: 'SOLID',
                  color: strokeColor
                }]
                pathVector.strokeWeight = strokeWidth
              }
              
              parentFrame.appendChild(pathVector)
              console.log(`Created path vector: ${pathData.substring(0, 50)}...`)
            } catch (pathError) {
              console.warn(`Failed to create path ${index + 1}:`, pathError.message)
            }
          }
        })
      }
      
      // Process group elements
      const groupMatches = svgContent.match(/<g[^>]*>([\s\S]*?)<\/g>/g)
      if (groupMatches) {
        console.log('Found groups:', groupMatches.length)
        for (const groupMatch of groupMatches) {
          // Extract group content
          const groupContentMatch = groupMatch.match(/<g[^>]*>([\s\S]*?)<\/g>/)
          if (groupContentMatch) {
            const groupContent = groupContentMatch[1]
            // Create a frame for the group
            const groupFrame = figma.createFrame()
            groupFrame.name = 'Group'
            groupFrame.fills = []
            groupFrame.clipsContent = false
            parentFrame.appendChild(groupFrame)
            
            // Recursively process group content
            await processSvgElement(groupContent, groupFrame)
          }
        }
      }
    }
    
    // Call the helper function to process SVG
    await processSvgElement(svgContent, iconFrame)
    
    // If we successfully created elements
    if (iconFrame.children.length > 0) {
      console.log(`Successfully created ${iconFrame.children.length} SVG elements`)
    } else {
      throw new Error('Could not extract any valid elements from SVG content. No circles or paths found.')
    }

    // Add to parent or current page
    const actualParentId = await appendToParent(iconFrame, parentId)

    // Select the created icon
    figma.currentPage.selection = [iconFrame]
    figma.viewport.scrollAndZoomIntoView([iconFrame])

    return {
      ...createNodeResult(iconFrame, actualParentId),
      svgContent: svgContent || null,
      components: {
        container: iconFrame.id,
        elementsCreated: iconFrame.children.length
      }
    }

  } catch (error) {
    console.error('Error creating design from SVG:', error)
    throw new Error(`Failed to create design from SVG: ${error.message || error}`)
  }
}

