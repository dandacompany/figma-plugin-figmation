// Figma plugin that communicates with WebSocket server

const state = {
	serverPort: 3055, // Default port
	serverHost: 'localhost', // Default host
	isConnected: false
}

export default function () {
	figma.showUI(__html__, { width: 400, height: 600, themeColors: true })

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
				// Handle unknown message types
				console.warn(`Unknown message type received: ${msg.type}`, msg)
				figma.notify(`Unknown message type: ${msg.type}`, { error: true })
				break
			case 'execute-command':
				// Execute commands received via WebSocket - Enhanced error handling
				if (!msg.command) {
					figma.notify('No command specified in request', { error: true })
					figma.ui.postMessage({
						type: 'command-error',
						id: msg.id,
						error: 'Missing command parameter',
					})
					return
				}

				try {
					// Command execution start notification
					figma.notify(`Executing command: ${msg.command}...`, { timeout: 2000 })
					
					const result = await handleCommand(msg.command, msg.params)
					
					// Success notification
					figma.notify(`✅ Command '${msg.command}' completed successfully`, { timeout: 3000 })
					
					// Send result to UI
					figma.ui.postMessage({
						type: 'command-result',
						id: msg.id,
						result,
						command: msg.command, // Add command info for debugging
						timestamp: new Date().toISOString()
					})
				} catch (error) {
					const errorMessage = error?.message || 'Unknown error occurred'
					
					// User-friendly error notification
					figma.notify(`❌ Error: ${errorMessage}`, { error: true, timeout: 5000 })
					
					// Detailed error logging to developer console
					console.error(`Command '${msg.command}' failed:`, {
						error: errorMessage,
						command: msg.command,
						params: msg.params,
						timestamp: new Date().toISOString(),
						stack: error?.stack
					})
					
					figma.ui.postMessage({
						type: 'command-error',
						id: msg.id,
						error: errorMessage,
						command: msg.command,
						timestamp: new Date().toISOString()
					})
				}
				break
		}
	}

	// Auto-connect when plugin runs
	figma.on('run', ({ command }) => {
		figma.ui.postMessage({ type: 'auto-connect' })
	})

	// Update UI when selection changes
	figma.on('selectionchange', () => {
		postSelectionInfo()
	})

	// Send current selection information
	function postSelectionInfo() {
		const selection = figma.currentPage.selection
		figma.ui.postMessage({
			type: 'selection-changed',
			selectionCount: selection.length,
			selection: selection.map(node => ({
				id: node.id,
				name: node.name,
				type: node.type,
			}))
		})
	}
}

// Update settings
function updateSettings(settings) {
	if (settings.serverPort) {
		state.serverPort = settings.serverPort
	}
	if (settings.serverHost) {
		state.serverHost = settings.serverHost
	}

	figma.clientStorage.setAsync('settings', {
		serverPort: state.serverPort,
		serverHost: state.serverHost,
	})
}

// Initialize plugin
async function initializePlugin() {
	try {
		const savedSettings = await figma.clientStorage.getAsync('settings')
		if (savedSettings) {
			if (savedSettings.serverPort) {
				state.serverPort = savedSettings.serverPort
			}
			if (savedSettings.serverHost) {
				state.serverHost = savedSettings.serverHost
			}
		}

		// Send initial settings to UI
		figma.ui.postMessage({
			type: 'init-settings',
			settings: {
				serverPort: state.serverPort,
				serverHost: state.serverHost,
			},
		})
	} catch (error) {
		console.error('Error loading settings:', error)
	}
}

// Command handler - Comprehensive error handling and user guidance included
async function handleCommand(command, params) {
	// Input validation
	if (!command || typeof command !== 'string') {
		throw new Error('Invalid command: Command must be a non-empty string')
	}

	// Design mode check (node creation commands only)
	const nodeCreationCommands = [
		'create_rectangle', 'create_frame', 'create_text', 'create_ellipse',
		'create_vector_path', 'create_button', 'create_boolean_operation',
		'create_icon_from_svg', 'create_input_field', 'create_checkbox',
		'create_toggle', 'create_symbol', 'create_avatar', 'create_progress_bar',
		'create_slider', 'create_image_from_url'
	]

	if (nodeCreationCommands.includes(command) && figma.editorType !== 'figma') {
		throw new Error(`Design mode required: The command '${command}' can only be executed in Figma's Design mode. Please switch from Dev mode to Design mode and try again.`)
	}

	try {
		switch (command) {
		case 'get_document_info':
			return await getDocumentInfo()
		case 'get_selection':
			return await getSelection()
		case 'get_node_info':
			if (!params || !params.nodeId) {
				throw new Error('Missing nodeId parameter')
			}
			return await getNodeInfo(params.nodeId)
		case 'create_rectangle':
			return await createRectangle(params)
		case 'create_frame':
			return await createFrame(params)
		case 'create_text':
			return await createText(params)
		case 'set_fill_color':
			return await setFillColor(params)
		case 'set_stroke_color':
			return await setStrokeColor(params)
		case 'move_node':
			return await moveNode(params)
		case 'resize_node':
			return await resizeNode(params)
		case 'delete_node':
			return await deleteNode(params)
		case 'clone_node':
			return await cloneNode(params)
		case 'export_node_as_image':
			return await exportNodeAsImage(params)
		case 'get_nodes_info':
			return await getNodesInfo(params)
		case 'set_text_content':
			return await setTextContent(params)
		case 'get_styles':
			return await getStyles()
		case 'get_local_components':
			return await getLocalComponents()
		case 'create_component_instance':
			return await createComponentInstance(params)
		case 'set_corner_radius':
			return await setCornerRadius(params)
		case 'set_opacity':
			return await setOpacity(params)
		case 'set_rotation':
			return await setRotation(params)
		case 'add_drop_shadow':
			return await addDropShadow(params)
		case 'add_inner_shadow':
			return await addInnerShadow(params)
		case 'add_blur':
			return await addBlur(params)
		case 'set_individual_corner_radius':
			return await setIndividualCornerRadius(params)
		case 'scan_text_nodes':
			return await scanTextNodes(params)
		case 'scan_nodes_by_types':
			return await scanNodesByTypes(params)
		case 'set_multiple_text_contents':
			return await setMultipleTextContents(params)
		case 'delete_multiple_nodes':
			return await deleteMultipleNodes(params)
		case 'set_layout_mode':
			return await setLayoutMode(params)
		case 'set_padding':
			return await setPadding(params)
		case 'set_axis_align':
			return await setAxisAlign(params)
		case 'set_layout_sizing':
			return await setLayoutSizing(params)
		case 'set_item_spacing':
			return await setItemSpacing(params)
		case 'get_annotations':
			return await getAnnotations(params)
		case 'set_annotation':
			return await setAnnotation(params)
		case 'get_instance_overrides':
			return await getInstanceOverrides(params)
		case 'set_instance_overrides':
			return await setInstanceOverrides(params)
		case 'get_reactions':
			return await getReactions(params)
		case 'set_default_connector':
			return await setDefaultConnector(params)
		case 'create_connections':
			return await createConnections(params)
		case 'create_image_from_url':
			return await createImageFromUrl(params)
		case 'create_slider':
			return await createSlider(params)
		case 'create_ellipse':
			return await createEllipse(params)
		case 'create_vector_path':
			return await createVectorPath(params)
		case 'create_button':
			return await createButton(params)
		case 'create_boolean_operation':
			return await createBooleanOperation(params)
		case 'create_icon_from_svg':
			return await createIconFromSvg(params)
		case 'create_svg_to_vector':
			return await createSvgToVector(params)
		case 'execute_custom_command':
			return await executeCustomCommand(params)
		case 'create_input_field':
			return await createInputField(params)
		case 'create_checkbox':
			return await createCheckbox(params)
		case 'create_toggle':
			return await createToggle(params)
		case 'create_symbol':
			return await createSymbol(params)
		case 'create_avatar':
			return await createAvatar(params)
		case 'create_progress_bar':
			return await createProgressBar(params)
		default:
			throw new Error(`Unknown command: '${command}'. Available commands include: get_document_info, get_selection, create_rectangle, create_frame, create_text, and ${nodeCreationCommands.length} other node creation commands. Please check the command name and try again.`)
	}
	} catch (error) {
		// Improve error messages and add user guidance
		const errorMessage = error?.message || 'An unexpected error occurred'
		
		// User-friendly messages for common error situations
		if (errorMessage.includes('Node not found')) {
			throw new Error(`${errorMessage}. This usually happens when a node has been deleted or the ID is incorrect. Please verify the node exists and try again.`)
		} else if (errorMessage.includes('Permission denied') || errorMessage.includes('not allowed')) {
			throw new Error(`${errorMessage}. Please check that you have the necessary permissions and that Figma is in the correct mode for this operation.`)
		} else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
			throw new Error(`Network error: ${errorMessage}. Please check your internet connection and ensure the external resources are accessible.`)
		} else if (errorMessage.includes('Font') || errorMessage.includes('loadFont')) {
			throw new Error(`Font loading error: ${errorMessage}. The required font may not be available. Figma will attempt to use a fallback font.`)
		}
		
		// Re-throw the original error but add context information
		throw new Error(`Command '${command}' failed: ${errorMessage}`)
	}
}

// Utility functions

// Color validation and Paint object creation
function createColorPaint(colorInput) {
	if (!colorInput || typeof colorInput !== 'object') {
		throw new Error('Color must be an object with r, g, b properties')
	}
	
	const { r, g, b, a = 1 } = colorInput
	
	// Color value validation (0-1 range)
	if (typeof r !== 'number' || r < 0 || r > 1) {
		throw new Error('Red value (r) must be a number between 0 and 1')
	}
	if (typeof g !== 'number' || g < 0 || g > 1) {
		throw new Error('Green value (g) must be a number between 0 and 1')
	}
	if (typeof b !== 'number' || b < 0 || b > 1) {
		throw new Error('Blue value (b) must be a number between 0 and 1')
	}
	if (typeof a !== 'number' || a < 0 || a > 1) {
		throw new Error('Alpha value (a) must be a number between 0 and 1')
	}
	
	return {
		type: 'SOLID',
		color: { r, g, b },
		opacity: a,
	}
}

// Parent node validation and child addition
async function appendToParent(childNode, parentId) {
	if (parentId) {
		const parentNode = await figma.getNodeByIdAsync(parentId)
		if (!parentNode) {
			throw new Error(`Parent node not found with ID: ${parentId}`)
		}
		if (!('appendChild' in parentNode)) {
			throw new Error(`Parent node (${parentNode.type}) does not support children`)
		}
		parentNode.appendChild(childNode)
		return parentNode.id
	} else {
		figma.currentPage.appendChild(childNode)
		return figma.currentPage.id
	}
}

// Generate consistent node names
function generateNodeName(baseType, customName) {
	if (customName && typeof customName === 'string' && customName.trim() !== '') {
		return customName.trim()
	}
	return `${baseType}_${Date.now()}`
}

// Command implementations

async function getDocumentInfo() {
	await figma.currentPage.loadAsync()
	const page = figma.currentPage
	return {
		name: page.name,
		nodeId: page.id,
		id: page.id,
		type: page.type,
		children: page.children.map(node => ({
			nodeId: node.id,
			id: node.id,
			name: node.name,
			type: node.type,
		})),
		currentPage: {
			nodeId: page.id,
			id: page.id,
			name: page.name,
			childCount: page.children.length,
		},
		pages: figma.root.children.map(page => ({
			nodeId: page.id,
			id: page.id,
			name: page.name,
			childCount: page.children.length,
		})),
	}
}

async function getSelection() {
	return {
		selectionCount: figma.currentPage.selection.length,
		selection: figma.currentPage.selection.map(node => ({
			nodeId: node.id,
			id: node.id,
			name: node.name,
			type: node.type,
			visible: node.visible,
		})),
	}
}

async function getNodeInfo(nodeId) {
	const node = await figma.getNodeByIdAsync(nodeId)
	
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		type: node.type,
		visible: node.visible,
		locked: node.locked,
		x: 'x' in node ? node.x : undefined,
		y: 'y' in node ? node.y : undefined,
		width: 'width' in node ? node.width : undefined,
		height: 'height' in node ? node.height : undefined,
		fills: 'fills' in node ? node.fills : undefined,
		strokes: 'strokes' in node ? node.strokes : undefined,
	}
}

