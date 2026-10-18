/**
 * scripts/layout.js
 * Collision-Free 2D Tree Layout Engine
 * Calculates auto-spaced card coordinates (280x120px) and vertical subtree envelopes
 */

class TreeLayoutEngine {
  constructor(options = {}) {
    this.cardWidth = options.cardWidth || 280;
    this.cardHeight = options.cardHeight || 120;
    this.horizontalGap = options.horizontalGap || 100;
    this.verticalGap = options.verticalGap || 40;
  }

  layout(nodes, rootNode) {
    if (!rootNode || !nodes || nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    const childrenMap = new Map();
    nodes.forEach((n) => childrenMap.set(n.id, []));
    nodes.forEach((n) => {
      if (n.parentId && childrenMap.has(n.parentId)) {
        childrenMap.get(n.parentId).push(n);
      }
    });

    const subtreeHeightMap = new Map();
    const computeSubtreeHeight = (node) => {
      const children = childrenMap.get(node.id) || [];
      if (children.length === 0) {
        const h = this.cardHeight + this.verticalGap;
        subtreeHeightMap.set(node.id, h);
        return h;
      }
      let totalH = 0;
      for (const child of children) {
        totalH += computeSubtreeHeight(child);
      }
      subtreeHeightMap.set(node.id, totalH);
      return totalH;
    };

    computeSubtreeHeight(rootNode);

    const layoutNodes = [];
    const layoutEdges = [];

    const assignCoordinates = (node, x, yStart, yEnd) => {
      const y = yStart + (yEnd - yStart - this.cardHeight) / 2;

      layoutNodes.push({
        id: node.id,
        x: Math.round(x),
        y: Math.round(y),
        width: this.cardWidth,
        height: this.cardHeight,
        type: "text",
        text: node.text
      });

      const children = childrenMap.get(node.id) || [];
      if (children.length > 0) {
        let currentChildY = yStart;
        for (const child of children) {
          const childH = subtreeHeightMap.get(child.id);
          const nextChildY = currentChildY + childH;
          const nextX = x + this.cardWidth + this.horizontalGap;

          layoutEdges.push({
            id: "edge_" + node.id + "_" + child.id,
            fromNode: node.id,
            fromSide: "right",
            toNode: child.id,
            toSide: "left",
            toEnd: "arrow"
          });

          assignCoordinates(child, nextX, currentChildY, nextChildY);
          currentChildY = nextChildY;
        }
      }
    };

    const totalRootHeight = subtreeHeightMap.get(rootNode.id);
    assignCoordinates(rootNode, 0, 0, totalRootHeight);

    return { nodes: layoutNodes, edges: layoutEdges };
  }
}

// Export for module/script environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { TreeLayoutEngine };
} else {
  window.TreeLayoutEngine = TreeLayoutEngine;
}
