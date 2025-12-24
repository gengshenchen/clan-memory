import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import * as d3 from "d3";
import { type FamilyMember } from "../../types";

export interface ClanTreeHandle {
  focusNode: (id: string) => void;
}

interface ClanTreeProps {
  data: FamilyMember[];
  onNodeClick: (id: string) => void;
  selectedId?: string | null;
}

const ClanTree = forwardRef<ClanTreeHandle, ClanTreeProps>(({ data, onNodeClick, selectedId }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, any> | null>(null);

  const [root, setRoot] = useState<d3.HierarchyPointNode<FamilyMember> | null>(null);

  // [Fix] 增强版路径转换函数
  const getAvatarUrl = (path?: string) => {
    if (!path || path.trim() === "") return "";
    // 1. 如果已经是网络图片、Base64 或 file 协议，直接返回
    if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("file:")) return path;

    // 2. 规范化路径：将 Windows 反斜杠转换为正斜杠 (重要！)
    const normalizedPath = path.replace(/\\/g, "/");

    // 3. 处理 Windows 盘符 (例如 C:/...) -> file:///C:/...
    if (/^[a-zA-Z]:/.test(normalizedPath)) {
        return `file:///${normalizedPath}`;
    }

    // 4. 处理 Linux/Unix 绝对路径 (/home/...) -> file:///home/...
    if (normalizedPath.startsWith("/")) {
        return `file://${normalizedPath}`;
    }

    return `file://${normalizedPath}`;
  };

  // [Fix] 必须使用 useEffect 处理副作用 (状态更新)
  // 之前使用 useMemo 调用 setRoot 是错误的，会导致 React 报错
  useEffect(() => {
    if (!data || data.length === 0) {
        setRoot(null);
        return;
    }
    try {
      const stratify = d3.stratify<FamilyMember>()
        .id((d) => d.id)
        .parentId((d) => d.parentId || "");

      const rootNode = stratify(data);
      const treeLayout = d3.tree<FamilyMember>().nodeSize([250, 320]);

      // 在 useEffect 中更新 State 是安全的
      setRoot(treeLayout(rootNode));
    } catch (e) {
      console.error("Tree layout error:", e);
    }
  }, [data]);

  // 初始化 D3 Zoom
  useEffect(() => {
    if (!root || !svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomBehavior.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);

    // 初始居中逻辑
    if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        const initialTransform = d3.zoomIdentity.translate(clientWidth / 2, 100).scale(0.85);
        svg.call(zoom.transform, initialTransform);
    }
  }, [root]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    focusNode: (id: string) => {
      if (!root || !svgRef.current || !zoomBehavior.current) return;

      const target = root.descendants().find(d => d.data.id === id);
      if (!target) return;

      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth;
      const height = svgRef.current.clientHeight;
      const scale = 1.0;

      const x = -target.x * scale + width / 2;
      const y = -target.y * scale + height / 2;

      svg.transition()
         .duration(750)
         .call(zoomBehavior.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
    }
  }));

  const generatePath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const midY = (source.y + target.y) / 2;
    return `M${source.x},${source.y} V${midY} H${target.x} V${target.y}`;
  };

  if (!root) return <div style={{color:'#666', padding:20, display:'flex', justifyContent:'center', marginTop:'20%'}}>数据加载中...</div>;

  return (
    <div ref={containerRef} className="tree-container" style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#1a1a1a', cursor: 'grab' }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ width: '100%', height: '100%', touchAction: 'none' }}>
        <g ref={gRef}>
          {root.links().map((link, i) => (
            <path key={`link-${i}`} d={generatePath(link.source, link.target)} fill="none" stroke="#555" strokeWidth="1.5" />
          ))}

          {root.descendants().map((node) => {
            const d = node.data;
            const isSelected = selectedId === d.id;
            const isMale = d.gender === 'M';

            // [Fix] 兼容性处理：尝试获取 camelCase 或 snake_case 字段
            // C++ 数据库通常返回下划线命名 (portrait_path)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawPath = d.portraitPath || (d as any).portrait_path;

            // 转换路径
            const imageUrl = getAvatarUrl(rawPath);

            return (
              <g
                key={d.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer' }}
              >
                <foreignObject x="-100" y="-100" width="200" height="200" style={{ pointerEvents: 'none', overflow: 'visible' }}>

                  <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none'
                  }}>

                    <div className={`tree-node ${isSelected ? 'active' : ''} ${isMale ? 'node-male' : 'node-female'}`}
                         onClick={(e) => {
                           e.stopPropagation();
                           onNodeClick(d.id);
                         }}
                         style={{
                           width: '140px', height: '160px',
                           boxSizing: 'border-box',
                           display: 'flex', flexDirection: 'column', alignItems: 'center',
                           justifyContent: 'center',
                           pointerEvents: 'auto',
                           transition: 'all 0.3s',
                           background: '#333',
                           borderRadius: '8px',
                           border: '2px solid transparent',
                           boxShadow: isSelected ? '0 0 15px var(--gold)' : '0 4px 10px rgba(0,0,0,0.5)',
                           borderColor: isSelected ? 'var(--gold)' : 'transparent',
                           transform: isSelected ? 'scale(1.1)' : 'scale(1)'
                         }}>

                      {/* 头像区域 */}
                      <div style={{
                          width: '80px', height: '80px', borderRadius: '50%',
                          overflow: 'hidden', marginBottom: '10px',
                          background: '#222', border: `3px solid ${isMale ? '#4a90e2' : '#e24a4a'}`,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                          {imageUrl ? (
                              // [Fix] 添加 key={imageUrl}，确保 URL 变化时组件重置 (清除 display:none)
                              <img
                                   key={imageUrl}
                                   src={imageUrl}
                                   alt=""
                                   style={{width:'100%', height:'100%', objectFit:'cover'}}
                                   onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                          ) : (
                              <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', paddingBottom:'5px'}}>
                                  {isMale ? "👨" : "👩"}
                              </div>
                          )}
                      </div>

                      <div style={{fontWeight: 'bold', color: '#fff', fontSize: '16px', marginBottom: '4px', textShadow: '0 1px 3px black'}}>{d.name}</div>
                      <div style={{fontSize: '12px', color: '#ccc', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px'}}>
                          {d.generation}世 · {d.generationName}字辈
                      </div>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
});

export default ClanTree;
