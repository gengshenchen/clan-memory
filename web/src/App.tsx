import { useState, useRef, useEffect } from "react";
import "./App.css";

import { useClanBridge } from "./hooks/useClanBridge";
import { useMedia } from "./hooks/useMedia";
import ClanTree, { type ClanTreeHandle } from "./components/ClanTree/ClanTree";
import TopBar from "./components/Layout/TopBar";
import SidePanel from "./components/Layout/SidePanel";
import MediaPlayer from "./components/Media/MediaPlayer";
import { MemberForm } from "./components/Admin/MemberForm";
import { OperationLogs } from "./components/Admin/OperationLogs";
import { type FamilyMember } from "./types";

function App() {
  const {
    isBridgeReady,
    familyData,
    selectedMember,
    setSelectedMember,
    avatarSrc,
    fetchMemberDetail,
    updateMemberPortrait,
  } = useClanBridge();

  const media = useMedia(selectedMember);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [password, setPassword] = useState("admin");
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isFullBioOpen, setIsFullBioOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  // Member form states
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [generationNames, setGenerationNames] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<FamilyMember[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const treeRef = useRef<ClanTreeHandle>(null);

  // Fetch generation names when admin mode enters
  useEffect(() => {
    if (isAdminMode && window.CallBridge) {
      // Set up callback for settings
      window.onSettingsReceived = (key: string, value: string[]) => {
        if (key === "generation_names" && Array.isArray(value)) {
          setGenerationNames(value);
        }
      };
      // Fetch generation names
      window.CallBridge.invoke("getSettings", "generation_names");
    }
  }, [isAdminMode]);

  // Expose tree focus function globally for callbacks (portrait update, etc.)
  useEffect(() => {
    (window as unknown as { focusTreeNode?: (id: string) => void }).focusTreeNode = (id: string) => {
      if (treeRef.current) {
        treeRef.current.focusNode(id);
      }
    };
  }, []);

  const handleNodeClick = (id: string) => fetchMemberDetail(id);

  // Define callback interface for global window object
  useEffect(() => {
    // @ts-ignore
    window.onSearchResultsReceived = (results: any) => {
        console.log("Async search results received:", results);
        if (results && results.length > 0) {
            if (results.length === 1) {
                const target = results[0];
                if (treeRef.current) {
                    treeRef.current.focusNode(target.id);
                }
                fetchMemberDetail(target.id);
            } else {
                setSearchResults(results);
                setShowSearchResults(true);
            }
        } else {
             alert("未找到匹配成员");
        }
    };
    
    // Cleanup
    return () => {
        // @ts-ignore
        delete window.onSearchResultsReceived;
    };
  }, []);

  const handleSearch = (text: string) => {
    if (!text) return;

    // Use backend search (supports aliases and robust LIKE query)
    if (window.CallBridge) {
        console.log("Invoking searchMembers:", text);
        try {
            window.CallBridge.invoke("searchMembers", text);
            // Result will be handled by window.onSearchResultsReceived
        } catch (e) {
            console.error("Search invoke failed:", e);
        }
        return;
    }

    // Fallback: Client-side search (Name only)
    const target = familyData.find((m: FamilyMember) => m.name.includes(text));
    if (target) {
      treeRef.current?.focusNode(target.id);
      fetchMemberDetail(target.id);
    } else {
      alert("未找到匹配成员");
    }
  };

  const handleLogin = () => {
    if (password === "admin") {
      setIsAdminMode(true);
      document.body.classList.add("admin-mode");
      setIsLoginOpen(false);
      setIsDashboardOpen(true);
      setSelectedMember(null);
      setPassword("");
    } else {
      alert("密码错误");
    }
  };

  const handleLogout = () => {
    if (window.confirm("退出管理员模式?")) {
      setIsAdminMode(false);
      setIsDashboardOpen(false);
      document.body.classList.remove("admin-mode");
    }
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setIsMemberFormOpen(true);
  };







  return (
    <>
      <TopBar
        isAdmin={isAdminMode}
        onAdminClick={() =>
          isAdminMode ? handleLogout() : setIsLoginOpen(true)
        }
        onSearch={handleSearch}
      />

      <ClanTree
        ref={treeRef}
        data={familyData}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setSelectedMember(null)}
        selectedId={selectedMember?.id}
      />

      {familyData.length === 0 && (
        <div className="hint-bar">
          <div className="hint-pill">
            {isBridgeReady ? "数据加载中..." : "连接核心中..."}
          </div>
        </div>
      )}

      <SidePanel
        member={selectedMember}
        isOpen={!!selectedMember && !isDashboardOpen}
        onClose={() => setSelectedMember(null)}
        avatarSrc={avatarSrc}
        onOpenMedia={media.actions.openMedia}
        onReadBio={() => setIsFullBioOpen(true)}
        onUpdatePortrait={() => {
          console.log("App: onUpdatePortrait called", selectedMember?.id);
          if (selectedMember) updateMemberPortrait(selectedMember.id);
        }}
        isAdminMode={isAdminMode}
        onEditMember={() => {
          setEditingMember(selectedMember);
          setIsMemberFormOpen(true);
        }}
        mediaCounts={media.mediaCounts}
        allMembers={familyData}
      />

      <MediaPlayer
        isActive={!!media.mediaType}
        type={media.mediaType}
        mediaList={media.mediaList}
        currentUrl={media.currentMediaUrl}
        isUploading={media.isUploading}
        audioState={media.audioState}
        actions={{
          close: media.actions.closeMedia,
          select: media.actions.setCurrentMediaUrl,
          upload: media.actions.uploadMedia,
          deleteMedia: media.actions.deleteMedia,
          next: media.actions.next,
          prev: media.actions.prev,
          toggleAudio: media.actions.toggleAudio,
          seekAudio: media.actions.seekAudio,
          changeSpeed: media.actions.changeSpeed,
          setAudioPlaying: media.actions.setAudioPlaying,
          setAudioProgress: media.actions.setAudioProgress,
          setAudioDuration: media.actions.setAudioDuration,
        }}
        avatarSrc={avatarSrc}
        isAdminMode={isAdminMode}
      />

      <div className={`full-bio-overlay ${isFullBioOpen ? "active" : ""}`}>
        <div className="bio-header">
          <button className="back-btn" onClick={() => setIsFullBioOpen(false)}>
            ← 返回
          </button>
        </div>
        <div className="bio-content-scroll">
          {selectedMember && (
            <article className="bio-article">
              <h1>{selectedMember.name} 生平传略</h1>
              <div className="bio-article-meta">
                第{selectedMember.generation}世 ·{" "}
                {selectedMember.generationName}字辈
              </div>
              <div className="bio-body">
                <p>{selectedMember.bio || "暂无。"}</p>
              </div>
            </article>
          )}
        </div>
      </div>

      <div className={`modal-overlay ${isLoginOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>管理员登录</h2>
          <input
            type="password"
            className="modal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setIsLoginOpen(false)}
            >
              取消
            </button>
            <button className="btn btn-primary" onClick={handleLogin}>
              登录
            </button>
          </div>
        </div>
      </div>

      <div
        className={`admin-dashboard ${isDashboardOpen ? "active" : ""}`}
        id="adminDashboard"
      >
        <div className="dashboard-header">
          <h2 className="dashboard-title">管理员工作台</h2>
          <button
            className="close-dashboard-btn"
            onClick={() => setIsDashboardOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="dashboard-content">
          <div className="dashboard-cards">
            <div className="dashboard-card" onClick={handleAddMember}>
              <div className="card-icon">➕</div>
              <div className="card-title">添加成员</div>
              <div className="card-desc">录入新的家族成员</div>
            </div>
            <div
              className="dashboard-card"
              onClick={() =>
                alert(`当前族谱共有 ${familyData.length} 位成员\n更多统计详情功能正在开发中！`)
              }
            >
              <div className="card-icon">📊</div>
              <div className="card-title">统计概览</div>
              <div className="card-desc">共 {familyData.length} 位成员</div>
            </div>
            <div className="dashboard-card" onClick={() => setIsLogsOpen(true)}>
              <div className="card-icon">📋</div>
              <div className="card-title">操作日志</div>
              <div className="card-desc">查看变更记录</div>
            </div>
          </div>

          <div className="dashboard-section">
            <h3>快速入口</h3>
            <p className="dashboard-hint">
              点击「添加成员」卡片开始录入，或关闭此面板后点击任意成员进行编辑。
            </p>
          </div>
        </div>
      </div>

      {isAdminMode && !isDashboardOpen && (
        <button
          className="admin-fab"
          onClick={() => setIsDashboardOpen(true)}
          title="打开管理员工作台"
        >
          🛠️
        </button>
      )}

      <MemberForm
        isOpen={isMemberFormOpen}
        onClose={() => {
          setIsMemberFormOpen(false);
          setEditingMember(null);
        }}
        member={editingMember}
        allMembers={(() => {
          const flatten = (nodes: FamilyMember[]): FamilyMember[] =>
            nodes.flatMap((n) => [n, ...(n.children ? flatten(n.children) : [])]);
          return flatten(familyData || []);
        })()}
        generationNames={generationNames}
        onSaveComplete={(memberId) => {
          // Wait a bit for tree data to refresh, then focus and show detail
          setTimeout(() => {
            treeRef.current?.focusNode(memberId);
            fetchMemberDetail(memberId);
            setIsDashboardOpen(false); // Close dashboard to show member detail
          }, 300);
        }}
      />

      <div className={`modal-overlay ${showSearchResults ? "active" : ""}`} onClick={() => setShowSearchResults(false)}>
         <div className="modal-box search-results-box" onClick={e => e.stopPropagation()}>
             <h3 className="modal-title">搜索结果</h3>
             {!searchResults || searchResults.length === 0 ? (
                 <p style={{color: '#888', margin: '20px 0'}}>未找到匹配成员</p>
             ) : (
                 <ul className="search-result-list">
                     {searchResults.map(m => (
                         <li key={m.id} onClick={() => {
                             treeRef.current?.focusNode(m.id);
                             fetchMemberDetail(m.id);
                             setShowSearchResults(false);
                         }}>
                             <div className="result-name">
                                 {m.name} 
                                 {m.aliases && <small> ({m.aliases})</small>}
                             </div>
                             <div className="result-meta">
                                 {m.generation}世 · {m.generationName}字辈 
                                {m.spouseName ? ` | 配偶: ${m.spouseName}` : ""}
                                {m.fatherName ? ` | 父亲: ${m.fatherName}` : (m.parentId ? "" : " | 始祖")}
                             </div>
                         </li>
                     ))}
                 </ul>
             )}
             <button className="btn btn-secondary" style={{marginTop: 20}} onClick={() => setShowSearchResults(false)}>关闭</button>
         </div>
      </div>

      <OperationLogs isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} />
    </>
  );
}

export default App;
