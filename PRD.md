# PRD: Google NotebookLM Mindmap Extractor & Exporter (Chrome Extension MV3)

## Problem Statement

Users of Google NotebookLM use its automatic mindmap synthesis to organize and brainstorm complex topics across research sources. However, these mindmaps are trapped within Google's closed web interface on `notebook.google.com` and `notebooklm.google.com`. Visual thinkers and knowledge workers who rely on Obsidian, Whimsical, FreeMind, or outliners cannot easily export these graphs into their personal knowledge management workflows.

Previously, attempts to solve this via a Tampermonkey userscript failed due to Google NotebookLM's strict Content Security Policy (specifically Trusted Types enforcement: `require-trusted-types-for 'script'`). Injected DOM elements and innerHTML manipulations were systematically blocked by the browser. Furthermore, the legacy Chrome extension attempted to reconstruct mindmap hierarchies by reverse-engineering SVG coordinates, bounding boxes, and bezier curves, resulting in fragile parent-child detection, dropped branches, and race conditions.

Users need a dedicated, reliable Google Chrome Extension (Manifest V3) that ditches the userscript approach entirely. The extension must extract the live mindmap hierarchy directly and accurately by reading the underlying D3.js memory bindings, automatically expand collapsed nodes so that no branches are omitted, and provide a clean, distraction-free popup interface to download the mindmap as an Obsidian Canvas (`.canvas`) with non-overlapping visual card layouts, alongside secondary export formats like Markdown/Markmap, FreeMind, OPML, JSON, and CSV.

---

## Solution

Build a modern, robust Google Chrome Extension (Manifest V3) that provides a seamless, one-click export experience from the browser toolbar:

1. **Dedicated Action Popup UI**: Eliminates page-injection hazards by confining the user interface to a clean, elegant Chrome Extension popup. This completely bypasses NotebookLM's Trusted Types CSP and ensures zero visual clashes with NotebookLM's web layout.
2. **Direct D3.js Memory Extraction**: Injects a lightweight extractor into the page's MAIN execution world, tapping directly into D3.js DOM data bindings (`g.node.__data__`). This captures the true semantic tree structure with 100% hierarchy fidelity, without relying on approximate coordinate geometry.
3. **Automated Tree Expansion**: Automatically locates and simulates expand events on all collapsed nodes (`>` symbols) prior to extraction, ensuring every nested node and leaf branch is rendered and captured.
4. **Collision-Free Obsidian Canvas Layout**: Calculates hierarchical 2D coordinates using an auto-spaced tree layout engine that computes recursive vertical subtree envelopes, preventing card overlaps and producing standard 280x120px Obsidian Canvas cards with directional connector arrows.
5. **Universal Multi-Format Export**: Generates Obsidian Canvas (`.canvas`), Markdown / Markmap (`.md`), FreeMind (`.mm`), OPML (`.opml`), JSON, and CSV with one-click instant download or copy-to-clipboard capabilities.

---

## User Stories

