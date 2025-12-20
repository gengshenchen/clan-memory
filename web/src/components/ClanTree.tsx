import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

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
}

interface ClanTreeProps {
  data: FamilyMember[];
  onNodeClick?: (id: string) => void;
}

const ClanTree: React.FC<ClanTreeProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = window.innerWidth;
    const height = window.innerHeight - 60; // 减去顶栏高度
    const margin = { top: 50, right: 100, bottom: 50, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    try {
      const root = d3.stratify<FamilyMember>()
        .id(d => d.id)
        .parentId(d => d.parentId)(data);

      const treeLayout = d3.tree<FamilyMember>().size([innerHeight, innerWidth]);
      treeLayout(root);

      // 支持缩放和平移
      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.5, 2])
          .on("zoom", (event) => {
              g.attr("transform", event.transform);
          });
      svg.call(zoom);

      // A. 绘制连线
      g.selectAll(".link")
        .data(root.links())
        .enter().append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#555") // 深色背景下的连线颜色
        .attr("stroke-width", 2)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr("d", d3.linkHorizontal<d3.HierarchyPointLink<FamilyMember>, d3.HierarchyPointNode<FamilyMember>>()
          .x(d => d.y!)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .y(d => d.x!) as any
        );

      // B. 绘制节点容器
      const node = g.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y!},${d.x!})`)
        .style("cursor", "pointer");

      // 1. 点击热区 (透明大圆)
      node.append("circle")
        .attr("r", 45)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .on("click", (_event, d) => {
           if (onNodeClick) {
             onNodeClick(d.data.id);
           }
        });

      // 2. 头像背景框 (模拟 ui.html 中的 .node-avatar)
      node.append("circle")
        .attr("r", 30) // 半径 30 = 宽高 60
        .attr("fill", "#555")
        .attr("stroke", d => {
            // 根据性别或状态改变边框颜色
            if (d.data.gender === 'F') return '#e06c75'; // 粉色
            return '#4a90e2'; // 蓝色
        })
        .attr("stroke-width", 3)
        .style("pointer-events", "none");

      // 3. 头像内容 (这里暂时用 Emoji 或文字首字代替，因为 SVG image 处理 Base64 较复杂，为了性能先简化)
      node.append("text")
        .attr("dy", 8)
        .attr("text-anchor", "middle")
        .text(d => d.data.gender === 'F' ? '👩' : '👨')
        .style("font-size", "30px")
        .style("pointer-events", "none");

      // 4. 姓名标签 (模拟 .node-name)
      // 背景胶囊
      node.append("rect")
        .attr("x", -40)
        .attr("y", 35)
        .attr("width", 80)
        .attr("height", 24)
        .attr("rx", 12)
        .attr("fill", "rgba(0,0,0,0.7)")
        .style("pointer-events", "none");

      // 姓名文字
      node.append("text")
        .attr("dy", 52)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .text(d => d.data.name)
        .style("font-size", "12px")
        .style("fill", "#e5e5e5")
        .style("pointer-events", "none");

    } catch (error) {
      console.error("D3 绘图失败:", error);
    }

  }, [data, onNodeClick]);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg ref={svgRef} width="100%" height="100%"></svg>
    </div>
  );
};

export default ClanTree;