async function createRectangle(params) {
	// Input validation and default value setting
	const {
		x = 0,
		y = 0,
		width = 100,
		height = 100,
		name = `Rectangle_${Date.now()}`,
		parentId,
		// All Figma API properties
		fills,
		fillColor, // Convenience property (backward compatibility)
		strokes,
		strokeColor, // Convenience property (backward compatibility)  
		strokeWeight,
		strokeCap,
		strokeJoin,
		strokeAlign,
		dashPattern,
		opacity,
		blendMode,
		cornerRadius,
		topLeftRadius,
		topRightRadius,
		bottomLeftRadius,
		bottomRightRadius,
		individualCornerRadius, // Convenience property (backward compatibility)
		rotation,
		visible,
		locked,
		effects,
		shadows, // Convenience property (backward compatibility)
		blurs, // Convenience property (backward compatibility)
		constraints,
		relativeTransform,
		clipsContent,
		guides,
		selection,
		opacity: nodeOpacity,
		isMask,
		maskType,
		exportSettings,
		overflowDirection,
		numberOfFixedChildren,
		overlayPositionType,
		overlayBackground,
		overlayBackgroundInteraction,
		relaunch,
		reactions,
		componentPropertyReferences,
	} = params || {}

	// Validation
	if (typeof x !== 'number' || typeof y !== 'number') {
		throw new Error('Position values (x, y) must be numbers')
	}
	if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
		throw new Error('Size values (width, height) must be positive numbers')
	}
	if (typeof name !== 'string' || name.trim() === '') {
		throw new Error('Name must be a non-empty string')
	}

	// Design mode check
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		const rect = figma.createRectangle()
		rect.x = x
		rect.y = y
		rect.resize(width, height)
		rect.name = generateNodeName('Rectangle', name)

		// Apply all Figma API properties
		
		// Fill properties (fills takes priority, fillColor for backward compatibility)
		if (fills !== undefined) {
			rect.fills = fills
		} else if (fillColor) {
			try {
				const paintStyle = createColorPaint(fillColor)
				rect.fills = [paintStyle]
			} catch (error) {
				throw new Error(`Invalid fill color: ${error.message}`)
			}
		}

		// Stroke properties (strokes takes priority, strokeColor for backward compatibility)
		if (strokes !== undefined) {
			rect.strokes = strokes
		} else if (strokeColor) {
			try {
				const strokeStyle = createColorPaint(strokeColor)
				rect.strokes = [strokeStyle]
			} catch (error) {
				throw new Error(`Invalid stroke color: ${error.message}`)
			}
		}

		// Border-related properties
		if (strokeWeight !== undefined) {
			if (typeof strokeWeight !== 'number' || strokeWeight < 0) {
				throw new Error('Stroke weight must be a non-negative number')
			}
			rect.strokeWeight = strokeWeight
		}
		if (strokeCap !== undefined) rect.strokeCap = strokeCap
		if (strokeJoin !== undefined) rect.strokeJoin = strokeJoin
		if (strokeAlign !== undefined) rect.strokeAlign = strokeAlign
		if (dashPattern !== undefined) rect.dashPattern = dashPattern

		// Appearance properties
		if (opacity !== undefined) {
			if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
				throw new Error('Opacity must be between 0 and 1')
			}
			rect.opacity = opacity
		}
		if (blendMode !== undefined) rect.blendMode = blendMode
		if (visible !== undefined) rect.visible = visible
		if (locked !== undefined) rect.locked = locked
		if (isMask !== undefined) rect.isMask = isMask

		// Corner radius properties (individual properties take priority, cornerRadius applies to all)
		if (topLeftRadius !== undefined) rect.topLeftRadius = topLeftRadius
		if (topRightRadius !== undefined) rect.topRightRadius = topRightRadius
		if (bottomLeftRadius !== undefined) rect.bottomLeftRadius = bottomLeftRadius
		if (bottomRightRadius !== undefined) rect.bottomRightRadius = bottomRightRadius
		if (individualCornerRadius) {
			const { topLeftRadius: tlr, topRightRadius: trr, bottomRightRadius: brr, bottomLeftRadius: blr } = individualCornerRadius
			if (tlr !== undefined) rect.topLeftRadius = tlr
			if (trr !== undefined) rect.topRightRadius = trr
			if (brr !== undefined) rect.bottomRightRadius = brr
			if (blr !== undefined) rect.bottomLeftRadius = blr
		}
		if (cornerRadius !== undefined) {
			if (typeof cornerRadius !== 'number' || cornerRadius < 0) {
				throw new Error('Corner radius must be a non-negative number')
			}
			rect.cornerRadius = cornerRadius
		}

		// Transform properties
		if (rotation !== undefined) {
			if (typeof rotation !== 'number') {
				throw new Error('Rotation must be a number (in degrees)')
			}
			const radians = (rotation * Math.PI) / 180
			rect.rotation = radians
		}
		if (relativeTransform !== undefined) rect.relativeTransform = relativeTransform

		// Effect properties (effects takes priority, shadows/blurs for backward compatibility)
		if (effects !== undefined) {
			rect.effects = effects
		} else {
			let currentEffects = [...rect.effects]
			
			if (shadows && Array.isArray(shadows)) {
				for (const shadow of shadows) {
					if (shadow.type === 'DROP_SHADOW' || shadow.type === 'INNER_SHADOW') {
						const effect = {
							type: shadow.type,
							color: shadow.color || { r: 0, g: 0, b: 0, a: 0.25 },
							offset: shadow.offset || { x: 0, y: 4 },
							radius: shadow.radius || 4,
							spread: shadow.spread || 0,
							visible: shadow.visible !== false,
							blendMode: shadow.blendMode || 'NORMAL'
						}
						currentEffects.push(effect)
					}
				}
			}

			if (blurs && Array.isArray(blurs)) {
				for (const blur of blurs) {
					if (blur.type === 'LAYER_BLUR' || blur.type === 'BACKGROUND_BLUR') {
						const effect = {
							type: blur.type,
							radius: blur.radius || 4,
							visible: blur.visible !== false
						}
						currentEffects.push(effect)
					}
				}
			}
			
			if (shadows || blurs) {
				rect.effects = currentEffects
			}
		}

		// Layout and constraints
		if (constraints !== undefined) rect.constraints = constraints
		if (clipsContent !== undefined) rect.clipsContent = clipsContent

		// Export settings
		if (exportSettings !== undefined) rect.exportSettings = exportSettings

		// Other properties
		if (relaunch !== undefined) rect.relaunch = relaunch
		if (reactions !== undefined) rect.reactions = reactions

		// Add to parent node
		const actualParentId = await appendToParent(rect, parentId)

		return {
			nodeId: rect.id,
			id: rect.id,
			name: rect.name,
			type: rect.type,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			parentId: actualParentId,
			success: true,
			message: `Rectangle "${rect.name}" created successfully`
		}
	} catch (error) {
		throw new Error(`Failed to create rectangle: ${error.message}`)
	}
}

async function createFrame(params) {
	// Input validation and default value setting
	const {
		x = 0,
		y = 0,
		width = 200,
		height = 200,
		name = `Frame_${Date.now()}`,
		parentId,
		// All Figma API properties
		fills,
		fillColor, // Convenience property (backward compatibility)
		strokes,
		strokeColor, // Convenience property (backward compatibility)  
		strokeWeight,
		strokeCap,
		strokeJoin,
		strokeAlign,
		dashPattern,
		opacity,
		blendMode,
		cornerRadius,
		topLeftRadius,
		topRightRadius,
		bottomLeftRadius,
		bottomRightRadius,
		individualCornerRadius, // Convenience property (backward compatibility)
		rotation,
		visible,
		locked,
		effects,
		shadows, // Convenience property (backward compatibility)
		blurs, // Convenience property (backward compatibility)
		constraints,
		relativeTransform,
		clipsContent,
		guides,
		layoutMode,
		primaryAxisSizingMode,
		counterAxisSizingMode,
		primaryAxisAlignItems,
		counterAxisAlignItems,
		paddingLeft,
		paddingRight,
		paddingTop,
		paddingBottom,
		itemSpacing,
		counterAxisSpacing,
		layoutWrap,
		strokesIncludedInLayout,
		layoutGrids,
		gridStyleId,
		isMask,
		maskType,
		exportSettings,
		overflowDirection,
		numberOfFixedChildren,
		overlayPositionType,
		overlayBackground,
		overlayBackgroundInteraction,
		relaunch,
		reactions,
		componentPropertyReferences,
	} = params || {}

	// Validation
	if (typeof x !== 'number' || typeof y !== 'number') {
		throw new Error('Position values (x, y) must be numbers')
	}
	if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
		throw new Error('Size values (width, height) must be positive numbers')
	}
	if (typeof name !== 'string' || name.trim() === '') {
		throw new Error('Name must be a non-empty string')
	}
	if (strokeWeight !== undefined && (typeof strokeWeight !== 'number' || strokeWeight < 0)) {
		throw new Error('Stroke weight must be a non-negative number')
	}

	// Design mode check
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		const frame = figma.createFrame()
		frame.x = x
		frame.y = y
		frame.resize(width, height)
		frame.name = generateNodeName('Frame', name)

		// Apply all Figma API properties
		
		// Fill properties (fills takes priority, fillColor for backward compatibility)
		if (fills !== undefined) {
			frame.fills = fills
		} else if (fillColor) {
			try {
				const paintStyle = createColorPaint(fillColor)
				frame.fills = [paintStyle]
			} catch (error) {
				throw new Error(`Invalid fill color: ${error.message}`)
			}
		}

		// Stroke properties (strokes takes priority, strokeColor for backward compatibility)
		if (strokes !== undefined) {
			frame.strokes = strokes
		} else if (strokeColor) {
			try {
				const strokeStyle = createColorPaint(strokeColor)
				frame.strokes = [strokeStyle]
			} catch (error) {
				throw new Error(`Invalid stroke color: ${error.message}`)
			}
		}

		// Border-related properties
		if (strokeWeight !== undefined) {
			if (typeof strokeWeight !== 'number' || strokeWeight < 0) {
				throw new Error('Stroke weight must be a non-negative number')
			}
			frame.strokeWeight = strokeWeight
		}
		if (strokeCap !== undefined) frame.strokeCap = strokeCap
		if (strokeJoin !== undefined) frame.strokeJoin = strokeJoin
		if (strokeAlign !== undefined) frame.strokeAlign = strokeAlign
		if (dashPattern !== undefined) frame.dashPattern = dashPattern

		// Appearance properties
		if (opacity !== undefined) {
			if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
				throw new Error('Opacity must be between 0 and 1')
			}
			frame.opacity = opacity
		}
		if (blendMode !== undefined) frame.blendMode = blendMode
		if (visible !== undefined) frame.visible = visible
		if (locked !== undefined) frame.locked = locked
		if (isMask !== undefined) frame.isMask = isMask
		if (clipsContent !== undefined) frame.clipsContent = clipsContent

		// Corner radius properties (individual properties take priority, cornerRadius applies to all)
		if (topLeftRadius !== undefined) frame.topLeftRadius = topLeftRadius
		if (topRightRadius !== undefined) frame.topRightRadius = topRightRadius
		if (bottomLeftRadius !== undefined) frame.bottomLeftRadius = bottomLeftRadius
		if (bottomRightRadius !== undefined) frame.bottomRightRadius = bottomRightRadius
		if (individualCornerRadius) {
			const { topLeftRadius: tlr, topRightRadius: trr, bottomRightRadius: brr, bottomLeftRadius: blr } = individualCornerRadius
			if (tlr !== undefined) frame.topLeftRadius = tlr
			if (trr !== undefined) frame.topRightRadius = trr
			if (brr !== undefined) frame.bottomRightRadius = brr
			if (blr !== undefined) frame.bottomLeftRadius = blr
		}
		if (cornerRadius !== undefined) {
			if (typeof cornerRadius !== 'number' || cornerRadius < 0) {
				throw new Error('Corner radius must be a non-negative number')
			}
			frame.cornerRadius = cornerRadius
		}

		// Transform properties
		if (rotation !== undefined) {
			if (typeof rotation !== 'number') {
				throw new Error('Rotation must be a number (in degrees)')
			}
			const radians = (rotation * Math.PI) / 180
			frame.rotation = radians
		}
		if (relativeTransform !== undefined) frame.relativeTransform = relativeTransform

		// Effect properties (effects takes priority, shadows/blurs for backward compatibility)
		if (effects !== undefined) {
			frame.effects = effects
		} else {
			let currentEffects = [...frame.effects]
			
			if (shadows && Array.isArray(shadows)) {
				for (const shadow of shadows) {
					if (shadow.type === 'DROP_SHADOW' || shadow.type === 'INNER_SHADOW') {
						const effect = {
							type: shadow.type,
							color: shadow.color || { r: 0, g: 0, b: 0, a: 0.25 },
							offset: shadow.offset || { x: 0, y: 4 },
							radius: shadow.radius || 4,
							spread: shadow.spread || 0,
							visible: shadow.visible !== false,
							blendMode: shadow.blendMode || 'NORMAL'
						}
						currentEffects.push(effect)
					}
				}
			}

			if (blurs && Array.isArray(blurs)) {
				for (const blur of blurs) {
					if (blur.type === 'LAYER_BLUR' || blur.type === 'BACKGROUND_BLUR') {
						const effect = {
							type: blur.type,
							radius: blur.radius || 4,
							visible: blur.visible !== false
						}
						currentEffects.push(effect)
					}
				}
			}
			
			if (shadows || blurs) {
				frame.effects = currentEffects
			}
		}

		// Layout and constraints
		if (constraints !== undefined) frame.constraints = constraints

		// Frame-specific properties (Auto Layout)
		if (layoutMode !== undefined) frame.layoutMode = layoutMode
		if (primaryAxisSizingMode !== undefined) frame.primaryAxisSizingMode = primaryAxisSizingMode
		if (counterAxisSizingMode !== undefined) frame.counterAxisSizingMode = counterAxisSizingMode
		if (primaryAxisAlignItems !== undefined) frame.primaryAxisAlignItems = primaryAxisAlignItems
		if (counterAxisAlignItems !== undefined) frame.counterAxisAlignItems = counterAxisAlignItems
		if (paddingLeft !== undefined) frame.paddingLeft = paddingLeft
		if (paddingRight !== undefined) frame.paddingRight = paddingRight
		if (paddingTop !== undefined) frame.paddingTop = paddingTop
		if (paddingBottom !== undefined) frame.paddingBottom = paddingBottom
		if (itemSpacing !== undefined) frame.itemSpacing = itemSpacing
		if (counterAxisSpacing !== undefined) frame.counterAxisSpacing = counterAxisSpacing
		if (layoutWrap !== undefined) frame.layoutWrap = layoutWrap
		if (strokesIncludedInLayout !== undefined) frame.strokesIncludedInLayout = strokesIncludedInLayout

		// Grid and guides
		if (layoutGrids !== undefined) frame.layoutGrids = layoutGrids
		if (gridStyleId !== undefined) frame.gridStyleId = gridStyleId
		if (guides !== undefined) frame.guides = guides

		// Export settings
		if (exportSettings !== undefined) frame.exportSettings = exportSettings

		// Other properties
		if (relaunch !== undefined) frame.relaunch = relaunch
		if (reactions !== undefined) frame.reactions = reactions

		// Add to parent node
		const actualParentId = await appendToParent(frame, parentId)

		return {
			nodeId: frame.id,
			id: frame.id,
			name: frame.name,
			type: frame.type,
			x: frame.x,
			y: frame.y,
			width: frame.width,
			height: frame.height,
			fills: frame.fills,
			strokes: frame.strokes,
			strokeWeight: frame.strokeWeight,
			parentId: actualParentId,
			success: true,
			message: `Frame "${frame.name}" created successfully`
		}
	} catch (error) {
		throw new Error(`Failed to create frame: ${error.message}`)
	}
}