1. As a researcher using NotebookLM, I want to click an extension icon in my browser toolbar, so that I can export mindmaps without dealing with broken userscripts or Tampermonkey permission warnings.
2. As an Obsidian user, I want NotebookLM mindmaps exported directly into the official `.canvas` format, so that I can open and navigate them visually inside Obsidian with zero manual reformatting.
3. As a visual thinker, I want exported Obsidian Canvas cards to be neatly organized from left to right with uniform dimensions (280x120px), so that node titles are legible and the diagram looks balanced.
4. As an Obsidian user, I want canvas cards to have directional connector arrows flowing from the parent's right edge to the child's left edge, so that visual reading order is immediately clear.
5. As a user with deeply nested mindmap topics, I want sibling subtrees to be spaced with vertical envelope padding, so that branches never collide or overlap each other.
6. As a researcher, I want the extension to automatically expand all collapsed mindmap branches before extraction, so that my export includes the complete research tree without requiring manual clicks on every node.
7. As a NotebookLM user, I want the extension to read data directly from NotebookLM's internal D3.js data bindings, so that parent-child relationships are 100% faithful to the original data model.
8. As a user navigating between notebooks, I want the extension to work seamlessly across both `https://notebooklm.google.com/*` and `https://notebook.google.com/*`, so that domain redirects do not break functionality.
9. As a user opening the popup, I want to see the detected mindmap title, total node count, and tree depth, so that I can verify the mindmap was successfully captured before downloading.
10. As a user working on multiple topics, I want the exported file to be automatically named after the root topic of the mindmap (e.g. `Machine Learning Fundamentals.canvas`), so that I can easily identify files in my downloads folder and vault.
11. As a user whose mindmap title contains special or non-ASCII characters, I want filenames to be sanitized safely, so that file systems on Windows, macOS, and Linux save them without errors.
12. As a power user, I want the option to export into Markdown/Markmap (`.md`), so that I can paste mindmap outlines directly into Whimsical, Markmap, or standard markdown notes.
13. As a user migrating to traditional mindmapping software, I want to export into FreeMind (`.mm`) format, so that I can open the map in XMind, Freeplane, or MindNode.
14. As an outliner user, I want to export into OPML 2.0 (`.opml`), so that I can import my research into Logseq, Workflowy, or OmniOutliner.
15. As a developer or data analyst, I want to export raw JSON and CSV representations of the mindmap, so that I can ingest the hierarchy into downstream analytical tools or scripts.
16. As a user who quickly wants to paste data, I want a "Copy to Clipboard" button for text-based formats, so that I do not have to download and open a file just to grab its contents.
17. As an Obsidian user with a custom color scheme, I want canvas cards to omit hardcoded colors and use neutral cards, so that the exported canvas inherits my active Obsidian theme seamlessly.
18. As a privacy-conscious user, I want all processing, layout calculation, and file generation to happen 100% locally in my browser, so that my research data is never transmitted to any external server.
19. As a user opening the extension on a page without a mindmap, I want to see an informative status message guiding me to open a mindmap first, so that I understand why export is not ready.
20. As a user experiencing slow rendering or animation transitions in NotebookLM, I want the auto-expansion engine to wait safely for child nodes to mount, so that race conditions are prevented.
21. As a user whose nodes contain quotation marks, ampersands, or angle brackets, I want all strings properly escaped in JSON and XML outputs, so that target parsers do not encounter syntax errors.
22. As a keyboard-centric user, I want standard keyboard navigation within the popup, so that I can trigger exports swiftly without needing heavy mouse interactions.
23. As a user updating the extension, I want a clean, self-contained Manifest V3 architecture with minimal requested permissions, so that Chrome does not display intrusive security warnings.
24. As a user, I want the popup to display a progress indicator while expanding and extracting nodes, so that I am confident the extension is actively working.

---

## Implementation Decisions

### 1. Architectural Strategy & Manifest V3 Structure
- **Ditch Tampermonkey**: All userscript logic is deprecated. The project is repackaged as a standalone Chrome Extension built on Manifest V3.
- **Isolated Popup Execution**: All user-facing UI resides exclusively within the Chrome Extension action popup (`popup.html` and `popup.js`). No custom DOM elements, modals, or toasts are injected into the active NotebookLM page, fully eliminating Trusted Types CSP violations (`require-trusted-types-for 'script'`).
- **Main World Execution for D3 Access**: To read D3.js memory bindings (`g.node.__data__`), the extraction function is executed within the page's MAIN execution world (via `chrome.scripting.executeScript` with `world: 'MAIN'` or a designated main-world content script).
- **Dual Domain Support**: Host permissions and content script patterns explicitly cover both `https://notebooklm.google.com/*` and `https://notebook.google.com/*`.

### 2. Core Modules & Boundaries

#### A. `MindmapDataExtractor`
- **Responsibility**: Interacts with the active NotebookLM DOM and live D3 graph.
- **Interface**:
  - `expandAllNodes(): Promise<{ success: boolean, expandedCount: number }>`
  - `extractHierarchy(): Promise<{ success: boolean, data: MindmapTree, metadata: TreeMetadata }>`
- **Internal Logic**:
  - Scans for SVG containers holding `g.node` elements.
  - Iteratively finds collapsed indicator symbols (`>` in `text.expand-symbol`) and triggers synthetic mouse events on parent circles until all nodes are expanded.
  - Accesses `rootNode.__data__`, walking upwards via `parent` links if a subnode is initially targeted, guaranteeing the true root of the tree is obtained.
  - Recursively cleans circular references from D3 data, collecting node text, node IDs, and both expanded (`children`) and collapsed (`_children`) branches.

#### B. `TreeLayoutEngine`
- **Responsibility**: Computes geometric 2D coordinates for canvas graph generation without touching the DOM.
- **Interface**:
  - `computeLayout(tree: MindmapTree, config?: LayoutConfig): LaidOutGraph`
