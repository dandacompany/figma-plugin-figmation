// Figma plugin that communicates with WebSocket server
// Refactored version using modular architecture

import { CommandParams, CommandResult } from './types'
import { createWebSocketClient } from './utils/websocket'
import * as commands from './commands'

const state = {
	serverPort: 3055, // Default port
	channelId: 'hellofigma', // Default channel ID
	isConnected: false
}

export default function () {
	figma.showUI(__html__, { width: 300, height: 380, themeColors: true })

	// Load settings when plugin starts
	initializePlugin()

	// Handle messages from UI - Improved error handling and user feedback
	figma.ui.onmessage = async (msg) => {
		// Message validation
		if (!msg || typeof msg.type !== 'string') {
			figma.notify('Invalid message received from UI', { error: true })
			return
		}

		switch (msg.type) {
			case 'execute-command':
				executeUICommand(msg)
				break
			case 'update-settings':
				updateSettings(msg)
				break
			case 'notify':
				// Improved notification system
				if (msg.message) {
					const options = {
						timeout: msg.timeout || 3000,
						error: msg.error || false
					}
					figma.notify(msg.message, options)
				} else {
					figma.notify('Empty notification message received', { error: true })
				}
				break
			case 'copy-to-clipboard':
				// Handle clipboard copy request
				try {
					if (msg.text) {
						// Send back to UI to handle copy
						figma.ui.postMessage({
							type: 'execute-copy',
							text: msg.text
						})
						
						// Show notification
						figma.notify(`Copied: ${msg.text}`, { timeout: 2000 })
					}
				} catch (error) {
					console.error('❌ Failed to copy to clipboard:', error)
					figma.notify('Failed to copy to clipboard', { error: true })
				}
				break
			case 'close-plugin':
				// Cleanup work before plugin termination
				try {
					// Save last session state
					await figma.clientStorage.setAsync('lastSession', {
						timestamp: new Date().toISOString(),
						selectionCount: figma.currentPage.selection.length
					})
					figma.closePlugin('👋 Figmation session ended. Thanks for using Figmation!')
				} catch (error) {
					console.warn('Error during plugin cleanup:', error)
					figma.closePlugin()
				}
				break
			default:
				console.warn('Unknown message type received from UI:', msg.type)
				break
		}
	}
}

// Initialize plugin state and settings
async function initializePlugin() {
	try {
		// Load saved server settings
		const savedSettings = await figma.clientStorage.getAsync('serverSettings')
		if (savedSettings) {
			state.serverPort = savedSettings.serverPort || 3055
			state.channelId = savedSettings.channelId || 'hellofigma'
			console.log('✅ Loaded saved settings:', savedSettings)
			
			// Notify UI of loaded settings
			figma.ui.postMessage({
				type: 'settings-loaded',
				settings: { 
					serverPort: state.serverPort, 
					channelId: state.channelId 
				}
			})
		}

		// Initialize WebSocket client
		const wsClient = createWebSocketClient(state.serverPort, state.channelId)
		
		// Set up message handler
		wsClient.setMessageHandler(handleWebSocketMessage)
		
		// Start connection
		wsClient.connect()

		// Send initial UI state - Selection info
		updateSelectionInfo()

		// Listen to selection changes
		figma.on('selectionchange', updateSelectionInfo)

	} catch (error) {
		console.error('❌ Plugin initialization failed:', error)
		figma.notify('Plugin initialization failed. Check console for details.', { error: true })
	}
}

// Handle WebSocket messages with command routing
async function handleWebSocketMessage(message: any) {
	try {
		console.log('📨 Received WebSocket message:', message)

		if (!message.command) {
			throw new Error('No command specified in message')
		}

		const result = await executeCommand(message.command, message.parameters || {})
		
		// Send success response
		const response = {
			command: message.command,
			serverId: message.serverId,
			result: result,
			timestamp: new Date().toISOString(),
			success: true
		}

		// Send response via WebSocket
		figma.ui.postMessage({
			type: 'websocket-send',
			data: response
		})

		console.log('✅ Command executed successfully:', message.command)

	} catch (error) {
		console.error('❌ Command execution error:', error)
		
		// Send error response
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
		const errorResponse = {
			command: message.command,
			serverId: message.serverId,
			error: errorMessage,
			timestamp: new Date().toISOString(),
			success: false
		}

		// Send error response via WebSocket
		figma.ui.postMessage({
			type: 'websocket-send',
			data: errorResponse
		})

		// Notify user
		figma.notify(`Command failed: ${errorMessage}`, { error: true })
	}
}

