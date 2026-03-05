const THEMES = {
    vibrant: [
        'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)', // Pink
        'linear-gradient(135deg, #84FAB0 0%, #8FD3F4 100%)', // Mint/Blue
        'linear-gradient(135deg, #FFECD2 0%, #FCB69F 100%)', // Peach
        'linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)', // Purple
        'linear-gradient(135deg, #89F7FE 0%, #66A6FF 100%)', // Bright Blue
        'linear-gradient(135deg, #FDDB92 0%, #D1FDFF 100%)'  // Yellow/Cyan
    ],
    pastel: [
        '#EE39B2', '#6979F3', '#23B0FF', '#FF9202', '#FF615E', '#10B981'
    ],
    ocean: [
        '#37BBC8', '#0191B4', '#F8D70E', '#D2DE18', '#FE7A15', '#0EA5E9'
    ],
    sunset: [
        '#F0EAD8', '#F73668', '#FF7F75', '#021E66', '#FB7185', '#F43F5E'
    ],
    aurora: [
        '#D7B0DB', '#3A3087', '#753BA5', '#6B79CE', '#EC5955', '#A78BFA'
    ],
    monochrome: [
        '#333333', '#555555', '#777777', '#999999', '#AAAAAA', '#CCCCCC'
    ]
};

const THEMES_SOLID = {
    vibrant: ['rgba(255, 154, 158, 0.4)', 'rgba(132, 250, 176, 0.4)', 'rgba(255, 236, 210, 0.6)', 'rgba(161, 140, 209, 0.4)', 'rgba(137, 247, 254, 0.4)', 'rgba(253, 219, 146, 0.6)'],
    pastel: ['rgba(238, 57, 178, 0.4)', 'rgba(105, 121, 243, 0.4)', 'rgba(35, 176, 255, 0.4)', 'rgba(255, 146, 2, 0.4)', 'rgba(255, 97, 94, 0.4)', 'rgba(16, 185, 129, 0.4)'],
    ocean: ['rgba(55, 187, 200, 0.4)', 'rgba(1, 145, 180, 0.4)', 'rgba(248, 215, 14, 0.4)', 'rgba(210, 222, 24, 0.5)', 'rgba(254, 122, 21, 0.4)', 'rgba(14, 165, 233, 0.4)'],
    sunset: ['rgba(240, 234, 216, 0.6)', 'rgba(247, 54, 104, 0.4)', 'rgba(255, 127, 117, 0.4)', 'rgba(2, 30, 102, 0.4)', 'rgba(251, 113, 133, 0.4)', 'rgba(244, 63, 94, 0.4)'],
    aurora: ['rgba(215, 176, 219, 0.4)', 'rgba(58, 48, 135, 0.4)', 'rgba(117, 59, 165, 0.4)', 'rgba(107, 121, 206, 0.4)', 'rgba(236, 89, 85, 0.4)', 'rgba(167, 139, 250, 0.4)'],
    monochrome: ['rgba(51, 51, 51, 0.3)', 'rgba(85, 85, 85, 0.3)', 'rgba(119, 119, 119, 0.3)', 'rgba(153, 153, 153, 0.3)', 'rgba(170, 170, 170, 0.3)', 'rgba(204, 204, 204, 0.3)']
};

let activeColors = THEMES.vibrant;
let activeSolidColors = THEMES_SOLID.vibrant;

let highlightContainer = null;
let toastElement = null;
let toastTimeout = null;

function init() {
    chrome.storage.local.get(['hl_theme'], (result) => {
        if (result.hl_theme && THEMES[result.hl_theme]) {
            activeColors = THEMES[result.hl_theme];
            activeSolidColors = THEMES_SOLID[result.hl_theme] || THEMES_SOLID.vibrant;
        }
        updateMarkerVars();
        createContainer();
        createToast();
        loadHighlights();
    });
}

function updateMarkerVars() {
    activeSolidColors.forEach((color, i) => {
        document.documentElement.style.setProperty(`--hl-ext-marker-${i}`, color);
    });
}

function getUrlKey() {
    // Modify to match across query param and hash changes.
    // Use origin + pathname to group same-page variations (like ChatGPT chats).
    const url = new URL(window.location.href);
    return `highlights_local_${url.origin}${url.pathname}`;
}

