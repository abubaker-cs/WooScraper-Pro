// UI Elements
const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const tableBody = document.getElementById('tableBody');
const productCount = document.getElementById('productCount');
const consoleBox = document.getElementById('consoleBox');

let extractedDataset = [];

// Helper: Add log to terminal
function logToConsole(message, type = 'normal') {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
  consoleBox.appendChild(entry);
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

// Helper: Add row to live preview table
function addPreviewRow(item) {
  if (tableBody.querySelector('.empty-state')) {
    tableBody.innerHTML = '';
  }
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><span style="color:var(--text-muted)">${item.sku}</span></td>
    <td>${item.name}</td>
    <td style="color:var(--success); font-weight:500">${item.price}</td>
  `;
  tableBody.insertBefore(tr, tableBody.firstChild);
}

// Start Extraction
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  startBtn.innerText = "Engine Running...";
  logToConsole("Deploying extraction engine to active tab...", "system");

  // Get active tab
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Inject the scraper engine
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scraper.js']
  });
});

// Listen for live updates from scraper.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "log") {
    logToConsole(request.message, request.type);
    if(request.type === 'normal') statusText.innerText = request.message;
  } 
  
  else if (request.action === "progress") {
    const percent = Math.floor((request.current / request.total) * 100);
    progressBar.style.width = `${percent}%`;
    progressPercent.innerText = `${percent}%`;
    productCount.innerText = `${request.current} / ${request.total}`;
    addPreviewRow(request.item);
  } 
  
  else if (request.action === "complete") {
    extractedDataset = request.data; // Store data in memory for Step 3
    statusText.innerText = "Extraction complete.";
    startBtn.innerText = "Scan Complete";
    
    // Unlock the download button
    downloadBtn.disabled = false;
    downloadBtn.style.background = "var(--success)";
    downloadBtn.style.color = "#fff";
    downloadBtn.style.borderColor = "var(--success)";
    
    // Save data temporarily to Chrome local storage so we can format it in Step 3
    chrome.storage.local.set({ wooData: extractedDataset });
  }
});

// CSV Export Trigger (We will build the formatting logic in Step 3)
downloadBtn.addEventListener('click', () => {
  logToConsole("Exporting to CSV format...", "system");
  chrome.tabs.create({ url: "export.html" }); // We will build this page next
});

// Reset Engine Memory
document.getElementById('resetCacheBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to wipe the engine's memory? This will reset all extraction progress.")) {
        chrome.storage.local.clear(() => {
            alert("Memory wiped. The engine will start fresh on the next scan.");
            // Optional: reset your UI progress bars here to 0%
        });
    }
});