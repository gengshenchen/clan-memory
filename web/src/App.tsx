import { useState, useRef } from "react";
import "./App.css";

import { useClanBridge } from "./hooks/useClanBridge";
import { useMedia } from "./hooks/useMedia";
import ClanTree, { type ClanTreeHandle } from "./components/ClanTree/ClanTree";
import TopBar from "./components/Layout/TopBar";
import SidePanel from "./components/Layout/SidePanel";
import MediaPlayer from "./components/Media/MediaPlayer";
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
  const [password, setPassword] = useState("");
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isFullBioOpen, setIsFullBioOpen] = useState(false);

  const treeRef = useRef<ClanTreeHandle>(null);

  const handleNodeClick = (id: string) => fetchMemberDetail(id);

  const handleSearch = (text: string) => {
    if (!text) return;
    const target = familyData.find((m: FamilyMember) => m.name.includes(text));
    if (target) {
      treeRef.current?.focusNode(target.id);
      fetchMemberDetail(target.id);
    } else {
      alert("未找到名为 " + text + " 的成员");
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

  return (
    <>
      <TopBar
        isAdmin={isAdminMode}
        onAdminClick={() =>
          isAdminMode
            ? window.confirm("退出?") && setIsAdminMode(false)
            : setIsLoginOpen(true)
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
          next: media.actions.next, // [Fix] 绑定了切换逻辑
          prev: media.actions.prev, // [Fix] 绑定了切换逻辑
          toggleAudio: media.actions.toggleAudio,
          seekAudio: media.actions.seekAudio,
          changeSpeed: media.actions.changeSpeed,
          setAudioPlaying: media.actions.setAudioPlaying,
          setAudioProgress: media.actions.setAudioProgress,
          setAudioDuration: media.actions.setAudioDuration,
        }}
        avatarSrc={avatarSrc}
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
          <button
            className="close-dashboard-btn"
            onClick={() => setIsDashboardOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className="dashboard-content">
          <div style={{ color: "white", padding: 20 }}>管理员功能开发中...</div>
        </div>
      </div>
    </>
  );
}

export default App;
