import { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import ClanTree, { type FamilyMember } from "./components/ClanTree";
import MemberDetail from "./pages/MemberDetail";

// 扩展全局类型
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
    // 【修正】C++ 直接传的是 Object，不是 JSON String
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSearchResultsReceived?: (data: any) => void;
  }
}

interface SearchResult {
  id: string;
  name: string;
  generation: number;
  bioSnippet: string;
}

const Home = () => {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("等待连接...");

  // 搜索状态
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        setStatus("已连接");
        clearInterval(timer);

        // 1. 族谱数据回调
        window.onFamilyTreeDataReceived = (data) => {
          console.log("[React] Tree Data Received:", data.length);
          setFamilyData(data);
          setStatus(`已加载 ${data.length} 位家族成员`);
        };

        // 2. 搜索回调
        window.onSearchResultsReceived = (results) => {
             // C++ 传过来已经是 Array 了，直接用
             console.log("[React] Search Results:", results);
             setSearchResults(results);
             setShowResults(true);
        };

        window.CallBridge.invoke("fetchFamilyTree", "init");
      } else if (checkCount > 50) {
        clearInterval(timer);
        setStatus("未检测到 Qt 环境 (Dev Mode)");
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleNodeClick = (id: string) => {
    navigate(`/member/${id}`);
  };

  const handleRefresh = () => {
    if (window.CallBridge) {
      window.CallBridge.invoke("fetchFamilyTree", "manual");
    }
  };

  // 搜索处理
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value;
    setSearchTerm(keyword);

    if (keyword.trim().length === 0) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (window.CallBridge) {
      window.CallBridge.invoke("searchMembers", keyword);
    }
  };

  return (
    <div className="container" onClick={() => setShowResults(false)}>
      {/* Header Area */}
      <div style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 100
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Clan Memory</h1>

            {/* 搜索框 */}
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <input
                    type="text"
                    placeholder="🔍 搜名字、生平..."
                    value={searchTerm}
                    onChange={handleSearch}
                    onFocus={() => { if(searchResults.length > 0) setShowResults(true); }}
                    style={{
                        padding: '8px 16px',
                        width: '300px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        outline: 'none',
                        background: '#f8fafc',
                        fontSize: '0.95rem'
                    }}
                />

                {/* 搜索结果下拉列表 */}
                {showResults && searchResults.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '8px',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid #f1f5f9'
                    }}>
                        {searchResults.map(res => (
                            <div
                                key={res.id}
                                onClick={() => handleNodeClick(res.id)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    textAlign: 'left' // 强制左对齐
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                <div style={{fontWeight: 600, color: '#334155'}}>
                                    {res.name} <span style={{fontSize: '0.8em', color: '#94a3b8', marginLeft: '8px'}}>第{res.generation}世</span>
                                </div>
                                {res.bioSnippet && (
                                    <div style={{fontSize: '0.85rem', color: '#64748b', marginTop: '4px'}}>
                                        {res.bioSnippet}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: isBridgeReady ? '#10b981' : '#f59e0b' }}>
                {status}
            </span>
            <button onClick={handleRefresh} disabled={!isBridgeReady} className="refresh-btn">
              刷新
            </button>
        </div>
      </div>

      <div className="tree-container" style={{ height: 'calc(100vh - 120px)' }}>
        {familyData.length > 0 ? (
          <ClanTree data={familyData} onNodeClick={handleNodeClick} />
        ) : (
          <div className="empty-state">
            <p>{status}</p>
          </div>
        )}
      </div>
    </div>
  );
};

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