// Execute command from UI - handles commands received from the UI
async function executeUICommand(msg: any) {
	try {
		console.log('🔧 Executing UI command:', msg.command, msg.params)
		
		const result = await executeCommand(msg.command, msg.params || {})
		
		// Send success response back to UI
		figma.ui.postMessage({
			type: 'command-result',
			id: msg.id,
			result: result
		})
		
		console.log('✅ UI command executed successfully:', msg.command)
		
	} catch (error) {
		console.error('❌ UI command execution error:', error)
		
		// Send error response back to UI
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
		figma.ui.postMessage({
			type: 'command-error',
			id: msg.id,
			error: errorMessage
		})
	}
}

// Command execution router - maps commands to functions
async function executeCommand(command: string, params: CommandParams): Promise<CommandResult> {
	// Map command strings to functions
	const commandMap: Record<string, (params: CommandParams) => Promise<CommandResult>> = {
		// Shape commands
		'create_rectangle': commands.createRectangle,
		'create_ellipse': commands.createEllipse,
		'create_circle': commands.createCircle,
		'create_line': commands.createLine,
		'create_star': commands.createStar,
		'create_polygon': commands.createPolygon,
		'create_vector_path': commands.createVectorPath,

		// Text commands
		'create_text': commands.createText,
		'update_text': commands.updateText,
		'set_text_content': commands.updateTextContent, // Fixed mapping - now correctly points to updateTextContent
		'set_font': commands.setFont,
		'scan_text_nodes': commands.scanTextNodes,
		'set_multiple_text_contents': commands.setMultipleTextContents,
		'search_available_fonts': commands.searchAvailableFonts,

		// Style commands
		'set_fill_color': commands.setFillColor,
		'set_stroke_color': commands.setStrokeColor,
		'set_opacity': commands.setOpacity,
		'apply_effect': commands.applyEffect, // Unified effect command (replaces add_drop_shadow, add_inner_shadow, add_blur)
		'set_corner_radius': commands.setCornerRadius,
		'set_individual_corner_radius': commands.setIndividualCornerRadius,

		// Layout commands
		'create_frame': commands.createFrame,
		'create_auto_layout': commands.createAutoLayout,
		'create_instance': commands.createInstance,
		'create_component': commands.createComponent,
		'set_layout_grid': commands.setLayoutGrid,
		'set_layout_mode': commands.setLayoutMode,
		'set_padding': commands.setPadding,
		'set_item_spacing': commands.setItemSpacing,
		'set_axis_align': commands.setAxisAlign,
		'set_layout_sizing': commands.setLayoutSizing,
		'set_annotation': commands.setAnnotation,
		'get_annotations': commands.getAnnotations,


		// Manipulation commands
		'move_node': commands.moveNode,
		'resize_node': commands.resizeNode,
		'rotate_node': commands.rotateNode,
		'set_rotation': commands.setRotation,
		'delete_node': commands.deleteNode,
		'delete_multiple_nodes': commands.deleteMultipleNodes,
		'clone_node': commands.cloneNode,
		'group_nodes': commands.groupNodes,
		'create_group': commands.groupNodes, // Alias for group_nodes
		'get_instance_overrides': commands.getInstanceOverrides,
		'set_instance_overrides': commands.setInstanceOverrides,
		'detach_instance': commands.detachInstance,
		'ungroup_node': commands.ungroupNode,
		'select_nodes': commands.selectNodes,
		'select_nodes_by_type': commands.selectNodesByType,
		'select_nodes_by_name': commands.selectNodesByName,

		// SVG commands
		'create_design_from_svg': commands.createDesignFromSvg,

		// Image commands
		'create_image_from_url': commands.createImageFromUrl,
		'replace_image': commands.replaceImage,

		// Boolean operations
		'boolean_union': commands.booleanUnion,
		'boolean_subtract': commands.booleanSubtract,
		'boolean_intersect': commands.booleanIntersect,
		'boolean_exclude': commands.booleanExclude,
		'create_boolean_operation': commands.createBooleanOperation,

		// Information commands
		'get_document_info': commands.getDocumentInfo,
		'get_node_info': commands.getNodeInfo,
		'get_nodes_info': commands.getNodesInfo,
		'get_selection': commands.getSelection,
		'search_nodes': commands.searchNodes,
		'get_page_info': commands.getPageInfo,
		'export_node_as_image': commands.exportNodeAsImage,
		'get_components': commands.getComponents,
		'scan_nodes_by_types': commands.scanNodesByTypes,

		// Batch style commands (unified - both support selection and nodeIds)
		'apply_styles_to_selection': commands.applyStylesToSelection,
		'apply_text_styles_to_selection': commands.applyTextStylesToSelection,
		'apply_styles_to_nodes': commands.applyStylesToSelection, // Alias for backward compatibility

		// Layer order commands
		'reorder_layer': commands.reorderLayer,
		'move_to_front': commands.moveToFront,
		'move_to_back': commands.moveToBack,
		'move_forward': commands.moveForward,
		'move_backward': commands.moveBackward,
		'sort_layers_by_name': commands.sortLayersByName,
		'sort_layers_by_position': commands.sortLayersByPosition,
		'reorder_multiple_layers': commands.reorderMultipleLayers
	}

	const commandFunction = commandMap[command]
	if (!commandFunction) {
		throw new Error(`Unknown command: ${command}`)
	}

	return await commandFunction(params)
}