async function createText(params) {
	const {
		x = 0,
		y = 0,
		text = 'Text',
		fontSize = 14,
		fontWeight = 400,
		fontColor,
		name = '',
		parentId,
		// All Figma API properties
		fills,
		strokes,
		strokeColor, // Convenience property (backward compatibility)
		strokeWeight,
		strokeCap,
		strokeJoin,
		strokeAlign,
		strokeMiterLimit,
		dashPattern,
		opacity,
		blendMode,
		visible,
		locked,
		effects,
		shadows, // Convenience property (backward compatibility)
		blurs, // Convenience property (backward compatibility)
		constraints,
		relativeTransform,
		clipsContent,
		guides,
		selection,
		isMask,
		maskType,
		exportSettings,
		overflowDirection,
		numberOfFixedChildren,
		overlayPositionType,
		overlayBackground,
		overlayBackgroundInteraction,
		relaunch,
		reactions,
		componentPropertyReferences,
		// Text-specific properties
		characters,
		textCase,
		textDecoration,
		letterSpacing,
		lineHeight,
		paragraphIndent,
		paragraphSpacing,
		textAutoResize,
		textAlignHorizontal,
		textAlignVertical,
		fontName,
		textStyleId,
		fillStyleId,
		strokeStyleId,
		effectStyleId,
		gridStyleId,
		backgroundStyleId,
		hyperlink,
		textTruncation,
		maxLines,
		autoRename,
		rotation,
	} = params || {}

	// Basic validation
	if (typeof x !== 'number' || typeof y !== 'number') {
		throw new Error('Position values (x, y) must be numbers')
	}
	const textContent = characters || text
	if (typeof textContent !== 'string') {
		throw new Error('Text content must be a string')
	}
	if (typeof fontSize !== 'number' || fontSize <= 0 || fontSize > 200) {
		throw new Error('Font size must be a positive number between 1 and 200')
	}

	// Design mode check
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		const textNode = figma.createText()

		// Basic position setting
		textNode.x = x
		textNode.y = y
		textNode.name = generateNodeName('Text', name || textContent)

		// Font loading and setting
		let fontToUse = fontName
		if (!fontToUse) {
			fontToUse = { family: 'Inter', style: 'Regular' }
		}

		try {
			await figma.loadFontAsync(fontToUse)
			textNode.fontName = fontToUse
		} catch (fontError) {
			console.warn('Requested font not available, trying fallbacks')
			try {
				const fallbackFont = { family: 'Inter', style: 'Regular' }
				await figma.loadFontAsync(fallbackFont)
				textNode.fontName = fallbackFont
			} catch (fallbackError) {
				try {
					const systemFont = { family: 'Roboto', style: 'Regular' }
					await figma.loadFontAsync(systemFont)
					textNode.fontName = systemFont
				} catch (systemFontError) {
					throw new Error('Unable to load any compatible font. Please ensure Inter or Roboto fonts are available.')
				}
			}
		}

		// Text property setting
		textNode.fontSize = fontSize
		textNode.characters = textContent

		// Text-specific properties
		if (textCase !== undefined) textNode.textCase = textCase
		if (textDecoration !== undefined) textNode.textDecoration = textDecoration
		if (letterSpacing !== undefined) textNode.letterSpacing = letterSpacing
		if (lineHeight !== undefined) textNode.lineHeight = lineHeight
		if (paragraphIndent !== undefined) textNode.paragraphIndent = paragraphIndent
		if (paragraphSpacing !== undefined) textNode.paragraphSpacing = paragraphSpacing
		if (textAutoResize !== undefined) textNode.textAutoResize = textAutoResize
		if (textAlignHorizontal !== undefined) textNode.textAlignHorizontal = textAlignHorizontal
		if (textAlignVertical !== undefined) textNode.textAlignVertical = textAlignVertical
		if (textTruncation !== undefined) textNode.textTruncation = textTruncation
		if (maxLines !== undefined) textNode.maxLines = maxLines
		if (autoRename !== undefined) textNode.autoRename = autoRename
		if (hyperlink !== undefined) textNode.hyperlink = hyperlink

		// Style IDs
		if (textStyleId !== undefined) textNode.textStyleId = textStyleId
		if (fillStyleId !== undefined) textNode.fillStyleId = fillStyleId
		if (strokeStyleId !== undefined) textNode.strokeStyleId = strokeStyleId
		if (effectStyleId !== undefined) textNode.effectStyleId = effectStyleId

		// Fills setting (complete API takes priority, convenience properties secondary)
		if (fills) {
			textNode.fills = fills
		} else if (fontColor) {
			try {
				const paintStyle = createColorPaint(fontColor)
				textNode.fills = [paintStyle]
			} catch (colorError) {
				throw new Error(`Invalid font color: ${colorError.message}`)
			}
		}

		// Strokes setting
		if (strokes) {
			textNode.strokes = strokes
		} else if (strokeColor) {
			try {
				const strokePaint = createColorPaint(strokeColor)
				textNode.strokes = [strokePaint]
			} catch (colorError) {
				throw new Error(`Invalid stroke color: ${colorError.message}`)
			}
		}

		// Stroke properties
		if (strokeWeight !== undefined) textNode.strokeWeight = strokeWeight
		if (strokeCap !== undefined) textNode.strokeCap = strokeCap
		if (strokeJoin !== undefined) textNode.strokeJoin = strokeJoin
		if (strokeAlign !== undefined) textNode.strokeAlign = strokeAlign
		if (strokeMiterLimit !== undefined) textNode.strokeMiterLimit = strokeMiterLimit
		if (dashPattern !== undefined) textNode.dashPattern = dashPattern

		// General properties
		if (opacity !== undefined) {
			if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
				throw new Error('Opacity must be between 0 and 1')
			}
			textNode.opacity = opacity
		}

		if (blendMode !== undefined) textNode.blendMode = blendMode
		if (visible !== undefined) textNode.visible = visible
		if (locked !== undefined) textNode.locked = locked
		if (isMask !== undefined) textNode.isMask = isMask
		if (maskType !== undefined) textNode.maskType = maskType

		// Rotation setting
		if (rotation !== undefined) {
			if (typeof rotation !== 'number') {
				throw new Error('Rotation must be a number (in degrees)')
			}
			const radians = (rotation * Math.PI) / 180
			textNode.rotation = radians
		}

		// RelativeTransform setting
		if (relativeTransform !== undefined) textNode.relativeTransform = relativeTransform

		// Constraints setting
		if (constraints !== undefined) textNode.constraints = constraints

		// Effects setting (complete API takes priority, convenience properties secondary)
		if (effects) {
			textNode.effects = effects
		} else {
			const currentEffects = []

			// Shadows application (convenience property)
			if (shadows && Array.isArray(shadows)) {
				for (const shadow of shadows) {
					if (shadow.type === 'DROP_SHADOW' || shadow.type === 'INNER_SHADOW') {
						const effect = {
							type: shadow.type,
							color: shadow.color || { r: 0, g: 0, b: 0, a: 0.25 },
							offset: shadow.offset || { x: 0, y: 4 },
							radius: shadow.radius || 4,
							spread: shadow.spread || 0,
							visible: shadow.visible !== false,
							blendMode: shadow.blendMode || 'NORMAL'
						}
						currentEffects.push(effect)
					}
				}
			}

			// Blurs application (convenience property)
			if (blurs && Array.isArray(blurs)) {
				for (const blur of blurs) {
					if (blur.type === 'LAYER_BLUR' || blur.type === 'BACKGROUND_BLUR') {
						const effect = {
							type: blur.type,
							radius: blur.radius || 4,
							visible: blur.visible !== false
						}
						currentEffects.push(effect)
					}
				}
			}

			if (currentEffects.length > 0) {
				textNode.effects = currentEffects
			}
		}

		// Export settings
		if (exportSettings !== undefined) textNode.exportSettings = exportSettings

		// Component properties
		if (componentPropertyReferences !== undefined) textNode.componentPropertyReferences = componentPropertyReferences

		// Relaunch and reactions
		if (relaunch !== undefined) textNode.relaunch = relaunch
		if (reactions !== undefined) textNode.reactions = reactions

		// Add to parent node
		const actualParentId = await appendToParent(textNode, parentId)

		return {
			nodeId: textNode.id,
			id: textNode.id,
			name: textNode.name,
			type: textNode.type,
			x: textNode.x,
			y: textNode.y,
			width: textNode.width,
			height: textNode.height,
			characters: textNode.characters,
			fontSize: textNode.fontSize,
			fontName: textNode.fontName,
			parentId: actualParentId,
			success: true,
			message: `Text "${textNode.name}" created successfully`
		}
	} catch (error) {
		throw new Error(`Failed to create text: ${error.message}`)
	}
}

async function setFillColor(params) {
	// Input validation
	if (!params || !params.nodeId) {
		throw new Error('Missing required parameter: nodeId')
	}
	if (!params.color) {
		throw new Error('Missing required parameter: color')
	}

	const { nodeId, color } = params

	try {
		const node = await figma.getNodeByIdAsync(nodeId)
		if (!node) {
			throw new Error(`Node not found with ID: ${nodeId}`)
		}

		if (!('fills' in node)) {
			throw new Error(`Node type "${node.type}" does not support fill colors`)
		}

		// Color validation and application
		const paintStyle = createColorPaint(color)
		node.fills = [paintStyle]

		return {
			nodeId: node.id,
			id: node.id,
			name: node.name,
			type: node.type,
			fills: [paintStyle],
			success: true,
			message: `Fill color applied to "${node.name}" successfully`
		}
	} catch (error) {
		throw new Error(`Failed to set fill color: ${error.message}`)
	}
}

async function setStrokeColor(params) {
	const {
		nodeId,
		color: { r, g, b, a },
		weight = 1,
	} = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('strokes' in node)) {
		throw new Error(`Node does not support strokes: ${nodeId}`)
	}

	const paintStyle = {
		type: 'SOLID',
		color: {
			r: parseFloat(r) || 0,
			g: parseFloat(g) || 0,
			b: parseFloat(b) || 0,
		},
		opacity: parseFloat(a) || 1,
	}

	node.strokes = [paintStyle]

	if ('strokeWeight' in node) {
		node.strokeWeight = weight
	}

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		strokes: node.strokes,
		strokeWeight: 'strokeWeight' in node ? node.strokeWeight : undefined,
	}
}

async function moveNode(params) {
	const { nodeId, x, y } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (x === undefined || y === undefined) {
		throw new Error('Missing x or y parameters')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('x' in node) || !('y' in node)) {
		throw new Error(`Node does not support position: ${nodeId}`)
	}

	node.x = x
	node.y = y

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		x: node.x,
		y: node.y,
	}
}

async function resizeNode(params) {
	const { nodeId, width, height } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (width === undefined || height === undefined) {
		throw new Error('Missing width or height parameters')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('resize' in node)) {
		throw new Error(`Node does not support resizing: ${nodeId}`)
	}

	node.resize(width, height)

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		width: node.width,
		height: node.height,
	}
}

async function deleteNode(params) {
	const { nodeId } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	// Save node information
	const nodeInfo = {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		type: node.type,
	}

	node.remove()

	return nodeInfo
}

async function cloneNode(params) {
	const { nodeId, x, y } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	const clone = node.clone()

	// Position setting
	if (x !== undefined && y !== undefined) {
		if (!('x' in clone) || !('y' in clone)) {
			throw new Error(`Cloned node does not support position: ${nodeId}`)
		}
		clone.x = x
		clone.y = y
	}

	// Add to same parent
	if (node.parent) {
		node.parent.appendChild(clone)
	} else {
		figma.currentPage.appendChild(clone)
	}

	return {
		nodeId: clone.id,
		id: clone.id,
		name: clone.name,
		x: 'x' in clone ? clone.x : undefined,
		y: 'y' in clone ? clone.y : undefined,
		width: 'width' in clone ? clone.width : undefined,
		height: 'height' in clone ? clone.height : undefined,
	}
}

async function exportNodeAsImage(params) {
	const { nodeId, scale = 1, format = 'PNG' } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('exportAsync' in node)) {
		throw new Error(`Node does not support exporting: ${nodeId}`)
	}

	try {
		const settings = {
			format: format,
			constraint: { type: 'SCALE', value: scale },
		}

		const bytes = await node.exportAsync(settings)

		// Base64 encoding
		const base64 = customBase64Encode(bytes)

		return {
			nodeId,
			format,
			scale,
			imageData: base64,
		}
	} catch (error) {
		throw new Error(`Error exporting node as image: ${error.message}`)
	}
}

// Base64 encoding helper function
function customBase64Encode(bytes) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	let base64 = ''

	const byteLength = bytes.byteLength
	const byteRemainder = byteLength % 3
	const mainLength = byteLength - byteRemainder

	let a, b, c, d
	let chunk

	// Process 3 bytes at a time
	for (let i = 0; i < mainLength; i = i + 3) {
		chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

		a = (chunk & 16515072) >> 18
		b = (chunk & 258048) >> 12
		c = (chunk & 4032) >> 6
		d = chunk & 63

		base64 += chars[a] + chars[b] + chars[c] + chars[d]
	}

	// Process remaining bytes
	if (byteRemainder === 1) {
		chunk = bytes[mainLength]
		a = (chunk & 252) >> 2
		b = (chunk & 3) << 4
		base64 += chars[a] + chars[b] + '=='
	} else if (byteRemainder === 2) {
		chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]
		a = (chunk & 64512) >> 10
		b = (chunk & 1008) >> 4
		c = (chunk & 15) << 2
		base64 += chars[a] + chars[b] + chars[c] + '='
	}

	return base64
}

// New command implementations

async function getNodesInfo(params) {
	const { nodeIds } = params || {}
	
	if (!nodeIds || !Array.isArray(nodeIds)) {
		throw new Error('Missing or invalid nodeIds parameter')
	}

	const results = []
	for (const nodeId of nodeIds) {
		try {
			const node = await figma.getNodeByIdAsync(nodeId)
			if (node) {
				results.push({
					nodeId: node.id,
					id: node.id,
					name: node.name,
					type: node.type,
					visible: node.visible,
					locked: node.locked,
					x: 'x' in node ? node.x : undefined,
					y: 'y' in node ? node.y : undefined,
					width: 'width' in node ? node.width : undefined,
					height: 'height' in node ? node.height : undefined,
					fills: 'fills' in node ? node.fills : undefined,
					strokes: 'strokes' in node ? node.strokes : undefined,
				})
			}
		} catch (error) {
			results.push({
				nodeId: nodeId,
				id: nodeId,
				error: error.message
			})
		}
	}

	return { nodes: results }
}

