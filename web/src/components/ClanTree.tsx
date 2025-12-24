import React, { useState, useRef, useMemo } from "react";
import * as d3 from "d3";

export interface FamilyMember {
  id: string;
  name: string;
  gender?: string;
  generation: number;
  generationName: string;
  parentId: string;
  motherId: string;
  spouseName: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  portraitPath?: string;
  bio?: string;
  children?: FamilyMember[]; // Added for D3 hierarchy
}

interface ClanTreeProps {
  data: FamilyMember[];
  onNodeClick?: (id: string) => void;
  selectedId?: string | null;
}

const PAN_LIMIT_X = 500;
const PAN_LIMIT_Y = 300;

const ClanTree: React.FC<ClanTreeProps> = ({
  data,
  onNodeClick,
  selectedId,
}) => {
  // 1. D3 Hierarchy Layout Calculation
  const root = useMemo(() => {
    if (!data || data.length === 0) return null;
    try {
      const stratify = d3
        .stratify<FamilyMember>()
        .id((d) => d.id)
        .parentId((d) => d.parentId);

      const rootNode = stratify(data);

      // Vertical Layout: nodeSize controls spacing [width, height]
      // Width: horizontal space between siblings
      // Height: vertical space between generations
      const treeLayout = d3.tree<FamilyMember>().nodeSize([140, 180]);

      return treeLayout(rootNode);
    } catch (e) {
      console.error("Tree layout error:", e);
      return null;
    }
  }, [data]);

  // 2. Dragging (Panning) State
  const [translate, setTranslate] = useState({ x: 0, y: 150 }); // Initial Offset
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent drag if clicking on a node
    if ((e.target as HTMLElement).closest(".tree-node")) return;

    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - translate.x,
      y: e.clientY - translate.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    let newX = e.clientX - dragStart.current.x;
    let newY = e.clientY - dragStart.current.y;

    // Apply Boundary Checks (Clamping)
    if (newX > PAN_LIMIT_X) newX = PAN_LIMIT_X;
    if (newX < -PAN_LIMIT_X) newX = -PAN_LIMIT_X;
    if (newY > PAN_LIMIT_Y) newY = PAN_LIMIT_Y;
    if (newY < -PAN_LIMIT_Y) newY = -PAN_LIMIT_Y;

    setTranslate({ x: newX, y: newY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // 3. Helper to generate orthogonal paths (Inverted-T style)
  const generatePath = (
    source: { x: number; y: number },
    target: { x: number; y: number }
  ) => {
    const midY = (source.y + target.y) / 2;
    return `M${source.x},${source.y}
            V${midY}
            H${target.x}
            V${target.y}`;
  };

  if (!root) return null;

  return (
    <div
      className="main-canvas" // This class has overflow:hidden and background
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Transform Layer */}
      <div
        className="tree-layer"
        style={{
          transform: `translate(calc(50% + ${translate.x}px), ${translate.y}px)`,
        }}
      >
        {/* Layer A: SVG Connectors (Z-Index 0) */}
        <svg className="connector-lines" style={{ overflow: "visible" }}>
          {root.links().map((link, i) => (
            <path
              key={i}
              d={generatePath(link.source, link.target)}
              fill="none"
              stroke="#555"
              strokeWidth="2"
            />
          ))}
        </svg>

        {/* Layer B: HTML Nodes (Z-Index 2) */}
        {root.descendants().map((node) => {
          const member = node.data;
          const isMale = member.gender === "M" || member.gender === "Male";
          const isSelected = selectedId === member.id;

          // Determine classes
          let nodeClass = "tree-node";
          if (isMale) nodeClass += " node-male";
          else nodeClass += " node-female";

          if (isSelected) nodeClass += " active";

          return (
            <div
              key={member.id}
              className={nodeClass}
              style={{ left: node.x, top: node.y }}
              onClick={(e) => {
                e.stopPropagation(); // Prevent drag start
                onNodeClick?.(member.id);
              }}
            >
              <div className="node-avatar">
                {member.portraitPath ? (
                  <img src={member.portraitPath} alt={member.name} />
                ) : (
                  <span style={{ fontSize: "30px", pointerEvents: "none" }}>
                    {isMale ? "👨" : "👩"}
                  </span>
                )}
              </div>
              <div className="node-name">
                {member.name} ({member.generation}世)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClanTree;
