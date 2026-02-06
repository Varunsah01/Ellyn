// Ellyn Background Service Worker
// Handles messaging between sidepanel and content scripts

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Relay messages from sidepanel to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractProfile') {
    // Forward to content script in the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }

      const tab = tabs[0];

      // Check if we're on LinkedIn
      if (!tab.url || !tab.url.includes('linkedin.com/in/')) {
        sendResponse({ success: false, error: 'Not on a LinkedIn profile page' });
        return;
      }

      // Inject content script if not already loaded, then send message
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/linkedin-extractor.js'],
      }).then(() => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractProfile' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      }).catch((err) => {
        sendResponse({ success: false, error: 'Cannot access this page: ' + err.message });
      });
    });

    return true; // Keep message channel open for async response
  }

  if (message.action === 'getActiveTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url, title: tabs[0].title });
      } else {
        sendResponse({ url: '', title: '' });
      }
    });
    return true;
  }
});

// Listen for tab updates to notify sidepanel
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Broadcast tab change to sidepanel
    chrome.runtime.sendMessage({
      action: 'tabUpdated',
      url: tab.url || '',
      title: tab.title || '',
    }).catch(() => {
      // Sidepanel might not be open - ignore
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    chrome.runtime.sendMessage({
      action: 'tabUpdated',
      url: tab.url || '',
      title: tab.title || '',
    }).catch(() => {});
  });
});

console.log('[Ellyn] Background service worker loaded');