function createContainer() {
    if (!highlightContainer) {
        highlightContainer = document.createElement('div');
        highlightContainer.id = 'hl-ext-container';
        document.body.appendChild(highlightContainer);
    }
}

function createToast() {
    if (!toastElement) {
        toastElement = document.createElement('div');
        toastElement.id = 'hl-ext-toast';
        document.body.appendChild(toastElement);
    }
}

// Track URL changes for SPAs (Single Page Applications)
let lastUrl = location.href;
let redrawTimeout = null;
let currentlyRenderedHighlightIds = "";

new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        setTimeout(() => {
            try { loadHighlights(); } catch (e) { }
        }, 500);
    } else {
        clearTimeout(redrawTimeout);
        redrawTimeout = setTimeout(() => {
            chrome.storage.local.get([getUrlKey()], (result) => {
                const highlights = result[getUrlKey()] || [];
                if (highlights.length === 0) return;

                const pageText = document.body ? (document.body.innerText || '').replace(/\s+/g, ' ') : '';
                const newIds = highlights.filter(h => {
                    const looseH = h.text.replace(/\s+/g, ' ');
                    return pageText.includes(looseH);
                }).map(h => h.id).join(',');

                if (newIds !== currentlyRenderedHighlightIds) {
                    try { loadHighlights(); } catch (e) { }
                }
            });
        }, 1000); // 1s debounce
    }
}).observe(document, { subtree: true, childList: true });

