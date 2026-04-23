document.addEventListener('DOMContentLoaded', () => {
    // Main View Elements
    const mainView = document.getElementById('main-view');
    const settingsView = document.getElementById('settings-view');
    const settingsBtn = document.getElementById('settings-btn');
    const backBtn = document.getElementById('back-btn');
    const markerCount = document.getElementById('marker-count');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const markersList = document.getElementById('markers-list');
    
    // Settings Elements
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const shortcutDisplay = document.getElementById('shortcut-display');
    const openShortcuts = document.getElementById('open-shortcuts');

    // Define standard colors from the mock
    const badgeColors = [
        '#FCA5A5', // 1: red/pink
        '#3B82F6', // 2: blue 
        '#6EE7B7', // 3: light green
        '#FDBA74', // 4: orange
        '#C084FC', // 5: purple
        '#FCD34D', // 6: yellow
        '#2DD4BF', // 7: teal
        '#F472B6'  // 8: pink 
    ];
    
    let currentTabUrl = '';
    let currentHighlights = [];

    // Navigation
    settingsBtn.addEventListener('click', () => {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
    });

    backBtn.addEventListener('click', () => {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    // Retrieve all highlights for sidepanel
    function updateAllHighlights() {
        chrome.storage.local.get(null, (allData) => {
            const highlightKeys = Object.keys(allData).filter(key => key.startsWith('highlights_local_'));

            if (highlightKeys.length === 0) {
                clearAllBtn.style.display = 'none';
                markerCount.textContent = '0 markers';
                markersList.innerHTML = '';
                return;
            }

            // Hide clear all since we are showing global highlights (or we can keep it to clear everything, but let's hide to be safe)
            clearAllBtn.style.display = 'none';
            markersList.innerHTML = '';

            let totalCount = 0;
            const groupedHighlights = {};
            highlightKeys.forEach(key => {
                const url = key.replace('highlights_local_', '');
                groupedHighlights[url] = allData[key];
                totalCount += allData[key].length;
            });

            markerCount.textContent = `${totalCount} marker${totalCount !== 1 ? 's' : ''}`;

            const sortedUrls = Object.keys(groupedHighlights).sort((a, b) => {
                const timeA = groupedHighlights[a][0]?.timestamp || 0;
                const timeB = groupedHighlights[b][0]?.timestamp || 0;
                return timeB - timeA; // Newest first
            });

            sortedUrls.forEach(url => {
                const highlights = groupedHighlights[url];
                if (!highlights || highlights.length === 0) return;

                let domain = url;
                let faviconUrl = '';
                try {
                    const urlObj = new URL(url);
                    domain = urlObj.hostname;
                    faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${urlObj.hostname}`;
                } catch (e) {
                    faviconUrl = 'icons/icon16.png';
                }

                // Create Domain Header
                const groupContainer = document.createElement('div');
                groupContainer.className = 'domain-group';
                groupContainer.style.marginBottom = '20px';

                const displayTitle = (highlights.find(h => h.pageTitle)?.pageTitle) || domain;

                const header = document.createElement('div');
                header.className = 'domain-header';
                header.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 0; font-weight: 600; font-size: 13px; color: #111827; cursor: pointer; user-select: none;';
                
                // Fetch previously saved expanded state for this specific domain
                const expandedDomains = JSON.parse(localStorage.getItem('hl_expanded_domains') || '{}');
                let expanded = expandedDomains[domain] === true;

                header.innerHTML = `
                    <svg class="domain-fold-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: #9CA3AF; transition: transform 0.2s ease; transform: rotate(${expanded ? '90deg' : '0deg'}); flex-shrink: 0;">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <img src="${faviconUrl}" onerror="this.src='icons/icon16.png'" style="width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;">
                    <span style="flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</span>
                    <span style="color: #6B7280; font-weight: 400; flex-shrink: 0;">${highlights.length}</span>
                `;

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'domain-items';
                itemsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 8px;';
                itemsContainer.style.display = expanded ? 'flex' : 'none';

                highlights.forEach((h, index) => {
                    const item = document.createElement('div');
                    item.className = 'marker-item';
                    
                    const color = badgeColors[index % badgeColors.length];
                    
                    item.innerHTML = `
                        <div class="marker-badge" style="background-color: ${color}; width: 20px; height: 20px; font-size: 10px;">${index + 1}</div>
                        <div class="marker-text" title="${h.text.replace(/"/g, '&quot;')}">${h.text}</div>
                        <svg class="marker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px;">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    `;

                    item.addEventListener('click', () => {
                        // visually set active
                        document.querySelectorAll('.marker-item').forEach(el => el.classList.remove('active'));
                        item.classList.add('active');

                        const fragment = `#:~:text=${encodeURIComponent(h.text)}`;
                        chrome.tabs.create({ url: url + fragment });
                    });

                    itemsContainer.appendChild(item);
                });

                // Toggle expansion
                header.addEventListener('click', () => {
                    expanded = !expanded;
                    itemsContainer.style.display = expanded ? 'flex' : 'none';
                    
                    // Rotate the icon
                    const icon = header.querySelector('.domain-fold-icon');
                    if (icon) {
                        icon.style.transform = `rotate(${expanded ? '90deg' : '0deg'})`;
                    }

                    // Save state persistently per domain
                    const currentStates = JSON.parse(localStorage.getItem('hl_expanded_domains') || '{}');
                    currentStates[domain] = expanded;
                    localStorage.setItem('hl_expanded_domains', JSON.stringify(currentStates));
                });

                groupContainer.appendChild(header);
                groupContainer.appendChild(itemsContainer);
                markersList.appendChild(groupContainer);
            });
        });
    }

    // Replace the tab listeners with simple logic
    chrome.tabs.onActivated.addListener(updateAllHighlights);

    // Listen to storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            const hasChange = Object.keys(changes).some(key => key.startsWith('highlights_local_'));
            if (hasChange) {
                updateAllHighlights();
            }
        }
    });

    // Initial load
    updateAllHighlights();

    // ==========================================
    // Settings Logic (Theme and Shortcuts)
    // ==========================================

    chrome.commands.getAll((commands) => {
        const highlightCommand = commands.find(c => c.name === 'add-highlight');
        if (highlightCommand && highlightCommand.shortcut) {
            shortcutDisplay.textContent = highlightCommand.shortcut;
        } else {
            shortcutDisplay.textContent = 'Not set';
        }
    });

    openShortcuts.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    chrome.storage.local.get(['hl_theme'], (result) => {
        const savedTheme = result.hl_theme || 'vibrant';
        const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (radio) radio.checked = true;
    });

    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            chrome.storage.local.set({ hl_theme: newTheme }, () => {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'theme-changed', theme: newTheme }).catch(() => { });
                    });
                });
            });
        });
    });
});
