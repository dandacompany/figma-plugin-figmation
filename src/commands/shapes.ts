// Shape creation commands

import { CommandParams, CommandResult } from '../types'
import { hexToRgb, parseColor, createColorPaint } from '../utils/colors'
import { generateNodeName, appendToParent, applyDropShadow, createNodeResult } from '../utils/nodes'

// Create Ellipse
export async function createEllipse(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const name = generateNodeName('Ellipse', params.name)
  const initialOpacity = params.initialOpacity !== undefined ? Number(params.initialOpacity) : 1
  const initialRotation = params.initialRotation !== undefined ? Number(params.initialRotation) : 0
  const parentId = params.parentIdForNode || params.parentId || null

  // Arc data for partial ellipses (donut shape)
  const startingAngle = params.startingAngle !== undefined ? Number(params.startingAngle) : 0
  const endingAngle = params.endingAngle !== undefined ? Number(params.endingAngle) : 0
  const innerRadius = params.innerRadius !== undefined ? Number(params.innerRadius) : 0

  const ellipse = figma.createEllipse()
  ellipse.x = x
  ellipse.y = y
  ellipse.resize(width, height)
  ellipse.name = name
  ellipse.opacity = initialOpacity
  ellipse.rotation = initialRotation

  // Apply arc data if provided
  if (startingAngle !== 0 || endingAngle !== 0 || innerRadius !== 0) {
    ellipse.arcData = {
      startingAngle: startingAngle,
      endingAngle: endingAngle,
      innerRadius: innerRadius
    }
  }

  // Set fill color
  if (params.fillColor || params.Fill_Color_R !== undefined) {
    const fillColor = params.fillColor || {
      r: params.Fill_Color_R || 0,
      g: params.Fill_Color_G || 0,
      b: params.Fill_Color_B || 0,
      a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
    }
    ellipse.fills = [createColorPaint(fillColor)]
  }

  // Set stroke
  if (params.strokeColor || params.Stroke_Color_R !== undefined) {
    const strokeColor = params.strokeColor || {
      r: params.Stroke_Color_R || 0,
      g: params.Stroke_Color_G || 0,
      b: params.Stroke_Color_B || 0,
      a: params.Stroke_Color_A !== undefined ? params.Stroke_Color_A : 1,
    }
    ellipse.strokes = [createColorPaint(strokeColor)]
    ellipse.strokeWeight = params.strokeWeight !== undefined ? Number(params.strokeWeight) : 1
  }

  // Apply drop shadow if requested
  if (params.addDropShadow) {
    ellipse.effects = [applyDropShadow()]
  }

  // Add to parent or current page
  const actualParentId = await appendToParent(ellipse, parentId)

  // Select the new ellipse
  figma.currentPage.selection = [ellipse]
  figma.viewport.scrollAndZoomIntoView([ellipse])

  return createNodeResult(ellipse, actualParentId)
}

// Create Rectangle
export async function createRectangle(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const name = generateNodeName('Rectangle', params.name)
  const cornerRadius = params.cornerRadius !== undefined ? Number(params.cornerRadius) : 0
  const initialOpacity = params.initialOpacity !== undefined ? Number(params.initialOpacity) : 1
  const initialRotation = params.initialRotation !== undefined ? Number(params.initialRotation) : 0
  const parentId = params.parentIdForNode || params.parentId || null

  const rect = figma.createRectangle()
  rect.x = x
  rect.y = y
  rect.resize(width, height)
  rect.name = name
  rect.opacity = initialOpacity
  rect.rotation = initialRotation

  if (cornerRadius > 0) {
    rect.cornerRadius = cornerRadius
  }

  // Set fill color
  if (params.fillColor || params.Fill_Color_R !== undefined) {
    const fillColor = params.fillColor || {
      r: params.Fill_Color_R || 0,
      g: params.Fill_Color_G || 0,
      b: params.Fill_Color_B || 0,
      a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
    }
    rect.fills = [createColorPaint(fillColor)]
  }

  // Set stroke
  if (params.strokeColor || params.Stroke_Color_R !== undefined) {
    const strokeColor = params.strokeColor || {
      r: params.Stroke_Color_R || 0,
      g: params.Stroke_Color_G || 0,
      b: params.Stroke_Color_B || 0,
      a: params.Stroke_Color_A !== undefined ? params.Stroke_Color_A : 1,
    }
    rect.strokes = [createColorPaint(strokeColor)]
    rect.strokeWeight = params.strokeWeight || 1
  }

  // Apply drop shadow if requested
  applyDropShadow(rect, params)

  // Add to parent or current page
  const actualParentId = await appendToParent(rect, parentId)

  // Select the new rectangle
  figma.currentPage.selection = [rect]

  return createNodeResult(rect, actualParentId)
}

