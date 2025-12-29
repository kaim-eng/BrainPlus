/**
 * Quick test script to verify the native messaging host works
 */
const { spawn } = require('child_process');
const path = require('path');

const hostPath = path.join(__dirname, 'brainplus-sync-host.js');

console.log('Testing native host:', hostPath);
console.log('Sending ping message...\n');

const host = spawn('node', [hostPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send a ping message
const pingMessage = { type: 'ping' };
const messageStr = JSON.stringify(pingMessage);
const messageBuffer = Buffer.from(messageStr, 'utf-8');
const lengthBuffer = Buffer.alloc(4);
lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

host.stdin.write(lengthBuffer);
host.stdin.write(messageBuffer);

// Read response
let responseData = Buffer.alloc(0);

host.stdout.on('data', (data) => {
  responseData = Buffer.concat([responseData, data]);
  
  // Try to parse response
  if (responseData.length >= 4) {
    const messageLength = responseData.readUInt32LE(0);
    if (responseData.length >= 4 + messageLength) {
      const messageBuffer = responseData.slice(4, 4 + messageLength);
      const message = JSON.parse(messageBuffer.toString('utf-8'));
      console.log('✅ Received response:', JSON.stringify(message, null, 2));
      host.kill();
      process.exit(0);
    }
  }
});

host.on('error', (error) => {
  console.error('❌ Host error:', error);
  process.exit(1);
});

host.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Host exited with code ${code}`);
    process.exit(1);
  }
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Timeout waiting for response');
  host.kill();
  process.exit(1);
}, 5000);

