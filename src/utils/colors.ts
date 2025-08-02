// Color utility functions

import { ColorRGB } from '../types'

// Helper function to convert hex to RGB with alpha
export function hexToRgb(hex: string): ColorRGB {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255
    return { r, g, b, a: 1 } // Always include alpha for effects
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255
    return { r, g, b, a: 1 } // Always include alpha for effects
  } else if (cleanHex.length === 8) {
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255
    const a = parseInt(cleanHex.substring(6, 8), 16) / 255
    return { r, g, b, a }
  }
  return { r: 0, g: 0, b: 0, a: 1 } // Default to black with full opacity
}

// Helper function to parse color (supports hex, rgb, rgba)
export function parseColor(color: string): ColorRGB {
  // Handle hex colors
  if (color.startsWith('#')) {
    return hexToRgb(color)
  }
  
  // Handle rgba colors
  if (color.startsWith('rgba(')) {
    const matches = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    if (matches) {
      return {
        r: parseInt(matches[1]) / 255,
        g: parseInt(matches[2]) / 255,
        b: parseInt(matches[3]) / 255,
        a: parseFloat(matches[4])
      }
    }
  }
  
  // Handle rgb colors
  if (color.startsWith('rgb(')) {
    const matches = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (matches) {
      return {
        r: parseInt(matches[1]) / 255,
        g: parseInt(matches[2]) / 255,
        b: parseInt(matches[3]) / 255,
        a: 1 // Include alpha for effects
      }
    }
  }
  
  // Handle named colors (basic set) - always include alpha for effects
  const namedColors: { [key: string]: ColorRGB } = {
    'white': { r: 1, g: 1, b: 1, a: 1 },
    'black': { r: 0, g: 0, b: 0, a: 1 },
    'red': { r: 1, g: 0, b: 0, a: 1 },
    'green': { r: 0, g: 1, b: 0, a: 1 },
    'blue': { r: 0, g: 0, b: 1, a: 1 },
    'yellow': { r: 1, g: 1, b: 0, a: 1 },
    'cyan': { r: 0, g: 1, b: 1, a: 1 },
    'magenta': { r: 1, g: 0, b: 1, a: 1 },
    'transparent': { r: 0, g: 0, b: 0, a: 0 }
  }
  
  if (namedColors[color.toLowerCase()]) {
    return namedColors[color.toLowerCase()]
  }
  
  // Default to black with full opacity
  return { r: 0, g: 0, b: 0, a: 1 }
}

// Create color paint
export function createColorPaint(colorInput: string | ColorRGB): SolidPaint {
  if (typeof colorInput === 'string') {
    const color = parseColor(colorInput)
    return {
      type: 'SOLID',
      color: { r: color.r, g: color.g, b: color.b },
      opacity: color.a !== undefined ? color.a : 1
    }
  }
  
  return {
    type: 'SOLID',
    color: {
      r: colorInput.r || 0,
      g: colorInput.g || 0,
      b: colorInput.b || 0
    },
    opacity: colorInput.a !== undefined ? colorInput.a : 1
  }
}