- **Internal Logic**:
  - Normalizes nodes with standard dimensions (Width: 280px, Height: 120px).
  - Establishes a horizontal level gap of 100px and vertical sibling gap of 40px.
  - Implements recursive vertical subtree bounding calculations to ensure subtrees with multiple children do not overlap adjacent branches.
  - Generates directional edge records linking parent right-middle points to child left-middle points.

#### C. `MindmapSerializerSuite`
- **Responsibility**: Converts raw or laid-out graph structures into standardized output formats.
- **Interface**:
  - `toObsidianCanvas(graph: LaidOutGraph): string` (Specification-compliant Obsidian Canvas JSON)
  - `toMarkdownMarkmap(tree: MindmapTree): string` (Indented Markdown outline for Markmap/Whimsical)
  - `toOPML(tree: MindmapTree): string` (OPML 2.0 XML)
  - `toFreeMind(tree: MindmapTree): string` (FreeMind `.mm` XML)
  - `toJSON(tree: MindmapTree): string` (Normalized hierarchical JSON)
  - `toCSV(tree: MindmapTree): string` (Tabular format with path and level attributes)
- **Internal Logic**:
  - Implements proper string escaping for JSON strings and XML entities (`&`, `<`, `>`, `"`, `'`).
  - Ensures clean formatting and indentation across all generated files.

#### D. `PopupController`
- **Responsibility**: Manages the extension popup lifecycle, user input, progress state, and downloads.
- **Interface**: Runs on popup DOM load.
- **Internal Logic**:
  - Communicates with the active tab using `chrome.tabs.sendMessage` and `chrome.scripting`.
  - Coordinates the sequence: verify page -> trigger auto-expansion -> extract tree -> format output.
  - Renders metadata badges (node count, depth, root topic).
  - Triggers client-side downloads via `chrome.downloads.download` or Object URLs.
  - Provides clipboard copy actions for text-compatible formats.

---

## Testing Decisions

### Test Philosophy
- Quality assurance focuses on external behavioral verification and end-to-end integration across Chrome and target knowledge tools (Obsidian, Mind mapping apps).
- Automated unit test suites are omitted from the project scope per user requirements; verification will be conducted via comprehensive manual test protocols.

### Manual Verification Checklist
1. **Extension Installation**: Load unpacked extension in Google Chrome (`chrome://extensions`) in Developer Mode and confirm zero manifest or service worker errors.
2. **Domain Matching**: Verify extension detects mindmaps on both `https://notebooklm.google.com/` and `https://notebook.google.com/`.
3. **Auto-Expansion Verification**: Open a mindmap with collapsed branches (`>`), open the popup, and verify all branches are clicked and rendered before extraction completes.
4. **Hierarchy Accuracy**: Verify that 100% of nodes in the DOM are captured in the extracted structure without phantom nodes or missed leaves.
5. **Obsidian Canvas Import**:
   - Download the `.canvas` file.
   - Open it in Obsidian (e.g. in the user's primary vault).
   - Verify that all cards display full titles cleanly, no cards overlap, and arrows connect parents to children from right to left.
6. **Multi-Format Verification**:
   - Verify Markdown output renders as a clean indented hierarchy in Markmap or text editors.
   - Verify FreeMind `.mm` opens correctly in FreeMind/XMind.
   - Verify OPML imports into an outliner (Logseq/Workflowy).
   - Verify JSON and CSV parse without syntax issues.
7. **Graceful Status Handling**: Open popup on non-NotebookLM tabs or when no mindmap is open and verify clear, helpful status messaging appears without crashing.

---

## Out of Scope

- Injecting floating UI panels or buttons directly into Google NotebookLM's web page DOM.
- Tampermonkey or Violentmonkey userscript distribution.
- Two-way synchronization or importing Obsidian Canvas files back into Google NotebookLM.
- Cloud-based storage, user accounts, or external API telemetry.
- Custom node color picker configurations in the initial release (neutral cards are used to guarantee theme compatibility).

---

## Further Notes

- The Obsidian Canvas JSON specification is fully documented and requires only `{ nodes: [...], edges: [...] }` with string IDs, integer coordinates, and text card types.
- Auto-expansion employs humanized iteration intervals (50ms click delay, 200ms step interval, capped at 50 iterations) to respect browser rendering frames and prevent UI lockups during deep tree traversals.
- Moving the extraction logic into `world: "MAIN"` solves the D3 access limitation cleanly while respecting modern browser security models.
