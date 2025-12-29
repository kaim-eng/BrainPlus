#!/usr/bin/env node

/**
 * Install Native Messaging Host Manifest
 * 
 * Registers the native messaging host with Chrome/Chromium browsers.
 * Must be run after building the host.
 * 
 * Usage: node install-manifest.js [extension-id]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MANIFEST_NAME = 'com.brainplus.sync_host';

/**
 * Get native messaging host directory for current OS
 */
function getNativeMessagingDir() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'darwin') {
    // macOS
    return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
  } else if (platform === 'win32') {
    // Windows - use registry instead of file system
    return null; // Will use registry
  } else {
    // Linux
    return path.join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts');
  }
}

/**
 * Install manifest for macOS/Linux
 */
function installManifestUnix(extensionId) {
  const manifestDir = getNativeMessagingDir();
  const hostPath = path.resolve(__dirname, 'brainplus-sync-host.js');
  
  // Create manifest
  const manifest = {
    name: MANIFEST_NAME,
    description: 'BrainPlus Cross-Device Sync Host',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [
      `chrome-extension://${extensionId}/`
    ]
  };
  
  // Ensure directory exists
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }
  
  // Write manifest
  const manifestPath = path.join(manifestDir, `${MANIFEST_NAME}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Make host executable
  fs.chmodSync(hostPath, '755');
  
  console.log('✅ Native messaging host installed successfully!');
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Host: ${hostPath}`);
}

/**
 * Install manifest for Windows (using registry)
 */
function installManifestWindows(extensionId) {
  const { execSync } = require('child_process');
  const manifestPath = path.resolve(__dirname, 'manifest.json');
  const hostScriptPath = path.resolve(__dirname, 'brainplus-sync-host.js');
  const wrapperPath = path.resolve(__dirname, 'brainplus-sync-host-wrapper.bat');
  
  // Find node.exe path
  let nodePath;
  try {
    nodePath = execSync('where node', { encoding: 'utf-8' }).trim().split('\n')[0];
    console.log(`Found Node.js at: ${nodePath}`);
  } catch (error) {
    console.error('❌ Node.js not found in PATH');
    process.exit(1);
  }
  
  // Update wrapper batch file with correct node path
  const wrapperContent = `@echo off\nsetlocal\nset SCRIPT_DIR=%~dp0\n"${nodePath}" "%SCRIPT_DIR%brainplus-sync-host.js"\n`;
  fs.writeFileSync(wrapperPath, wrapperContent);
  
  // Update manifest with extension ID
  const manifest = {
    name: MANIFEST_NAME,
    description: 'BrainPlus Cross-Device Sync Host',
    path: wrapperPath,
    type: 'stdio',
    allowed_origins: [
      `chrome-extension://${extensionId}/`
    ]
  };
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  // Add to registry
  const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${MANIFEST_NAME}`;
  const regCommand = `reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`;
  
  try {
    execSync(regCommand, { stdio: 'inherit' });
    console.log('✅ Native messaging host installed successfully!');
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Wrapper: ${wrapperPath}`);
    console.log(`Node.js: ${nodePath}`);
    console.log(`Script: ${hostScriptPath}`);
    console.log('\n⚠️  Please restart Chrome COMPLETELY:');
    console.log('   1. Close ALL Chrome windows');
    console.log('   2. Wait 5 seconds');
    console.log('   3. Reopen Chrome\n');
  } catch (error) {
    console.error('❌ Failed to add registry key. Run as Administrator?');
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Main
 */
function main() {
  const extensionId = process.argv[2];
  
  if (!extensionId) {
    console.error('Usage: node install-manifest.js <extension-id>');
    console.error('\nExample:');
    console.error('  node install-manifest.js abcdefghijklmnopqrstuvwxyz012345');
    console.error('\nTo get your extension ID:');
    console.error('  1. Load extension in Chrome (Developer mode)');
    console.error('  2. Copy ID from chrome://extensions');
    process.exit(1);
  }
  
  console.log('Installing native messaging host...');
  console.log(`Extension ID: ${extensionId}`);
  console.log(`Platform: ${os.platform()}`);
  console.log('');
  
  const platform = os.platform();
  
  if (platform === 'win32') {
    installManifestWindows(extensionId);
  } else {
    installManifestUnix(extensionId);
  }
}

main();

