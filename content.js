(function() {
    if (window.hlExtInitialized) return;
    window.hlExtInitialized = true;

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
    let globalValidHighlights = [];
    let globalOccurrencesMap = {};
    let fadeTimeout5s = null;
    let fadeTimeout15s = null;
    let isFirstHighlightEver = false;

    function resetFadeTimers(forceVisible = false) {
        clearTimeout(fadeTimeout5s);
        clearTimeout(fadeTimeout15s);
        if (highlightContainer) {
            highlightContainer.style.transition = 'opacity 0.5s ease';
            highlightContainer.style.opacity = '1';
        }
        
        if (!forceVisible) {
            startFadeTimers();
        }
    }

    function startFadeTimers() {
        if (isFirstHighlightEver) return; 

        clearTimeout(fadeTimeout5s);
        clearTimeout(fadeTimeout15s);
        
        // New rule: After 5s go to 10%
        fadeTimeout5s = setTimeout(() => {
            if (highlightContainer) {
                highlightContainer.style.transition = 'opacity 1s ease';
                highlightContainer.style.opacity = '0.1';
            }
        }, 5000);
    }

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
            
            [1000, 3000, 6000].forEach(delay => {
                setTimeout(() => {
                    try { loadHighlights(); } catch (e) { }
                }, delay);
            });
        });
    }

    function updateMarkerVars() {
        activeSolidColors.forEach((color, i) => {
            document.documentElement.style.setProperty(`--hl-ext-marker-${i}`, color);
        });
    }

    function getUrlKey() {
        const url = new URL(window.location.href);
        return `highlights_local_${url.origin}${url.pathname}`;
    }

    function createContainer() {
        if (!highlightContainer) {
            highlightContainer = document.createElement('div');
            highlightContainer.id = 'hl-ext-container';
            
            highlightContainer.addEventListener('mouseenter', () => {
                resetFadeTimers();
                if (globalValidHighlights && globalValidHighlights.length > 0) {
                    showToast(globalValidHighlights, globalOccurrencesMap);
                    highlightContainer.classList.add('hl-hidden');
                }
            });

            highlightContainer.addEventListener('mouseleave', () => {
                 startFadeTimers();
                 toastTimeout = setTimeout(() => hideToast(), 500);
            });
            
            startFadeTimers();
        }
        
        if (!document.getElementById('hl-ext-container') && document.body) {
            document.body.appendChild(highlightContainer);
        }
    }

    function createToast() {
        if (!toastElement) {
            toastElement = document.createElement('div');
            toastElement.id = 'hl-ext-toast';
            
            toastElement.addEventListener('mouseenter', () => {
                if (toastTimeout) clearTimeout(toastTimeout);
            });
            
            toastElement.addEventListener('mouseleave', () => {
                toastTimeout = setTimeout(() => hideToast(), 500);
            });

            document.body.appendChild(toastElement);
        }
    }

    let lastUrl = location.href;
    let redrawTimeout = null;
    let lastDrawTime = 0;

    function scheduleLoadHighlights() {
        const now = Date.now();
        if (now - lastDrawTime > 2000) {
            lastDrawTime = now;
            try { loadHighlights(); } catch(e) {}
        } else {
            clearTimeout(redrawTimeout);
            redrawTimeout = setTimeout(() => {
                lastDrawTime = Date.now();
                try { loadHighlights(); } catch(e) {}
            }, 600);
        }
    }

    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            [100, 1000, 3000].forEach(delay => {
                setTimeout(() => {
                    try { loadHighlights(); } catch (e) { }
                }, delay);
            });
        } else {
            scheduleLoadHighlights();
        }
    }).observe(document, { subtree: true, childList: true });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadHighlights();
        }
    });

    function scanDOMForHighlights(highlights) {
        const requiredTexts = Array.from(new Set(highlights.map(h => h.text)));
        const occurrencesMap = {};
        requiredTexts.forEach(t => occurrencesMap[t] = []);
        const globalOrder = new Map();

        const textNodes = [];
        let rawText = "";

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

        let normToRaw = [];
        let normText = "";
        let superNormToRaw = [];
        let superNormText = "";

        for (let i = 0; i < rawText.length; i++) {
            const char = rawText[i];
            if (/\s/.test(char)) {
                if (!normText.endsWith(" ")) {
                    normToRaw.push(i);
                    normText += " ";
                }
            } else {
                normToRaw.push(i);
                normText += char;
            }

            if (/[a-zA-Z0-9\u4e00-\u9fa5]/.test(char)) {
                superNormToRaw.push(i);
                superNormText += char;
            }
        }

        function findOccurrences(originalText) {
            const searchNorm = originalText.replace(/\s+/g, " ").trim();
            if (!searchNorm) return [];

            const matches = [];
            let startPos = 0;

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

            if (matches.length === 0) {
                const searchSuper = originalText.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
                if (searchSuper.length > 10) {
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
                if (highlights.length === 0) {
                    isFirstHighlightEver = false;
                    return;
                }
            }

            if (highlights.length === 0) return;

            const { occurrencesMap, globalOrder } = scanDOMForHighlights(highlights);
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
                    return (a.top || 0) - (b.top || 0);
                }
                return orderA - orderB;
            });

            globalValidHighlights = validHighlights;
            globalOccurrencesMap = occurrencesMap;

            validHighlights.forEach((data, index) => {
                data.color = activeColors[index % activeColors.length];
                renderHighlightBlock(data, occurrencesMap, validHighlights);
            });

            applyDOMHighlights(validHighlights, occurrencesMap);

            if (validHighlights.length > 0) {
                const bottomBtn = document.createElement('div');
                bottomBtn.className = 'hl-ext-bottom-btn';
                bottomBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                bottomBtn.addEventListener('mouseenter', () => {
                    if (globalValidHighlights && globalValidHighlights.length > 0) {
                        showToast(globalValidHighlights, globalOccurrencesMap);
                    }
                });
                highlightContainer.appendChild(bottomBtn);
            }

            if (isFirstHighlightEver) {
                resetFadeTimers(true);
            } else {
                // New rule: Start at 50% on reload, then fade to 10% via startFadeTimers
                if (highlightContainer && !highlightContainer.matches(':hover')) {
                     highlightContainer.style.opacity = '0.5';
                }
                startFadeTimers();
            }
        });
    }

    function applyDOMHighlights(validHighlights, occurrencesMap) {
        if (!('highlights' in CSS)) return;
        for (let i = 0; i < 6; i++) {
            CSS.highlights.delete(`hl-ext-marker-${i}`);
        }
        const highlightGroups = {};
        validHighlights.forEach((data, index) => {
            const colorIdx = index % 6;
            if (!highlightGroups[colorIdx]) highlightGroups[colorIdx] = [];
            const matches = occurrencesMap[data.text] || [];
            const match = matches[data.occurrenceIndex || 0];
            if (match) {
                try {
                    const range = new Range();
                    range.setStart(match.startNode, match.startOffset);
                    range.setEnd(match.endNode, match.endOffset);
                    highlightGroups[colorIdx].push(range);
                } catch (e) {}
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
                if (block) block.remove();
                hideToast();
                loadHighlights();
            });
        });
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'create-highlight') {
            try { handleHighlightAction(); } catch (e) {
                console.error("Error creating highlight:", e);
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
        if (typeof sendResponse === 'function') sendResponse({ status: 'ok' });
        return true;
    });

    function handleHighlightAction() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') return;
        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        let scrollContainer = document.documentElement;
        let node = range.startContainer;
        while (node && node !== document.body && node !== document.documentElement && node.nodeType === 1) {
            const style = window.getComputedStyle(node);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && (node.scrollHeight > node.clientHeight + 10)) {
                scrollContainer = node;
                break;
            }
            node = node.parentNode;
        }
        let top = (scrollContainer === document.documentElement || scrollContainer === document.body) ? (rect.top + window.scrollY) : ((rect.top - scrollContainer.getBoundingClientRect().top) + scrollContainer.scrollTop);
        const key = getUrlKey();
        chrome.storage.local.get([key], (result) => {
            const highlights = result[key] || [];
            if (highlights.length === 0) {
                isFirstHighlightEver = true;
            }
            const { occurrencesMap } = scanDOMForHighlights([{ text: text }]);
            let matches = occurrencesMap[text] || [];
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
                    if (dist < bestDist) { bestDist = dist; targetOccurrence = i; }
                } catch (e) {
                    if (match.startNode && match.startNode.parentElement) {
                        const dist = Math.abs(match.startNode.parentElement.getBoundingClientRect().top - targetRect.top);
                        if (dist < bestDist) { bestDist = dist; targetOccurrence = i; }
                    }
                }
            });
            const occurrenceIndex = targetOccurrence;
            if (highlights.some(h => h.text === text && (h.occurrenceIndex || 0) === occurrenceIndex)) return;
            const highlightData = {
                id: Date.now().toString(),
                text: text,
                occurrenceIndex: occurrenceIndex,
                color: activeColors[highlights.length % activeColors.length],
                top: top,
                timestamp: Date.now(),
                pageTitle: document.title.replace(/\s*-\s*ChatGPT$/, '').replace(/\s*-\s*Gemini$/, '').trim()
            };
            saveHighlight(highlightData, () => loadHighlights());
        });
    }

    function renderHighlightBlock(data, occurrencesMap, validHighlights) {
        createContainer();
        const block = document.createElement('div');
        block.className = 'hl-ext-block';
        block.id = `hl-ext-block-${data.id}`;
        block.style.background = data.color;
        block.addEventListener('mouseenter', () => showToast(globalValidHighlights, globalOccurrencesMap, data.id));
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            let matches = occurrencesMap ? (occurrencesMap[data.text] || []) : scanDOMForHighlights([{ text: data.text }]).occurrencesMap[data.text];
            let match = matches[data.occurrenceIndex || 0];
            if (match && match.startNode && match.startNode.parentElement) {
            const targetEl = match.startNode.parentElement;
            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            
            block.classList.add('hl-pulse');
            
            // Determine scroll container to append overlay to
            let scrollContainer = document.body;
            let node = targetEl;
            while (node && node !== document.body && node.nodeType === 1) {
                const style = window.getComputedStyle(node);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && (node.scrollHeight > node.clientHeight + 10)) {
                    scrollContainer = node;
                    break;
                }
                node = node.parentNode;
            }

            try {
                const tempRange = document.createRange();
                tempRange.setStart(match.startNode, match.startOffset);
                tempRange.setEnd(match.endNode, match.endOffset);
                const rect = tempRange.getBoundingClientRect();
                
                const overlay = document.createElement('div');
                overlay.className = 'hl-jump-overlay';
                
                // Position relative to scroll container
                const containerRect = scrollContainer.getBoundingClientRect();
                const isBody = scrollContainer === document.body || scrollContainer === document.documentElement;
                
                overlay.style.top = (rect.top - (isBody ? 0 : containerRect.top) + (isBody ? window.scrollY : scrollContainer.scrollTop) - 4) + 'px';
                overlay.style.left = (rect.left - (isBody ? 0 : containerRect.left) + (isBody ? window.scrollX : scrollContainer.scrollLeft) - 4) + 'px';
                overlay.style.width = (rect.width + 8) + 'px';
                overlay.style.height = (rect.height + 8) + 'px';
                
                scrollContainer.appendChild(overlay);
                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.5s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 500);
                }, 3000);
            } catch(e) {}

            setTimeout(() => { 
                block.classList.remove('hl-pulse');
            }, 3000);

            try {
                const selection = window.getSelection();
                selection.removeAllRanges();
                const range = document.createRange();
                range.setStart(match.startNode, match.startOffset);
                range.setEnd(match.endNode, match.endOffset);
                selection.addRange(range);
                setTimeout(() => {
                    const currentSelection = window.getSelection();
                    if (currentSelection.rangeCount > 0 && currentSelection.getRangeAt(0).startContainer === match.startNode) {
                        currentSelection.removeAllRanges();
                    }
                }, 800);
            } catch (err) { }

        } else {
            window.scrollTo({ top: data.top || 0, behavior: 'smooth' });
        }    });
        highlightContainer.appendChild(block);
    }

    function showToast(validHighlights, occurrencesMap, activeBlockId = null) {
        if (toastTimeout) clearTimeout(toastTimeout);
        if (!toastElement.classList.contains('hl-ext-toast-visible') || toastElement.getAttribute('data-count') !== validHighlights.length.toString()) {
            let listHTML = validHighlights.map((h, i) => `<div class="hl-toast-item" data-id="${h.id}"><div class="hl-toast-badge" style="background: ${h.color};">${i + 1}</div><div class="hl-toast-text" title="${h.text.replace(/"/g, '&quot;')}">${h.text}</div><button class="hl-toast-delete" data-id="${h.id}" title="Delete highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div>`).join('');
            toastElement.innerHTML = `<div class="hl-toast-header" style="display: flex; align-items: center; justify-content: space-between;"><div class="hl-toast-header-left" style="display: flex; align-items: center;"><svg class="hl-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><h2>Page Markers</h2></div></div><div class="hl-toast-sub" style="display: flex; align-items: center; justify-content: space-between; width: 100%;"><span>${validHighlights.length} marker${validHighlights.length !== 1 ? 's' : ''}</span><button class="hl-toast-clear" id="hl-ext-clear-btn" style="margin-left: auto;">Clear all</button></div><div class="hl-toast-list">${listHTML}</div>`;
            toastElement.setAttribute('data-count', validHighlights.length);
            const clearBtn = toastElement.querySelector('#hl-ext-clear-btn');
            if (clearBtn) clearBtn.addEventListener('click', (e) => { e.stopPropagation(); if(confirm('Are you sure?')) clearPageHighlights(); });
            const items = toastElement.querySelectorAll('.hl-toast-item');
            items.forEach((item, index) => {
                item.addEventListener('click', (e) => {
                    const id = item.getAttribute('data-id');
                    if (e.target.closest('.hl-toast-delete')) {
                        e.stopPropagation(); if(confirm('Delete?')) deleteHighlight(id); return;
                    }
                    items.forEach(el => el.classList.remove('active')); item.classList.add('active');
                    const block = document.getElementById(`hl-ext-block-${id}`);
                    if(block) block.click();
                });
            });
        }
        toastElement.querySelectorAll('.hl-toast-item').forEach(el => el.classList.remove('active'));
        if (activeBlockId) {
            const item = toastElement.querySelector(`.hl-toast-item[data-id="${activeBlockId}"]`);
            if (item) { item.classList.add('active'); item.scrollIntoView({ block: 'nearest' }); }
        }
        toastElement.classList.add('hl-ext-toast-visible');
    }

    function hideToast() { 
        toastElement.classList.remove('hl-ext-toast-visible'); 
        if (highlightContainer) {
            highlightContainer.classList.remove('hl-hidden');
            // When card closes, start the fade timer for the restored indicators
            startFadeTimers();
        }
    }

    function clearPageHighlights() {
        const key = getUrlKey();
        chrome.storage.local.remove([key], () => {
            if (highlightContainer) highlightContainer.innerHTML = '';
            if ('highlights' in CSS) { for (let i = 0; i < 6; i++) CSS.highlights.delete(`hl-ext-marker-${i}`); }
        });
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

    let isMac = navigator.userAgent.includes("Mac");
    document.addEventListener('keydown', (e) => {
        const isModifierPressed = isMac ? e.metaKey : e.altKey;
        if (isModifierPressed && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            e.preventDefault(); handleHighlightAction();
        }
    });
})();