async function setTextContent(params) {
	const { nodeId, text } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (!text) {
		throw new Error('Missing text parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (node.type !== 'TEXT') {
		throw new Error(`Node is not a text node: ${nodeId}`)
	}

	try {
		await figma.loadFontAsync(node.fontName)
		node.characters = text
	} catch (error) {
		throw new Error(`Error setting text content: ${error.message}`)
	}

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		characters: node.characters,
	}
}

async function getStyles() {
	return {
		paintStyles: figma.getLocalPaintStyles().map(style => ({
			nodeId: style.id,
			id: style.id,
			name: style.name,
			type: style.type,
			paints: style.paints
		})),
		textStyles: figma.getLocalTextStyles().map(style => ({
			nodeId: style.id,
			id: style.id,
			name: style.name,
			type: style.type,
			fontSize: style.fontSize,
			fontName: style.fontName
		})),
		effectStyles: figma.getLocalEffectStyles().map(style => ({
			nodeId: style.id,
			id: style.id,
			name: style.name,
			type: style.type,
			effects: style.effects
		}))
	}
}

async function getLocalComponents() {
	return {
		components: figma.getLocalComponents().map(component => ({
			nodeId: component.id,
			id: component.id,
			name: component.name,
			type: component.type,
			key: component.key,
			description: component.description
		}))
	}
}

async function createComponentInstance(params) {
	const { componentKey, x = 0, y = 0, name, parentId } = params || {}

	if (!componentKey) {
		throw new Error('Missing componentKey parameter')
	}

	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	const component = figma.getLocalComponents().find(comp => comp.key === componentKey)
	if (!component) {
		throw new Error(`Component not found with key: ${componentKey}`)
	}

	const instance = component.createInstance()
	instance.x = x
	instance.y = y
	if (name) {
		instance.name = name
	}

	// Parent node processing (same pattern as other create functions)
	let parentNode = figma.currentPage
	if (parentId) {
		try {
			const parent = await figma.getNodeByIdAsync(parentId)
			if (parent && 'appendChild' in parent) {
				parentNode = parent
			} else {
				console.warn(`Parent node with ID ${parentId} not found or cannot contain children. Using current page.`)
			}
		} catch (error) {
			console.warn(`Error finding parent node ${parentId}:`, error.message, 'Using current page.')
		}
	}

	parentNode.appendChild(instance)

	return {
		nodeId: instance.id,  // Changed to nodeId for consistency
		id: instance.id,      // Maintained for backward compatibility
		name: instance.name,
		x: instance.x,
		y: instance.y,
		componentKey: componentKey,
		mainComponentId: component.id  // Add master component ID
	}
}

async function setCornerRadius(params) {
	const { nodeId, cornerRadius } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (cornerRadius === undefined) {
		throw new Error('Missing cornerRadius parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('cornerRadius' in node)) {
		throw new Error(`Node does not support corner radius: ${nodeId}`)
	}

	node.cornerRadius = cornerRadius

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		cornerRadius: node.cornerRadius,
		success: true,
		message: `Corner radius set to ${cornerRadius} for "${node.name}"`
	}
}

// Opacity setting
async function setOpacity(params) {
	const { nodeId, opacity } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (opacity === undefined || typeof opacity !== 'number') {
		throw new Error('Missing or invalid opacity parameter (must be a number between 0 and 1)')
	}

	if (opacity < 0 || opacity > 1) {
		throw new Error('Opacity must be between 0 and 1')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('opacity' in node)) {
		throw new Error(`Node does not support opacity: ${nodeId}`)
	}

	node.opacity = opacity

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		opacity: node.opacity,
		success: true,
		message: `Opacity set to ${opacity} for "${node.name}"`
	}
}

// Rotation angle setting (convert degrees to radians)
async function setRotation(params) {
	const { nodeId, rotation } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (rotation === undefined || typeof rotation !== 'number') {
		throw new Error('Missing or invalid rotation parameter (must be a number in degrees)')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('rotation' in node)) {
		throw new Error(`Node does not support rotation: ${nodeId}`)
	}

	// Convert degrees to radians
	const radians = (rotation * Math.PI) / 180
	node.rotation = radians

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		rotation: rotation, // Return in degrees
		rotationRadians: node.rotation,
		success: true,
		message: `Rotation set to ${rotation}° for "${node.name}"`
	}
}

// Add drop shadow
async function addDropShadow(params) {
	const { 
		nodeId, 
		offsetX = 0, 
		offsetY = 4, 
		blur = 4, 
		spread = 0,
		color = { r: 0, g: 0, b: 0, a: 0.25 },
		visible = true
	} = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('effects' in node)) {
		throw new Error(`Node does not support effects: ${nodeId}`)
	}

	// Color validation
	const shadowColor = createColorPaint(color)

	const dropShadow = {
		type: 'DROP_SHADOW',
		visible: visible,
		color: shadowColor.color,
		blendMode: 'NORMAL',
		offset: { x: offsetX, y: offsetY },
		radius: blur,
		spread: spread
	}

	// Add new shadow to existing effects
	const currentEffects = node.effects || []
	node.effects = [...currentEffects, dropShadow]

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		effects: node.effects,
		success: true,
		message: `Drop shadow added to "${node.name}"`
	}
}

// Add inner shadow
async function addInnerShadow(params) {
	const { 
		nodeId, 
		offsetX = 0, 
		offsetY = 4, 
		blur = 4, 
		spread = 0,
		color = { r: 0, g: 0, b: 0, a: 0.25 },
		visible = true
	} = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('effects' in node)) {
		throw new Error(`Node does not support effects: ${nodeId}`)
	}

	// 색상 유효성 검사
	const shadowColor = createColorPaint(color)

	const innerShadow = {
		type: 'INNER_SHADOW',
		visible: visible,
		color: shadowColor.color,
		blendMode: 'NORMAL',
		offset: { x: offsetX, y: offsetY },
		radius: blur,
		spread: spread
	}

	// 기존 effects에 새로운 그림자 추가
	const currentEffects = node.effects || []
	node.effects = [...currentEffects, innerShadow]

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		effects: node.effects,
		success: true,
		message: `Inner shadow added to "${node.name}"`
	}
}

// 블러 효과 추가
async function addBlur(params) {
	const { 
		nodeId, 
		radius = 4,
		type = 'LAYER_BLUR', // LAYER_BLUR or BACKGROUND_BLUR
		visible = true
	} = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (typeof radius !== 'number' || radius < 0) {
		throw new Error('Radius must be a positive number')
	}

	if (!['LAYER_BLUR', 'BACKGROUND_BLUR'].includes(type)) {
		throw new Error('Blur type must be either "LAYER_BLUR" or "BACKGROUND_BLUR"')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('effects' in node)) {
		throw new Error(`Node does not support effects: ${nodeId}`)
	}

	const blurEffect = {
		type: type,
		visible: visible,
		radius: radius
	}

	// 기존 effects에 새로운 블러 추가
	const currentEffects = node.effects || []
	node.effects = [...currentEffects, blurEffect]

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		effects: node.effects,
		success: true,
		message: `${type.toLowerCase().replace('_', ' ')} effect (radius: ${radius}) added to "${node.name}"`
	}
}

// 개별 모서리 반경 설정
async function setIndividualCornerRadius(params) {
	const { 
		nodeId, 
		topLeft, 
		topRight, 
		bottomLeft, 
		bottomRight 
	} = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (topLeft === undefined && topRight === undefined && 
		bottomLeft === undefined && bottomRight === undefined) {
		throw new Error('At least one corner radius value must be provided')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	// 개별 corner radius 지원 여부 확인
	if (!('topLeftRadius' in node)) {
		throw new Error(`Node does not support individual corner radius: ${nodeId}`)
	}

	// 각 모서리 반경 설정 (값이 제공된 경우에만)
	if (topLeft !== undefined) {
		if (typeof topLeft !== 'number' || topLeft < 0) {
			throw new Error('topLeft radius must be a non-negative number')
		}
		node.topLeftRadius = topLeft
	}

	if (topRight !== undefined) {
		if (typeof topRight !== 'number' || topRight < 0) {
			throw new Error('topRight radius must be a non-negative number')
		}
		node.topRightRadius = topRight
	}

	if (bottomLeft !== undefined) {
		if (typeof bottomLeft !== 'number' || bottomLeft < 0) {
			throw new Error('bottomLeft radius must be a non-negative number')
		}
		node.bottomLeftRadius = bottomLeft
	}

	if (bottomRight !== undefined) {
		if (typeof bottomRight !== 'number' || bottomRight < 0) {
			throw new Error('bottomRight radius must be a non-negative number')
		}
		node.bottomRightRadius = bottomRight
	}

	return {
		nodeId: node.id,
		id: node.id,
		name: node.name,
		cornerRadii: {
			topLeft: node.topLeftRadius,
			topRight: node.topRightRadius,
			bottomLeft: node.bottomLeftRadius,
			bottomRight: node.bottomRightRadius
		},
		success: true,
		message: `Individual corner radii set for "${node.name}"`
	}
}

async function scanTextNodes(params) {
	const { nodeId } = params || {}
	
	let targetNode
	if (nodeId) {
		targetNode = await figma.getNodeByIdAsync(nodeId)
		if (!targetNode) {
			throw new Error(`Node not found with ID: ${nodeId}`)
		}
	} else {
		targetNode = figma.currentPage
	}

	const textNodes = []
	
	function findTextNodes(node) {
		if (node.type === 'TEXT') {
			textNodes.push({
				nodeId: node.id,
				id: node.id,
				name: node.name,
				characters: node.characters,
				fontSize: node.fontSize,
				fontName: node.fontName,
				x: node.x,
				y: node.y
			})
		}
		
		if ('children' in node) {
			for (const child of node.children) {
				findTextNodes(child)
			}
		}
	}

	findTextNodes(targetNode)

	return { textNodes }
}

async function scanNodesByTypes(params) {
	const { nodeTypes, nodeId } = params || {}

	if (!nodeTypes || !Array.isArray(nodeTypes)) {
		throw new Error('Missing or invalid nodeTypes parameter')
	}

	let targetNode
	if (nodeId) {
		targetNode = await figma.getNodeByIdAsync(nodeId)
		if (!targetNode) {
			throw new Error(`Node not found with ID: ${nodeId}`)
		}
	} else {
		targetNode = figma.currentPage
	}

	const foundNodes = []

	function findNodesByTypes(node) {
		if (nodeTypes.includes(node.type)) {
			foundNodes.push({
				nodeId: node.id,
				id: node.id,
				name: node.name,
				type: node.type,
				x: 'x' in node ? node.x : undefined,
				y: 'y' in node ? node.y : undefined,
				width: 'width' in node ? node.width : undefined,
				height: 'height' in node ? node.height : undefined
			})
		}

		if ('children' in node) {
			for (const child of node.children) {
				findNodesByTypes(child)
			}
		}
	}

	findNodesByTypes(targetNode)

	return { nodes: foundNodes }
}

async function setMultipleTextContents(params) {
	const { updates } = params || {}

	if (!updates || !Array.isArray(updates)) {
		throw new Error('Missing or invalid updates parameter')
	}

	const results = []

	for (const update of updates) {
		try {
			const { nodeId, text } = update
			if (!nodeId || !text) {
				results.push({
					nodeId: nodeId || 'unknown',
					success: false,
					error: 'Missing nodeId or text'
				})
				continue
			}

			const node = await figma.getNodeByIdAsync(nodeId)
			if (!node) {
				results.push({
					nodeId,
					success: false,
					error: 'Node not found'
				})
				continue
			}

			if (node.type !== 'TEXT') {
				results.push({
					nodeId,
					success: false,
					error: 'Node is not a text node'
				})
				continue
			}

			await figma.loadFontAsync(node.fontName)
			node.characters = text

			results.push({
				nodeId,
				success: true,
				name: node.name,
				characters: node.characters
			})

		} catch (error) {
			results.push({
				nodeId: update.nodeId || 'unknown',
				success: false,
				error: error.message
			})
		}
	}

	return { results }
}

async function deleteMultipleNodes(params) {
	const { nodeIds } = params || {}

	if (!nodeIds || !Array.isArray(nodeIds)) {
		throw new Error('Missing or invalid nodeIds parameter')
	}

	const results = []

	for (const nodeId of nodeIds) {
		try {
			const node = await figma.getNodeByIdAsync(nodeId)
			if (!node) {
				results.push({
					nodeId,
					success: false,
					error: 'Node not found'
				})
				continue
			}

			const nodeInfo = {
				nodeId: node.id,
				id: node.id,
				name: node.name,
				type: node.type
			}

			node.remove()

			results.push({
				nodeId,
				success: true,
				...nodeInfo
			})

		} catch (error) {
			results.push({
				nodeId,
				success: false,
				error: error.message
			})
		}
	}

	return { results }
}

async function setLayoutMode(params) {
	const { nodeId, layoutMode } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (!layoutMode) {
		throw new Error('Missing layoutMode parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('layoutMode' in node)) {
		throw new Error(`Node does not support layout mode: ${nodeId}`)
	}

	node.layoutMode = layoutMode

	return {
		id: node.id,
		name: node.name,
		layoutMode: node.layoutMode
	}
}

async function setPadding(params) {
	const { nodeId, paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0 } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('paddingTop' in node)) {
		throw new Error(`Node does not support padding: ${nodeId}`)
	}

	node.paddingTop = paddingTop
	node.paddingRight = paddingRight
	node.paddingBottom = paddingBottom
	node.paddingLeft = paddingLeft

	return {
		id: node.id,
		name: node.name,
		paddingTop: node.paddingTop,
		paddingRight: node.paddingRight,
		paddingBottom: node.paddingBottom,
		paddingLeft: node.paddingLeft
	}
}

async function setAxisAlign(params) {
	const { nodeId, primaryAxisAlignItems, counterAxisAlignItems } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('primaryAxisAlignItems' in node)) {
		throw new Error(`Node does not support axis alignment: ${nodeId}`)
	}

	if (primaryAxisAlignItems) {
		node.primaryAxisAlignItems = primaryAxisAlignItems
	}

	if (counterAxisAlignItems) {
		node.counterAxisAlignItems = counterAxisAlignItems
	}

	return {
		id: node.id,
		name: node.name,
		primaryAxisAlignItems: node.primaryAxisAlignItems,
		counterAxisAlignItems: node.counterAxisAlignItems
	}
}

