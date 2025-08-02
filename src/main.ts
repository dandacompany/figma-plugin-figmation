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
function updateSelectionInfo() {
	try {
		const selection = figma.currentPage.selection
		const selectionInfo = {
			count: selection.length,
			nodes: selection.map(node => ({
				id: node.id,
				name: node.name,
				type: node.type,
				x: 'x' in node ? node.x : 0,
				y: 'y' in node ? node.y : 0,
				width: 'width' in node ? node.width : 0,
				height: 'height' in node ? node.height : 0
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