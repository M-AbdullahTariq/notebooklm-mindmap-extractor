/**
 * scripts/serializer.js
 * MindmapSerializerSuite: Converts normalized mindmap graphs into multiple standard formats
 * Supports: Obsidian Canvas (.canvas), Markdown/Markmap (.md), FreeMind (.mm), OPML (.opml), JSON, CSV
 */

class MindmapSerializerSuite {
  /**
   * Serializes graph into Obsidian Canvas specification JSON (.canvas)
   */
  static toObsidianCanvas(treeData, layoutOptions = {}) {
    const LayoutEngineClass = typeof TreeLayoutEngine !== "undefined"
      ? TreeLayoutEngine
      : (typeof window !== "undefined" && window.TreeLayoutEngine);

    if (!LayoutEngineClass) {
      throw new Error("TreeLayoutEngine is required for Obsidian Canvas serialization");
    }

    const engine = new LayoutEngineClass({
      cardWidth: layoutOptions.cardWidth || 280,
      cardHeight: layoutOptions.cardHeight || 120,
      horizontalGap: layoutOptions.horizontalGap || 100,
      verticalGap: layoutOptions.verticalGap || 40
    });

    const layout = engine.layout(treeData.nodes, treeData.rootNode);

    const canvasData = {
      nodes: layout.nodes,
      edges: layout.edges
    };

    return JSON.stringify(canvasData, null, 2);
  }

  /**
   * Serializes graph into strict indented Markdown list (.md)
   * Compatible with Markmap and Whimsical ("Paste as Mind Map")
   */
  static toMarkdown(treeData) {
    if (!treeData.rootNode) return "";

    const childrenMap = this._buildChildrenMap(treeData.nodes);
    let md = "";

    const traverse = (node, depth) => {
      const indent = "    ".repeat(depth);
      const cleanText = String(node.text || "").replace(/\n/g, " ").trim();
      if (depth === 0) {
        md += "# " + cleanText + "\n";
      } else {
        md += indent + "- " + cleanText + "\n";
      }

      const children = childrenMap.get(node.id) || [];
      for (const child of children) {
        traverse(child, depth + 1);
      }
    };

    traverse(treeData.rootNode, 0);
    return md;
  }

  /**
   * Serializes graph into standard FreeMind XML (.mm)
   * Compatible with FreeMind, XMind, and Freeplane
   */
  static toFreeMind(treeData) {
    if (!treeData.rootNode) return "";

    const childrenMap = this._buildChildrenMap(treeData.nodes);
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<map version="1.0.1">\n';
    xml += "  <!-- Exported by NotebookLM Mindmap Extractor -->\n";

    const traverse = (node, depth) => {
      const indent = "  ".repeat(depth);
      const text = this._escapeXml(node.text);
      const children = childrenMap.get(node.id) || [];

      if (children.length === 0) {
        xml += indent + '<node ID="' + this._escapeXml(node.id) + '" TEXT="' + text + '"/>\n';
      } else {
        xml += indent + '<node ID="' + this._escapeXml(node.id) + '" TEXT="' + text + '">\n';
        for (const child of children) {
          traverse(child, depth + 1);
        }
        xml += indent + "</node>\n";
      }
    };

    traverse(treeData.rootNode, 1);
    xml += "</map>\n";
    return xml;
  }

  /**
   * Serializes graph into OPML 2.0 XML (.opml)
   * Compatible with Logseq, Workflowy, and OmniOutliner
   */
  static toOPML(treeData) {
    if (!treeData.rootNode) return "";

    const rootText = this._escapeXml(treeData.rootNode.text);
    const childrenMap = this._buildChildrenMap(treeData.nodes);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<opml version="2.0">\n';
    xml += "  <head>\n";
    xml += "    <title>" + rootText + "</title>\n";
    xml += "    <dateCreated>" + new Date().toUTCString() + "</dateCreated>\n";
    xml += "    <generator>NotebookLM Mindmap Extractor</generator>\n";
    xml += "  </head>\n";
    xml += "  <body>\n";

    const traverse = (node, depth) => {
      const indent = "  ".repeat(depth);
      const text = this._escapeXml(node.text);
      const children = childrenMap.get(node.id) || [];

      if (children.length === 0) {
        xml += indent + '<outline text="' + text + '"/>\n';
      } else {
        xml += indent + '<outline text="' + text + '">\n';
        for (const child of children) {
          traverse(child, depth + 1);
        }
        xml += indent + "</outline>\n";
      }
    };

    traverse(treeData.rootNode, 2);
    xml += "  </body>\n";
    xml += "</opml>\n";
    return xml;
  }

  /**
   * Serializes graph into normalized JSON
   */
  static toJSON(treeData) {
    const childrenMap = this._buildChildrenMap(treeData.nodes);

    const buildSubtree = (node) => {
      const children = childrenMap.get(node.id) || [];
      return {
        id: node.id,
        text: node.text,
        children: children.map((c) => buildSubtree(c))
      };
    };

    const output = {
      generator: "NotebookLM Mindmap Extractor",
      exportedAt: new Date().toISOString(),
      metadata: {
        rootTopic: treeData.rootNode ? treeData.rootNode.text : "Untitled",
        totalNodes: treeData.nodes ? treeData.nodes.length : 0
      },
      tree: treeData.rootNode ? buildSubtree(treeData.rootNode) : null
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Serializes graph into flattened CSV table
   */
  static toCSV(treeData) {
    if (!treeData.rootNode) return "";

    const childrenMap = this._buildChildrenMap(treeData.nodes);
    const rows = [["Level", "ID", "ParentID", "Path", "Text"]];

    const traverse = (node, level, path) => {
      const currentPath = path ? path + " > " + node.text : node.text;
      rows.push([
        level,
        node.id,
        node.parentId || "",
        currentPath,
        node.text
      ]);

      const children = childrenMap.get(node.id) || [];
      for (const child of children) {
        traverse(child, level + 1, currentPath);
      }
    };

    traverse(treeData.rootNode, 0, "");

    return rows
      .map((row) =>
        row
          .map((field) => {
            const str = String(field ?? "");
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          })
          .join(",")
      )
      .join("\n");
  }

  // --- Helpers ---
  static _buildChildrenMap(nodes = []) {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, []));
    nodes.forEach((n) => {
      if (n.parentId && map.has(n.parentId)) {
        map.get(n.parentId).push(n);
      }
    });
    return map;
  }

  static _escapeXml(text) {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .trim();
  }
}

// Export for module/script environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { MindmapSerializerSuite };
} else {
  window.MindmapSerializerSuite = MindmapSerializerSuite;
}