async function setLayoutSizing(params) {
	const { nodeId, horizontalSizing, verticalSizing } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('layoutSizingHorizontal' in node)) {
		throw new Error(`Node does not support layout sizing: ${nodeId}`)
	}

	if (horizontalSizing) {
		node.layoutSizingHorizontal = horizontalSizing
	}

	if (verticalSizing) {
		node.layoutSizingVertical = verticalSizing
	}

	return {
		id: node.id,
		name: node.name,
		layoutSizingHorizontal: node.layoutSizingHorizontal,
		layoutSizingVertical: node.layoutSizingVertical
	}
}

async function setItemSpacing(params) {
	const { nodeId, itemSpacing } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	if (itemSpacing === undefined) {
		throw new Error('Missing itemSpacing parameter')
	}

	const node = await figma.getNodeByIdAsync(nodeId)
	if (!node) {
		throw new Error(`Node not found with ID: ${nodeId}`)
	}

	if (!('itemSpacing' in node)) {
		throw new Error(`Node does not support item spacing: ${nodeId}`)
	}

	node.itemSpacing = itemSpacing

	return {
		id: node.id,
		name: node.name,
		itemSpacing: node.itemSpacing
	}
}

async function getAnnotations(params) {
	const { nodeId } = params || {}

	// Figma API에서 annotations는 제한적으로 지원되므로 기본 구현만 제공
	return {
		message: 'Annotations API is limited in Figma plugins',
		nodeId: nodeId || 'current_page'
	}
}

async function setAnnotation(params) {
	const { nodeId, text } = params || {}

	if (!nodeId) {
		throw new Error('Missing nodeId parameter')
	}

	// Figma API에서 annotations 설정은 제한적이므로 기본 응답만 제공
	return {
		message: 'Annotation setting is limited in Figma plugins',
		nodeId,
		text: text || ''
	}
}

async function getInstanceOverrides(params) {
	const { sourceInstanceId } = params || {}

	if (!sourceInstanceId) {
		throw new Error('Missing sourceInstanceId parameter')
	}

	const node = await figma.getNodeByIdAsync(sourceInstanceId)
	if (!node) {
		throw new Error(`Node not found with ID: ${sourceInstanceId}`)
	}

	if (node.type !== 'INSTANCE') {
		throw new Error(`Node is not a component instance: ${sourceInstanceId}`)
	}

	// 인스턴스 오버라이드 정보 수집
	const overrides = {}
	
	// 기본 오버라이드 정보만 제공 (Figma API 제한으로 인해)
	return {
		sourceInstanceId,
		mainComponentId: node.mainComponent?.id,
		overridesCount: Object.keys(overrides).length,
		success: true,
		message: 'Instance overrides retrieved (limited by Figma API)'
	}
}

async function setInstanceOverrides(params) {
	const { overrides } = params || {}

	if (!overrides) {
		throw new Error('Missing overrides parameter')
	}

	// 인스턴스 오버라이드 설정은 Figma API에서 제한적이므로 기본 응답만 제공
	return {
		success: true,
		message: 'Instance overrides setting is limited in Figma plugins',
		totalCount: Object.keys(overrides).length
	}
}

async function getReactions(params) {
	const { nodeIds } = params || {}

	if (!nodeIds || !Array.isArray(nodeIds)) {
		return {
			reactions: [],
			message: 'No node IDs provided'
		}
	}

	const reactions = []

	for (const nodeId of nodeIds) {
		try {
			const node = await figma.getNodeByIdAsync(nodeId)
			if (node && 'reactions' in node && node.reactions) {
				reactions.push({
					nodeId,
					reactions: node.reactions.map(reaction => ({
						action: reaction.action,
						trigger: reaction.trigger
					}))
				})
			}
		} catch (error) {
			reactions.push({
				nodeId,
				error: error.message
			})
		}
	}

	return { reactions }
}

async function setDefaultConnector(params) {
	const { connectorId } = params || {}

	if (!connectorId) {
		throw new Error('Missing connectorId parameter')
	}

	// 커넥터 설정은 Figma API에서 제한적이므로 기본 응답만 제공
	return {
		success: true,
		connectorId,
		message: 'Default connector setting is limited in Figma plugins'
	}
}

async function createConnections(params) {
	const { connections } = params || {}

	if (!connections || !Array.isArray(connections)) {
		throw new Error('Missing or invalid connections parameter')
	}

	// 연결 생성은 Figma API에서 제한적이므로 기본 응답만 제공
	return {
		success: true,
		connectionsCount: connections.length,
		message: 'Connection creation is limited in Figma plugins'
	}
}

async function createImageFromUrl(params) {
	const { 
		url, 
		base64Data,
		mimeType,
		x = 0, 
		y = 0, 
		width = 200, 
		height = 200, 
		name, 
		parentId,
		scaleMode = 'FILL',
		cornerRadius = 0
	} = params || {}

	// Validate required parameters
	if (!url && !base64Data) {
		throw new Error('Either Image URL or Base64 data is required')
	}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		let image;
		
		if (base64Data) {
			console.log('Creating image from Base64 data, mimeType:', mimeType)
			
			// Convert base64 to Uint8Array
			const binaryString = atob(base64Data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			
			// Create image from binary data
			image = figma.createImage(bytes);
		} else {
			console.log('Creating image from URL:', url)
			
			// Create image from URL
			image = await figma.createImageAsync(url)
		}
		
		if (!image) {
			throw new Error('Failed to load image from URL - image may not be accessible or valid')
		}
		
		console.log('Image created successfully, hash:', image.hash)
		
		// Create a rectangle to hold the image
		const rect = figma.createRectangle()
		
		// Set position
		rect.x = x
		rect.y = y
		
		// Set size
		rect.resize(width, height)
		
		// Set corner radius if provided
		if (cornerRadius > 0) {
			rect.cornerRadius = cornerRadius
		}
		
		// Set the image as fill with specified scale mode
		const validScaleModes = ['FILL', 'FIT', 'CROP', 'TILE']
		const finalScaleMode = validScaleModes.includes(scaleMode) ? scaleMode : 'FILL'
		
		const fills = [{
			type: 'IMAGE',
			scaleMode: finalScaleMode,
			imageHash: image.hash
		}]
		rect.fills = fills
		
		// Set name
		if (name) {
			rect.name = name
		} else {
			rect.name = `Image from URL ${Date.now()}`
		}
		
		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(rect)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(rect)
			}
		} else {
			figma.currentPage.appendChild(rect)
		}
		
		// Select the created image
		figma.currentPage.selection = [rect]
		figma.viewport.scrollAndZoomIntoView([rect])
		
		return {
			nodeId: rect.id,
			id: rect.id,  // Backward compatibility
			name: rect.name,
			type: rect.type,
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
			cornerRadius: rect.cornerRadius,
			imageUrl: url || null,
			imageSource: base64Data ? 'base64' : 'url',
			imageHash: image.hash,
			scaleMode: finalScaleMode,
			parentId: parentId || null,
			success: true
		}
		
	} catch (error) {
		console.error('Error creating image:', error)
		// 에러 메시지를 더 구체적으로 처리
		let errorMessage = 'Unknown error occurred'
		
		if (error && error.message) {
			errorMessage = error.message
		} else if (typeof error === 'string') {
			errorMessage = error
		} else if (error) {
			errorMessage = error.toString()
		}
		
		// CORS 에러 감지 (URL 방식인 경우만)
		if (url && (errorMessage.includes('fetch') || errorMessage.includes('CORS') || errorMessage.includes('network'))) {
			errorMessage = `Image could not be loaded from URL. This may be due to CORS restrictions, invalid URL, or network issues. URL: ${url}`
		} else if (base64Data && errorMessage.includes('Invalid')) {
			errorMessage = `Invalid Base64 image data provided. Please check the image format and data integrity.`
		}
		
		throw new Error(`Failed to create image from URL: ${errorMessage}`)
	}
}

async function createSlider(params) {
	const {
		x = 0,
		y = 0,
		width = 200,
		height = 40,
		minValue = 0,
		maxValue = 100,
		currentValue = 50,
		name = 'Slider',
		parentId
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		// Create container frame for the slider
		const sliderContainer = figma.createFrame()
		sliderContainer.name = name
		sliderContainer.x = x
		sliderContainer.y = y
		sliderContainer.resize(width, height)
		
		// Set auto layout
		sliderContainer.layoutMode = 'HORIZONTAL'
		sliderContainer.primaryAxisAlignItems = 'CENTER'
		sliderContainer.counterAxisAlignItems = 'CENTER'
		sliderContainer.itemSpacing = 12
		sliderContainer.paddingLeft = 8
		sliderContainer.paddingRight = 8
		sliderContainer.paddingTop = 8
		sliderContainer.paddingBottom = 8
		
		// Create track (background bar)
		const track = figma.createRectangle()
		track.name = 'Track'
		track.resize(width - 80, 4) // Leave space for value label
		track.cornerRadius = 2
		track.fills = [{
			type: 'SOLID',
			color: { r: 0.9, g: 0.9, b: 0.9 }
		}]
		
		// Create progress bar (shows current value)
		const progressWidth = Math.max(8, ((currentValue - minValue) / (maxValue - minValue)) * (width - 80))
		const progress = figma.createRectangle()
		progress.name = 'Progress'
		progress.resize(progressWidth, 4)
		progress.cornerRadius = 2
		progress.fills = [{
			type: 'SOLID',
			color: { r: 0.0, g: 0.5, b: 1.0 }
		}]
		
		// Create thumb (draggable handle)
		const thumb = figma.createEllipse()
		thumb.name = 'Thumb'
		thumb.resize(16, 16)
		thumb.fills = [{
			type: 'SOLID',
			color: { r: 1.0, g: 1.0, b: 1.0 }
		}]
		thumb.strokes = [{
			type: 'SOLID',
			color: { r: 0.8, g: 0.8, b: 0.8 }
		}]
		thumb.strokeWeight = 1
		
		// Position thumb on the progress bar
		thumb.x = progress.width - 8
		thumb.y = -6
		
		// Create value label
		const valueLabel = figma.createText()
		await figma.loadFontAsync({ family: "Inter", style: "Regular" })
		valueLabel.name = 'Value'
		valueLabel.characters = currentValue.toString()
		valueLabel.fontSize = 12
		valueLabel.fills = [{
			type: 'SOLID',
			color: { r: 0.0, g: 0.0, b: 0.0 }
		}]
		
		// Create track container to hold track, progress, and thumb
		const trackContainer = figma.createFrame()
		trackContainer.name = 'Track Container'
		trackContainer.resize(width - 80, 16)
		trackContainer.fills = [] // Transparent
		trackContainer.clipsContent = false
		
		// Add elements to track container
		trackContainer.appendChild(track)
		trackContainer.appendChild(progress)
		trackContainer.appendChild(thumb)
		
		// Position elements within track container
		track.x = 0
		track.y = 6
		progress.x = 0
		progress.y = 6
		
		// Add track container and value label to main container
		sliderContainer.appendChild(trackContainer)
		sliderContainer.appendChild(valueLabel)
		
		// Set layout sizing for responsive behavior
		trackContainer.layoutSizingHorizontal = 'FILL'
		valueLabel.layoutSizingHorizontal = 'HUG'
		
		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(sliderContainer)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(sliderContainer)
			}
		} else {
			figma.currentPage.appendChild(sliderContainer)
		}
		
		// Select the created slider
		figma.currentPage.selection = [sliderContainer]
		figma.viewport.scrollAndZoomIntoView([sliderContainer])
		
		return {
			nodeId: sliderContainer.id,
			id: sliderContainer.id,
			name: sliderContainer.name,
			type: sliderContainer.type,
			x: sliderContainer.x,
			y: sliderContainer.y,
			width: sliderContainer.width,
			height: sliderContainer.height,
			minValue,
			maxValue,
			currentValue,
			parentId: parentId || null,
			components: {
				container: sliderContainer.id,
				trackContainer: trackContainer.id,
				track: track.id,
				progress: progress.id,
				thumb: thumb.id,
				valueLabel: valueLabel.id
			},
			success: true
		}
		
	} catch (error) {
		console.error('Error creating slider:', error)
		throw new Error(`Failed to create slider: ${error.message || error}`)
	}
}