// Update settings and save to storage
async function updateSettings(msg: any) {
	try {
		// Validate settings
		if (msg.serverPort && (isNaN(msg.serverPort) || msg.serverPort < 1 || msg.serverPort > 65535)) {
			throw new Error('Invalid server port. Must be a number between 1 and 65535.')
		}

		if (msg.channelId && typeof msg.channelId !== 'string') {
			throw new Error('Invalid channel ID. Must be a string.')
		}

		// Update state
		if (msg.serverPort) {
			state.serverPort = parseInt(msg.serverPort)
		}

		if (msg.channelId) {
			state.channelId = msg.channelId.trim()
		}

		// Save to client storage
		await figma.clientStorage.setAsync('serverSettings', {
			serverPort: state.serverPort,
			channelId: state.channelId,
			lastUpdated: new Date().toISOString()
		})

		console.log('✅ Settings updated and saved:', { 
			serverPort: state.serverPort, 
			channelId: state.channelId 
		})

		// Notify UI of successful save
		figma.ui.postMessage({
			type: 'settings-saved',
			settings: { 
				serverPort: state.serverPort, 
				channelId: state.channelId 
			}
		})

		figma.notify('Settings saved successfully!', { timeout: 2000 })

	} catch (error) {
		console.error('❌ Settings update failed:', error)
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
		figma.ui.postMessage({
			type: 'settings-error',
			error: errorMessage
		})
		figma.notify(`Settings update failed: ${errorMessage}`, { error: true })
	}
}