// Create Circle
export async function createCircle(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const radius = params.radius !== undefined ? Number(params.radius) : 50
  const name = generateNodeName('Circle', params.name)
  const initialOpacity = params.initialOpacity !== undefined ? Number(params.initialOpacity) : 1
  const initialRotation = params.initialRotation !== undefined ? Number(params.initialRotation) : 0
  const parentId = params.parentIdForNode || params.parentId || null

  const circle = figma.createEllipse()
  circle.x = x
  circle.y = y
  circle.resize(radius * 2, radius * 2)
  circle.name = name
  circle.opacity = initialOpacity
  circle.rotation = initialRotation

  // Set fill color
  if (params.fillColor || params.Fill_Color_R !== undefined) {
    const fillColor = params.fillColor || {
      r: params.Fill_Color_R || 0,
      g: params.Fill_Color_G || 0,
      b: params.Fill_Color_B || 0,
      a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
    }
    circle.fills = [createColorPaint(fillColor)]
  }

  // Set stroke
  if (params.strokeColor || params.Stroke_Color_R !== undefined) {
    const strokeColor = params.strokeColor || {
      r: params.Stroke_Color_R || 0,
      g: params.Stroke_Color_G || 0,
      b: params.Stroke_Color_B || 0,
      a: params.Stroke_Color_A !== undefined ? params.Stroke_Color_A : 1,
    }
    circle.strokes = [createColorPaint(strokeColor)]
    circle.strokeWeight = params.strokeWeight || 1
  }

  // Apply drop shadow if requested
  applyDropShadow(circle, params)

  // Add to parent or current page
  const actualParentId = await appendToParent(circle, parentId)

  // Select the new circle
  figma.currentPage.selection = [circle]

  return createNodeResult(circle, actualParentId)
}

// Create Line
export async function createLine(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x1 = params.x1 !== undefined ? Number(params.x1) : 0
  const y1 = params.y1 !== undefined ? Number(params.y1) : 0
  const x2 = params.x2 !== undefined ? Number(params.x2) : 100
  const y2 = params.y2 !== undefined ? Number(params.y2) : 100
  const name = generateNodeName('Line', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  // Calculate line dimensions and position
  const minX = Math.min(x1, x2)
  const minY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1) || 1
  const height = Math.abs(y2 - y1) || 1

  const line = figma.createLine()
  line.x = minX
  line.y = minY
  line.resize(width, height)
  line.name = name

  // Set stroke
  const strokeColor = params.strokeColor || {
    r: params.Stroke_Color_R || 0,
    g: params.Stroke_Color_G || 0,
    b: params.Stroke_Color_B || 0,
    a: params.Stroke_Color_A !== undefined ? params.Stroke_Color_A : 1,
  }
  line.strokes = [createColorPaint(strokeColor)]
  line.strokeWeight = params.strokeWeight || params.Stroke_Weight || 1

  // Apply drop shadow if requested
  applyDropShadow(line, params)

  // Add to parent or current page
  const actualParentId = await appendToParent(line, parentId)

  // Select the new line
  figma.currentPage.selection = [line]

  return createNodeResult(line, actualParentId)
}