async function createEllipse(params) {
	const {
		x = 0,
		y = 0,
		width = 100,
		height = 100,
		name = 'Ellipse',
		parentId,
		// 모든 Figma API 속성들
		fills,
		fillColor, // 간편 속성 (하위 호환성)
		strokes,
		strokeColor, // 간편 속성 (하위 호환성)  
		strokeWeight,
		strokeCap,
		strokeJoin,
		strokeAlign,
		dashPattern,
		opacity,
		blendMode,
		rotation,
		visible,
		locked,
		effects,
		shadows, // 간편 속성 (하위 호환성)
		blurs, // 간편 속성 (하위 호환성)
		constraints,
		relativeTransform,
		isMask,
		maskType,
		exportSettings,
		relaunch,
		reactions,
		componentPropertyReferences,
		// Ellipse 특화 속성들
		arcData,
		startingAngle,
		endingAngle,
		innerRadius,
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		const ellipse = figma.createEllipse()
		ellipse.x = x
		ellipse.y = y
		ellipse.resize(width, height)
		ellipse.name = name

		// 모든 Figma API 속성들 적용
		
		// 채우기 속성 (fills가 우선, fillColor는 하위 호환성)
		if (fills !== undefined) {
			ellipse.fills = fills
		} else if (fillColor) {
			try {
				const paintStyle = createColorPaint(fillColor)
				ellipse.fills = [paintStyle]
			} catch (error) {
				throw new Error(`Invalid fill color: ${error.message}`)
			}
		}

		// 테두리 속성 (strokes가 우선, strokeColor는 하위 호환성)
		if (strokes !== undefined) {
			ellipse.strokes = strokes
		} else if (strokeColor) {
			try {
				const strokeStyle = createColorPaint(strokeColor)
				ellipse.strokes = [strokeStyle]
			} catch (error) {
				throw new Error(`Invalid stroke color: ${error.message}`)
			}
		}

		// 테두리 관련 속성들
		if (strokeWeight !== undefined) {
			if (typeof strokeWeight !== 'number' || strokeWeight < 0) {
				throw new Error('Stroke weight must be a non-negative number')
			}
			ellipse.strokeWeight = strokeWeight
		}
		if (strokeCap !== undefined) ellipse.strokeCap = strokeCap
		if (strokeJoin !== undefined) ellipse.strokeJoin = strokeJoin
		if (strokeAlign !== undefined) ellipse.strokeAlign = strokeAlign
		if (dashPattern !== undefined) ellipse.dashPattern = dashPattern

		// 외관 속성들
		if (opacity !== undefined) {
			if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
				throw new Error('Opacity must be between 0 and 1')
			}
			ellipse.opacity = opacity
		}
		if (blendMode !== undefined) ellipse.blendMode = blendMode
		if (visible !== undefined) ellipse.visible = visible
		if (locked !== undefined) ellipse.locked = locked
		if (isMask !== undefined) ellipse.isMask = isMask

		// 변형 속성들
		if (rotation !== undefined) {
			if (typeof rotation !== 'number') {
				throw new Error('Rotation must be a number (in degrees)')
			}
			const radians = (rotation * Math.PI) / 180
			ellipse.rotation = radians
		}
		if (relativeTransform !== undefined) ellipse.relativeTransform = relativeTransform

		// 효과 속성들 (effects가 우선, shadows/blurs는 하위 호환성)
		if (effects !== undefined) {
			ellipse.effects = effects
		} else {
			let currentEffects = [...ellipse.effects]
			
			if (shadows && Array.isArray(shadows)) {
				for (const shadow of shadows) {
					if (shadow.type === 'DROP_SHADOW' || shadow.type === 'INNER_SHADOW') {
						const effect = {
							type: shadow.type,
							color: shadow.color || { r: 0, g: 0, b: 0, a: 0.25 },
							offset: shadow.offset || { x: 0, y: 4 },
							radius: shadow.radius || 4,
							spread: shadow.spread || 0,
							visible: shadow.visible !== false,
							blendMode: shadow.blendMode || 'NORMAL'
						}
						currentEffects.push(effect)
					}
				}
			}

			if (blurs && Array.isArray(blurs)) {
				for (const blur of blurs) {
					if (blur.type === 'LAYER_BLUR' || blur.type === 'BACKGROUND_BLUR') {
						const effect = {
							type: blur.type,
							radius: blur.radius || 4,
							visible: blur.visible !== false
						}
						currentEffects.push(effect)
					}
				}
			}
			
			if (shadows || blurs) {
				ellipse.effects = currentEffects
			}
		}

		// 레이아웃 및 제약 조건
		if (constraints !== undefined) ellipse.constraints = constraints

		// 내보내기 설정
		if (exportSettings !== undefined) ellipse.exportSettings = exportSettings

		// Ellipse 특화 속성들
		if (arcData !== undefined) ellipse.arcData = arcData

		// 기타 속성들
		if (relaunch !== undefined) ellipse.relaunch = relaunch
		if (reactions !== undefined) ellipse.reactions = reactions

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(ellipse)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(ellipse)
			}
		} else {
			figma.currentPage.appendChild(ellipse)
		}

		// Select the created ellipse
		figma.currentPage.selection = [ellipse]
		figma.viewport.scrollAndZoomIntoView([ellipse])

		return {
			nodeId: ellipse.id,
			id: ellipse.id,
			name: ellipse.name,
			type: ellipse.type,
			x: ellipse.x,
			y: ellipse.y,
			width: ellipse.width,
			height: ellipse.height,
			parentId: parentId || null,
			success: true
		}

	} catch (error) {
		console.error('Error creating ellipse:', error)
		throw new Error(`Failed to create ellipse: ${error.message || error}`)
	}
}

async function createVectorPath(params) {
	const {
		pathData,
		x = 0,
		y = 0,
		name = 'Vector Path',
		parentId
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	if (!pathData) {
		throw new Error('SVG path data is required')
	}

	try {
		// Create vector node from SVG path
		const vectorNode = figma.createVector()
		vectorNode.name = name
		
		// Parse and set the vector path
		// Note: This is a simplified implementation
		// In a real-world scenario, you'd need a proper SVG path parser
		const parsedPaths = [{
			windingRule: 'NONZERO',
			data: pathData
		}]
		
		vectorNode.vectorPaths = parsedPaths
		vectorNode.x = x
		vectorNode.y = y

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(vectorNode)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(vectorNode)
			}
		} else {
			figma.currentPage.appendChild(vectorNode)
		}

		// Select the created vector
		figma.currentPage.selection = [vectorNode]
		figma.viewport.scrollAndZoomIntoView([vectorNode])

		return {
			nodeId: vectorNode.id,
			id: vectorNode.id,
			name: vectorNode.name,
			type: vectorNode.type,
			x: vectorNode.x,
			y: vectorNode.y,
			width: vectorNode.width,
			height: vectorNode.height,
			pathData,
			parentId: parentId || null,
			success: true
		}

	} catch (error) {
		console.error('Error creating vector path:', error)
		throw new Error(`Failed to create vector path: ${error.message || error}`)
	}
}

async function createButton(params) {
	const {
		x = 0,
		y = 0,
		width = 120,
		height = 40,
		text = 'Button',
		buttonStyle = 'primary',
		name = 'Button',
		parentId
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	try {
		// Create button container frame
		const buttonFrame = figma.createFrame()
		buttonFrame.name = name
		buttonFrame.x = x
		buttonFrame.y = y
		buttonFrame.resize(width, height)
		
		// Set auto layout
		buttonFrame.layoutMode = 'HORIZONTAL'
		buttonFrame.primaryAxisAlignItems = 'CENTER'
		buttonFrame.counterAxisAlignItems = 'CENTER'
		buttonFrame.paddingLeft = 16
		buttonFrame.paddingRight = 16
		buttonFrame.paddingTop = 8
		buttonFrame.paddingBottom = 8
		buttonFrame.cornerRadius = 8

		// Set style based on buttonStyle
		let backgroundColor, textColor
		switch (buttonStyle) {
			case 'primary':
				backgroundColor = { r: 0.0, g: 0.5, b: 1.0 }
				textColor = { r: 1.0, g: 1.0, b: 1.0 }
				break
			case 'secondary':
				backgroundColor = { r: 0.9, g: 0.9, b: 0.9 }
				textColor = { r: 0.0, g: 0.0, b: 0.0 }
				break
			case 'outline':
				backgroundColor = { r: 1.0, g: 1.0, b: 1.0 }
				textColor = { r: 0.0, g: 0.5, b: 1.0 }
				buttonFrame.strokes = [{
					type: 'SOLID',
					color: { r: 0.0, g: 0.5, b: 1.0 }
				}]
				buttonFrame.strokeWeight = 1
				break
			default:
				backgroundColor = { r: 0.0, g: 0.5, b: 1.0 }
				textColor = { r: 1.0, g: 1.0, b: 1.0 }
		}

		buttonFrame.fills = [{
			type: 'SOLID',
			color: backgroundColor
		}]

		// Create button text
		const buttonText = figma.createText()
		await figma.loadFontAsync({ family: "Inter", style: "Medium" })
		buttonText.name = 'Text'
		buttonText.characters = text
		buttonText.fontSize = 14
		buttonText.fills = [{
			type: 'SOLID',
			color: textColor
		}]

		// Add text to button frame
		buttonFrame.appendChild(buttonText)

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(buttonFrame)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(buttonFrame)
			}
		} else {
			figma.currentPage.appendChild(buttonFrame)
		}

		// Select the created button
		figma.currentPage.selection = [buttonFrame]
		figma.viewport.scrollAndZoomIntoView([buttonFrame])

		return {
			nodeId: buttonFrame.id,
			id: buttonFrame.id,
			name: buttonFrame.name,
			type: buttonFrame.type,
			x: buttonFrame.x,
			y: buttonFrame.y,
			width: buttonFrame.width,
			height: buttonFrame.height,
			text,
			buttonStyle,
			parentId: parentId || null,
			components: {
				container: buttonFrame.id,
				text: buttonText.id
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating button:', error)
		throw new Error(`Failed to create button: ${error.message || error}`)
	}
}

async function createBooleanOperation(params) {
	const {
		operation = 'UNION',
		sourceNodeIds = [],
		name = 'Boolean Operation',
		parentId
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	if (!sourceNodeIds || sourceNodeIds.length < 2) {
		throw new Error('At least 2 source nodes are required for boolean operation')
	}

	try {
		// Get source nodes
		const sourceNodes = []
		for (const nodeId of sourceNodeIds) {
			const node = await figma.getNodeByIdAsync(nodeId)
			if (!node) {
				throw new Error(`Source node not found with ID: ${nodeId}`)
			}
			if (!('fills' in node)) {
				throw new Error(`Node ${nodeId} does not support boolean operations`)
			}
			sourceNodes.push(node)
		}

		// Create boolean operation
		const booleanNode = figma.createBooleanOperation()
		booleanNode.name = name
		booleanNode.booleanOperation = operation

		// Add source nodes to boolean operation
		for (const sourceNode of sourceNodes) {
			const clonedNode = sourceNode.clone()
			booleanNode.appendChild(clonedNode)
		}

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(booleanNode)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(booleanNode)
			}
		} else {
			figma.currentPage.appendChild(booleanNode)
		}

		// Select the created boolean operation
		figma.currentPage.selection = [booleanNode]
		figma.viewport.scrollAndZoomIntoView([booleanNode])

		return {
			nodeId: booleanNode.id,
			id: booleanNode.id,
			name: booleanNode.name,
			type: booleanNode.type,
			x: booleanNode.x,
			y: booleanNode.y,
			width: booleanNode.width,
			height: booleanNode.height,
			operation,
			sourceNodeIds,
			parentId: parentId || null,
			success: true
		}

	} catch (error) {
		console.error('Error creating boolean operation:', error)
		throw new Error(`Failed to create boolean operation: ${error.message || error}`)
	}
}

async function createIconFromSvg(params) {
	const {
		svgContent,
		pathData,
		x = 0,
		y = 0,
		width = 24,
		height = 24,
		name = 'Icon',
		parentId
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	if (!svgContent && !pathData) {
		throw new Error('Either SVG content or path data is required')
	}

	try {
		// Create icon frame
		const iconFrame = figma.createFrame()
		iconFrame.name = name
		iconFrame.x = x
		iconFrame.y = y
		iconFrame.resize(width, height)
		iconFrame.fills = [] // Transparent background
		iconFrame.clipsContent = false

		// Create vector from SVG
		let vectorNode
		if (pathData) {
			// Use path data directly
			vectorNode = figma.createVector()
			vectorNode.name = 'Icon Path'
			vectorNode.vectorPaths = [{
				windingRule: 'NONZERO',
				data: pathData
			}]
		} else {
			// Parse SVG content (simplified implementation)
			// In a real implementation, you'd need a proper SVG parser
			vectorNode = figma.createVector()
			vectorNode.name = 'Icon Vector'
			
			// Extract path data from SVG content (basic regex)
			const pathMatch = svgContent.match(/d="([^"]+)"/);
			if (pathMatch) {
				vectorNode.vectorPaths = [{
					windingRule: 'NONZERO',
					data: pathMatch[1]
				}]
			} else {
				throw new Error('Could not extract path data from SVG content')
			}
		}

		// Set vector properties
		vectorNode.fills = [{
			type: 'SOLID',
			color: { r: 0.0, g: 0.0, b: 0.0 }
		}]

		// Scale vector to fit the icon frame
		vectorNode.resize(width, height)
		vectorNode.x = 0
		vectorNode.y = 0

		// Add vector to icon frame
		iconFrame.appendChild(vectorNode)

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(iconFrame)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(iconFrame)
			}
		} else {
			figma.currentPage.appendChild(iconFrame)
		}

		// Select the created icon
		figma.currentPage.selection = [iconFrame]
		figma.viewport.scrollAndZoomIntoView([iconFrame])

		return {
			nodeId: iconFrame.id,
			id: iconFrame.id,
			name: iconFrame.name,
			type: iconFrame.type,
			x: iconFrame.x,
			y: iconFrame.y,
			width: iconFrame.width,
			height: iconFrame.height,
			svgContent: svgContent || null,
			pathData: pathData || null,
			parentId: parentId || null,
			components: {
				container: iconFrame.id,
				vector: vectorNode.id
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating icon from SVG:', error)
		throw new Error(`Failed to create icon from SVG: ${error.message || error}`)
	}
}

// Input Field 생성 함수
async function createInputField(params) {
	try {
		const { x = 0, y = 0, width = 200, height = 40, placeholder = 'Enter text...', inputType = 'text', name = `Input Field ${Date.now()}`, parentId = null } = params

		// Create main input container
		const inputContainer = figma.createFrame()
		inputContainer.name = name
		inputContainer.x = x
		inputContainer.y = y
		inputContainer.resize(width, height)
		inputContainer.layoutMode = 'HORIZONTAL'
		inputContainer.primaryAxisAlignItems = 'CENTER'
		inputContainer.counterAxisAlignItems = 'CENTER'
		inputContainer.paddingLeft = 12
		inputContainer.paddingRight = 12
		inputContainer.paddingTop = 8
		inputContainer.paddingBottom = 8
		inputContainer.cornerRadius = 6

		// Background fill
		inputContainer.fills = [{
			type: 'SOLID',
			color: { r: 1, g: 1, b: 1 }
		}]

		// Border stroke
		inputContainer.strokes = [{
			type: 'SOLID',
			color: { r: 0.8, g: 0.8, b: 0.8 }
		}]
		inputContainer.strokeWeight = 1

		// Input text
		const inputText = figma.createText()
		await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
		inputText.fontName = { family: 'Inter', style: 'Regular' }
		inputText.fontSize = 14
		inputText.characters = placeholder
		inputText.fills = [{
			type: 'SOLID',
			color: { r: 0.6, g: 0.6, b: 0.6 }
		}]
		inputText.layoutGrow = 1

		// Add type indicator for different input types
		if (inputType === 'password') {
			inputText.characters = '••••••••'
		} else if (inputType === 'email') {
			inputText.characters = placeholder.includes('@') ? placeholder : 'example@email.com'
		} else if (inputType === 'number') {
			inputText.characters = '123'
		}

		inputContainer.appendChild(inputText)

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(inputContainer)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(inputContainer)
			}
		} else {
			figma.currentPage.appendChild(inputContainer)
		}

		// Select the created input field
		figma.currentPage.selection = [inputContainer]
		figma.viewport.scrollAndZoomIntoView([inputContainer])

		return {
			nodeId: inputContainer.id,
			id: inputContainer.id,
			name: inputContainer.name,
			type: inputContainer.type,
			x: inputContainer.x,
			y: inputContainer.y,
			width: inputContainer.width,
			height: inputContainer.height,
			placeholder,
			inputType,
			parentId: parentId || null,
			components: {
				container: inputContainer.id,
				text: inputText.id
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating input field:', error)
		throw new Error(`Failed to create input field: ${error.message || error}`)
	}
}

