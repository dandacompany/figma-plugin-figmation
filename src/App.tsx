import React, { useState, useEffect, useRef } from 'react'
import Icon from './components/Icon'
import Input from './components/Input'
import Button from './components/Button'
import './App.css' // Import CSS for styles

const App: React.FC = () => {
	const [serverPort, setServerPort] = useState<number>(3055)
	const [serverHost, setServerHost] = useState<string>('localhost')
	const [isConnected, setIsConnected] = useState<boolean>(false)
	const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected')
	const [selectionInfo, setSelectionInfo] = useState<any[]>([])
	const [commandHistory, setCommandHistory] = useState<any[]>([])
	const [activeTab, setActiveTab] = useState<string>('connection')
	const [channelId, setChannelId] = useState<string>('')
	const [channelList, setChannelList] = useState<any[]>([])
	const [currentChannel, setCurrentChannel] = useState<any>(null)
	
	// WebSocket reference
	const wsRef = useRef<WebSocket | null>(null)
	const commandIdCounter = useRef(0)
	const connectionCheckInterval = useRef<NodeJS.Timeout | null>(null)
	const pingInterval = useRef<NodeJS.Timeout | null>(null)
	const lastPongTime = useRef<number>(Date.now())

	// Server URL calculation (auto-updates when serverHost, serverPort changes)
	const serverUrl = `ws://${serverHost}:${serverPort}`

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
					break
				
				case 'auto-connect':
					// Auto-connect attempt
					connectToWebSocket()
					break
				
				case 'selection-changed':
					setSelectionInfo(message.selection || [])
					break
				
				case 'command-result':
					handleCommandResult(message.id, message.result)
					break
				
				case 'command-error':
					handleCommandError(message.id, message.error)
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
			console.log('Attempting to connect to:', serverUrl)
			const ws = new WebSocket(serverUrl)
			
			ws.onopen = () => {
				console.log('WebSocket connected')
				setIsConnected(true)
				setConnectionStatus('Connected')
				wsRef.current = ws
				
				// Set connection time to lastPongTime
				lastPongTime.current = Date.now()
				console.log('Initial lastPongTime set to:', lastPongTime.current)
				
				// 연결 성공 메시지 (채널 ID 포함)
				const registerMessage = {
					type: 'register',
					clientType: 'figma',
					clientId: 'figma_plugin_' + Date.now(),
					channelId: channelId || 'hellofigma', // 기본 채널 ID 사용
					message: 'Figma plugin connected'
				}
				console.log('Sending register message:', registerMessage)
				ws.send(JSON.stringify(registerMessage))
				
				// 연결 상태 주기적 체크 시작
				startConnectionCheck()
			}

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data)
					console.log('Received message:', data)
					
					// ping/pong 응답 처리
					if (data.type === 'pong') {
						console.log('Received pong response')
						lastPongTime.current = Date.now()
						return
					}
					
					// 등록 성공 응답 처리
					if (data.type === 'registration_success') {
						console.log('Registration successful:', data)
						setCurrentChannel({
							id: data.channelId,
							clientId: data.clientId
						})
						// 서버에서 할당된 채널 ID로 업데이트
						setChannelId(data.channelId)
						return
					}
					
					// 등록 에러 처리
					if (data.type === 'registration_error') {
						console.error('Registration failed:', data.error)
						setConnectionStatus('Registration Failed: ' + data.error)
						setIsConnected(false)
						return
					}
					
					// 새 채널 생성 브로드캐스트 처리
					if (data.type === 'channel_created_broadcast') {
						console.log('New channel created:', data.channelId, data.channelName)
						console.log('Setting channel ID to:', data.channelId)
						// 자동으로 채널 ID 설정
						setChannelId(data.channelId)
						// 알림 메시지 표시
						setConnectionStatus(`Channel "${data.channelId}" is ready for connection!`)
						console.log('Channel ID set successfully')
						return
					}
					
					// 채널 목록 업데이트 처리
					if (data.type === 'channel_list') {
						console.log('Channel list updated:', data.channels)
						setChannelList(data.channels)
						return
					}
					
						// 외부 명령 처리
	if (data.type === 'command') {
		console.log('📨 외부 명령 수신:', data);
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
				
				// 연결 체크 인터벌 정리
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

	// ping 메시지 전송
	const sendPing = () => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			console.log('Sending ping...')
			try {
				wsRef.current.send(JSON.stringify({ type: 'ping' }))
			} catch (error) {
				console.error('Error sending ping:', error)
			}
		} else {
			console.log('Cannot send ping - WebSocket not ready. State:', wsRef.current?.readyState)
		}
	}

	// 연결 상태 주기적 체크
	const startConnectionCheck = () => {
		// console.log('Starting connection check interval...')
		
		// 기존 인터벌 정리
		if (connectionCheckInterval.current) {
			// console.log('Clearing existing connection check interval')
			clearInterval(connectionCheckInterval.current)
		}
		if (pingInterval.current) {
			// console.log('Clearing existing ping interval')
			clearInterval(pingInterval.current)
		}
		
		// 자동 재연결 시도 횟수 제한
		let reconnectAttempts = 0
		const maxReconnectAttempts = 5
		
		// 5초마다 ping 전송 (서버 상태 빠른 감지)
		pingInterval.current = setInterval(() => {
			// console.log('Ping interval triggered')
			sendPing()
		}, 5000)
		
		// 5초마다 연결 상태 체크 (서버 상태 빠른 감지)
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
				
				// 연결 상태 모니터링 (readyState + ping/pong 기반)
				if (readyState === WebSocket.CLOSED || 
					readyState === WebSocket.CLOSING || 
					timeSinceLastPong > 30000) { // 30초 이상 pong이 없으면 연결 끊김으로 판단
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
					
					// 자동 재연결 시도
					if (reconnectAttempts < maxReconnectAttempts) {
						reconnectAttempts++
						console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`)
						
						// 3초 후 재연결 시도
						setTimeout(() => {
							console.log('Attempting automatic reconnection...')
							connectToWebSocket()
						}, 3000)
					} else {
						console.log('Max reconnection attempts reached, stopping auto-reconnect')
					}
				} else {
					// 연결이 활성 상태인 경우 상태 업데이트
					if (!isConnected) {
						console.log('Connection restored - updating status')
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

	// WebSocket 연결 해제
	const disconnectWebSocket = () => {
		console.log('Disconnecting WebSocket...')
		
		if (wsRef.current) {
			console.log('Closing WebSocket connection')
			wsRef.current.close()
			wsRef.current = null
		}
		
		// 연결 체크 인터벌 정리
		if (connectionCheckInterval.current) {
			console.log('Clearing connection check interval on manual disconnect')
			clearInterval(connectionCheckInterval.current)
			connectionCheckInterval.current = null
		}
		
		// ping 인터벌 정리
		if (pingInterval.current) {
			console.log('Clearing ping interval on manual disconnect')
			clearInterval(pingInterval.current)
			pingInterval.current = null
		}
	}

	// 외부 명령 실행
	const executeCommand = (commandData: any) => {
		// WebSocket 서버에서 보낸 명령의 ID 사용
		const commandId = commandData.id || `cmd_${commandIdCounter.current++}`
		
		console.log('🔧 명령 실행 시작:', { commandId, command: commandData.command, params: commandData.params });
		
		// 명령 기록 추가
		const newCommand = {
			id: commandId,
			command: commandData.command,
			params: commandData.params,
			timestamp: new Date().toISOString(),
			status: 'executing'
		}
		
		setCommandHistory(prev => [newCommand, ...prev].slice(0, 50))
		
		// 플러그인에 명령 전달
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
	const handleCommandResult = (commandId: string, result: any) => {
		console.log('✅ 명령 결과 처리:', { commandId, result });
		
		// 명령 기록 업데이트
		setCommandHistory(prev => 
			prev.map(cmd => 
				cmd.id === commandId 
					? { ...cmd, status: 'success', result } 
					: cmd
			)
		)
		
		// WebSocket으로 결과 전송 (WebSocketServer에서 기대하는 형식)
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			const response = {
				type: 'command_result',
				id: commandId,
				result,
				timestamp: new Date().toISOString()
			};
			console.log('📤 WebSocket으로 결과 전송:', response);
			wsRef.current.send(JSON.stringify(response))
		}
	}

	// 명령 에러 처리
	const handleCommandError = (commandId: string, error: string) => {
		console.log('❌ 명령 에러 처리:', { commandId, error });
		
		// 명령 기록 업데이트
		setCommandHistory(prev => 
			prev.map(cmd => 
				cmd.id === commandId 
					? { ...cmd, status: 'error', error } 
					: cmd
			)
		)
		
		// WebSocket으로 에러 전송 (WebSocketServer에서 기대하는 형식)
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			const response = {
				type: 'command_error',
				id: commandId,
				error,
				timestamp: new Date().toISOString()
			};
			console.log('📤 WebSocket으로 에러 전송:', response);
			wsRef.current.send(JSON.stringify(response))
		}
	}

	// 설정 업데이트
	const updateSettings = () => {
		window.parent.postMessage(
			{
				pluginMessage: {
					type: 'update-settings',
					serverPort,
					serverHost
				}
			},
			'*'
		)
	}


	return (
		<div className="container" role="main">
			{/* Application Header with proper semantics */}
			<header className="banner" role="banner">
				<Icon size={38} />
				<h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Figmation</h1>
			</header>

			{/* Tab Navigation with proper ARIA attributes */}
			<nav 
				role="tablist" 
				aria-label="Plugin navigation tabs"
				style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: '16px' }}
			>
				{['connection', 'channels', 'selection', 'commands'].map((tab, index) => (
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
								const tabs = ['connection', 'channels', 'selection', 'commands']
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
							padding: '12px 8px',
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

			{/* Connection Tab Panel */}
			{activeTab === 'connection' && (
				<section 
					role="tabpanel" 
					id="panel-connection"
					aria-labelledby="tab-connection"
					tabIndex={0}
				>
					{/* Connection Status with proper ARIA live region */}
					<div className="field" role="status" aria-live="polite" aria-atomic="true">
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
								<label htmlFor="server-host" style={{ display: 'block', marginBottom: '4px' }}>
									Server Host:
								</label>
								<Input
									id="server-host"
									type="text"
									value={serverHost}
									onChange={(value: string) => {
										try {
											setServerHost(value);
										} catch (error) {
											console.error('Host input error:', error);
											setServerHost('localhost');
										}
									}}
									aria-describedby="server-host-help"
									aria-required="true"
								/>
								<div id="server-host-help" style={{ 
									fontSize: '12px', 
									color: '#666', 
									marginTop: '2px' 
								}}>
									Usually 'localhost' for local development
								</div>
							</div>

							<div className="field">
								<label htmlFor="server-port" style={{ display: 'block', marginBottom: '4px' }}>
									Server Port:
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
								/>
								<div id="server-port-help" style={{ 
									fontSize: '12px', 
									color: '#666', 
									marginTop: '2px' 
								}}>
									Port number between 1 and 65535 (default: 3055)
								</div>
							</div>
							
							<div className="field">
								<Button 
									onClick={updateSettings}
									aria-describedby="save-settings-help"
									type="submit"
								>
									Save Settings
								</Button>
								<div id="save-settings-help" style={{ 
									fontSize: '12px', 
									color: '#666', 
									marginTop: '2px' 
								}}>
									Save server configuration to local storage
								</div>
							</div>
						</fieldset>
					</form>

					{/* Channel Configuration */}
					<div className="field" style={{ marginTop: '16px' }}>
						<label htmlFor="channel-id" style={{ display: 'block', marginBottom: '4px' }}>
							Channel ID:
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
							placeholder="Enter channel ID (e.g., my_design_project)"
							aria-describedby="channel-id-help"
							aria-required="false"
						/>
						<div id="channel-id-help" style={{ 
							fontSize: '12px', 
							color: '#666', 
							marginTop: '2px' 
						}}>
							Unique identifier for your design project channel
						</div>
					</div>

					{/* Connection Information */}
					<div className="field" style={{ marginTop: '16px' }}>
						<strong>WebSocket URL: </strong>
						<code 
							style={{ 
								fontFamily: 'monospace', 
								fontSize: '12px', 
								color: '#666',
								background: '#f5f5f5',
								padding: '2px 4px',
								borderRadius: '2px'
							}}
							aria-label={`WebSocket URL: ${serverUrl}`}
						>
							{serverUrl}
						</code>
					</div>

					{/* Connection Actions */}
					<div className="field" style={{ marginTop: '16px' }}>
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
								Connect to Server
							</Button>
						) : (
							<Button 
								onClick={disconnectWebSocket}
								aria-describedby="disconnect-button-help"
							>
								Disconnect
							</Button>
						)}
						<div 
							id={isConnected ? "disconnect-button-help" : "connect-button-help"}
							style={{ 
								fontSize: '12px', 
								color: '#666', 
								marginTop: '2px' 
							}}
						>
							{isConnected 
								? 'Disconnect from the current WebSocket server'
								: 'Connect to the WebSocket server using the configuration above'
							}
						</div>
					</div>

					{/* Setup Instructions with proper semantics */}
					<section 
						style={{ fontSize: '12px', marginTop: '16px' }}
						aria-labelledby="setup-instructions-heading"
					>
						<h3 
							id="setup-instructions-heading"
							style={{ 
								fontSize: '14px', 
								fontWeight: 'bold', 
								margin: '0 0 8px 0' 
							}}
						>
							Setup Instructions:
						</h3>
						<ol style={{ paddingLeft: '20px', lineHeight: '1.4' }}>
							<li>Install <strong>n8n-nodes-figmation</strong> from n8n Community Nodes</li>
							<li>Create n8n workflow with <strong>Figmation Connector</strong> node</li>
							<li>Set <strong>Channel Name</strong> in connector node (e.g., "design-automation")</li>
							<li><strong>Execute</strong> the connector node to start WebSocket server</li>
							<li>Enter the same name as <strong>Channel ID</strong> in this plugin</li>
							<li>Click <strong>"Connect to Server"</strong> to join the channel</li>
							<li>Use <strong>Figmation Commander</strong> node to send 45+ Figma commands</li>
						</ol>
						<div 
							style={{ 
								marginTop: '8px', 
								padding: '8px', 
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
						</div>
					)}

					{/* Channel List Section */}
					<section aria-labelledby="channel-list-heading">
						<h3 
							id="channel-list-heading"
							style={{ 
								fontSize: '14px', 
								fontWeight: 'bold', 
								margin: '16px 0 8px 0' 
							}}
						>
							Active Channels ({channelList.length})
						</h3>

						{channelList.length > 0 ? (
							<div 
								style={{ maxHeight: '300px', overflowY: 'auto' }}
								role="list"
								aria-label={`${channelList.length} active channels`}
							>
								{channelList.map((channel) => (
									<div 
										key={channel.id}
										role="listitem"
										style={{ 
											border: '1px solid #ddd', 
											padding: '8px', 
											margin: '4px 0',
											borderRadius: '4px',
											fontSize: '12px',
											backgroundColor: channel.id === currentChannel?.id ? '#e8f5e8' : 'transparent'
										}}
										aria-current={channel.id === currentChannel?.id ? 'true' : 'false'}
									>
										<div>
											<strong>Channel:</strong> 
											<span style={{ marginLeft: '4px' }}>{channel.id}</span>
										</div>
										<div>
											<strong>Clients:</strong> 
											<span style={{ marginLeft: '4px' }}>{channel.clients.length}</span>
										</div>
										{channel.clients.length > 0 && (
											<div 
												style={{ marginLeft: '10px', fontSize: '11px', marginTop: '4px' }}
												role="list"
												aria-label={`${channel.clients.length} clients in channel ${channel.id}`}
											>
												{channel.clients.map((client: any, index: number) => (
													<div key={index} role="listitem">
														• {client.type} ({client.id})
													</div>
												))}
											</div>
										)}
									</div>
								))}
							</div>
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
								aria-label="No active channels available"
							>
								No active channels
							</div>
						)}
					</section>
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
									margin: '16px 0 8px 0' 
								}}
							>
								Selected Nodes ({selectionInfo.length})
							</h3>
							
							<div 
								style={{ maxHeight: '300px', overflowY: 'auto' }}
								role="list"
								aria-label={`${selectionInfo.length} selected nodes`}
							>
								{selectionInfo.map((node, index) => (
									<div 
										key={node.id}
										role="listitem" 
										style={{ 
											border: '1px solid #ddd', 
											padding: '8px', 
											margin: '4px 0',
											borderRadius: '4px',
											fontSize: '12px'
										}}
										aria-label={`Selected node: ${node.name}, type: ${node.type}`}
									>
										<div>
											<strong>Name:</strong> 
											<span style={{ marginLeft: '4px' }}>{node.name}</span>
										</div>
										<div>
											<strong>Type:</strong> 
											<span style={{ marginLeft: '4px' }}>{node.type}</span>
										</div>
										<div>
											<strong>ID:</strong> 
											<code style={{ 
												fontFamily: 'monospace', 
												fontSize: '11px',
												background: '#f5f5f5',
												padding: '2px 4px',
												borderRadius: '2px',
												marginLeft: '4px'
											}}>
												{node.id}
											</code>
										</div>
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
	)
}

export default App
