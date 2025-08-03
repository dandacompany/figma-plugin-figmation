import React, { useState, useEffect, useRef } from 'react'
import Icon from './components/Icon'
import Input from './components/Input'
import Button from './components/Button'
import Tooltip from './components/Tooltip'
import './App.css' // Import CSS for styles

const App: React.FC = () => {
	const [serverPort, setServerPort] = useState<number>(3055)
	const [channelId, setChannelId] = useState<string>('hellofigma')
	const [isConnected, setIsConnected] = useState<boolean>(false)
	const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected')
	const [selectionInfo, setSelectionInfo] = useState<any[]>([])
	const [commandHistory, setCommandHistory] = useState<any[]>([])
	const [activeTab, setActiveTab] = useState<string>('connection')
	const [channelList, setChannelList] = useState<any[]>([])
	const [currentChannel, setCurrentChannel] = useState<any>(null)
	const [isSetupInstructionsExpanded, setIsSetupInstructionsExpanded] = useState<boolean>(false)
	const [copiedId, setCopiedId] = useState<string | null>(null)
	
	// WebSocket reference
	const wsRef = useRef<WebSocket | null>(null)
	const commandIdCounter = useRef(0)
	const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null)
	const pingInterval = useRef<NodeJS.Timeout | null>(null)
	const lastPongTime = useRef<number>(Date.now())

		// Server URL calculation - simplified for localhost only (no path)
	const serverUrl = `ws://localhost:${serverPort}`
	
	// Debug logging
	// console.log('🔍 URL Debug Info:', {
	// 	serverPort,
	// 	channelId,
	// 	finalUrl: serverUrl
	// })

	// Handle messages from the plugin
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data.pluginMessage
			
			if (!message) return

			switch (message.type) {
				case 'init-settings':
					if (message.settings.serverPort) {
						setServerPort(message.settings.serverPort)
					}
					if (message.settings.serverHost) {
						setServerHost(message.settings.serverHost)
					}
					if (message.settings.channelId) {
						setChannelId(message.settings.channelId)
					}
					break
				
				case 'auto-connect':
					// Auto-connect attempt
					connectToWebSocket()
					break
				
				case 'selection-changed':
					console.log('Selection changed:', message.selection)
					setSelectionInfo(message.selection?.nodes || [])
					break
				
				case 'command-result':
					handleCommandResult(message.id, message.result)
					break
				
				case 'command-error':
					handleCommandError(message.id, message.error)
					break
				
				case 'execute-copy':
					// Execute copy in UI context
					try {
						const textArea = document.createElement('textarea')
						textArea.value = message.text
						textArea.style.position = 'fixed'
						textArea.style.left = '-999999px'
						document.body.appendChild(textArea)
						textArea.select()
						document.execCommand('copy')
						document.body.removeChild(textArea)
					} catch (err) {
						console.error('Failed to execute copy:', err)
					}
					break
				
			}
		}

		window.addEventListener('message', handleMessage)
		return () => {
			window.removeEventListener('message', handleMessage)
		}
	}, [])

	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			console.log('Component unmounting - cleaning up resources...')
			
			// Close WebSocket connection
			if (wsRef.current) {
				console.log('Closing WebSocket on component unmount')
				wsRef.current.close()
				wsRef.current = null
			}
			
			// Clear connection check interval
			if (connectionCheckInterval.current) {
				console.log('Clearing connection check interval on component unmount')
				clearInterval(connectionCheckInterval.current)
				connectionCheckInterval.current = null
			}
			
			// Clear ping interval
			if (pingInterval.current) {
				console.log('Clearing ping interval on component unmount')
				clearInterval(pingInterval.current)
				pingInterval.current = null
			}
		}
	}, [])

	// WebSocket connection
	const connectToWebSocket = () => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return
		}

		setConnectionStatus('Connecting...')
		
		try {
					console.log('🔌 Attempting to connect to:', serverUrl)
		console.log('🔍 Connection details:', {
			url: serverUrl,
			port: serverPort,
			channel: channelId
		})
			const ws = new WebSocket(serverUrl)
			
			ws.onopen = () => {
				console.log('WebSocket connected')
				setIsConnected(true)
				setConnectionStatus('Connected')
				wsRef.current = ws
				
				// Set connection time to lastPongTime
				lastPongTime.current = Date.now()
				console.log('Initial lastPongTime set to:', lastPongTime.current)
				
				// Connection success message (including channel ID)
				const registerMessage = {
					type: 'register',
					clientType: 'figma',
					clientId: 'figma_plugin_' + Date.now(),
					channelId: channelId || 'hellofigma', // Use default channel ID
					message: 'Figma plugin connected'
				}
				console.log('Sending register message:', registerMessage)
				ws.send(JSON.stringify(registerMessage))
				
				// Start periodic connection status check
				startConnectionCheck()
			}

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					// console.log('Received message:', data)
					
					// Handle ping/pong response
					if (data.type === 'pong') {
						// console.log('Received pong response')
						lastPongTime.current = Date.now()
						return
					}
					
					// Handle registration success response
					if (data.type === 'registration_success') {
						console.log('Registration successful:', data)
						setCurrentChannel({
							id: data.channelId,
							clientId: data.clientId
						})
						// Update with channel ID assigned by server
						setChannelId(data.channelId)
						return
					}
					
					// Handle registration error
					if (data.type === 'registration_error') {
						console.error('Registration failed:', data.error)
						setConnectionStatus('Registration Failed: ' + data.error)
						setIsConnected(false)
						return
					}
					
					// Handle new channel creation broadcast
					if (data.type === 'channel_created_broadcast') {
						console.log('New channel created:', data.channelId, data.channelName)
						console.log('Setting channel ID to:', data.channelId)
						// Automatically set channel ID
						setChannelId(data.channelId)
						// Show notification message
						setConnectionStatus(`Channel "${data.channelId}" is ready for connection!`)
						console.log('Channel ID set successfully')
						return
					}
					
					// Handle channel list update
					if (data.type === 'channel_list') {
						console.log('Channel list updated:', data.channels)
						setChannelList(data.channels)
						return
					}
					
						// Handle external command
	if (data.type === 'command') {
		console.log('📨 External command received:', data);
		executeCommand(data)
	}
				} catch (error) {
					console.error('Error parsing message:', error)
				}
			}

			ws.onerror = (error) => {
				console.error('WebSocket error:', error)
				setConnectionStatus('Connection Error')
			}

			ws.onclose = (event) => {
				console.log('WebSocket disconnected:', event.code, event.reason)
				setIsConnected(false)
				setConnectionStatus('Disconnected')
				wsRef.current = null
				
				// Clean up connection check interval
				if (connectionCheckInterval.current) {
					clearInterval(connectionCheckInterval.current)
					connectionCheckInterval.current = null
				}
			}
		} catch (error) {
			console.error('Failed to connect:', error)
			setConnectionStatus('Failed to Connect')
		}
	}

	// Send ping message
	const sendPing = () => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			// console.log('Sending ping...')
			try {
				wsRef.current.send(JSON.stringify({ type: 'ping' }))
			} catch (error) {
				console.error('Error sending ping:', error)
			}
		} else {
			console.log('Cannot send ping - WebSocket not ready. State:', wsRef.current?.readyState)
		}
	}

	// Periodic connection status check
	const startConnectionCheck = () => {
		// console.log('Starting connection check interval...')
		
		// Clean up existing intervals
		if (connectionCheckInterval.current) {
			// console.log('Clearing existing connection check interval')
			clearInterval(connectionCheckInterval.current)
		}
		if (pingInterval.current) {
			// console.log('Clearing existing ping interval')
			clearInterval(pingInterval.current)
		}
		
		// Limit automatic reconnection attempts
		let reconnectAttempts = 0
		const maxReconnectAttempts = 5
		
		// Send ping every 5 seconds (fast server status detection)
		pingInterval.current = setInterval(() => {
			// console.log('Ping interval triggered')
			sendPing()
		}, 5000)
		
		// Check connection status every 5 seconds (fast server status detection)
		connectionCheckInterval.current = setInterval(() => {
			// console.log('Connection check running...')
			
			if (wsRef.current) {
				const readyState = wsRef.current.readyState
				const timeSinceLastPong = Date.now() - lastPongTime.current
				
				// console.log('WebSocket readyState:', readyState, {
				// 	CONNECTING: WebSocket.CONNECTING,
				// 	OPEN: WebSocket.OPEN,
				// 	CLOSING: WebSocket.CLOSING,
				// 	CLOSED: WebSocket.CLOSED
				// })
				// console.log('Time since last pong:', timeSinceLastPong, 'ms')
				
				// Connection status monitoring (readyState + ping/pong based)
				if (readyState === WebSocket.CLOSED || 
					readyState === WebSocket.CLOSING || 
					timeSinceLastPong > 30000) { // Consider connection lost if no pong for 30+ seconds
					// console.log('Connection lost - updating status')
					// console.log('Reason:', {
					// 	readyStateClosed: readyState === WebSocket.CLOSED,
					// 	readyStateClosing: readyState === WebSocket.CLOSING,
					// 	timeoutExceeded: timeSinceLastPong > 30000,
					// 	timeSinceLastPong
					// })
					
					setIsConnected(false)
					setConnectionStatus('Disconnected')
					wsRef.current = null
					
					// Automatic reconnection attempt
					if (reconnectAttempts < maxReconnectAttempts) {
						reconnectAttempts++
						console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`)
						
						// Attempt reconnection after 3 seconds
						setTimeout(() => {
							console.log('Attempting automatic reconnection...')
							connectToWebSocket()
						}, 3000)
					} else {
						console.log('Max reconnection attempts reached, stopping auto-reconnect')
					}
				} else {
					// Update status when connection is active
					if (!isConnected) {
						// console.log('Connection restored - updating status')
						setIsConnected(true)
						setConnectionStatus('Connected')
					}
					// console.log('Connection is still active')
				}
			} else {
				console.log('No WebSocket reference found')
			}
		}, 5000)
		
		// console.log('Connection check interval started')
	}

	// Disconnect WebSocket
	const disconnectWebSocket = () => {
		console.log('Disconnecting WebSocket...')
		
		if (wsRef.current) {
			console.log('Closing WebSocket connection')
			wsRef.current.close()
			wsRef.current = null
		}
		
		// Clean up connection check interval
		if (connectionCheckInterval.current) {
			console.log('Clearing connection check interval on manual disconnect')
			clearInterval(connectionCheckInterval.current)
			connectionCheckInterval.current = null
		}
		
		// Clean up ping interval
		if (pingInterval.current) {
			console.log('Clearing ping interval on manual disconnect')
			clearInterval(pingInterval.current)
			pingInterval.current = null
		}
	}

	// Execute external command
	const executeCommand = (commandData: any) => {
		// Use command ID sent from WebSocket server
		const commandId = commandData.id || `cmd_${commandIdCounter.current++}`
		
		console.log('🔧 Command execution started:', { commandId, command: commandData.command, params: commandData.params });
		
		// Add command to history
		const newCommand = {
			id: commandId,
			command: commandData.command,
			params: commandData.params,
			timestamp: new Date().toISOString(),
			status: 'executing'
		}
		
		setCommandHistory(prev => [newCommand, ...prev].slice(0, 50))
		
		// Send command to plugin
		window.parent.postMessage(
			{
				pluginMessage: {
					type: 'execute-command',
					id: commandId,
					command: commandData.command,
					params: commandData.params
				}
			},
			'*'
		)
	}

	// 명령 결과 처리
	const copyToClipboard = async (text: string, id: string) => {
		try {
			// Figma 플러그인에서 클립보드 복사 처리
			// 메인 스레드로 메시지 전송
			parent.postMessage({
				pluginMessage: {
					type: 'copy-to-clipboard',
					text: text
				}
			}, '*')
			
			// UI 상태 업데이트
			setCopiedId(id)
			
			// 2초 후 상태 초기화
			setTimeout(() => {
				setCopiedId(null)
			}, 2000)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}

	const handleCommandResult = (commandId: string, result: any) => {
		console.log('✅ Command result processing:', { commandId, result });
		
		// Update command history
		setCommandHistory(prev => 
			prev.map(cmd => 
				cmd.id === commandId 
					? { ...cmd, status: 'success', result } 
					: cmd
			)
		)
		
		// Send result via WebSocket (format expected by WebSocketServer)
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			const response = {
				type: 'command_result',
				id: commandId,
				result,
				timestamp: new Date().toISOString()
			};
			console.log('📤 Sending result via WebSocket:', response);
			wsRef.current.send(JSON.stringify(response))
		}
	}

	// Handle command error
	const handleCommandError = (commandId: string, error: string) => {
		console.log('❌ Command error processing:', { commandId, error });
		
		// Update command history
		setCommandHistory(prev => 
			prev.map(cmd => 
				cmd.id === commandId 
					? { ...cmd, status: 'error', error } 
					: cmd
			)
		)
		
		// Send error via WebSocket (format expected by WebSocketServer)
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			const response = {
				type: 'command_error',
				id: commandId,
				error,
				timestamp: new Date().toISOString()
			};
			console.log('📤 Sending error via WebSocket:', response);
			wsRef.current.send(JSON.stringify(response))
		}
	}

	// Update settings
		const updateSettings = () => {
		console.log('💾 Saving settings...', {
			serverPort,
			channelId
		})

		window.parent.postMessage(
			{
				pluginMessage: {
					type: 'update-settings',
					serverPort,
					channelId
				}
			},
			'*'
		)
		
		// Show visual feedback
		const saveButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
		if (saveButton) {
			const originalText = saveButton.textContent
			saveButton.textContent = 'Saved!'
			saveButton.style.background = '#4CAF50'
			saveButton.style.color = 'white'
			saveButton.disabled = true
			
			setTimeout(() => {
				saveButton.textContent = originalText
				saveButton.style.background = ''
				saveButton.style.color = ''
				saveButton.disabled = false
			}, 1500)
		}
	}


	return (
		<div className="container" role="main" style={{ 
			padding: '8px',
			display: 'flex',
			flexDirection: 'column',
			height: '100%',
			overflow: 'hidden'
		}}>
			{/* Application Header with proper semantics */}
			<header className="banner" role="banner" style={{ 
				marginBottom: '8px',
				flexShrink: 0
			}}>
				<Icon size={38} />
				<h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Figmation</h1>
			</header>

			{/* Tab Navigation with proper ARIA attributes */}
			<nav 
				role="tablist" 
				aria-label="Plugin navigation tabs"
				style={{ 
					display: 'flex', 
					borderBottom: '1px solid #ddd', 
					marginBottom: '8px',
					flexShrink: 0
				}}
			>
				{['connection', 'channels', 'selection'].map((tab, index) => (
					<button
						key={tab}
						role="tab"
						id={`tab-${tab}`}
						aria-controls={`panel-${tab}`}
						aria-selected={activeTab === tab}
						tabIndex={activeTab === tab ? 0 : -1}
						onClick={() => setActiveTab(tab)}
						onKeyDown={(e) => {
							// Keyboard navigation for tabs
							if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
								e.preventDefault()
								const tabs = ['connection', 'channels', 'selection']
								const currentIndex = tabs.indexOf(activeTab)
								let newIndex: number
								
								if (e.key === 'ArrowLeft') {
									newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
								} else {
									newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
								}
								
								setActiveTab(tabs[newIndex])
								// Focus the new tab
								document.getElementById(`tab-${tabs[newIndex]}`)?.focus()
							}
						}}
						style={{
							flex: 1,
							padding: '8px 4px',
							border: 'none',
							background: activeTab === tab ? '#007AFF' : 'transparent',
							color: activeTab === tab ? 'white' : '#333',
							cursor: 'pointer',
							textTransform: 'capitalize',
							fontSize: '14px',
							fontWeight: activeTab === tab ? 'bold' : 'normal',
							// Enhanced focus styles for accessibility
							outline: 'none',
							position: 'relative'
						}}
						className={`tab-button ${activeTab === tab ? 'tab-active' : ''}`}
					>
						{tab}
						{/* Visual focus indicator */}
						<style jsx>{`
							.tab-button:focus {
								box-shadow: inset 0 0 0 2px #005bb5;
							}
							.tab-button:hover {
								background-color: ${activeTab === tab ? '#005bb5' : '#f0f0f0'};
							}
						`}</style>
					</button>
				))}
			</nav>

			{/* Scrollable content area */}
			<div style={{
				flex: 1,
				overflowY: 'auto',
				overflowX: 'hidden',
				minHeight: 0
			}}>
				{/* Connection Tab Panel */}
				{activeTab === 'connection' && (
					<section 
					role="tabpanel" 
					id="panel-connection"
					aria-labelledby="tab-connection"
					tabIndex={0}
				>
					{/* Server Configuration Form */}
					<form onSubmit={(e) => { e.preventDefault(); updateSettings(); }}>
						<fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
							<legend style={{ 
								fontSize: '16px', 
								fontWeight: 'bold', 
								marginBottom: '12px',
								padding: 0 
							}}>
								Server Configuration
							</legend>

							<div className="field">
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
									<label htmlFor="server-port" style={{ 
										display: 'flex', 
										alignItems: 'center', 
										gap: '4px',
										width: '70px',
										flexShrink: 0,
										paddingLeft: '4px',
										paddingRight: '4px'
									}}>
										Port:
										<Tooltip text="Port number between 1 and 65535 (default: 3055)" />
									</label>
									<Input
										id="server-port"
										type="number"
										value={serverPort.toString()}
										onChange={(value: string) => {
											try {
												if (value === '') {
													setServerPort(3055);
												} else {
													const numValue = Number(value);
													if (!isNaN(numValue) && numValue > 0 && numValue <= 65535) {
														setServerPort(numValue);
													}
												}
											} catch (error) {
												console.error('Port input error:', error);
												setServerPort(3055);
											}
										}}
										aria-describedby="server-port-help"
										aria-required="true"
										min="1"
										max="65535"
										style={{ flex: 1 }}
									/>
								</div>
							</div>

							{/* Channel Configuration - moved up */}
							<div className="field">
								<div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
									<label htmlFor="channel-id" style={{ 
										display: 'flex', 
										alignItems: 'center', 
										gap: '4px',
										width: '70px',
										flexShrink: 0,
										paddingLeft: '4px',
										paddingRight: '4px'
									}}>
										Channel:
										<Tooltip text="Unique identifier for your design project channel" />
									</label>
									<Input
										id="channel-id"
										type="text"
										value={channelId}
										onChange={(value: string) => {
											try {
												setChannelId(value);
											} catch (error) {
												console.error('Channel ID input error:', error);
												setChannelId('');
											}
										}}
										placeholder="Enter channel ID"
										aria-describedby="channel-id-help"
										aria-required="false"
										style={{ flex: 1 }}
									/>
								</div>
							</div>
							
						</fieldset>
					</form>

					{/* Connection Status with proper ARIA live region */}
					<div className="field" role="status" aria-live="polite" aria-atomic="true" style={{ marginBottom: '8px' }}>
						<strong id="connection-status-label">Connection Status: </strong>
						<span 
							style={{ 
								color: isConnected ? '#2d7d32' : '#c62828',
								fontWeight: 'bold'
							}}
							aria-describedby="connection-status-label"
						>
							{connectionStatus}
						</span>
					</div>

					{/* Connection Actions */}
					<div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
						<Button 
							onClick={updateSettings}
							aria-describedby="save-settings-help"
							type="submit"
						>
							Save
						</Button>
						{!isConnected ? (
							<Button 
								onClick={connectToWebSocket}
								disabled={false}
								aria-describedby="connect-button-help"
								style={{
									opacity: 1,
									cursor: 'pointer'
								}}
							>
								Connect
							</Button>
						) : (
							<Button 
								onClick={disconnectWebSocket}
								aria-describedby="disconnect-button-help"
							>
								Disconnect
							</Button>
						)}
					</div>

					{/* Setup Instructions with proper semantics */}
					<section 
						style={{ fontSize: '12px', marginTop: '8px' }}
						aria-labelledby="setup-instructions-heading"
					>
						<button 
							id="setup-instructions-heading"
							onClick={() => setIsSetupInstructionsExpanded(!isSetupInstructionsExpanded)}
							style={{ 
								fontSize: '14px', 
								fontWeight: 'bold', 
								margin: '0 0 4px 0',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '4px',
								padding: '0',
								color: 'inherit'
							}}
							aria-expanded={isSetupInstructionsExpanded}
						>
							<span style={{ 
								transform: isSetupInstructionsExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
								transition: 'transform 0.2s ease'
							}}>
								▶
							</span>
							Setup Instructions:
						</button>
						{isSetupInstructionsExpanded && (
							<div>
								<ol style={{ paddingLeft: '20px', lineHeight: '1.4' }}>
									<li>Install <strong>n8n-nodes-figmation</strong> from n8n Community Nodes</li>
									<li>Create n8n workflow with <strong>Figmation Connector</strong> node</li>
									<li>Choose <strong>Connection Type</strong>:
										<ul style={{ marginTop: '4px', marginBottom: '4px' }}>
											<li><strong>Standalone</strong>: Set <code>WebSocket Host</code> to <code>0.0.0.0</code> for external access</li>
											<li><strong>Integrated</strong>: Use n8n HTTP server with WebSocket path (e.g., <code>/ws</code>)</li>
										</ul>
									</li>
									<li>Set <strong>Channel Name</strong> in connector node (e.g., "design-automation")</li>
									<li><strong>Execute</strong> the connector node to start WebSocket server</li>
									<li>Enter the same name as <strong>Channel ID</strong> in this plugin</li>
									<li>Set <strong>Host</strong> to your server IP/domain (not localhost for remote access)</li>
									<li>Click <strong>"Connect to Server"</strong> to join the channel</li>
									<li>Use <strong>Figmation Commander</strong> node to send 45+ Figma commands</li>
								</ol>
								<div 
									style={{ 
										marginTop: '6px', 
										marginBottom: '8px',
										padding: '6px', 
										background: '#f0f8ff', 
										borderRadius: '4px',
										border: '1px solid #cce7ff'
									}}
									role="note"
									aria-label="Important note about server configuration"
								>
									<strong>Note:</strong> Both nodes now use unified Server ID = Channel ID system. 
									WebSocket server runs at the configured host:port above.
									
								</div>
							</div>
						)}
					</section>
				</section>
			)}

			{/* Channels Tab Panel */}
			{activeTab === 'channels' && (
				<section 
					role="tabpanel" 
					id="panel-channels"
					aria-labelledby="tab-channels"
					tabIndex={0}
				>
					{/* Current Channel Status */}
					<div className="field" role="status" aria-live="polite">
						<strong id="current-channel-label">Current Channel: </strong>
						<span 
							style={{ 
								color: currentChannel ? '#2d7d32' : '#c62828',
								fontWeight: 'bold'
							}}
							aria-describedby="current-channel-label"
						>
							{currentChannel ? currentChannel.id : 'Not connected'}
						</span>
					</div>

					{currentChannel && (
						<div className="field">
							<strong>Client ID: </strong>
							<code style={{ 
								fontFamily: 'monospace', 
								fontSize: '12px',
								background: '#f5f5f5',
								padding: '2px 4px',
								borderRadius: '2px'
							}}>
								{currentChannel.clientId}
							</code>
							{currentChannel.clientId && (
								<button
									onClick={() => copyToClipboard(currentChannel.clientId, 'client-id')}
									style={{
										background: copiedId === 'client-id' ? '#4CAF50' : '',
										cursor: 'pointer',
										fontSize: '10px',
										transition: 'all 0.2s'
									}}
									title="Copy ID"
								>
									{copiedId === 'client-id' ? '✓' : '📋'}
								</button>
							)}
						</div>
					)}

					{/* Channel List Section */}
				</section>
			)}

			{/* Selection Tab Panel */}
			{activeTab === 'selection' && (
				<section 
					role="tabpanel" 
					id="panel-selection"
					aria-labelledby="tab-selection"
					tabIndex={0}
				>
					{/* Current Selection Status */}
					<div className="field" role="status" aria-live="polite" aria-atomic="true">
						<strong id="selection-status-label">Current Selection: </strong>
						<span 
							style={{ 
								color: selectionInfo.length > 0 ? '#2d7d32' : '#c62828',
								fontWeight: 'bold'
							}}
							aria-describedby="selection-status-label"
						>
							{selectionInfo.length} nodes selected
						</span>
					</div>

					{selectionInfo.length > 0 && (
						<section aria-labelledby="selected-nodes-heading">
							<h3 
								id="selected-nodes-heading"
								style={{ 
									fontSize: '14px', 
									fontWeight: 'bold', 
									margin: '8px 0 4px 0' 
								}}
							>
								Selected Nodes ({selectionInfo.length})
							</h3>
							
							<div 
								role="list"
								aria-label={`${selectionInfo.length} selected nodes`}
							>
								{selectionInfo.map((node, index) => (
									<div 
										key={node.id}
										role="listitem" 
										style={{ 
											border: '1px solid #ddd', 
											padding: '12px', 
											margin: '8px 0',
											borderRadius: '4px',
											fontSize: '12px',
											backgroundColor: '#fafafa',
											wordWrap: 'break-word',
											overflowWrap: 'break-word'
										}}
										aria-label={`Selected node: ${node.name}, type: ${node.type}`}
									>
										{/* Basic Properties Section */}
										<div style={{ 
											marginBottom: '12px',
											padding: '8px',
											background: '#f8f9fa',
											borderRadius: '4px',
											border: '1px solid #e9ecef'
										}}>
											<h4 style={{ 
												margin: '0 0 8px 0', 
												fontSize: '13px', 
												fontWeight: 'bold', 
												color: '#495057' 
											}}>
												Basic Properties
											</h4>
											<div style={{ marginBottom: '4px' }}>
												<strong>Name:</strong> 
												<span style={{ marginLeft: '4px', fontWeight: 'bold', wordBreak: 'break-word' }}>{node.name}</span>
											</div>
											<div style={{ marginBottom: '4px' }}>
												<strong>Type:</strong> 
												<span style={{ 
													marginLeft: '4px',
													background: '#e3f2fd',
													padding: '2px 6px',
													borderRadius: '3px',
													fontSize: '11px',
													fontWeight: 'bold'
												}}>
													{node.type}
												</span>
											</div>
											<div style={{ marginBottom: '4px' }}>
												<strong>ID:</strong> 
												<code style={{ 
													fontFamily: 'monospace', 
													fontSize: '11px',
													background: '#f5f5f5',
													padding: '2px 4px',
													borderRadius: '2px',
													marginLeft: '4px',
													wordBreak: 'break-all',
													display: 'inline-block',
													maxWidth: 'calc(100% - 80px)'
												}}>
													{node.id}
												</code>
												<button
													onClick={() => copyToClipboard(node.id, `node-${node.id}`)}
													style={{
														background: copiedId === `node-${node.id}` ? '#4CAF50' : '',
														cursor: 'pointer',
														fontSize: '10px',
														transition: 'all 0.2s'
													}}
													title="Copy ID"
												>
													{copiedId === `node-${node.id}` ? '✓' : '📋'}
												</button>
											</div>
											<div style={{ marginBottom: '4px' }}>
												<strong>Position:</strong> 
												<span style={{ marginLeft: '4px' }}>x: {node.x}, y: {node.y}</span>
											</div>
											<div style={{ marginBottom: '4px' }}>
												<strong>Size:</strong> 
												<span style={{ marginLeft: '4px' }}>{node.width} × {node.height}</span>
											</div>
											<div style={{ marginBottom: '4px' }}>
												<strong>Visible:</strong> 
												<span style={{ marginLeft: '4px' }}>{node.visible ? '✓' : '✗'}</span>
												<span style={{ marginLeft: '12px' }}>
													<strong>Locked:</strong> 
													<span style={{ marginLeft: '4px' }}>{node.locked ? '✓' : '✗'}</span>
												</span>
											</div>
											{node.opacity !== undefined && node.opacity < 1 && (
												<div style={{ marginBottom: '4px' }}>
													<strong>Opacity:</strong> 
													<span style={{ marginLeft: '4px' }}>{(node.opacity * 100).toFixed(0)}%</span>
												</div>
											)}
											{node.blendMode && node.blendMode !== 'NORMAL' && (
												<div>
													<strong>Blend Mode:</strong> 
													<span style={{ marginLeft: '4px' }}>{node.blendMode}</span>
												</div>
											)}
										</div>

										{/* Component Properties */}
										{(node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#e3f2fd',
												borderRadius: '4px',
												border: '1px solid #bbdefb'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#1976d2' 
												}}>
													Component Properties
												</h4>
												{node.key && (
													<div style={{ marginBottom: '8px' }}>
														<strong>Key:</strong> 
														<code style={{ 
															marginLeft: '4px',
															fontSize: '11px',
															background: '#e8f5e9',
															padding: '2px 4px',
															borderRadius: '2px'
														}}>
															{node.key}
														</code>
														<button
															onClick={() => copyToClipboard(node.key, `node-key-${node.id}`)}
															style={{
																background: copiedId === `node-key-${node.id}` ? '#4CAF50' : '',
																cursor: 'pointer',
																fontSize: '10px',
																transition: 'all 0.2s'
															}}
															title="Copy Key"
														>
															{copiedId === `node-key-${node.id}` ? '✓' : '📋'}
														</button>
													</div>
												)}
												{node.description && (
													<div style={{ marginBottom: '8px' }}>
														<strong>Description:</strong> 
														<span style={{ marginLeft: '4px', fontStyle: 'italic', wordBreak: 'break-word', display: 'inline-block' }}>{node.description}</span>
													</div>
												)}
												{node.componentProperties && node.componentProperties.length > 0 && (
													<div style={{ marginBottom: '8px' }}>
														<strong>Properties:</strong>
														<ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
															{node.componentProperties.map((prop: any, idx: number) => (
																<li key={idx} style={{ marginBottom: '2px' }}>
																	<code>{prop.key}</code>: {prop.type}
																	{prop.defaultValue && ` = "${prop.defaultValue}"`}
																	{prop.variantOptions && ` [${prop.variantOptions.join(', ')}]`}
																</li>
															))}
														</ul>
													</div>
												)}
												{node.variantGroupProperties && Object.keys(node.variantGroupProperties).length > 0 && (
													<div style={{ marginBottom: '8px' }}>
														<strong>Variant Groups:</strong>
														<ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
															{Object.entries(node.variantGroupProperties).map(([key, value]: [string, any], idx: number) => {
																// Variant Group Properties 형식에 따른 처리
																let displayValue = '';
																if (Array.isArray(value)) {
																	displayValue = `[${value.join(', ')}]`;
																} else if (value && typeof value === 'object' && value.values) {
																	displayValue = `[${value.values.join(', ')}]`;
																} else if (value && typeof value === 'object') {
																	// 객체인 경우 키들을 표시
																	displayValue = `[${Object.keys(value).join(', ')}]`;
																} else {
																	displayValue = String(value);
																}
																
																return (
																	<li key={idx} style={{ marginBottom: '2px' }}>
																		<code>{key}</code>: {displayValue}
																	</li>
																);
															})}
														</ul>
													</div>
												)}
											</div>
										)}

										{/* Instance Properties */}
										{node.type === 'INSTANCE' && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#fff',
												borderRadius: '4px',
												border: '1px solid #dee2e6'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#388e3c' 
												}}>
													Instance Properties
												</h4>
												{node.mainComponent && (
													<div style={{ marginBottom: '8px' }}>
														<h5 style={{ 
															margin: '0 0 4px 0', 
															fontSize: '12px', 
															fontWeight: 'bold', 
															color: '#2e7d32' 
														}}>
															Main Component
														</h5>
														<div style={{ 
															marginTop: '4px',
															padding: '6px',
															background: '#e8f5e9',
															borderRadius: '4px',
															fontSize: '12px'
														}}>
															<div style={{ marginBottom: '4px' }}>
																<strong>Name:</strong> 
																<span style={{ marginLeft: '4px' }}>{node.mainComponent.name || '(unnamed)'}</span>
															</div>
															{node.mainComponent.key && (
																<div style={{ 
																	display: 'flex', 
																	alignItems: 'center'
																}}>
																	<strong style={{ marginRight: '8px' }}>Key:</strong>
																	<code style={{ 
																		background: '#e6ee9c',
																		padding: '2px 6px',
																		borderRadius: '3px',
																		fontWeight: 'bold',
																		fontSize: '11px',
																		wordBreak: 'break-all',
																		flex: 1
																	}}>
																		{node.mainComponent.key}
																	</code>
																	<button
																		type="button"
																		onClick={() => copyToClipboard(node.mainComponent.key, `component-key-${node.id}`)}
																		style={{
																			marginLeft: '4px',
																			padding: '1px 3px',
																			fontSize: '10px',
																			cursor: 'pointer'
																		}}
																		title="Copy Key"
																	>
																		{copiedId === `component-key-${node.id}` ? '✓' : '📋'}
																	</button>
																</div>
															)}
														</div>
													</div>
												)}
												{node.availableProperties && node.availableProperties.length > 0 && (
													<div style={{ marginBottom: '8px' }}>
														<h5 style={{ 
															margin: '0 0 4px 0', 
															fontSize: '12px', 
															fontWeight: 'bold', 
															color: '#1976d2' 
														}}>
															Available Properties
														</h5>
														<div style={{ marginTop: '4px' }}>
															{node.availableProperties.map((prop: any, idx: number) => (
																<div key={idx} style={{ 
																	marginBottom: '6px',
																	padding: '6px',
																	background: '#f5f5f5',
																	borderRadius: '4px',
																	fontSize: '12px'
																}}>
																	<div style={{ 
																		display: 'flex', 
																		alignItems: 'center',
																		marginBottom: '4px'
																	}}>
																		<code style={{ 
																			background: '#e3f2fd',
																			padding: '2px 6px',
																			borderRadius: '3px',
																			fontWeight: 'bold',
																			fontSize: '11px',
																			flex: 1
																		}}>{prop.key}</code>
																		<button
																			type="button"
																			onClick={() => copyToClipboard(prop.key, `prop-${node.id}-${idx}`)}
																			style={{
																				padding: '1px 3px',
																				fontSize: '10px',
																				cursor: 'pointer'
																			}}
																			title="Copy property name"
																		>
																			{copiedId === `prop-${node.id}-${idx}` ? '✓' : '📋'}
																		</button>
																	</div>
																	<div style={{ 
																		display: 'flex',
																		justifyContent: 'space-between',
																		fontSize: '11px',
																		color: '#666'
																	}}>
																		<span>Type: <strong>{prop.type}</strong></span>
																		{prop.currentValue !== undefined && (
																			<span>Value: <strong>
																				{(() => {
																					if (typeof prop.currentValue === 'object' && prop.currentValue !== null) {
																						if (prop.currentValue.type === 'TEXT' && prop.currentValue.value) {
																							return prop.currentValue.value;
																						} else if (prop.currentValue.type === 'VARIANT' && prop.currentValue.value) {
																							return prop.currentValue.value;
																						} else if (prop.currentValue.value !== undefined) {
																							return String(prop.currentValue.value);
																						}
																						return JSON.stringify(prop.currentValue);
																					}
																					return String(prop.currentValue);
																				})()}
																			</strong></span>
																		)}
																	</div>
																</div>
															))}
														</div>
													</div>
												)}
												{node.exposedInstances && node.exposedInstances.length > 0 && (
													<div style={{ marginBottom: '8px' }}>
														<strong>Exposed Instances:</strong>
														<ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
															{node.exposedInstances.map((exp: any, idx: number) => (
																<li key={idx} style={{ marginBottom: '2px' }}>
																	{exp.name} ({exp.type})
																</li>
															))}
														</ul>
													</div>
												)}
											</div>
										)}

										{/* Text Properties */}
										{node.type === 'TEXT' && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#fff8e1',
												borderRadius: '4px',
												border: '1px solid #ffecb3'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#e65100' 
												}}>
													Text Properties
												</h4>
												<div>
													<div style={{ marginBottom: '4px' }}>
														<strong>Characters:</strong> 
														<span style={{ 
															marginLeft: '4px',
															fontStyle: 'italic',
															maxWidth: '200px',
															display: 'inline-block',
															whiteSpace: 'nowrap',
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															verticalAlign: 'bottom'
														}}>
															"{node.characters}"
														</span>
													</div>
													{node.fontSize && (
														<div style={{ marginBottom: '4px' }}>
															<strong>Font Size:</strong> 
															<span style={{ marginLeft: '4px' }}>{node.fontSize}px</span>
														</div>
													)}
													{node.fontName && (
														<div style={{ marginBottom: '4px' }}>
															<strong>Font:</strong> 
															<span style={{ marginLeft: '4px' }}>{node.fontName.family} {node.fontName.style}</span>
														</div>
													)}
													<div style={{ marginBottom: '4px' }}>
														<strong>Alignment:</strong> 
														<span style={{ marginLeft: '4px' }}>{node.textAlignHorizontal} / {node.textAlignVertical}</span>
													</div>
												</div>
											</div>
										)}

										{/* Layout Properties */}
										{node.layoutMode && node.layoutMode !== 'NONE' && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#e8f5e9',
												borderRadius: '4px',
												border: '1px solid #c8e6c9'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#2e7d32' 
												}}>
													Layout Properties
												</h4>
												<div>
													<div style={{ marginBottom: '4px' }}>
														<strong>Layout Mode:</strong> 
														<span style={{ marginLeft: '4px' }}>{node.layoutMode}</span>
														{node.layoutDirection && ` (${node.layoutDirection})`}
													</div>
													<div style={{ marginBottom: '4px' }}>
														<strong>Spacing:</strong> 
														<span style={{ marginLeft: '4px' }}>{node.itemSpacing}px</span>
													</div>
													<div style={{ marginBottom: '4px' }}>
														<strong>Padding:</strong> 
														<span style={{ marginLeft: '4px' }}>
															{node.paddingTop}/{node.paddingRight}/{node.paddingBottom}/{node.paddingLeft}
														</span>
													</div>
												</div>
											</div>
										)}

										{/* Style Properties */}
										{(node.fillsCount > 0 || node.strokesCount > 0 || node.effectsCount > 0) && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#f3e5f5',
												borderRadius: '4px',
												border: '1px solid #e1bee7'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#7b1fa2' 
												}}>
													Style Properties
												</h4>
												<div>
													{node.fillsCount > 0 && (
														<div style={{ marginBottom: '4px' }}>
															<strong>Fills:</strong> 
															<span style={{ marginLeft: '4px' }}>{node.fillsCount} fill(s)</span>
														</div>
													)}
													{node.strokesCount > 0 && (
														<div style={{ marginBottom: '4px' }}>
															<strong>Strokes:</strong> 
															<span style={{ marginLeft: '4px' }}>{node.strokesCount} stroke(s)</span>
															{node.strokeWeight && ` (${node.strokeWeight}px)`}
														</div>
													)}
													{node.effectsCount > 0 && (
														<div style={{ marginBottom: '4px' }}>
															<strong>Effects:</strong> 
															<span style={{ marginLeft: '4px' }}>{node.effectsCount} effect(s)</span>
															{node.effectTypes && (
																<span style={{ marginLeft: '8px', fontSize: '11px', color: '#666' }}>
																	[{node.effectTypes.join(', ')}]
																</span>
															)}
														</div>
													)}
												</div>
											</div>
										)}

										{/* Constraints */}
										{node.constraints && (
											<div style={{ 
												marginBottom: '12px',
												padding: '8px',
												background: '#fff3e0',
												borderRadius: '4px',
												border: '1px solid #ffcc02'
											}}>
												<h4 style={{ 
													margin: '0 0 8px 0', 
													fontSize: '13px', 
													fontWeight: 'bold', 
													color: '#ff8f00' 
												}}>
													Constraints
												</h4>
												<div>
													<span>H: {node.constraints.horizontal}, V: {node.constraints.vertical}</span>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</section>
					)}

					{selectionInfo.length === 0 && (
						<div 
							style={{ 
								textAlign: 'center', 
								color: '#666', 
								fontStyle: 'italic',
								padding: '20px',
								border: '1px dashed #ddd',
								borderRadius: '4px',
								background: '#f9f9f9'
							}}
							role="status"
							aria-label="No objects selected in Figma"
						>
							No objects selected in Figma
							<div style={{ 
								fontSize: '11px', 
								marginTop: '8px',
								color: '#888' 
							}}>
								Select objects in Figma to see them listed here
							</div>
						</div>
					)}
				</section>
			)}

			{/* Commands Tab Panel */}
			{activeTab === 'commands' && (
				<section 
					role="tabpanel" 
					id="panel-commands"
					aria-labelledby="tab-commands"
					tabIndex={0}
				>
					{/* Command History Header */}
					<div className="field" role="status" aria-live="polite">
						<strong id="command-history-label">Command History</strong>
						<span 
							style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}
							aria-describedby="command-history-label"
						>
							({commandHistory.length} commands)
						</span>
					</div>

					{commandHistory.length > 0 ? (
						<section aria-labelledby="command-list-heading">
							<h3 
								id="command-list-heading"
								style={{ 
									fontSize: '14px', 
									fontWeight: 'bold', 
									margin: '16px 0 8px 0' 
								}}
							>
								Execution History ({commandHistory.length})
							</h3>
							
							<div 
								style={{ maxHeight: '400px', overflowY: 'auto' }}
								role="list"
								aria-label={`${commandHistory.length} executed commands`}
							>
								{commandHistory.map((cmd) => (
									<article 
										key={cmd.id}
										role="listitem"
										style={{ 
											border: '1px solid #ddd', 
											padding: '8px', 
											margin: '4px 0',
											borderRadius: '4px',
											fontSize: '12px',
											borderLeft: `4px solid ${
												cmd.status === 'success' ? '#2d7d32' : 
												cmd.status === 'error' ? '#c62828' : '#f57c00'
											}`
										}}
										aria-label={`Command ${cmd.command}, status: ${cmd.status}, executed at ${new Date(cmd.timestamp).toLocaleTimeString()}`}
									>
										{/* Command Header */}
										<header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
											<strong aria-label={`Command name: ${cmd.command}`}>{cmd.command}</strong>
											<span 
												style={{ 
													color: cmd.status === 'success' ? '#2d7d32' : 
														  cmd.status === 'error' ? '#c62828' : '#f57c00',
													fontWeight: 'bold',
													textTransform: 'capitalize'
												}}
												aria-label={`Execution status: ${cmd.status}`}
											>
												{cmd.status}
											</span>
										</header>
										
										{/* Timestamp */}
										<div 
											style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}
											aria-label={`Executed at ${new Date(cmd.timestamp).toLocaleString()}`}
										>
											{new Date(cmd.timestamp).toLocaleTimeString()}
										</div>
										
										{/* Parameters Details */}
										{cmd.params && (
											<details style={{ marginTop: '8px' }}>
												<summary 
													style={{ cursor: 'pointer', fontWeight: 'bold' }}
													aria-label="Show command parameters"
												>
													Parameters
												</summary>
												<pre 
													style={{ 
														background: '#f5f5f5', 
														padding: '8px',
														fontSize: '10px',
														whiteSpace: 'pre-wrap',
														maxHeight: '100px',
														overflow: 'auto',
														margin: '4px 0',
														borderRadius: '2px'
													}}
													aria-label="Command parameters in JSON format"
													role="region"
												>
													{JSON.stringify(cmd.params, null, 2)}
												</pre>
											</details>
										)}
										
										{/* Success Result */}
										{cmd.result && (
											<details style={{ marginTop: '8px' }}>
												<summary 
													style={{ cursor: 'pointer', fontWeight: 'bold', color: '#2d7d32' }}
													aria-label="Show command result"
												>
													Result
												</summary>
												<pre 
													style={{ 
														background: '#e8f5e8', 
														padding: '8px',
														fontSize: '10px',
														whiteSpace: 'pre-wrap',
														maxHeight: '100px',
														overflow: 'auto',
														margin: '4px 0',
														borderRadius: '2px'
													}}
													aria-label="Command result in JSON format"
													role="region"
												>
													{JSON.stringify(cmd.result, null, 2)}
												</pre>
											</details>
										)}
										
										{/* Error Message */}
										{cmd.error && (
											<div 
												style={{ 
													background: '#ffe8e8', 
													padding: '8px',
													marginTop: '8px',
													fontSize: '11px',
													color: '#c62828',
													borderRadius: '2px',
													border: '1px solid #ffcdd2'
												}}
												role="alert"
												aria-label={`Error occurred: ${cmd.error}`}
											>
												<strong>Error:</strong> {cmd.error}
											</div>
										)}
									</article>
								))}
							</div>
						</section>
					) : (
						<div 
							style={{ 
								textAlign: 'center', 
								color: '#666', 
								fontStyle: 'italic',
								padding: '20px',
								border: '1px dashed #ddd',
								borderRadius: '4px',
								background: '#f9f9f9'
							}}
							role="status"
							aria-label="No commands have been executed yet"
						>
							No commands executed yet
							<div style={{ 
								fontSize: '11px', 
								marginTop: '8px',
								color: '#888' 
							}}>
								Commands sent from n8n workflows will appear here
							</div>
						</div>
					)}

					{/* Clear History Action */}
					{commandHistory.length > 0 && (
						<div className="field" style={{ marginTop: '16px' }}>
							<Button 
								onClick={() => {
									setCommandHistory([]);
									// Announce the action to screen readers
									const announcement = document.createElement('div');
									announcement.setAttribute('aria-live', 'polite');
									announcement.setAttribute('aria-atomic', 'true');
									announcement.style.position = 'absolute';
									announcement.style.left = '-10000px';
									announcement.textContent = 'Command history cleared';
									document.body.appendChild(announcement);
									setTimeout(() => document.body.removeChild(announcement), 1000);
								}}
								aria-describedby="clear-history-help"
							>
								Clear History
							</Button>
							<div 
								id="clear-history-help" 
								style={{ 
									fontSize: '12px', 
									color: '#666', 
									marginTop: '2px' 
								}}
							>
								Remove all command execution records from the history
							</div>
						</div>
					)}
				</section>
			)}
			</div>
		</div>
	)
}

export default App