// Create Star
export async function createStar(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const points = params.points !== undefined ? Number(params.points) : 5
  const innerRadiusRatio = params.innerRadiusRatio !== undefined ? Number(params.innerRadiusRatio) : 0.5
  const name = generateNodeName('Star', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  const star = figma.createStar()
  star.x = x
  star.y = y
  star.resize(width, height)
  star.name = name
  star.pointCount = points
  star.innerRadius = innerRadiusRatio

  // Set fill color
  if (params.fillColor || params.Fill_Color_R !== undefined) {
    const fillColor = params.fillColor || {
      r: params.Fill_Color_R || 0,
      g: params.Fill_Color_G || 0,
      b: params.Fill_Color_B || 0,
      a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
    }
    star.fills = [createColorPaint(fillColor)]
  }

  // Apply drop shadow if requested
  applyDropShadow(star, params)

  // Add to parent or current page
  const actualParentId = await appendToParent(star, parentId)

  // Select the new star
  figma.currentPage.selection = [star]

  return createNodeResult(star, actualParentId)
}

// Create Polygon
export async function createPolygon(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const width = params.width !== undefined ? Number(params.width) : 100
  const height = params.height !== undefined ? Number(params.height) : 100
  const sides = params.sides !== undefined ? Number(params.sides) : 6
  const name = generateNodeName('Polygon', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  const polygon = figma.createPolygon()
  polygon.x = x
  polygon.y = y
  polygon.resize(width, height)
  polygon.name = name
  polygon.pointCount = Math.max(3, sides)

  // Set fill color
  if (params.fillColor || params.Fill_Color_R !== undefined) {
    const fillColor = params.fillColor || {
      r: params.Fill_Color_R || 0,
      g: params.Fill_Color_G || 0,
      b: params.Fill_Color_B || 0,
      a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
    }
    polygon.fills = [createColorPaint(fillColor)]
  }

  // Apply drop shadow if requested
  applyDropShadow(polygon, params)

  // Add to parent or current page
  const actualParentId = await appendToParent(polygon, parentId)

  // Select the new polygon
  figma.currentPage.selection = [polygon]

  return createNodeResult(polygon, actualParentId)
}

// Create Vector Path
export async function createVectorPath(params: CommandParams): Promise<CommandResult> {
  if (figma.editorType !== 'figma') {
    throw new Error('Node creation is only available in Design mode')
  }

  const x = params.x !== undefined ? Number(params.x) : 0
  const y = params.y !== undefined ? Number(params.y) : 0
  const pathData = params.pathData || params.Path_Data || params.path
  const name = generateNodeName('Vector', params.name)
  const parentId = params.parentIdForNode || params.parentId || null

  if (!pathData) {
    throw new Error('Path data is required for vector path creation')
  }

  try {
    // Create vector node
    const vector = figma.createVector()
    vector.x = x
    vector.y = y
    vector.name = name

    // Set vector data
    vector.vectorPaths = [{
      windingRule: 'NONZERO',
      data: pathData
    }]

    // Set fill color
    if (params.fillColor || params.Fill_Color_R !== undefined) {
      const fillColor = params.fillColor || {
        r: params.Fill_Color_R || 0,
        g: params.Fill_Color_G || 0,
        b: params.Fill_Color_B || 0,
        a: params.Fill_Color_A !== undefined ? params.Fill_Color_A : 1,
      }
      vector.fills = [createColorPaint(fillColor)]
    }

    // Set stroke if provided
    if (params.strokeColor || params.Stroke_Color_R !== undefined) {
      const strokeColor = params.strokeColor || {
        r: params.Stroke_Color_R || 0,
        g: params.Stroke_Color_G || 0,
        b: params.Stroke_Color_B || 0,
        a: params.Stroke_Color_A !== undefined ? params.Stroke_Color_A : 1,
      }
      vector.strokes = [createColorPaint(strokeColor)]
      vector.strokeWeight = params.strokeWeight !== undefined ? Number(params.strokeWeight) : 1
    }

    // Apply drop shadow if requested
    applyDropShadow(vector, params)

    // Add to parent or current page
    const actualParentId = await appendToParent(vector, parentId)

    // Select the new vector
    figma.currentPage.selection = [vector]
    figma.viewport.scrollAndZoomIntoView([vector])

    return {
      ...createNodeResult(vector, actualParentId),
      pathData: pathData
    }

  } catch (error) {
    console.error('Error creating vector path:', error)
    throw new Error(`Failed to create vector path: ${error.message || error}`)
  }
}