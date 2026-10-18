/**
 * scripts/extractor.js
 * NotebookLM In-Page D3 Mindmap Extractor & Auto-Expander (Manifest V3)
 *
 * Runs in the page's MAIN execution world to directly access D3.js DOM data bindings (g.node.__data__).
 * Supports execution across both the top window and isolated subframes (e.g. *.scf.usercontent.goog).
 */

(function () {
  "use strict";

  const isTopFrame = typeof window !== "undefined" && window === window.top;
  const frameHost = typeof window !== "undefined" ? window.location.hostname : "unknown";

  if (typeof window !== "undefined") {
    console.log(
      `🗺️ [NotebookLM Extractor] Initialized in ${isTopFrame ? "Top Frame" : "Subframe"} (${frameHost})`
    );
  }

  const Extractor = {
    version: "2.1.0",

    /**
     * Find the mindmap SVG container with the highest count of g.node elements.
     * Searches both document and any open shadow roots.
     */
    findMindmapSvg() {
      let bestSvg = null;
      let maxNodes = 0;

      const searchRoots = [document];
      try {
        document.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) searchRoots.push(el.shadowRoot);
        });
      } catch (e) {
        // Shadow root access may be restricted
      }

      for (const root of searchRoots) {
        const svgs = root.querySelectorAll("svg");
        svgs.forEach((svg) => {
          const nodes = svg.querySelectorAll("g.node, g[role='treeitem']");
          if (nodes.length > maxNodes) {
            maxNodes = nodes.length;
            bestSvg = svg;
          }
        });
      }

      return { svg: bestSvg, nodeCount: maxNodes };
    },

    /**
     * Helper to pause execution for a given number of milliseconds.
     */
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    /**
     * Auto-expands all collapsed nodes in the mindmap.
     * Collapsed nodes in NotebookLM have text.expand-symbol with '>' or aria-expanded='false'.
     */
    async autoExpandAll(options = {}) {
      const maxIterations = options.maxIterations || 40;
      const clickDelay = options.clickDelay || 40;
      const stepDelay = options.stepDelay || 150;

      const { svg } = this.findMindmapSvg();
      if (!svg) {
        return { success: false, error: "No mindmap SVG found in this frame", expandedCount: 0 };
      }

      let totalExpanded = 0;

      for (let iter = 0; iter < maxIterations; iter++) {
        const currentNodes = svg.querySelectorAll("g.node, g[role='treeitem']");
        let clickedInIteration = 0;

        for (const node of currentNodes) {
          const expandSymbol = node.querySelector("text.expand-symbol");
          const isCollapsedSymbol = expandSymbol && expandSymbol.textContent.trim() === ">";
          const isAriaCollapsed = node.getAttribute("aria-expanded") === "false";

          if (isCollapsedSymbol || isAriaCollapsed) {
            // Locate clickable circle or node
            const clickable = node.querySelector("circle") || expandSymbol || node;

            const events = [
              new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }),
              new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }),
              new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
            ];

            events.forEach((evt) => clickable.dispatchEvent(evt));
            clickedInIteration++;
            totalExpanded++;

            if (clickDelay > 0) {
              await this.sleep(clickDelay);
            }
          }
        }

        if (clickedInIteration === 0) {
          break; // All branches are fully expanded
        }

        await this.sleep(stepDelay);
      }

      // Small cooldown to let D3 animations and DOM settle
      await this.sleep(100);

      const finalCheck = this.findMindmapSvg();
      return {
        success: true,
        expandedCount: totalExpanded,
        totalNodesNow: finalCheck.nodeCount
      };
    },

    /**
     * Extracts hierarchy directly from D3.js memory bindings (g.node.__data__).
     */
    extractD3Hierarchy(svg) {
      const gNodes = svg.querySelectorAll("g.node, g[role='treeitem']");
      if (!gNodes || gNodes.length === 0) {
        throw new Error("No g.node elements found in SVG");
      }

      // Look for a node with valid __data__
      let sampleD3Node = null;
      for (const gn of gNodes) {
        if (gn.__data__) {
          sampleD3Node = gn.__data__;
          break;
        }
      }

      if (!sampleD3Node) {
        return null; // D3 data not accessible, trigger fallback
      }

      // Climb up to the true root node if a child node was sampled
      let rootD3 = sampleD3Node;
      let climbSafety = 0;
      while (rootD3.parent && climbSafety < 100) {
        rootD3 = rootD3.parent;
        climbSafety++;
      }

      let nodeIdCounter = 1;
      const visitedD3Objects = new Set();

      const parseNode = (d3Node, depth = 0) => {
        if (!d3Node || typeof d3Node !== "object") return null;
        if (depth > 60) return null; // recursion limit
        if (visitedD3Objects.has(d3Node)) return null; // circular ref check
        visitedD3Objects.add(d3Node);

        // Extract label text
        let rawText =
          d3Node.data?.name ||
          d3Node.data?.text ||
          d3Node.name ||
          d3Node.text ||
          d3Node.value ||
          "";

        if (!rawText && d3Node.data && typeof d3Node.data === "string") {
          rawText = d3Node.data;
        }

        const text = String(rawText || "Untitled").trim();
        const id = "node_" + nodeIdCounter++;

        // Include both expanded (children) and collapsed (_children) nodes
        const rawChildren = d3Node.children || d3Node._children || [];
        const cleanChildren = [];

        if (Array.isArray(rawChildren)) {
          for (const childD3 of rawChildren) {
            const parsedChild = parseNode(childD3, depth + 1);
            if (parsedChild) {
              cleanChildren.push(parsedChild);
            }
          }
        }

        return {
          id: id,
          text: text,
          depth: depth,
          children: cleanChildren
        };
      };

      const tree = parseNode(rootD3, 0);
      return { tree: tree, method: "d3.js __data__" };
    },

    /**
     * Fallback extractor using SVG DOM attributes (data-depth, text.node-name, role="treeitem").
     */
    extractDomHierarchy(svg) {
      const gNodes = Array.from(svg.querySelectorAll("g.node, g[role='treeitem']"));
      if (!gNodes.length) {
        throw new Error("No g.node elements found in DOM");
      }

      // Extract node info from DOM elements
      const parsedItems = gNodes.map((gn, idx) => {
        const textEl = gn.querySelector("text.node-name") || gn.querySelector("text");
        let text = textEl ? textEl.textContent.trim() : "";

        if (!text) {
          const ariaLabel = gn.getAttribute("aria-label") || "";
          text = ariaLabel.replace(/,\s*\d+\s*children/i, "").trim();
        }

        const depthAttr = gn.getAttribute("data-depth");
        const levelAttr = gn.getAttribute("aria-level");
        let depth = 0;
        if (depthAttr !== null) {
          depth = parseInt(depthAttr, 10);
        } else if (levelAttr !== null) {
          depth = Math.max(0, parseInt(levelAttr, 10) - 1);
        }

        // Parse translate transform for Y ordering if depth is equal
        let y = 0;
        const transform = gn.getAttribute("transform") || "";
        const match = transform.match(/translate\(\s*[^,]+\s*,\s*([^)]+)\)/);
        if (match) {
          y = parseFloat(match[1]) || 0;
        }

        return {
          id: "dom_node_" + (idx + 1),
          text: text || "Untitled Node",
          depth: isNaN(depth) ? 0 : depth,
          y: y,
          children: []
        };
      });

      // Sort root items by depth and Y coordinate
      parsedItems.sort((a, b) => a.depth - b.depth || a.y - b.y);

      const root = parsedItems[0];
      const stack = [root];

      for (let i = 1; i < parsedItems.length; i++) {
        const node = parsedItems[i];
        while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(node);
        } else {
          root.children.push(node);
        }
        stack.push(node);
      }

      return { tree: root, method: "DOM attribute parsing" };
    },

    /**
     * Converts a nested tree into a dual representation:
     * - `tree`: nested root object
     * - `nodes`: flat array of all nodes with parentId links
     * - `rootNode`: pointer to root in nodes array
     * - `metadata`: summary statistics
     */
    flattenAndCalculateMetadata(rootTree, method) {
      if (!rootTree) {
        throw new Error("Cannot process null tree");
      }

      const flatNodes = [];
      let maxDepth = 0;

      const traverse = (node, parentId = null) => {
        if (!node) return;
        if (node.depth > maxDepth) {
          maxDepth = node.depth;
        }

        flatNodes.push({
          id: node.id,
          text: node.text,
          parentId: parentId,
          depth: node.depth
        });

        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child, node.id);
          }
        }
      };

      traverse(rootTree, null);

      return {
        tree: rootTree,
        rootNode: flatNodes[0] || null,
        nodes: flatNodes,
        metadata: {
          rootTopic: rootTree.text || "Untitled Mindmap",
          totalNodes: flatNodes.length,
          maxDepth: maxDepth,
          method: method,
          extractedAt: new Date().toISOString()
        }
      };
    },

    /**
     * Complete workflow: finds mindmap, auto-expands branches if requested,
     * extracts D3 / DOM hierarchy, and returns the normalized mindmap payload.
     */
    async expandAndExtract(options = {}) {
      const autoExpand = options.autoExpand !== false; // default to true
      const frameInfo = {
        url: typeof window !== "undefined" ? window.location.href : "unknown",
        hostname: typeof window !== "undefined" ? window.location.hostname : "unknown",
        isTop: isTopFrame
      };

      const { svg, nodeCount } = this.findMindmapSvg();
      if (!svg || nodeCount === 0) {
        return {
          success: false,
          frameInfo: frameInfo,
          error: `No NotebookLM mindmap found in frame (${frameInfo.hostname}).`
        };
      }

      let expansionResult = { success: true, expandedCount: 0 };
      if (autoExpand) {
        expansionResult = await this.autoExpandAll(options);
      }

      const refreshed = this.findMindmapSvg();
      const targetSvg = refreshed.svg || svg;

      let rawExtraction = null;
      try {
        rawExtraction = this.extractD3Hierarchy(targetSvg);
      } catch (err) {
        console.warn("⚠️ [NotebookLM Extractor] D3 extraction warning:", err.message);
      }

      if (!rawExtraction || !rawExtraction.tree) {
        console.log("ℹ️ [NotebookLM Extractor] Falling back to SVG DOM extraction...");
        rawExtraction = this.extractDomHierarchy(targetSvg);
      }

      const normalized = this.flattenAndCalculateMetadata(
        rawExtraction.tree,
        rawExtraction.method
      );

      return {
        success: true,
        frameInfo: frameInfo,
        expansion: expansionResult,
        data: normalized
      };
    }
  };

  // Expose to window in MAIN world (or module.exports in Node)
  if (typeof window !== "undefined") {
    window.__NLM_EXTRACTOR__ = Extractor;

    // Listen for window message requests from content scripts or extension
    window.addEventListener("message", async (event) => {
      if (!event.data || event.data.type !== "NLM_REQUEST_EXTRACTION") return;

      try {
        const result = await Extractor.expandAndExtract(event.data.options || {});
        window.postMessage(
          {
            type: "NLM_RESPONSE_EXTRACTION",
            requestId: event.data.requestId,
            result: result
          },
          "*"
        );
      } catch (err) {
        window.postMessage(
          {
            type: "NLM_RESPONSE_EXTRACTION",
            requestId: event.data.requestId,
            result: { success: false, error: err.message }
          },
          "*"
        );
      }
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Extractor };
  }
})();
