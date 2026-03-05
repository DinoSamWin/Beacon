document.addEventListener('DOMContentLoaded', () => {
    const shortcutDisplay = document.getElementById('shortcut-display');
    const openShortcuts = document.getElementById('open-shortcuts');
    const clearBtn = document.getElementById('clear-btn');
    const confirmDialog = document.getElementById('confirm-dialog');
    const cancelClear = document.getElementById('cancel-clear');
    const confirmClear = document.getElementById('confirm-clear');
    const themeRadios = document.querySelectorAll('input[name="theme"]');

    // Load shortcut
    chrome.commands.getAll((commands) => {
        const highlightCommand = commands.find(c => c.name === 'add-highlight');
        if (highlightCommand && highlightCommand.shortcut) {
            shortcutDisplay.textContent = highlightCommand.shortcut;
        } else {
            shortcutDisplay.textContent = 'Not set';
        }
    });

    // Open shortcuts settings
    openShortcuts.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    // Theme Selection
    chrome.storage.local.get(['hl_theme'], (result) => {
        const savedTheme = result.hl_theme || 'vibrant';
        const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (radio) radio.checked = true;
    });

    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            chrome.storage.local.set({ hl_theme: newTheme }, () => {
                // Notify lively to all active tabs to update blocks
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'theme-changed', theme: newTheme }).catch(() => { });
                    });
                });
            });
        });
    });

    // Clear page highlights interaction
    clearBtn.addEventListener('click', () => {
        clearBtn.classList.add('hidden');
        confirmDialog.classList.remove('hidden');
    });

    cancelClear.addEventListener('click', () => {
        confirmDialog.classList.add('hidden');
        clearBtn.classList.remove('hidden');
    });

    confirmClear.addEventListener('click', () => {
        // Send message to content script of active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'clear-highlights' }, () => {
                    if (chrome.runtime.lastError) {
                        // Fallback manual URL cleanup
                        const urlObj = new URL(tabs[0].url);
                        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                            const key = `highlights_local_${urlObj.origin}${urlObj.pathname}`;
                            chrome.storage.local.remove([key]);
                        }
                    }
                    confirmDialog.classList.add('hidden');
                    clearBtn.classList.remove('hidden');
                });
            }
        });
    });
});