// Checkbox 생성 함수
async function createCheckbox(params) {
	try {
		const { x = 0, y = 0, width = 120, height = 24, label = 'Checkbox', checked = false, name = `Checkbox ${Date.now()}`, parentId = null } = params

		// Create main checkbox container
		const checkboxContainer = figma.createFrame()
		checkboxContainer.name = name
		checkboxContainer.x = x
		checkboxContainer.y = y
		checkboxContainer.resize(width, height)
		checkboxContainer.layoutMode = 'HORIZONTAL'
		checkboxContainer.primaryAxisAlignItems = 'CENTER'
		checkboxContainer.counterAxisAlignItems = 'CENTER'
		checkboxContainer.itemSpacing = 8
		checkboxContainer.fills = []

		// Create checkbox box
		const checkboxBox = figma.createFrame()
		checkboxBox.name = 'Checkbox Box'
		checkboxBox.resize(16, 16)
		checkboxBox.cornerRadius = 2
		checkboxBox.layoutSizingHorizontal = 'FIXED'
		checkboxBox.layoutSizingVertical = 'FIXED'

		// Checkbox box styling
		checkboxBox.fills = [{
			type: 'SOLID',
			color: checked ? { r: 0.2, g: 0.6, b: 1 } : { r: 1, g: 1, b: 1 }
		}]
		checkboxBox.strokes = [{
			type: 'SOLID',
			color: checked ? { r: 0.2, g: 0.6, b: 1 } : { r: 0.8, g: 0.8, b: 0.8 }
		}]
		checkboxBox.strokeWeight = 1

		// Add checkmark if checked
		if (checked) {
			const checkmark = figma.createText()
			await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
			checkmark.fontName = { family: 'Inter', style: 'Regular' }
			checkmark.fontSize = 10
			checkmark.characters = '✓'
			checkmark.fills = [{
				type: 'SOLID',
				color: { r: 1, g: 1, b: 1 }
			}]
			checkmark.textAlignHorizontal = 'CENTER'
			checkmark.textAlignVertical = 'CENTER'
			checkmark.x = 3
			checkmark.y = 1
			checkboxBox.appendChild(checkmark)
		}

		// Create label text
		const labelText = figma.createText()
		await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
		labelText.fontName = { family: 'Inter', style: 'Regular' }
		labelText.fontSize = 14
		labelText.characters = label
		labelText.fills = [{
			type: 'SOLID',
			color: { r: 0.2, g: 0.2, b: 0.2 }
		}]
		labelText.layoutGrow = 1

		checkboxContainer.appendChild(checkboxBox)
		checkboxContainer.appendChild(labelText)

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(checkboxContainer)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(checkboxContainer)
			}
		} else {
			figma.currentPage.appendChild(checkboxContainer)
		}

		// Select the created checkbox
		figma.currentPage.selection = [checkboxContainer]
		figma.viewport.scrollAndZoomIntoView([checkboxContainer])

		return {
			nodeId: checkboxContainer.id,
			id: checkboxContainer.id,
			name: checkboxContainer.name,
			type: checkboxContainer.type,
			x: checkboxContainer.x,
			y: checkboxContainer.y,
			width: checkboxContainer.width,
			height: checkboxContainer.height,
			label,
			checked,
			parentId: parentId || null,
			components: {
				container: checkboxContainer.id,
				box: checkboxBox.id,
				label: labelText.id
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating checkbox:', error)
		throw new Error(`Failed to create checkbox: ${error.message || error}`)
	}
}

// Toggle 생성 함수
async function createToggle(params) {
	try {
		const { x = 0, y = 0, width = 100, height = 32, label = 'Toggle', enabled = false, name = `Toggle ${Date.now()}`, parentId = null } = params

		// Create main toggle container
		const toggleContainer = figma.createFrame()
		toggleContainer.name = name
		toggleContainer.x = x
		toggleContainer.y = y
		toggleContainer.resize(width, height)
		toggleContainer.layoutMode = 'HORIZONTAL'
		toggleContainer.primaryAxisAlignItems = 'CENTER'
		toggleContainer.counterAxisAlignItems = 'CENTER'
		toggleContainer.itemSpacing = 8
		toggleContainer.fills = []

		// Create toggle switch
		const toggleSwitch = figma.createFrame()
		toggleSwitch.name = 'Toggle Switch'
		toggleSwitch.resize(44, 24)
		toggleSwitch.cornerRadius = 12
		toggleSwitch.layoutSizingHorizontal = 'FIXED'
		toggleSwitch.layoutSizingVertical = 'FIXED'
		toggleSwitch.layoutMode = 'HORIZONTAL'
		toggleSwitch.primaryAxisAlignItems = 'CENTER'
		toggleSwitch.counterAxisAlignItems = 'CENTER'
		toggleSwitch.paddingLeft = 2
		toggleSwitch.paddingRight = 2

		// Toggle switch background
		toggleSwitch.fills = [{
			type: 'SOLID',
			color: enabled ? { r: 0.2, g: 0.6, b: 1 } : { r: 0.9, g: 0.9, b: 0.9 }
		}]

		// Create toggle knob
		const toggleKnob = figma.createEllipse()
		toggleKnob.name = 'Toggle Knob'
		toggleKnob.resize(20, 20)
		toggleKnob.fills = [{
			type: 'SOLID',
			color: { r: 1, g: 1, b: 1 }
		}]

		// Position knob based on enabled state
		if (enabled) {
			toggleKnob.x = 22  // Right side when enabled
		} else {
			toggleKnob.x = 2   // Left side when disabled
		}
		toggleKnob.y = 2

		toggleSwitch.appendChild(toggleKnob)

		// Create label text
		const labelText = figma.createText()
		await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
		labelText.fontName = { family: 'Inter', style: 'Regular' }
		labelText.fontSize = 14
		labelText.characters = label
		labelText.fills = [{
			type: 'SOLID',
			color: { r: 0.2, g: 0.2, b: 0.2 }
		}]
		labelText.layoutGrow = 1

		toggleContainer.appendChild(toggleSwitch)
		toggleContainer.appendChild(labelText)

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				parentNode.appendChild(toggleContainer)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', parentError.message)
				figma.currentPage.appendChild(toggleContainer)
			}
		} else {
			figma.currentPage.appendChild(toggleContainer)
		}

		// Select the created toggle
		figma.currentPage.selection = [toggleContainer]
		figma.viewport.scrollAndZoomIntoView([toggleContainer])

		return {
			nodeId: toggleContainer.id,
			id: toggleContainer.id,
			name: toggleContainer.name,
			type: toggleContainer.type,
			x: toggleContainer.x,
			y: toggleContainer.y,
			width: toggleContainer.width,
			height: toggleContainer.height,
			label,
			enabled,
			parentId: parentId || null,
			components: {
				container: toggleContainer.id,
				switch: toggleSwitch.id,
				knob: toggleKnob.id,
				label: labelText.id
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating toggle:', error)
		throw new Error(`Failed to create toggle: ${error.message || error}`)
	}
}