// Send selection info to UI
async function updateSelectionInfo() {
	try {
		const selection = figma.currentPage.selection
		const selectionInfo = {
			count: selection.length,
			nodes: await Promise.all(selection.map(async node => {
				const nodeInfo: any = {
					id: node.id,
					name: node.name,
					type: node.type,
					x: 'x' in node ? node.x : 0,
					y: 'y' in node ? node.y : 0,
					width: 'width' in node ? node.width : 0,
					height: 'height' in node ? node.height : 0,
					visible: node.visible,
					locked: node.locked,
					opacity: 'opacity' in node ? node.opacity : 1,
					blendMode: 'blendMode' in node ? node.blendMode : 'NORMAL'
				}

				// Component properties
				if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
					nodeInfo.isComponentSet = node.type === 'COMPONENT_SET'
					
					if (node.type === 'COMPONENT') {
						const component = node as ComponentNode
						nodeInfo.key = component.key
						nodeInfo.description = component.description
						nodeInfo.documentationLinks = component.documentationLinks || []
						
						// Component properties
						try {
							// Check if component is part of a component set
							if (component.parent?.type === 'COMPONENT_SET') {
								const componentSet = component.parent as ComponentSetNode
								const props = componentSet.componentPropertyDefinitions
								nodeInfo.componentProperties = Object.entries(props).map(([key, prop]) => ({
									key,
									type: prop.type,
									defaultValue: prop.defaultValue,
									variantOptions: prop.type === 'VARIANT' ? prop.variantOptions : undefined
								}))
							} else {
								// Standalone component
								const props = component.componentPropertyDefinitions
								nodeInfo.componentProperties = Object.entries(props).map(([key, prop]) => ({
									key,
									type: prop.type,
									defaultValue: prop.defaultValue,
									variantOptions: prop.type === 'VARIANT' ? prop.variantOptions : undefined
								}))
							}
						} catch (err) {
							console.warn('Error getting component properties:', err)
							nodeInfo.componentProperties = []
						}
					}
					
					if (node.type === 'COMPONENT_SET') {
						const componentSet = node as ComponentSetNode
						nodeInfo.key = componentSet.key
						nodeInfo.description = componentSet.description
						nodeInfo.documentationLinks = componentSet.documentationLinks || []
						nodeInfo.variantGroupProperties = componentSet.variantGroupProperties || {}
						
						// Component set properties
						try {
							const props = componentSet.componentPropertyDefinitions
							nodeInfo.componentProperties = Object.entries(props).map(([key, prop]) => ({
								key,
								type: prop.type,
								defaultValue: prop.defaultValue,
								variantOptions: prop.type === 'VARIANT' ? prop.variantOptions : undefined
							}))
						} catch (err) {
							console.warn('Error getting component set properties:', err)
							nodeInfo.componentProperties = []
						}
					}
				}

				// Instance properties
				if (node.type === 'INSTANCE') {
					const instance = node as InstanceNode
					try {
						// Get main component async
						const mainComponent = await instance.getMainComponentAsync()
						nodeInfo.mainComponent = mainComponent ? {
							id: mainComponent.id,
							name: mainComponent.name,
							key: mainComponent.key
						} : null
						
						// Instance overrides
						const properties = instance.componentProperties
						if (properties && Object.keys(properties).length > 0) {
							nodeInfo.componentProperties = properties
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
									nodeInfo.availableProperties = Object.entries(availableProps).map(([key, prop]) => ({
										key, // This will include the full key like "Title#929:0"
										type: prop.type,
										defaultValue: prop.defaultValue,
										currentValue: properties?.[key],
										variantOptions: prop.type === 'VARIANT' ? prop.variantOptions : undefined
									}))
								}
							} catch (err) {
								console.warn('Error getting available properties:', err)
							}
						}
						
						// Exposed instances
						try {
							const exposedInstances = instance.exposedInstances || []
							nodeInfo.exposedInstances = exposedInstances.map(exp => ({
								name: exp.name,
								type: exp.type
							}))
						} catch (err) {
							console.warn('Error getting exposed instances:', err)
						}
					} catch (err) {
						console.warn('Error getting instance info:', err)
					}
				}

				// Text properties
				if (node.type === 'TEXT') {
					const text = node as TextNode
					nodeInfo.characters = text.characters
					nodeInfo.fontSize = text.fontSize
					nodeInfo.fontName = text.fontName
					nodeInfo.textAlignHorizontal = text.textAlignHorizontal
					nodeInfo.textAlignVertical = text.textAlignVertical
				}

				// Frame properties
				if ('layoutMode' in node) {
					nodeInfo.layoutMode = node.layoutMode
					if (node.layoutMode !== 'NONE') {
						nodeInfo.layoutDirection = 'layoutDirection' in node ? node.layoutDirection : null
						nodeInfo.itemSpacing = node.itemSpacing
						nodeInfo.paddingLeft = node.paddingLeft
						nodeInfo.paddingRight = node.paddingRight
						nodeInfo.paddingTop = node.paddingTop
						nodeInfo.paddingBottom = node.paddingBottom
					}
				}

				// Fill and stroke properties
				if ('fills' in node && node.fills !== figma.mixed) {
					nodeInfo.fillsCount = Array.isArray(node.fills) ? node.fills.length : 0
				}
				if ('strokes' in node) {
					nodeInfo.strokesCount = Array.isArray(node.strokes) ? node.strokes.length : 0
					nodeInfo.strokeWeight = node.strokeWeight
				}

				// Effects
				if ('effects' in node) {
					nodeInfo.effectsCount = Array.isArray(node.effects) ? node.effects.length : 0
					if (node.effects.length > 0) {
						nodeInfo.effectTypes = node.effects.map(e => e.type)
					}
				}

				// Constraints
				if ('constraints' in node) {
					nodeInfo.constraints = node.constraints
				}

				return nodeInfo
			}))
		}

		figma.ui.postMessage({
			type: 'selection-changed',
			selection: selectionInfo
		})

	} catch (error) {
		console.error('Error updating selection info:', error)
	}
}