# Beacon

**Beacon** is a minimalist, distraction-free Chrome extension designed for deep reading, research, and long-form study. It allows users to highlight text on any webpage and generates corresponding color markers on the right edge of the viewport. By clicking these markers, users can instantly jump back to the exact position in the original text.

## 🎯 Product Positioning

**"Your personal tool for data collection and key information marking."**

When navigating vast web pages, long documents, or technical materials, we often need to mark the most important content. Beacon focuses on **anchoring and tracking high-value data** by innovatively mapping highlights to the **right edge** of the browser window.

It provides a "content skeleton" from a global perspective without disrupting the original layout of the webpage. Whether you need to track key data points or organize the main narrative of an article, a simple click on the edge allows you to traverse through critical information seamlessly.

## ✨ Core Features

*   **⚡ Rapid Annotation:** Select text and use the system shortcut (Mac default: `Command + Shift + F`, Windows default: `Alt + Shift + F`) to generate markers instantly without breaking your reading flow. **(Note: You can customize this shortcut anytime in the Chrome Extensions keyboard shortcuts settings).**
*   **📍 Intelligent Sorting & Native Jump:** Side markers are strictly ordered according to their actual appearance in the text. Clicking a marker invokes the browser's native search and positioning capabilities, ensuring a **smooth scroll and absolute focus** on the target text, regardless of complex nested scrollbars.
*   **👻 Immersive & Distraction-Free Design:**
    *   **Static Low-Profile:** In its idle state, markers use low-saturation Morandi colors that blend perfectly into the edge of the page.
    *   **Dynamic Feedback:** When hovered or interacted with, markers expand smoothly to provide clear visual feedback and a larger click area.
    *   **Hover Preview:** Hover over a marker to see a tooltip preview of the original annotated text.
*   **💾 Local Persistence:** All annotation data is automatically stored locally (`Local Storage`) based on the current webpage URL. Your "reading traces" remain intact even after refreshing or reopening the page.
*   **🎛️ Intuitive Side Panel:** Click the extension icon to bring up a side panel where you can view current shortcuts, manage markers across domains, and safely clear page highlights with a single click.

## 🛠️ Use Cases

*   **Academic/Long-form Reading:** Mark key arguments while reading through thousands of words, then use the right-side markers to quickly review the entire article's structure.
*   **Technical Documentation:** Bookmark specific API parameters or code snippets in long documentation pages for frequent reference.
*   **Research & Comparison:** Tag interrelated data points in financial reports or Wikipedia articles to switch rapidly between different contexts.

## 🚀 Installation (Developer Mode)

1. Clone or download this repository to your local computer.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** in the top left corner.
5. Select the folder containing this repository (`Highlighter`).
6. Success! We recommend pinning the extension icon to your toolbar.

## 📝 Architecture & Implementation

- **Non-Invasive Rendering:** Unlike traditional highlighters that modify the DOM tree directly, Beacon uses an independent overlay. This avoids breaking the internal state of complex web apps (like React/Vue SPAs).
- **Robust Addressing:** Instead of fragile DOM node calculations, Beacon relies on relative text positioning and native `window.find` combined with the `.scrollIntoView` API, ensuring performance and compatibility across heterogeneous pages.

---

*Enjoy distraction-free reading with Beacon!*