function scanDOMForHighlights(highlights) {
    const requiredTexts = Array.from(new Set(highlights.map(h => h.text)));
    const occurrencesMap = {};
    requiredTexts.forEach(t => occurrencesMap[t] = []);
    const globalOrder = new Map();

    const textNodes = [];
    let rawText = "";

    // 1. Gather all text nodes and build a raw string
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let n;
    while ((n = walker.nextNode())) {
        const parentTag = n.parentElement ? n.parentElement.tagName.toLowerCase() : '';
        if (parentTag === 'script' || parentTag === 'style' || parentTag === 'noscript') continue;

        textNodes.push({
            node: n,
            start: rawText.length,
            end: rawText.length + n.nodeValue.length
        });
        rawText += n.nodeValue;
    }

    // 2. Build normalized maps
    let normToRaw = [];
    let normText = "";

    let superNormToRaw = []; // Map alpha-only characters back to raw indices
    let superNormText = "";

    for (let i = 0; i < rawText.length; i++) {
        const char = rawText[i];

        // --- Standard Normalization (Collapsing whitespace) ---
        if (/\s/.test(char)) {
            if (!normText.endsWith(" ")) {
                normToRaw.push(i);
                normText += " ";
            }
        } else {
            normToRaw.push(i);
            normText += char;
        }

        // --- Super Normalization (Alpha-Digit only) ---
        // This is the ultimate fallback for when symbols/bullets break the string
        if (/[a-zA-Z0-9\u4e00-\u9fa5]/.test(char)) { // Support Alphanumeric + Chinese
            superNormToRaw.push(i);
            superNormText += char;
        }
    }

    // Function to find occurrences of a string in the normalized map
    function findOccurrences(originalText) {
        const searchNorm = originalText.replace(/\s+/g, " ").trim();
        if (!searchNorm) return [];

        const matches = [];
        let startPos = 0;

        // --- 1. Try Exact Match ---
        while ((startPos = normText.indexOf(searchNorm, startPos)) !== -1) {
            const endPos = startPos + searchNorm.length;
            const rawStart = normToRaw[startPos];
            const rawEnd = normToRaw[endPos - 1] + 1;

            const startNodeObj = textNodes.find(tn => rawStart >= tn.start && rawStart < tn.end);
            const endNodeObj = textNodes.find(tn => rawEnd > tn.start && rawEnd <= tn.end);

            if (startNodeObj && endNodeObj) {
                matches.push({
                    startNode: startNodeObj.node, startOffset: rawStart - startNodeObj.start,
                    endNode: endNodeObj.node, endOffset: rawEnd - endNodeObj.start,
                    rawStart: rawStart, isFuzzy: false
                });
            }
            startPos += 1;
        }

        // --- 2. Robust Fallback (Fuzzy Head-Tail) ---
        if (matches.length === 0 && searchNorm.length > 60) {
            const head = searchNorm.substring(0, 30);
            const tail = searchNorm.substring(searchNorm.length - 30);

            let headPos = 0;
            while ((headPos = normText.indexOf(head, headPos)) !== -1) {
                const lookaheadLimit = headPos + searchNorm.length + 1000;
                let tailPos = normText.indexOf(tail, headPos + head.length);
                if (tailPos !== -1 && tailPos < lookaheadLimit) {
                    const rawStart = normToRaw[headPos];
                    const rawEnd = normToRaw[tailPos + tail.length - 1] + 1;
                    const startNodeObj = textNodes.find(tn => rawStart >= tn.start && rawStart < tn.end);
                    const endNodeObj = textNodes.find(tn => rawEnd > tn.start && rawEnd <= tn.end);
                    if (startNodeObj && endNodeObj) {
                        matches.push({
                            startNode: startNodeObj.node, startOffset: rawStart - startNodeObj.start,
                            endNode: endNodeObj.node, endOffset: rawEnd - endNodeObj.start,
                            rawStart: rawStart, isFuzzy: true
                        });
                    }
                }
                headPos += 1;
            }
        }

        // --- 3. The "Ultimate" Fallback: Super-Normalized Alpha Mapping ---
        // If everything else fails, we ignore all symbols, spaces, and formatting
        if (matches.length === 0) {
            const searchSuper = originalText.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
            if (searchSuper.length > 10) { // Only do this for meaningful chunks
                let sPos = 0;
                while ((sPos = superNormText.indexOf(searchSuper, sPos)) !== -1) {
                    const rawStart = superNormToRaw[sPos];
                    const rawEnd = superNormToRaw[sPos + searchSuper.length - 1] + 1;

                    const startNodeObj = textNodes.find(tn => rawStart >= tn.start && rawStart < tn.end);
                    const endNodeObj = textNodes.find(tn => rawEnd > tn.start && rawEnd <= tn.end);

                    if (startNodeObj && endNodeObj) {
                        matches.push({
                            startNode: startNodeObj.node, startOffset: rawStart - startNodeObj.start,
                            endNode: endNodeObj.node, endOffset: rawEnd - endNodeObj.start,
                            rawStart: rawStart, isFuzzy: true, isSuperFuzzy: true
                        });
                    }
                    sPos += 1;
                }
            }
        }

        return matches;
    }

    // 3. Populate map
    requiredTexts.forEach(text => {
        const matches = findOccurrences(text);
        occurrencesMap[text] = matches;
        matches.forEach((m, idx) => {
            globalOrder.set(`${text}-${idx}`, m.rawStart);
        });
    });

    return { occurrencesMap, globalOrder };
}

