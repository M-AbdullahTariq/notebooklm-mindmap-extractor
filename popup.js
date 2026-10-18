/**
 * popup.js
 * Extension Action Popup Controller for NotebookLM Mindmap Extractor v2.0.0
 */

document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const statusBanner = document.getElementById("statusBanner");
  const statusDot = document.getElementById("statusDot");
  const mindmapCard = document.getElementById("mindmapCard");
  const topicTitle = document.getElementById("topicTitle");
  const statNodes = document.getElementById("statNodes");
  const statDepth = document.getElementById("statDepth");
  const statMethod = document.getElementById("statMethod");
  const optionsCard = document.getElementById("optionsCard");
  const formatSelector = document.getElementById("formatSelector");
  const autoExpandCheck = document.getElementById("autoExpandCheck");
  const progressContainer = document.getElementById("progressContainer");
  const progressText = document.getElementById("progressText");
  const actionsContainer = document.getElementById("actionsContainer");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyBtn = document.getElementById("copyBtn");
  const rescanBtn = document.getElementById("rescanBtn");
  const toast = document.getElementById("toast");

  let activeTab = null;
  let cachedMindmap = null;
  let cachedWinningFrameId = null;

  // Format label mapping
  // Note: Obsidian Canvas (.canvas) must use application/octet-stream so Chromium's
  // DownloadManager preserves the .canvas extension without forcing .json
  const FORMAT_META = {
    canvas: { ext: ".canvas", mime: "application/octet-stream", label: "Obsidian Canvas (.canvas)" },
    markdown: { ext: ".md", mime: "text/markdown;charset=utf-8", label: "Markdown (.md)" },
    freemind: { ext: ".mm", mime: "application/octet-stream", label: "FreeMind (.mm)" },
    opml: { ext: ".opml", mime: "application/octet-stream", label: "OPML (.opml)" },
    json: { ext: ".json", mime: "application/json", label: "JSON (.json)" },
    csv: { ext: ".csv", mime: "text/csv;charset=utf-8", label: "CSV (.csv)" }
  };

  // Restore saved format preference
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["preferredFormat", "autoExpandPref"], (res) => {
      if (res.preferredFormat && FORMAT_META[res.preferredFormat]) {
        formatSelector.value = res.preferredFormat;
      }
      if (typeof res.autoExpandPref === "boolean") {
        autoExpandCheck.checked = res.autoExpandPref;
      }
      updateDownloadBtnLabel();
    });
  }

  // Event Listeners
  formatSelector.addEventListener("change", () => {
    updateDownloadBtnLabel();
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ preferredFormat: formatSelector.value });
    }
  });

  autoExpandCheck.addEventListener("change", () => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoExpandPref: autoExpandCheck.checked });
    }
  });

  downloadBtn.addEventListener("click", handleDownload);
  copyBtn.addEventListener("click", handleCopy);
  rescanBtn.addEventListener("click", () => scanMindmap(true));

  // Initialize and check current active tab
  async function init() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        showErrorBanner("Could not find an active browser tab.");
        return;
      }
      activeTab = tabs[0];
      const url = activeTab.url || "";

      const isNotebookLM =
        url.includes("notebooklm.google.com") || url.includes("notebook.google.com");

      if (!isNotebookLM) {
        showErrorBanner(
          "Please navigate to Google NotebookLM with an open mindmap.",
          true // show open button
        );
        setStatusDot("warning");
        return;
      }

      setStatusDot("active");
      await scanMindmap();
    } catch (err) {
      console.error("Initialization error:", err);
      showErrorBanner("Failed to initialize: " + err.message);
      setStatusDot("error");
    }
  }

  // --- Core Methods ---

  async function scanMindmap(forceAllFrames = false) {
    if (!activeTab || !activeTab.id) return;

    showProgress("Scanning all frames & reading D3 mindmap hierarchy...");
    setButtonsDisabled(true);

    try {
      const options = {
        autoExpand: autoExpandCheck.checked,
        maxIterations: 40,
        clickDelay: 40,
        stepDelay: 120
      };

      const executeInFrames = async (targetOpts) => {
        // Pre-inject extractor into the target frame(s)
        try {
          await chrome.scripting.executeScript({
            target: targetOpts,
            files: ["scripts/extractor.js"],
            world: "MAIN"
          });
        } catch (injectionErr) {
          console.debug("Extractor pre-injection note:", injectionErr.message);
        }

        // Execute extraction
        return await chrome.scripting.executeScript({
          target: targetOpts,
          world: "MAIN",
          func: async (opts) => {
            if (window.__NLM_EXTRACTOR__) {
              return await window.__NLM_EXTRACTOR__.expandAndExtract(opts);
            }
            return {
              success: false,
              frameInfo: {
                hostname: window.location.hostname,
                url: window.location.href,
                isTop: window === window.top
              },
              error: "Extractor engine not found in frame."
            };
          },
          args: [options]
        });
      };

      let results = null;

      // 1. Try cached frame first if available and not forced
      if (cachedWinningFrameId !== null && !forceAllFrames) {
        try {
          results = await executeInFrames({
            tabId: activeTab.id,
            frameIds: [cachedWinningFrameId]
          });
        } catch (e) {
          console.debug("Cached frame execution failed, falling back to all frames:", e.message);
          cachedWinningFrameId = null;
        }
      }

      // 2. Scan all frames if cached frame was missing, failed, or had no mindmap
      const firstResultValid =
        results &&
        results[0] &&
        results[0].result &&
        results[0].result.success &&
        results[0].result.data?.nodes?.length > 0;

      if (!firstResultValid) {
        results = await executeInFrames({
          tabId: activeTab.id,
          allFrames: true
        });
      }

      hideProgress();
      setButtonsDisabled(false);

      if (!results || results.length === 0) {
        throw new Error("No response received from any page frame.");
      }

      // Find winning frame with a valid mindmap (sorted by highest node count)
      const validWinners = results
        .filter(
          (entry) =>
            entry.result &&
            entry.result.success &&
            entry.result.data &&
            Array.isArray(entry.result.data.nodes) &&
            entry.result.data.nodes.length > 0
        )
        .sort((a, b) => b.result.data.nodes.length - a.result.data.nodes.length);

      if (validWinners.length === 0) {
        // Collect scanned frames diagnostic info
        const scannedHosts = results
          .map((r) => r.result?.frameInfo?.hostname || `frame_${r.frameId}`)
          .filter(Boolean);
        const uniqueHosts = Array.from(new Set(scannedHosts));

        showErrorBanner(
          `No mindmap found across ${results.length} frame(s) (${uniqueHosts.slice(0, 3).join(", ")}). Please ensure a mindmap is actively opened in Studio.`
        );
        setStatusDot("warning");
        hideMindmapCard();
        cachedWinningFrameId = null;
        return;
      }

      const winningEntry = validWinners[0];
      cachedWinningFrameId = winningEntry.frameId;
      cachedMindmap = winningEntry.result.data;

      console.log(
        `🎯 [Popup] Selected frame ${winningEntry.frameId} (${winningEntry.result.frameInfo?.hostname || "subframe"}) with ${cachedMindmap.nodes.length} nodes`
      );

      displayMindmapInfo(cachedMindmap, winningEntry.result.frameInfo);
      setStatusDot("active");
      showReadyBanner();
    } catch (err) {
      hideProgress();
      setButtonsDisabled(false);
      cachedWinningFrameId = null;
      console.error("Extraction error:", err);
      showErrorBanner("Extraction failed: " + err.message);
      setStatusDot("error");
      hideMindmapCard();
    }
  }

  function displayMindmapInfo(data, frameInfo) {
    const meta = data.metadata || {};
    topicTitle.textContent = meta.rootTopic || "Untitled Mindmap";
    topicTitle.title = meta.rootTopic || "Untitled Mindmap";

    statNodes.textContent = `${meta.totalNodes || 0} nodes`;
    statDepth.textContent = `Depth: ${meta.maxDepth || 0}`;

    const frameLabel = frameInfo?.isTop ? "Top Frame" : "Studio Frame";
    statMethod.textContent = (meta.method?.includes("d3") ? "D3 Memory" : "DOM Fallback") + ` • ${frameLabel}`;

    mindmapCard.style.display = "block";
    optionsCard.style.display = "block";
    actionsContainer.style.display = "flex";
  }

  function hideMindmapCard() {
    mindmapCard.style.display = "none";
    optionsCard.style.display = "none";
    actionsContainer.style.display = "none";
  }

  function updateDownloadBtnLabel() {
    const format = formatSelector.value;
    const meta = FORMAT_META[format] || FORMAT_META.canvas;
    downloadBtn.querySelector("span").textContent = `📥 Download ${meta.label}`;
  }

  function serializeCurrentData(format) {
    if (!cachedMindmap) {
      throw new Error("No mindmap data available to export.");
    }

    switch (format) {
      case "canvas":
        return MindmapSerializerSuite.toObsidianCanvas(cachedMindmap);
      case "markdown":
        return MindmapSerializerSuite.toMarkdown(cachedMindmap);
      case "freemind":
        return MindmapSerializerSuite.toFreeMind(cachedMindmap);
      case "opml":
        return MindmapSerializerSuite.toOPML(cachedMindmap);
      case "json":
        return MindmapSerializerSuite.toJSON(cachedMindmap);
      case "csv":
        return MindmapSerializerSuite.toCSV(cachedMindmap);
      default:
        throw new Error("Unsupported export format: " + format);
    }
  }

  function sanitizeFilename(title) {
    if (!title) return "Untitled";
    return title
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
  }

  async function handleDownload() {
    if (!cachedMindmap) return;

    try {
      const format = formatSelector.value;
      const meta = FORMAT_META[format] || FORMAT_META.canvas;
      const content = serializeCurrentData(format);

      const baseName = sanitizeFilename(cachedMindmap.metadata?.rootTopic || "Mindmap");
      const filename = `${baseName}${meta.ext}`;

      const blob = new Blob([content], { type: meta.mime });
      const blobUrl = URL.createObjectURL(blob);

      if (chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download(
          {
            url: blobUrl,
            filename: filename,
            conflictAction: "uniquify",
            saveAs: false
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.warn("chrome.downloads warning:", chrome.runtime.lastError.message);
              fallbackDownload(blobUrl, filename);
            } else {
              showToast(`✓ Downloaded "${filename}"!`, "success");
            }
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          }
        );
      } else {
        fallbackDownload(blobUrl, filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }
    } catch (err) {
      console.error("Download error:", err);
      showToast("Download failed: " + err.message, "error");
    }
  }

  function fallbackDownload(blobUrl, filename) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`✓ Downloaded "${filename}"!`, "success");
  }

  async function handleCopy() {
    if (!cachedMindmap) return;

    try {
      const format = formatSelector.value;
      const content = serializeCurrentData(format);

      await navigator.clipboard.writeText(content);
      const meta = FORMAT_META[format] || FORMAT_META.canvas;
      showToast(`✓ Copied ${meta.label} to clipboard!`, "success");
    } catch (err) {
      console.error("Copy error:", err);
      showToast("Copy failed: " + err.message, "error");
    }
  }

  // --- UI Helpers ---

  function showProgress(message) {
    progressText.querySelector("span").textContent = message;
    progressContainer.classList.add("active");
  }

  function hideProgress() {
    progressContainer.classList.remove("active");
  }

  function setButtonsDisabled(disabled) {
    downloadBtn.disabled = disabled;
    copyBtn.disabled = disabled;
    rescanBtn.disabled = disabled;
  }

  function setStatusDot(type) {
    statusDot.className = "status-dot " + (type || "");
    if (type === "active") statusDot.title = "Connected to NotebookLM";
    else if (type === "warning") statusDot.title = "Attention needed";
    else statusDot.title = "Disconnected";
  }

  function showReadyBanner() {
    statusBanner.className = "status-banner ready";
    statusBanner.innerHTML = "<span>✅ Mindmap captured & ready to export!</span>";
  }

  function showErrorBanner(message, showOpenBtn = false) {
    statusBanner.className = "status-banner warning";
    let html = `<span>⚠️ ${escapeHtml(message)}</span>`;
    if (showOpenBtn) {
      html += `<button id="openNlmBtn" style="margin-left: auto; padding: 4px 8px; font-size: 11px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer;">Open NotebookLM</button>`;
    }
    statusBanner.innerHTML = html;

    const openBtn = document.getElementById("openNlmBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "https://notebook.google.com/" });
      });
    }
  }

  function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.className = "toast";
    }, 3500);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Kick off initialization
  init();
});
