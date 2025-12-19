import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

// Enhanced interface matching C++ JsBridge output
export interface FamilyMember {
  id: string;
  name: string;
  parentId: string; // Maps to father_id
  generation: number;

  // New fields from Database
  generationName?: string; // e.g., "定", "英"
  gender?: string;
  mateName?: string;
  lifeSpan?: string;       // e.g., "1930-2005"

  // Detail fields (optional here, used in Detail page)
  motherId?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  portraitPath?: string;
  bio?: string;
}

interface ClanTreeProps {
  data: FamilyMember[];
  onNodeClick?: (id: string) => void;
}

const ClanTree: React.FC<ClanTreeProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    // 1. Clean up previous render
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 2. Setup Dimensions
    const width = 1200; // Increased width for better visibility
    const height = 800;
    const margin = { top: 40, right: 120, bottom: 40, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 3. Data Stratification
    try {
      // Handle cases where parentId might be empty string -> convert to null for d3.stratify if needed
      // But typically d3.stratify expects explicit null or empty string handling based on root.
      // Here we assume the root has parentId === "" or null.
      const stratify = d3.stratify<FamilyMember>()
        .id((d) => d.id)
        .parentId((d) => d.parentId || null); // Treat empty string as root

      const root = stratify(data);

      // 4. Tree Layout
      const treeLayout = d3.tree<FamilyMember>()
        .size([innerHeight, innerWidth])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 2)); // More space between nodes

      treeLayout(root);

      // 5. Container Group
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // --- A. Links (Curved lines) ---
      g.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#cbd5e1") // Slate-300
        .attr("stroke-width", 2)
        .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<FamilyMember>, d3.HierarchyPointNode<FamilyMember>>()
          .x((d) => d.y!)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .y((d) => d.x!) as any
        );

      // --- B. Nodes ---
      const node = g
        .selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d) => `translate(${d.y!},${d.x!})`)
        .style("cursor", "pointer");

      // 1. Hit Area (Transparent Circle)
      node
        .append("circle")
        .attr("r", 35)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("click", (_event, d) => {
          if (onNodeClick) {
            onNodeClick(d.data.id);
          } else if (window.CallBridge) {
            // Fallback
            window.CallBridge.invoke("showMemberDetail", d.data.id);
          }
        });

      // 2. Visible Circle (Status Indicator)
      node
        .append("circle")
        .attr("r", 24)
        .attr("fill", (d) => {
             // Gender Color: Blue for M, Pink/Red for F
             return d.data.gender === 'F' ? "#ec4899" : "#3b82f6";
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 3)
        .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))");

      // 3. Generation Label (Inside Circle)
      node
        .append("text")
        .attr("dy", 5)
        .attr("text-anchor", "middle")
        .text((d) => {
            // Priority: Generation Name > Generation Number
            return d.data.generationName || d.data.generation;
        })
        .style("fill", "white")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "serif") // Serif looks better for Chinese characters
        .style("pointer-events", "none");

      // 4. Name Label (Above Node)
      node
        .append("text")
        .attr("dy", -32)
        .attr("x", 0)
        .style("text-anchor", "middle")
        .text((d) => d.data.name)
        .style("font-size", "16px")
        .style("font-weight", "600")
        .style("fill", "#1e293b") // Slate-800
        .style("text-shadow", "0 1px 2px white")
        .style("pointer-events", "none");

      // 5. Mate & LifeSpan (Below Node)
      node
        .append("text")
        .attr("dy", 38)
        .attr("x", 0)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#64748b") // Slate-500
        .each(function(d) {
            const el = d3.select(this);
            // Line 1: Mate
            if (d.data.mateName) {
                el.append("tspan")
                  .attr("x", 0)
                  .attr("dy", 0)
                  .text(`配: ${d.data.mateName}`);
            }
            // Line 2: LifeSpan
            if (d.data.lifeSpan) {
                el.append("tspan")
                  .attr("x", 0)
                  .attr("dy", d.data.mateName ? 14 : 0) // New line if mate exists
                  .text(d.data.lifeSpan);
            }
        });

    } catch (error) {
      console.error("D3 Rendering Error:", error);
      svg
        .append("text")
        .text("Error rendering tree. Please check console.")
        .attr("fill", "red")
        .attr("x", 50)
        .attr("y", 50);
    }
  }, [data, onNodeClick]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: "auto",
        background: "#f8fafc", // Slate-50
        borderRadius: "12px",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.05)"
      }}
    >
      <svg ref={svgRef} width={1200} height={800} style={{ display: 'block' }}></svg>
    </div>
  );
};

export default ClanTree;
