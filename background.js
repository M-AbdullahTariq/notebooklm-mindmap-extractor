// Background Service Worker for NotebookLM Mindmap Extractor v2.0.0
chrome.runtime.onInstalled.addListener((details) => {
  console.log("🗺️ [NotebookLM Mindmap Extractor] Extension installed/updated v2.0.0");

  chrome.storage.local.set({
    installDate: Date.now(),
    version: chrome.runtime.getManifest().version,
    preferredFormat: "canvas"
  });

  // Optional Context Menu for quick access on supported domains
  try {
    chrome.contextMenus.create({
      id: "nlm-extract-mindmap",
      title: "Export Mindmap to Obsidian Canvas",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://notebooklm.google.com/*",
        "https://notebook.google.com/*"
      ]
    });
  } catch (err) {
    console.debug("Context menu setup:", err.message);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "nlm-extract-mindmap" && tab?.id) {
    chrome.action.openPopup();
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === "complete") {
    console.log("✅ Mindmap download completed successfully:", delta.id);
  }
});
