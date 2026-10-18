if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  console.log("🔌 [NotebookLM Mindmap Extractor] Content script loaded");

  // Listen for messages from the popup or background service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
      sendResponse({ success: true, message: "Content script active" });
      return true;
    }

    if (request.action === "extractMindmap") {
      // Request extraction from the MAIN execution world where D3 memory bindings reside
      const requestId = "nlm_req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

      const handleWindowMessage = (event) => {
        if (
          event.data &&
          event.data.type === "NLM_RESPONSE_EXTRACTION" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", handleWindowMessage);
          sendResponse(event.data.result);
        }
      };

      window.addEventListener("message", handleWindowMessage);

      // Dispatch request to scripts/extractor.js in the main world
      window.postMessage(
        {
          type: "NLM_REQUEST_EXTRACTION",
          requestId: requestId,
          options: request.options || {}
        },
        "*"
      );

      // Safety timeout in case the main world script fails to respond
      setTimeout(() => {
        window.removeEventListener("message", handleWindowMessage);
        sendResponse({
          success: false,
          error: "Extraction timed out. Ensure a mindmap is active and visible."
        });
      }, 20000);

      return true; // Keep message channel open for async response
    }

    sendResponse({ success: false, error: "Unknown action: " + request.action });
    return true;
  });
}
