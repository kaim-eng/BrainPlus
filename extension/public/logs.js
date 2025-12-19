// Log Viewer Script
let allLogs = [];
let filteredLogs = [];
let autoRefreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
  setupEventListeners();
  setupAutoRefresh();
});

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', loadLogs);
  document.getElementById('exportBtn').addEventListener('click', exportToFile);
  document.getElementById('copyBtn').addEventListener('click', copyAllLogs);
  document.getElementById('clearBtn').addEventListener('click', clearLogs);
  document.getElementById('filterLevel').addEventListener('change', applyFilters);
  document.getElementById('filterContext').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('autoRefresh').addEventListener('change', (e) => {
    if (e.target.checked) {
      setupAutoRefresh();
    } else {
      clearInterval(autoRefreshInterval);
    }
  });
}

function setupAutoRefresh() {
  clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    if (document.getElementById('autoRefresh').checked) {
      loadLogs();
    }
  }, 3000);
}

async function loadLogs() {
  try {
    const result = await chrome.storage.local.get('debug_logs');
    allLogs = result.debug_logs || [];
    applyFilters();
    updateStats();
  } catch (error) {
    console.error('Failed to load logs:', error);
    showStatus('Failed to load logs', 'error');
  }
}

function applyFilters() {
  const levelFilter = document.getElementById('filterLevel').value;
  const contextFilter = document.getElementById('filterContext').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  filteredLogs = allLogs.filter(log => {
    // Level filter
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    
    // Context filter
    if (contextFilter !== 'all' && log.context !== contextFilter) return false;
    
    // Search filter
    if (searchTerm) {
      const searchableText = `${log.message} ${JSON.stringify(log.data || '')}`.toLowerCase();
      if (!searchableText.includes(searchTerm)) return false;
    }
    
    return true;
  });

  renderLogs();
}

function renderLogs() {
  const container = document.getElementById('logsContainer');
  
  if (filteredLogs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path></svg>
        <h2>No logs match your filters</h2>
        <p>Try adjusting your search criteria</p>
      </div>
    `;
    return;
  }

  // Render logs in reverse order (newest first)
  container.innerHTML = filteredLogs.reverse().map(log => `
    <div class="log-entry ${log.level}">
      <div class="log-header">
        <span class="log-badge ${log.level}">${log.level}</span>
        <span class="log-badge context">${log.context}</span>
        <span class="log-time">${formatTime(log.timestamp)}</span>
      </div>
      <div class="log-message">${escapeHtml(log.message)}</div>
      ${log.data ? `<div class="log-data">${escapeHtml(JSON.stringify(log.data, null, 2))}</div>` : ''}
      ${log.stack ? `<div class="log-data">${escapeHtml(log.stack)}</div>` : ''}
    </div>
  `).join('');
}

function updateStats() {
  const errorCount = allLogs.filter(log => log.level === 'error').length;
  const warnCount = allLogs.filter(log => log.level === 'warn').length;
  
  document.getElementById('totalCount').textContent = allLogs.length;
  document.getElementById('errorCount').textContent = errorCount;
  document.getElementById('warnCount').textContent = warnCount;
  document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
}

async function exportToFile() {
  try {
    const text = await formatLogsAsText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-logs-${Date.now()}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
    showStatus('Logs exported successfully!', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    showStatus('Export failed', 'error');
  }
}

async function copyAllLogs() {
  try {
    const text = await formatLogsAsText();
    await navigator.clipboard.writeText(text);
    showStatus('Logs copied to clipboard!', 'success');
  } catch (error) {
    console.error('Copy failed:', error);
    showStatus('Copy failed', 'error');
  }
}

async function clearLogs() {
  if (!confirm('Are you sure you want to clear all logs?')) return;
  
  try {
    await chrome.storage.local.remove('debug_logs');
    allLogs = [];
    filteredLogs = [];
    renderLogs();
    updateStats();
    showStatus('Logs cleared', 'success');
  } catch (error) {
    console.error('Clear failed:', error);
    showStatus('Clear failed', 'error');
  }
}

function formatLogsAsText() {
  return allLogs.map(log => {
    let text = `[${log.timestamp}] [${log.context.toUpperCase()}] [${log.level.toUpperCase()}] ${log.message}`;
    if (log.data) {
      text += `\nData: ${JSON.stringify(log.data, null, 2)}`;
    }
    if (log.stack) {
      text += `\nStack: ${log.stack}`;
    }
    return text;
  }).join('\n\n---\n\n');
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString() + '.' + date.getMilliseconds();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.style.background = type === 'error' ? '#f44336' : '#388e3c';
  statusEl.classList.add('show');
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

