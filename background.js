chrome.commands.onCommand.addListener((command) => {
  if (command === 'add-highlight') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        // Safe message sending with callback to physically check lastError, 
        // which prevents Chrome from logging 'Unchecked runtime.lastError' to dashboard.
        chrome.tabs.sendMessage(tabs[0].id, { action: 'create-highlight' }, () => {
          const err = chrome.runtime.lastError;
          // Intentionally doing nothing with err to suppress it
        });
      }
    });
  }
});
// Setup side panel behavior to open natively on icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || tab.url.startsWith('chrome://')) return;

  // Ensure sidepanel is enabled for this tab and has the correct path
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // No longer need tabStates
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-shortcut') {
    chrome.commands.getAll((commands) => {
      const highlightCommand = commands.find(c => c.name === 'add-highlight');
      if (typeof sendResponse === 'function') {
        sendResponse(highlightCommand && highlightCommand.shortcut ? highlightCommand.shortcut : 'Not set');
      }
    });
    return true; // Keep channel open for async response
  }
  // Generic safe responder for other potential messages
  if (typeof sendResponse === 'function') sendResponse({ status: 'ok' });
});

// Setup fallback Context Menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-highlight",
    title: "Add Highlight",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-highlight" && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'create-highlight' }, () => {
      const err = chrome.runtime.lastError;
    });
  }
});
