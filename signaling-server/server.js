#!/usr/bin/env node

/**
 * BrainPlus WebSocket Signaling Server
 * 
 * Simple relay server for cross-device sync.
 * Routes messages between devices in the same room.
 * 
 * Security: Never decrypts data, only routes encrypted messages.
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8080;
const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Room management
const rooms = new Map(); // roomId → Set<WebSocket>
const roomTimers = new Map(); // roomId → timeout handle

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      connections: Array.from(rooms.values()).reduce((sum, set) => sum + set.size, 0),
      uptime: process.uptime(),
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BrainPlus Signaling Server');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('='.repeat(60));
console.log('BrainPlus WebSocket Signaling Server');
console.log('='.repeat(60));
console.log(`Port: ${PORT}`);
console.log(`Room timeout: ${ROOM_TIMEOUT / 1000 / 60} minutes`);
console.log('');

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] New connection from ${clientIp}`);
  
  ws.isAlive = true;
  ws.roomId = null;
  ws.deviceId = null;
  
  // Pong response for heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Log message type (not payload for privacy)
      console.log(`[${new Date().toISOString()}] ${message.type} from ${message.from || 'unknown'} in room ${message.roomId || 'none'}`);
      
      switch (message.type) {
        case 'JOIN':
          handleJoin(ws, message);
          break;
        
        case 'PING':
          handlePing(ws, message);
          break;
        
        default:
          // Relay all other messages to room members
          relayToRoom(ws, message);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendError(ws, 'Invalid message format');
    }
  });
  
  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Connection closed from ${clientIp}`);
    handleDisconnect(ws);
  });
  
  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
  });
});

/**
 * Handle JOIN message (device joining a room)
 */
function handleJoin(ws, message) {
  const { roomId, from } = message;
  
  if (!roomId) {
    sendError(ws, 'Room ID required');
    return;
  }
  
  // Leave previous room if any
  if (ws.roomId) {
    leaveRoom(ws);
  }
  
  // Join new room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
    console.log(`[${new Date().toISOString()}] Created room: ${roomId}`);
  }
  
  rooms.get(roomId).add(ws);
  ws.roomId = roomId;
  ws.deviceId = from;
  
  console.log(`[${new Date().toISOString()}] ${from} joined room ${roomId} (${rooms.get(roomId).size} members)`);
  
  // Set room timeout (auto-cleanup)
  resetRoomTimeout(roomId);
  
  // Notify others in the room
  relayToRoom(ws, message);
}

/**
 * Handle PING message (heartbeat)
 */
function handlePing(ws, message) {
  // Respond with PONG
  const pong = {
    type: 'PONG',
    roomId: message.roomId,
    from: 'server',
    timestamp: Date.now(),
  };
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(pong));
  }
}

/**
 * Relay message to all room members except sender
 */
function relayToRoom(ws, message) {
  if (!ws.roomId || !rooms.has(ws.roomId)) {
    return;
  }
  
  const room = rooms.get(ws.roomId);
  let sent = 0;
  
  room.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      sent++;
    }
  });
  
  if (sent > 0) {
    console.log(`[${new Date().toISOString()}] Relayed ${message.type} to ${sent} recipient(s)`);
  }
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws) {
  if (ws.roomId && rooms.has(ws.roomId)) {
    leaveRoom(ws);
  }
}

/**
 * Remove client from room
 */
function leaveRoom(ws) {
  if (!ws.roomId || !rooms.has(ws.roomId)) {
    return;
  }
  
  const room = rooms.get(ws.roomId);
  room.delete(ws);
  
  console.log(`[${new Date().toISOString()}] ${ws.deviceId} left room ${ws.roomId} (${room.size} remaining)`);
  
  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(ws.roomId);
    clearRoomTimeout(ws.roomId);
    console.log(`[${new Date().toISOString()}] Deleted empty room: ${ws.roomId}`);
  }
  
  ws.roomId = null;
  ws.deviceId = null;
}

/**
 * Reset room timeout (auto-cleanup after inactivity)
 */
function resetRoomTimeout(roomId) {
  clearRoomTimeout(roomId);
  
  const timer = setTimeout(() => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      console.log(`[${new Date().toISOString()}] Room ${roomId} timed out, closing ${room.size} connection(s)`);
      
      // Close all connections in the room
      room.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Room timeout');
        }
      });
      
      rooms.delete(roomId);
    }
  }, ROOM_TIMEOUT);
  
  roomTimers.set(roomId, timer);
}

/**
 * Clear room timeout
 */
function clearRoomTimeout(roomId) {
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }
}

/**
 * Send error message to client
 */
function sendError(ws, error) {
  const errorMsg = {
    type: 'ERROR',
    payload: { error },
    timestamp: Date.now(),
  };
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(errorMsg));
  }
}

/**
 * Heartbeat check (detect dead connections)
 */
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`[${new Date().toISOString()}] Terminating dead connection`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  clearInterval(heartbeatInterval);
  
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutdown');
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Ready to handle sync requests!');
  console.log('='.repeat(60));
});

