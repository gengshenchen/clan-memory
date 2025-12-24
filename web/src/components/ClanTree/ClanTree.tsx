import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
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

  // 1. 数据处理与布局
  useMemo(() => {
    if (!data || data.length === 0) {
        setRoot(null);
        return;
    }
    try {
      const stratify = d3.stratify<FamilyMember>()
        .id((d) => d.id)
        .parentId((d) => d.parentId || "");

      const rootNode = stratify(data);

      // [Fix] 再次增大节点间距，防止任何重叠
      const treeLayout = d3.tree<FamilyMember>().nodeSize([250, 320]);

      setRoot(treeLayout(rootNode));
    } catch (e) {
      console.error("Tree layout error:", e);
    }
  }, [data]);

  // 2. 初始化 D3 Zoom
  // [Critical Fix] 依赖项加入 [root]，确保 SVG 渲染后再绑定事件
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

    // [Fix] 初始居中逻辑：将根节点移到屏幕上方中间
    if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        // D3 Tree 根节点默认在 (0,0)
        // 我们平移 (width/2, 100) 让它显示在正上方
        const initialTransform = d3.zoomIdentity.translate(clientWidth / 2, 100).scale(0.85);
        svg.call(zoom.transform, initialTransform);
    }
  }, [root]);

  // 3. 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    focusNode: (id: string) => {
      if (!root || !svgRef.current || !zoomBehavior.current) return;

      const target = root.descendants().find(d => d.data.id === id);
      if (!target) {
          alert("未找到该成员节点");
          return;
      }

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

  // 4. 绘制直角连线
  const generatePath = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const midY = (source.y + target.y) / 2;
    return `M${source.x},${source.y} V${midY} H${target.x} V${target.y}`;
  };

  if (!root) return <div style={{color:'#666', padding:20, display:'flex', justifyContent:'center', marginTop:'20%'}}>数据加载中...</div>;

  return (
    <div ref={containerRef} className="tree-container" style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#1a1a1a', cursor: 'grab' }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ width: '100%', height: '100%', touchAction: 'none' }}>
        <g ref={gRef}>
          {/* 连线 */}
          {root.links().map((link, i) => (
            <path key={`link-${i}`} d={generatePath(link.source, link.target)} fill="none" stroke="#555" strokeWidth="1.5" />
          ))}

          {/* 节点 */}
          {root.descendants().map((node) => {
            const d = node.data;
            const isSelected = selectedId === d.id;
            const isMale = d.gender === 'M';

            return (
              <g
                key={d.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: 'pointer' }}
              >
                {/* [Fix] 扩大 foreignObject 视口，防止阴影或头像被切 */}
                {/* 以前是 140x160 (-70,-40)，现在改为 200x200 (-100,-100) 以容纳任何溢出 */}
                <foreignObject x="-100" y="-100" width="200" height="200" style={{ pointerEvents: 'none', overflow: 'visible' }}>

                  {/* 内部容器：恢复点击事件，并居中真实的卡片 */}
                  <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none' // 容器本身不接管点击，让内部卡片接管
                  }}>

                    {/* 真正的卡片节点 */}
                    <div className={`tree-node ${isSelected ? 'active' : ''} ${isMale ? 'node-male' : 'node-female'}`}
                         onClick={(e) => {
                           e.stopPropagation(); // 阻止触发背景拖拽
                           onNodeClick(d.id);
                         }}
                         style={{
                           width: '140px', height: '160px', // 固定卡片尺寸
                           boxSizing: 'border-box',
                           display: 'flex', flexDirection: 'column', alignItems: 'center',
                           justifyContent: 'center',
                           pointerEvents: 'auto', // [Fix] 恢复交互
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
                          // 阴影放在头像上也行
                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                      }}>
                          {d.portraitPath ? (
                              <img src={d.portraitPath} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}
                                   onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                              <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', paddingBottom:'5px'}}>
                                  {isMale ? "👨" : "👩"}
                              </div>
                          )}
                      </div>

                      {/* 名字与代数 */}
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
