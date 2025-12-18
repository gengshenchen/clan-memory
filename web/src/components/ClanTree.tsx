import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

// 复用数据定义
export interface FamilyMember {
  id: string;
  name: string;
  parentId: string; // 对应 father_id
  generation: number;
  gender?: string;

  // 新增字段 (注意使用驼峰命名，对应 JsBridge 里的 key)
  motherId?: string;
  mateName?: string; // 之前是 mate_name，建议统一改为 mateName

  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;

  portraitPath?: string; // 头像链接
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

    // 1. 清理旧图表
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 2. 设置画布尺寸
    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 90, bottom: 30, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 3. 数据转换：扁平数组 -> 树状层级
    try {
      const root = d3
        .stratify<FamilyMember>()
        .id((d) => d.id)
        .parentId((d) => d.parentId)(data);

      // 4. 创建树布局 (从左到右生长)
      const treeLayout = d3
        .tree<FamilyMember>()
        .size([innerHeight, innerWidth]);
      treeLayout(root);

      // 5. 绘制容器
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // A. 绘制连线 (Links) - 使用贝塞尔曲线
      g.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 2)
        .attr(
          "d",
          d3
            .linkHorizontal<
              d3.HierarchyPointLink<FamilyMember>,
              d3.HierarchyPointNode<FamilyMember>
            >()
            .x((d) => d.y!)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .y((d) => d.x!) as any
        );

      // B. 绘制节点 (Nodes)
      const node = g
        .selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d) => `translate(${d.y!},${d.x!})`)
        .style("cursor", "pointer");

      // 1. 增加一个透明的圆形作为“点击热区”
      node
        .append("circle")
        .attr("r", 30)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .style("pointer-events", "all")
        .on("click", (_event, d) => {
          console.log("点击了节点:", d.data.name);

          if (onNodeClick) {
            onNodeClick(d.data.id);
          } else if (window.CallBridge) {
            window.CallBridge.invoke("showMemberDetail", d.data.id);
          }
        });

      // 2. 视觉圆圈
      node
        .append("circle")
        .attr("r", 20)
        .attr("fill", (d) => (d.data.mateName ? "#4CAF50" : "#2196F3"))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");

      // 3. 节点文字
      node
        .append("text")
        .attr("dy", 4)
        .attr("text-anchor", "middle")
        .text((d) => d.data.generation)
        .style("fill", "white")
        .style("font-size", "10px")
        .style("pointer-events", "none");

      node
        .append("text")
        .attr("dy", -25)
        .attr("x", 0)
        .style("text-anchor", "middle")
        .text((d) => d.data.name)
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .style("pointer-events", "none");

      // 节点：配偶
      node
        .filter((d) => !!d.data.mateName)
        .append("text")
        .attr("dy", 35)
        .attr("x", 0)
        .style("text-anchor", "middle")
        .text((d) => `配: ${d.data.mateName}`)
        .style("font-size", "12px")
        .style("fill", "#666");
    } catch (error) {
      console.error("D3 绘图失败:", error);
      svg
        .append("text")
        .text("绘图错误: 请检查数据结构")
        .attr("fill", "red")
        .attr("y", 50);
    }
  }, [data, onNodeClick]); // 把 onNodeClick 加入依赖数组

  return (
    <div
      style={{
        overflow: "auto",
        border: "1px solid #eee",
        borderRadius: "8px",
        background: "#f9f9f9",
      }}
    >
      <svg ref={svgRef} width={1000} height={600}></svg>
    </div>
  );
};

export default ClanTree;