async function createSymbol(params: any) {
	try {
		const { sourceNodeId = null, name = `Symbol ${Date.now()}`, parentId = null } = params

		let sourceNode: SceneNode | null = null

		// Find source node
		if (sourceNodeId) {
			const allNodes = figma.root.findAll()
			sourceNode = allNodes.find(node => node.id === sourceNodeId) as SceneNode
		}

		// If no source node specified or found, use current selection
		if (!sourceNode) {
			if (figma.currentPage.selection.length === 0) {
				throw new Error('No node selected to create symbol from')
			}
			sourceNode = figma.currentPage.selection[0]
		}

		// Clone the source node to avoid modifying the original
		const clonedNode = sourceNode.clone()

		// Create a component from the cloned node
		const component = figma.createComponent()
		component.name = name
		component.appendChild(clonedNode)
		component.resizeWithoutConstraints(clonedNode.width, clonedNode.height)

		// Find parent or use current page
		let parent: BaseNode & ChildrenMixin = figma.currentPage
		if (parentId) {
			const allNodes = figma.root.findAll()
			const foundParent = allNodes.find(node => node.id === parentId && 'children' in node)
			if (foundParent) {
				parent = foundParent as BaseNode & ChildrenMixin
			}
		}

		parent.appendChild(component)

		// Position the component near the original
		if ('x' in sourceNode && 'y' in sourceNode) {
			component.x = sourceNode.x + sourceNode.width + 20
			component.y = sourceNode.y
		}

		// Select the new component and focus on it
		figma.currentPage.selection = [component]
		figma.viewport.scrollAndZoomIntoView([component])

		return {
			result: {
				id: component.id,
				name: component.name,
				type: component.type,
				width: component.width,
				height: component.height,
				x: component.x,
				y: component.y
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating symbol:', error)
		throw new Error(`Failed to create symbol: ${error.message || error}`)
	}
}

async function createAvatar(params: any) {
	try {
		const { x = 0, y = 0, width = 48, height = 48, avatarType = 'initials', avatarText = 'AB', name = `Avatar ${Date.now()}`, parentId = null } = params

		// Create main container frame
		const container = figma.createFrame()
		container.name = name
		container.x = x
		container.y = y
		container.resizeWithoutConstraints(width, height)
		container.layoutMode = 'NONE'
		container.cornerRadius = width / 2 // Circular avatar
		container.clipsContent = true

		// Set background based on avatar type
		if (avatarType === 'image') {
			// Create placeholder for image avatar
			container.fills = [{
				type: 'SOLID',
				color: { r: 0.9, g: 0.9, b: 0.9 }
			}]

			// Add image icon placeholder
			const imageIcon = figma.createEllipse()
			imageIcon.name = 'Image Placeholder'
			imageIcon.resizeWithoutConstraints(width * 0.4, height * 0.4)
			imageIcon.x = width * 0.3
			imageIcon.y = height * 0.3
			imageIcon.fills = [{
				type: 'SOLID',
				color: { r: 0.7, g: 0.7, b: 0.7 }
			}]
			container.appendChild(imageIcon)

		} else {
			// Create initials or emoji avatar
			container.fills = [{
				type: 'SOLID',
				color: { r: 0.3, g: 0.5, b: 0.8 } // Blue background
			}]

			// Add text
			const avatarText_node = figma.createText()
			await figma.loadFontAsync({ family: 'Inter', style: 'Medium' })
			avatarText_node.fontName = { family: 'Inter', style: 'Medium' }
			avatarText_node.characters = avatarText
			avatarText_node.fontSize = Math.max(12, width * 0.4)
			avatarText_node.fills = [{
				type: 'SOLID',
				color: { r: 1, g: 1, b: 1 } // White text
			}]
			avatarText_node.textAlignHorizontal = 'CENTER'
			avatarText_node.textAlignVertical = 'CENTER'
			
			// Center the text
			avatarText_node.x = (width - avatarText_node.width) / 2
			avatarText_node.y = (height - avatarText_node.height) / 2
			
			container.appendChild(avatarText_node)
		}

		// Find parent or use current page
		let parent: BaseNode & ChildrenMixin = figma.currentPage
		if (parentId) {
			const allNodes = figma.root.findAll()
			const foundParent = allNodes.find(node => node.id === parentId && 'children' in node)
			if (foundParent) {
				parent = foundParent as BaseNode & ChildrenMixin
			}
		}

		parent.appendChild(container)

		// Select the new avatar and focus on it
		figma.currentPage.selection = [container]
		figma.viewport.scrollAndZoomIntoView([container])

		return {
			result: {
				id: container.id,
				name: container.name,
				type: container.type,
				width: container.width,
				height: container.height,
				x: container.x,
				y: container.y,
				avatarType: avatarType
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating avatar:', error)
		throw new Error(`Failed to create avatar: ${error.message || error}`)
	}
}

async function createProgressBar(params: any) {
	try {
		const { x = 0, y = 0, width = 200, height = 8, progress = 50, progressStyle = 'linear', showProgressText = true, name = `Progress Bar ${Date.now()}`, parentId = null } = params

		// Create main container
		const container = figma.createFrame()
		container.name = name
		container.x = x
		container.y = y
		container.layoutMode = 'NONE'

		if (progressStyle === 'circular') {
			// Create circular progress
			const size = Math.max(width, height)
			container.resizeWithoutConstraints(size, size)
			
			// Background circle
			const bgCircle = figma.createEllipse()
			bgCircle.name = 'Background'
			bgCircle.resizeWithoutConstraints(size, size)
			bgCircle.fills = []
			bgCircle.strokes = [{
				type: 'SOLID',
				color: { r: 0.9, g: 0.9, b: 0.9 }
			}]
			bgCircle.strokeWeight = size * 0.1
			container.appendChild(bgCircle)

			// Progress arc (simplified as a partial circle)
			const progressCircle = figma.createEllipse()
			progressCircle.name = 'Progress'
			progressCircle.resizeWithoutConstraints(size, size)
			progressCircle.fills = []
			progressCircle.strokes = [{
				type: 'SOLID',
				color: { r: 0.2, g: 0.6, b: 1.0 }
			}]
			progressCircle.strokeWeight = size * 0.1
			// Note: Figma doesn't support arc stroking directly, so this is a full circle representation
			container.appendChild(progressCircle)

			// Progress text in center
			if (showProgressText) {
				const progressText = figma.createText()
				await figma.loadFontAsync({ family: 'Inter', style: 'Medium' })
				progressText.fontName = { family: 'Inter', style: 'Medium' }
				progressText.characters = `${progress}%`
				progressText.fontSize = size * 0.15
				progressText.fills = [{
					type: 'SOLID',
					color: { r: 0.2, g: 0.2, b: 0.2 }
				}]
				progressText.textAlignHorizontal = 'CENTER'
				progressText.textAlignVertical = 'CENTER'
				progressText.x = (size - progressText.width) / 2
				progressText.y = (size - progressText.height) / 2
				container.appendChild(progressText)
			}

		} else {
			// Create linear progress
			container.resizeWithoutConstraints(width, height)
			
			// Background bar
			const bgBar = figma.createRectangle()
			bgBar.name = 'Background'
			bgBar.resizeWithoutConstraints(width, height)
			bgBar.cornerRadius = height / 2
			bgBar.fills = [{
				type: 'SOLID',
				color: { r: 0.9, g: 0.9, b: 0.9 }
			}]
			container.appendChild(bgBar)

			// Progress bar
			const progressBar = figma.createRectangle()
			progressBar.name = 'Progress'
			const progressWidth = (width * progress) / 100
			progressBar.resizeWithoutConstraints(progressWidth, height)
			progressBar.cornerRadius = height / 2
			progressBar.fills = [{
				type: 'SOLID',
				color: { r: 0.2, g: 0.6, b: 1.0 }
			}]
			container.appendChild(progressBar)

			// Progress text
			if (showProgressText) {
				const progressText = figma.createText()
				await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
				progressText.fontName = { family: 'Inter', style: 'Regular' }
				progressText.characters = `${progress}%`
				progressText.fontSize = Math.max(10, height * 0.7)
				progressText.fills = [{
					type: 'SOLID',
					color: { r: 0.2, g: 0.2, b: 0.2 }
				}]
				progressText.x = width + 8
				progressText.y = (height - progressText.height) / 2
				container.appendChild(progressText)
				
				// Extend container to include text
				container.resizeWithoutConstraints(width + progressText.width + 8, height)
			}
		}

		// Find parent or use current page
		let parent: BaseNode & ChildrenMixin = figma.currentPage
		if (parentId) {
			const allNodes = figma.root.findAll()
			const foundParent = allNodes.find(node => node.id === parentId && 'children' in node)
			if (foundParent) {
				parent = foundParent as BaseNode & ChildrenMixin
			}
		}

		parent.appendChild(container)

		// Select the new progress bar and focus on it
		figma.currentPage.selection = [container]
		figma.viewport.scrollAndZoomIntoView([container])

		return {
			result: {
				id: container.id,
				name: container.name,
				type: container.type,
				width: container.width,
				height: container.height,
				x: container.x,
				y: container.y,
				progress: progress,
				progressStyle: progressStyle
			},
			success: true
		}

	} catch (error) {
		console.error('Error creating progress bar:', error)
		throw new Error(`Failed to create progress bar: ${error.message || error}`)
	}
}

// SVG를 Figma 벡터로 변환하는 함수
async function createSvgToVector(params: any) {
	const {
		svgContent,
		x = 0,
		y = 0,
		width,
		height,
		name = `SVG Vector ${Date.now()}`,
		parentId = null
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	if (!svgContent) {
		throw new Error('SVG content is required')
	}

	try {
		// Create a frame to contain the SVG
		const container = figma.createFrame()
		container.name = name
		container.x = x
		container.y = y
		container.fills = [] // Transparent background
		container.clipsContent = false

		// Figma의 기본 SVG 변환 API 사용
		try {
			// figma.createNodeFromSvg를 사용해서 SVG를 Figma 노드로 변환
			const svgNode = figma.createNodeFromSvg(svgContent)
			
			// 컨테이너 크기를 SVG 노드에 맞게 조정
			if (width && height) {
				container.resize(width, height)
				// SVG 노드 크기도 조정
				if ('resize' in svgNode) {
					svgNode.resize(width, height)
				}
			} else {
				// SVG 노드의 크기에 맞게 컨테이너 조정
				if ('width' in svgNode && 'height' in svgNode) {
					container.resize(svgNode.width, svgNode.height)
				} else {
					container.resize(100, 100)
				}
			}

			// 생성된 SVG 노드의 이름 설정
			svgNode.name = `${name} SVG`
			
			// 위치 설정
			svgNode.x = 0
			svgNode.y = 0
			
			container.appendChild(svgNode)

		} catch (svgApiError) {
			console.warn('figma.createNodeFromSvg failed, using fallback method:', svgApiError)
			
			// 폴백: 기존 방식으로 SVG 파싱
			const svgMatch = svgContent.match(/<svg[^>]*>/i)
			if (!svgMatch) {
				throw new Error('Invalid SVG content: No SVG element found')
			}

			// SVG 크기 추출
			let svgWidth = width
			let svgHeight = height

			if (!width || !height) {
				const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/i)
				const widthMatch = svgContent.match(/width=["']([^"']+)["']/i)
				const heightMatch = svgContent.match(/height=["']([^"']+)["']/i)

				if (viewBoxMatch) {
					const viewBox = viewBoxMatch[1].split(/\s+/)
					svgWidth = svgWidth || parseFloat(viewBox[2]) || 100
					svgHeight = svgHeight || parseFloat(viewBox[3]) || 100
				} else if (widthMatch && heightMatch) {
					svgWidth = svgWidth || parseFloat(widthMatch[1]) || 100
					svgHeight = svgHeight || parseFloat(heightMatch[1]) || 100
				} else {
					svgWidth = svgWidth || 100
					svgHeight = svgHeight || 100
				}
			}

			container.resize(svgWidth, svgHeight)

			// path 요소들 추출하여 벡터 노드 생성
			const pathMatches = svgContent.match(/<path[^>]*d=["']([^"']+)["'][^>]*>/gi)
			
			if (pathMatches && pathMatches.length > 0) {
				try {
					const pathMatch = pathMatches[0].match(/d=["']([^"']+)["']/i)
					if (pathMatch) {
						const pathData = pathMatch[1]
						const vectorNode = figma.createVector()
						vectorNode.name = `${name} Vector`
						
						try {
							vectorNode.vectorPaths = [{
								windingRule: 'NONZERO',
								data: pathData
							}]
							
							// 스타일 적용
							const fillMatch = svgContent.match(/fill=["']([^"']+)["']/i)
							const strokeMatch = svgContent.match(/stroke=["']([^"']+)["']/i)
							const strokeWidthMatch = svgContent.match(/stroke-width=["']([^"']+)["']/i)

							if (fillMatch && fillMatch[1] !== 'none') {
								const fillColor = parseColor(fillMatch[1])
								if (fillColor) {
									vectorNode.fills = [{
										type: 'SOLID',
										color: fillColor
									}]
								}
							}

							if (strokeMatch && strokeMatch[1] !== 'none') {
								const strokeColor = parseColor(strokeMatch[1])
								const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : 1
								if (strokeColor) {
									vectorNode.strokes = [{
										type: 'SOLID',
										color: strokeColor
									}]
									vectorNode.strokeWeight = strokeWidth
								}
							}
							
							container.appendChild(vectorNode)
						} catch (pathError) {
							console.warn('Failed to set vector path:', pathError)
							// 기본 사각형으로 폴백
							const rect = figma.createRectangle()
							rect.name = `${name} Fallback`
							rect.resize(svgWidth, svgHeight)
							rect.fills = [{
								type: 'SOLID',
								color: { r: 0.8, g: 0.8, b: 0.8 }
							}]
							container.appendChild(rect)
						}
					}
				} catch (fallbackError) {
					console.warn('Fallback method failed:', fallbackError)
					// 최종 폴백: 기본 프레임
					const fallbackFrame = figma.createFrame()
					fallbackFrame.name = `${name} Placeholder`
					fallbackFrame.resize(svgWidth || 100, svgHeight || 100)
					fallbackFrame.fills = [{
						type: 'SOLID',
						color: { r: 0.9, g: 0.9, b: 0.9 }
					}]
					container.appendChild(fallbackFrame)
				}
			} else {
				// path가 없는 경우 기본 프레임 생성
				const placeholderFrame = figma.createFrame()
				placeholderFrame.name = `${name} No Path`
				placeholderFrame.resize(svgWidth, svgHeight)
				placeholderFrame.fills = [{
					type: 'SOLID',
					color: { r: 0.7, g: 0.7, b: 0.7 }
				}]
				container.appendChild(placeholderFrame)
			}
		}

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				(parentNode as ChildrenMixin).appendChild(container)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', (parentError as Error).message)
				figma.currentPage.appendChild(container)
			}
		} else {
			figma.currentPage.appendChild(container)
		}

		// Select the created vector
		figma.currentPage.selection = [container]
		figma.viewport.scrollAndZoomIntoView([container])

		return {
			nodeId: container.id,
			id: container.id,
			name: container.name,
			type: container.type,
			x: container.x,
			y: container.y,
			width: container.width,
			height: container.height,
			childrenCount: container.children.length,
			success: true
		}

	} catch (error) {
		console.error('Error creating SVG vector:', error)
		throw new Error(`Failed to create SVG vector: ${(error as Error).message || error}`)
	}
}

// 사용자 정의 JSON 명령 실행 함수
async function executeCustomCommand(params: any) {
	const {
		customJson,
		nodeType = 'FRAME',
		x = 0,
		y = 0,
		name = `Custom Node ${Date.now()}`,
		parentId = null
	} = params || {}

	// Design 모드 체크
	if (figma.editorType !== 'figma') {
		throw new Error('Node creation is only available in Design mode')
	}

	if (!customJson) {
		throw new Error('Custom JSON is required')
	}

	try {
		let customData
		if (typeof customJson === 'string') {
			customData = JSON.parse(customJson)
		} else {
			customData = customJson
		}

		// 노드 타입에 따라 생성
		let node
		const upperNodeType = (customData.type || nodeType).toUpperCase()

		switch (upperNodeType) {
			case 'FRAME':
				node = figma.createFrame()
				break
			case 'RECTANGLE':
				node = figma.createRectangle()
				break
			case 'ELLIPSE':
				node = figma.createEllipse()
				break
			case 'TEXT':
				node = figma.createText()
				// 기본 폰트 로드
				await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
				node.fontName = { family: 'Inter', style: 'Regular' }
				break
			case 'VECTOR':
				node = figma.createVector()
				break
			case 'LINE':
				node = figma.createLine()
				break
			case 'STAR':
				node = figma.createStar()
				break
			case 'POLYGON':
				node = figma.createPolygon()
				break
			default:
				node = figma.createFrame()
		}

		// 기본 속성 설정
		node.name = customData.name || name
		if ('x' in customData) node.x = customData.x
		else node.x = x
		if ('y' in customData) node.y = customData.y
		else node.y = y

		// 크기 설정
		if (customData.width && customData.height) {
			node.resize(customData.width, customData.height)
		} else if ('resize' in node) {
			node.resize(100, 100) // 기본 크기
		}

		// Figma API 속성들 적용
		const applyableProps = [
			'visible', 'opacity', 'rotation', 'cornerRadius', 
			'fills', 'strokes', 'strokeWeight', 'strokeAlign',
			'strokeCap', 'strokeJoin', 'strokeMiterLimit',
			'effects', 'blendMode', 'isMask', 'constraints',
			'layoutMode', 'primaryAxisSizingMode', 'counterAxisSizingMode',
			'primaryAxisAlignItems', 'counterAxisAlignItems',
			'itemSpacing', 'padding', 'paddingLeft', 'paddingRight',
			'paddingTop', 'paddingBottom', 'clipsContent'
		]

		applyableProps.forEach(prop => {
			if (prop in customData && prop in node) {
				try {
					(node as any)[prop] = customData[prop]
				} catch (propError) {
					console.warn(`Failed to apply property ${prop}:`, propError)
				}
			}
		})

		// 텍스트 특수 처리
		if (upperNodeType === 'TEXT' && customData.characters && 'characters' in node) {
			(node as TextNode).characters = customData.characters
		}

		// 벡터 특수 처리
		if (upperNodeType === 'VECTOR' && customData.vectorPaths && 'vectorPaths' in node) {
			try {
				(node as VectorNode).vectorPaths = customData.vectorPaths
			} catch (vectorError) {
				console.warn('Failed to apply vector paths:', vectorError)
			}
		}

		// Add to parent or current page
		if (parentId) {
			try {
				const parentNode = await figma.getNodeByIdAsync(parentId)
				if (!parentNode) {
					throw new Error(`Parent node not found with ID: ${parentId}`)
				}
				if (!('appendChild' in parentNode)) {
					throw new Error(`Parent node does not support children: ${parentId}`)
				}
				(parentNode as ChildrenMixin).appendChild(node)
			} catch (parentError) {
				console.warn('Failed to add to parent, adding to current page:', (parentError as Error).message)
				figma.currentPage.appendChild(node)
			}
		} else {
			figma.currentPage.appendChild(node)
		}

		// Select the created node
		figma.currentPage.selection = [node]
		figma.viewport.scrollAndZoomIntoView([node])

		return {
			nodeId: node.id,
			id: node.id,
			name: node.name,
			type: node.type,
			x: node.x,
			y: node.y,
			width: 'width' in node ? node.width : undefined,
			height: 'height' in node ? node.height : undefined,
			appliedProperties: Object.keys(customData),
			success: true
		}

	} catch (error) {
		console.error('Error executing custom command:', error)
		throw new Error(`Failed to execute custom command: ${(error as Error).message || error}`)
	}
}

// 색상 파싱 헬퍼 함수
function parseColor(colorString: string) {
	if (!colorString || colorString === 'none') return null

	// hex 색상
	if (colorString.startsWith('#')) {
		const hex = colorString.substring(1)
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16) / 255
			const g = parseInt(hex[1] + hex[1], 16) / 255
			const b = parseInt(hex[2] + hex[2], 16) / 255
			return { r, g, b }
		} else if (hex.length === 6) {
			const r = parseInt(hex.substring(0, 2), 16) / 255
			const g = parseInt(hex.substring(2, 4), 16) / 255
			const b = parseInt(hex.substring(4, 6), 16) / 255
			return { r, g, b }
		}
	}

	// RGB 색상
	const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
	if (rgbMatch) {
		return {
			r: parseInt(rgbMatch[1]) / 255,
			g: parseInt(rgbMatch[2]) / 255,
			b: parseInt(rgbMatch[3]) / 255
		}
	}

	// 기본 색상명들
	const colorMap = {
		'black': { r: 0, g: 0, b: 0 },
		'white': { r: 1, g: 1, b: 1 },
		'red': { r: 1, g: 0, b: 0 },
		'green': { r: 0, g: 1, b: 0 },
		'blue': { r: 0, g: 0, b: 1 },
		'yellow': { r: 1, g: 1, b: 0 },
		'cyan': { r: 0, g: 1, b: 1 },
		'magenta': { r: 1, g: 0, b: 1 }
	}

	return colorMap[colorString.toLowerCase() as keyof typeof colorMap] || null
}