function loadHighlights() {
    const key = getUrlKey();
    chrome.storage.local.get([key], (result) => {
        const highlights = result[key] || [];

        if (highlightContainer) {
            highlightContainer.innerHTML = '';
        }

        if (highlights.length === 0) return;

        const { occurrencesMap, globalOrder } = scanDOMForHighlights(highlights);

        // Keep highlights broadly. If they cross nodes, TreeWalker might miss them,
        // but they should still appear on the side panel. Unloaded highlights shouldn't be blindly deleted automatically.
        const pageText = document.body ? document.body.innerText || '' : '';
        const validHighlights = highlights.filter(h => {
            const looseText = h.text.replace(/\s+/g, '');
            const loosePage = pageText.replace(/\s+/g, '');
            return loosePage.includes(looseText) || (occurrencesMap[h.text] && occurrencesMap[h.text].length > 0);
        });

        validHighlights.sort((a, b) => {
            const orderA = globalOrder.has(`${a.text}-${a.occurrenceIndex || 0}`) ? globalOrder.get(`${a.text}-${a.occurrenceIndex || 0}`) : Number.MAX_SAFE_INTEGER;
            const orderB = globalOrder.has(`${b.text}-${b.occurrenceIndex || 0}`) ? globalOrder.get(`${b.text}-${b.occurrenceIndex || 0}`) : Number.MAX_SAFE_INTEGER;

            if (orderA === Number.MAX_SAFE_INTEGER && orderB === Number.MAX_SAFE_INTEGER) {
                return (a.top || 0) - (b.top || 0); // Fallback sort
            }
            return orderA - orderB;
        });

        currentlyRenderedHighlightIds = validHighlights.map(h => h.id).join(',');

        validHighlights.forEach((data, index) => {
            data.color = activeColors[index % activeColors.length];
            renderHighlightBlock(data, occurrencesMap);
        });

        applyDOMHighlights(validHighlights, occurrencesMap);

        if (validHighlights.length > 0) {
            const bottomBtn = document.createElement('div');
            bottomBtn.className = 'hl-ext-bottom-btn';
            bottomBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
            `;
            bottomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const lastData = validHighlights[validHighlights.length - 1];
                let found = false;
                if (lastData) {
                    const match = occurrencesMap[lastData.text][lastData.occurrenceIndex || 0];
                    if (match && match.startNode && match.startNode.parentElement) {
                        try {
                            match.startNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            found = true;
                        } catch (e) { }
                    }
                }
                if (!found) {
                    // Fallback: Find the element with the largest scrollHeight
                    const allElements = document.querySelectorAll('*');
                    let maxScrollEl = window;
                    let maxVal = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

                    allElements.forEach(el => {
                        if (el.scrollHeight > maxVal && window.getComputedStyle(el).overflowY !== 'hidden') {
                            maxVal = el.scrollHeight;
                            maxScrollEl = el;
                        }
                    });

                    if (maxScrollEl === window) {
                        window.scrollTo({ top: maxVal + 1000, behavior: 'smooth' });
                    } else {
                        maxScrollEl.scrollTo({ top: maxScrollEl.scrollHeight + 1000, behavior: 'smooth' });
                    }

                    // Final move: simulate an "End" keypress if it supports it
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
                }
            });
            bottomBtn.addEventListener('mouseenter', (e) => {
                showToast("Scroll to bottom", e.clientY, 'bottom-btn');
                bottomBtn.style.opacity = '1';
            });
            bottomBtn.addEventListener('mouseleave', () => {
                toastTimeout = setTimeout(() => hideToast(), 200);
            });

            highlightContainer.appendChild(bottomBtn);
        }
    });
}

function applyDOMHighlights(validHighlights, occurrencesMap) {
    if (!('highlights' in CSS)) return;

    // Clear old highlights mapped to our prefix
    for (let i = 0; i < 6; i++) {
        CSS.highlights.delete(`hl-ext-marker-${i}`);
    }

    // Map colors to ranges
    const highlightGroups = {};
    validHighlights.forEach((data, index) => {
        const colorIdx = index % 6; // Max 6 defined in CSS
        if (!highlightGroups[colorIdx]) highlightGroups[colorIdx] = [];

        const matches = occurrencesMap[data.text] || [];
        const match = matches[data.occurrenceIndex || 0];

        if (match) {
            try {
                const range = new Range();
                range.setStart(match.startNode, match.startOffset);
                range.setEnd(match.endNode, match.endOffset);
                highlightGroups[colorIdx].push(range);
            } catch (e) {
                console.warn("Could not create range for highlight", e);
            }
        }
    });

    Object.keys(highlightGroups).forEach(colorIdx => {
        if (highlightGroups[colorIdx].length > 0) {
            const highlight = new Highlight(...highlightGroups[colorIdx]);
            CSS.highlights.set(`hl-ext-marker-${colorIdx}`, highlight);
        }
    });
}

function saveHighlight(highlightData, callback) {
    const key = getUrlKey();
    chrome.storage.local.get([key], (result) => {
        const highlights = result[key] || [];
        highlights.push(highlightData);
        chrome.storage.local.set({ [key]: highlights }, () => {
            if (callback) callback();
        });
    });
}

function deleteHighlight(id) {
    const key = getUrlKey();
    chrome.storage.local.get([key], (result) => {
        let highlights = result[key] || [];
        highlights = highlights.filter(h => h.id !== id);
        chrome.storage.local.set({ [key]: highlights }, () => {
            const block = document.getElementById(`hl-ext-block-${id}`);
            if (block) {
                block.remove();
            }
            hideToast();
            loadHighlights(); // Refresh CSS highlights on screen
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'create-highlight') {
        try {
            handleHighlightAction();
        } catch (e) {
            console.error("Error creating highlight:", e);
            showToast("⚠️ Error creating highlight: " + e.message, 50, 'error');
        }
    } else if (request.action === 'clear-highlights') {
        clearPageHighlights();
    } else if (request.action === 'theme-changed') {
        if (request.theme && THEMES[request.theme]) {
            activeColors = THEMES[request.theme];
            activeSolidColors = THEMES_SOLID[request.theme] || THEMES_SOLID.vibrant;
            updateMarkerVars();
            loadHighlights();
        }
    }
    // Always call sendResponse to avoid "Message port closed" error in Extension Dashboard
    if (typeof sendResponse === 'function') sendResponse({ status: 'ok' });
    return true;
});

function handleHighlightAction() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        return;
    }

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // We calculate a naive absolute Y position just to know the vertical order of highlights.
    // It doesn't need to be perfectly scaled anymore, just enough to sort them.
    let scrollContainer = document.documentElement;
    let node = range.startContainer;
    while (node && node !== document.body && node !== document.documentElement && node.nodeType === 1) {
        const style = window.getComputedStyle(node);
        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && (node.scrollHeight > node.clientHeight + 10);
        if (isScrollable) {
            scrollContainer = node;
            break;
        }
        node = node.parentNode;
    }

    let top = 0;
    if (scrollContainer === document.documentElement || scrollContainer === document.body) {
        top = rect.top + window.scrollY;
    } else {
        const containerRect = scrollContainer.getBoundingClientRect();
        top = (rect.top - containerRect.top) + scrollContainer.scrollTop;
    }

    const key = getUrlKey();
    chrome.storage.local.get([key], (result) => {
        const highlights = result[key] || [];

        // Calculate exact occurrenceIndex of this highlight among identical texts
        const { occurrencesMap } = scanDOMForHighlights([{ text: text }]);
        let matches = occurrencesMap[text] || [];

        // Fallback: if exact match fails during creation (cross-node with spacing), 
        // try finding the normalized closest match to current selection location
        if (matches.length === 0) {
            const fresh = scanDOMForHighlights([]); // Generic scan
            // We'd have to use the selection range to find the path, 
            // but let's stick to smarter indexing.
        }

        let bestDist = Infinity;
        let targetOccurrence = 0;
        const targetRect = range.getBoundingClientRect();

        matches.forEach((match, i) => {
            try {
                const matchRange = document.createRange();
                matchRange.setStart(match.startNode, match.startOffset);
                matchRange.setEnd(match.endNode, match.endOffset);
                const matchRect = matchRange.getBoundingClientRect();

                const dist = Math.abs(matchRect.top - targetRect.top) + Math.abs(matchRect.left - targetRect.left);
                if (dist < bestDist) {
                    bestDist = dist;
                    targetOccurrence = i;
                }
            } catch (e) {
                if (match.startNode && match.startNode.parentElement) {
                    const fallbackRect = match.startNode.parentElement.getBoundingClientRect();
                    const dist = Math.abs(fallbackRect.top - targetRect.top);
                    if (dist < bestDist) {
                        bestDist = dist;
                        targetOccurrence = i;
                    }
                }
            }
        });

        const occurrenceIndex = targetOccurrence;

        // Deduplication check: only reject if the SAME occurrence is highlighted
        if (highlights.some(h => h.text === text && (h.occurrenceIndex || 0) === occurrenceIndex)) {
            // Re-render blocks instead of blindly creating Toast to prevent spam if user is retrying 
            showToast("⚠️ Text already highlighted!", rect.top + window.scrollY, 'duplicate');
            return;
        }

        const colorIndex = highlights.length % activeColors.length;
        const color = activeColors[colorIndex];

        const highlightData = {
            id: Date.now().toString(),
            text: text,
            occurrenceIndex: occurrenceIndex,
            color: color,
            top: top,
            timestamp: Date.now()
        };

        saveHighlight(highlightData, () => {
            // Re-render all highlights so they map to the newest document height scale
            loadHighlights();
        });
    });
}

function renderHighlightBlock(data, occurrencesMap) {
    createContainer(); // Ensure container exists

    const block = document.createElement('div');
    block.className = 'hl-ext-block';
    block.id = `hl-ext-block-${data.id}`;

    // Set a fixed height for stackable blocks, let CSS handle gap/margin
    block.style.background = data.color;

    block.addEventListener('mouseenter', (e) => {
        showToast(data.text, e.clientY, data.id);
    });

    block.addEventListener('mouseleave', () => {
        toastTimeout = setTimeout(() => {
            hideToast();
        }, 200);
    });

    block.addEventListener('click', (e) => {
        e.stopPropagation();

        // Safe fetch from map
        let match = null;
        if (occurrencesMap) {
            const matches = occurrencesMap[data.text] || [];
            match = matches[data.occurrenceIndex || 0];
        } else {
            // Fallback if occurrencesMap not passed dynamically
            const freshMap = scanDOMForHighlights([{ text: data.text }]).occurrencesMap;
            const freshMatches = freshMap[data.text] || [];
            match = freshMatches[data.occurrenceIndex || 0];
        }

        if (match && match.startNode && match.startNode.parentElement) {
            match.startNode.parentElement.scrollIntoView({ behavior: "smooth", block: "center" });

            // Optional: briefly natively select it to physically guide the user's eyes
            try {
                const selection = window.getSelection();
                selection.removeAllRanges();
                const range = document.createRange();
                range.setStart(match.startNode, match.startOffset);
                range.setEnd(match.endNode, match.endOffset);
                selection.addRange(range);

                // Remove selection after a moment
                setTimeout(() => {
                    const currentSelection = window.getSelection();
                    if (currentSelection.rangeCount > 0 && currentSelection.getRangeAt(0).startContainer === match.startNode) {
                        currentSelection.removeAllRanges();
                    }
                }, 800);
            } catch (err) { }

        } else {
            // Fallback scroll to absolute position if strictly DOM-matched failed (e.g. cross-node texts)
            window.scrollTo({ top: data.top || 0, behavior: 'smooth' });
            showToast("ℹ️ Scrolled to approximate location.", e.clientY, data.id);
        }
    });

    highlightContainer.appendChild(block);
}

function showToast(text, clientY, id) {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    const isBottomBtn = id === 'bottom-btn';
    toastElement.innerHTML = `
    <div class="hl-ext-toast-content">${text}</div>
    ${!isBottomBtn ? `<div class="hl-ext-toast-delete" data-id="${id}">×</div>` : ''}
  `;

    // Prevent immediate hide if mouse enters toast
    toastElement.addEventListener('mouseenter', () => {
        if (toastTimeout) clearTimeout(toastTimeout);
    }, { once: true });

    toastElement.addEventListener('mouseleave', () => {
        hideToast();
    }, { once: true });

    const deleteBtn = toastElement.querySelector('.hl-ext-toast-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // don't trigger block click
            deleteHighlight(id);
        }, { once: true });
    }

    toastElement.classList.add('hl-ext-toast-visible');

    let topPos = clientY - 20;
    if (topPos < 10) topPos = 10;

    toastElement.style.top = `${topPos}px`;
}

function hideToast() {
    toastElement.classList.remove('hl-ext-toast-visible');
}

function clearPageHighlights() {
    const key = getUrlKey();
    chrome.storage.local.remove([key], () => {
        if (highlightContainer) {
            highlightContainer.innerHTML = '';
        }
        if ('highlights' in CSS) {
            for (let i = 0; i < 6; i++) {
                CSS.highlights.delete(`hl-ext-marker-${i}`);
            }
        }
    });
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Fallback direct Keyboard Shortcut Listener directly in DOM
// In case chrome.commands in background.js fails to register due to OS conflicts or extension reloading bugs
let isMac = navigator.userAgent.includes("Mac");
document.addEventListener('keydown', (e) => {
    // Check for Alt+Shift+F (Windows) or Cmd+Shift+F (Mac)
    const isModifierPressed = isMac ? e.metaKey : e.altKey;
    if (isModifierPressed && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault(); // Prevent standard browser find
        try {
            handleHighlightAction();
        } catch (err) {
            console.error("Direct shortcut fallback error:", err);
        }
    }
});
