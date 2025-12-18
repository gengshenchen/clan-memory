import { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import ClanTree from "./components/ClanTree";
import MemberDetail from "./pages/MemberDetail";

// 1. 定义数据结构
interface FamilyMember {
  id: string;
  name: string;
  parentId: string;
  generation: number;
  mate_name?: string;
  bio?: string;
}

// 2. TypeScript 声明 (原理见下文)
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
  }
}

const Home = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("等待连接...");
  const navigate = useNavigate(); // 用于跳转

  useEffect(() => {
    // 轮询检测 Bridge
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        setStatus("已连接");
        clearInterval(timer);

        window.onFamilyTreeDataReceived = (data) => {
          setFamilyData(data);
          setStatus(`已加载 ${data.length} 人`);
        };

        // 自动拉取一次数据
        window.CallBridge.invoke("fetchFamilyTree", "init");
      } else if (checkCount > 50) {
        clearInterval(timer);
        setStatus("连接超时");
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // 处理节点点击
  const handleNodeClick = (id: string) => {
    // 跳转到详情页
    navigate(`/member/${id}`);
  };

  const handleRefresh = () => {
    if (window.CallBridge) {
      setStatus("刷新中...");
      window.CallBridge.invoke("fetchFamilyTree", "manual");
    }
  };

  return (
    <div className="container">
      <h1>Clan Memory</h1>
      {/* 顶部控制栏 */}
      <div className="card" style={{ padding: "10px", marginBottom: "20px" }}>
        <button onClick={handleRefresh} disabled={!isBridgeReady}>
          {isBridgeReady ? "刷新族谱" : "连接核心中..."}
        </button>
        <span style={{ marginLeft: "10px", color: "#666" }}>{status}</span>
      </div>

      <div className="tree-container">
        {familyData.length > 0 ? (
          <ClanTree
            data={familyData}
            onNodeClick={handleNodeClick} // 传递点击事件
          />
        ) : (
          <p>{status}</p>
        )}
      </div>
    </div>
  );
};

// 主 App 组件只负责路由配置
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/member/:id" element={<MemberDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
