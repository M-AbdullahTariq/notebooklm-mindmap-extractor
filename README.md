# NotebookLM Mindmap Extractor to Obsidian Canvas (Chrome Extension MV3)

A fast, reliable Google Chrome Extension (Manifest V3) that extracts Google NotebookLM mindmaps directly into **Obsidian Canvas (`.canvas`)**, **Markdown (`.md` for Whimsical & Markmap)**, **FreeMind (`.mm`)**, **OPML (`.opml`)**, **JSON**, and **CSV**.

---

## ✨ Features

- **Direct D3.js Memory Extraction**: Reads the true semantic hierarchy straight from live D3 DOM bindings (`g.node.__data__`) in the page's MAIN execution world, achieving 100% hierarchy accuracy.
- **Automated Node Expansion**: Automatically detects and expands collapsed branches (`>` indicators) before extraction so no research notes or nested sub-topics are omitted.
- **Obsidian Canvas Support (`.canvas`)**: Exports ready-to-use `.canvas` files formatted with auto-spaced tree layouts, neutral card styling, and directional arrow connections (`fromSide: right` → `toSide: left`, `toEnd: arrow`).
- **Zero Card Overlaps**: Computes vertical subtree envelopes dynamically to keep your Obsidian canvas clean, organized, and collision-free.
- **Multi-Format Export**:
  - 🔮 **Obsidian Canvas (`.canvas`)**: Native visual canvas cards and arrows for Obsidian.
  - 📝 **Markdown (`.md`)**: Strict 4-space indented outlines ready to paste into Whimsical ("Paste as Mind Map") or Markmap.
  - 🧠 **FreeMind (`.mm`)**: Compatible with FreeMind, XMind, MindNode, and Freeplane.
  - 📋 **OPML 2.0 (`.opml`)**: Outlines for Logseq, Workflowy, and OmniOutliner.
  - 📊 **JSON Data (`.json`)**: Formatted hierarchical tree with metadata.
  - 📑 **Spreadsheet CSV (`.csv`)**: Tabular export with level and path attributes.
- **Zero In-Page Injections**: All user controls reside safely within the Chrome Extension popup, fully avoiding NotebookLM's strict Trusted Types Content Security Policy (`require-trusted-types-for 'script'`).
- **100% Client-Side & Private**: All extraction, layout calculations, and file generation run locally in your browser. Zero data leaves your machine.

---

## 🚀 How to Install in Google Chrome (Manifest V3)

1. Open **Google Chrome** (or any Chromium browser like Brave, Edge, Opera).
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **"Load unpacked"** button in the top-left corner.
5. In the file picker, select the cloned repository folder (where `manifest.json` is located).
6. Click **Select Folder**. The extension **"NotebookLM Mindmap Extractor to Obsidian Canvas"** will appear in your extension list! 🎉
7. Click the Chrome puzzle piece icon (Extensions) in the top toolbar and **pin** the NotebookLM Extractor icon for easy one-click access.

---

## 📖 How to Use

1. Navigate to Google NotebookLM at:
   - `https://notebook.google.com/` or `https://notebooklm.google.com/`
2. Open any notebook and open your **Mind Map** in the Studio panel.
3. Click the **NotebookLM Mindmap Extractor** extension icon in your Chrome toolbar.
4. The popup will automatically connect to the page and scan the mindmap:
   - Displays the detected **Root Topic Title**.
   - Displays the **Total Node Count** and **Tree Depth**.
   - Auto-expands any collapsed branches (`>`) by default.
5. Select your desired format from the dropdown (default is **Obsidian Canvas (`.canvas`)**).
6. Click **"📥 Download [Format]"** to save the file, or click **"📋 Copy to Clipboard"** for instant pasting.
7. To open in Obsidian:
   - Place the downloaded `.canvas` file into your Obsidian vault folder.
   - Open Obsidian and explore your visual canvas!

---

## 🛠️ Supported Output Formats

| Format | Extension | Primary Use Case |
|---|---|---|
| **Obsidian Canvas** | `.canvas` | Native Obsidian visual canvas with cards & directional arrows |
| **Markdown / Whimsical** | `.md` | Whimsical ("Paste as Mind Map"), Markmap, or markdown notes |
| **FreeMind** | `.mm` | FreeMind, XMind, Freeplane, MindNode |
| **OPML 2.0** | `.opml` | Outliners such as Logseq, Workflowy, and OmniOutliner |
| **JSON** | `.json` | Programmatic workflows, custom parsers, and archival |
| **CSV** | `.csv` | Google Sheets, Microsoft Excel, and tabular data analysis |

---

## 🔧 Project Architecture

- **`manifest.json`**: Manifest V3 declaration covering both `notebook.google.com` and `notebooklm.google.com`.
- **`popup.html` & `popup.js`**: Modern, isolated popup UI with real-time stats and download handlers.
- **`styles.css`**: Scoped styles matching modern Material & Obsidian aesthetics.
- **`scripts/extractor.js`**: In-page engine running in page `world: 'MAIN'` for direct D3 memory tree extraction and iterative auto-expansion.
- **`scripts/layout.js`**: Pure mathematical 2D grid layout engine calculating non-overlapping subtree envelopes.
- **`scripts/serializer.js`**: Multi-format serializer suite producing validated output files.
- **`background.js`**: Service worker registering context menus and download completions.
