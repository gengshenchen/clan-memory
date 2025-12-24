import { useState, useEffect, useRef } from "react";
import "./App.css";
import ClanTree, { type FamilyMember } from "./components/ClanTree";

declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
    onMemberDetailReceived?: (data: FamilyMember) => void;
    onLocalImageLoaded?: (path: string, base64: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMemberResourcesReceived?: (data: any[], type: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResourceImported?: (data: any) => void;
  }
}

function App() {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState<boolean>(false);

  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(
    null
  );
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>("");

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const [mediaType, setMediaType] = useState<
    "video" | "photo" | "audio" | null
  >(null);
  const [isFullBioOpen, setIsFullBioOpen] = useState(false);

  // Media List State & Uploading Status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Audio Playing State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        clearInterval(timer);

        window.onFamilyTreeDataReceived = (data) => {
          setFamilyData(data);
        };

        window.onMemberDetailReceived = (data) => {
          if (data) {
            setSelectedMember(data);
            if (!isDashboardOpen) {
              setIsSidePanelOpen(true);
            }
            if (data.portraitPath) {
              if (
                data.portraitPath.startsWith("http") ||
                data.portraitPath.startsWith("//")
              ) {
                setAvatarSrc(data.portraitPath);
              } else if (window.CallBridge) {
                window.CallBridge.invoke("getLocalImage", data.portraitPath);
              }
            } else {
              setAvatarSrc("");
            }
          }
        };

        window.onLocalImageLoaded = (_path, base64) => {
          setAvatarSrc(base64);
        };

        window.onMemberResourcesReceived = (data, type) => {
          console.log(`Received ${type} list:`, data);
          setMediaList(data);
          if (data.length > 0) {
            // If playing something new or nothing selected, pick first
            if (!currentMediaUrl || type !== mediaType) {
              setCurrentMediaUrl(data[0].url);
            }
          } else {
            setCurrentMediaUrl("");
          }
        };

        window.onResourceImported = (data) => {
          console.log("Import result:", data);
          setIsUploading(false);

          if (data && data.status === "cancelled") {
            return;
          }

          if (selectedMember && mediaType) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).CallBridge?.invoke(
              "fetchMemberResources",
              selectedMember.id,
              mediaType
            );
          }
        };

        window.CallBridge.invoke("fetchFamilyTree", "init");
      } else if (checkCount > 50) {
        clearInterval(timer);
        console.error("Bridge Connection Timeout");
      }
    }, 100);
    return () => clearInterval(timer);
  }, [isDashboardOpen, mediaType, selectedMember, currentMediaUrl]);

  const handleNodeClick = (id: string) => {
    if (window.CallBridge) {
      window.CallBridge.invoke("fetchMemberDetail", id);
    }
  };

  const handleSettingClick = () => {
    if (isAdminMode) {
      if (confirm("确定要退出管理员模式吗？")) {
        setIsAdminMode(false);
        setIsDashboardOpen(false);
        document.body.classList.remove("admin-mode");
      }
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const attemptLogin = () => {
    if (passwordInput === "admin") {
      setIsAdminMode(true);
      document.body.classList.add("admin-mode");
      setIsLoginModalOpen(false);
      setIsDashboardOpen(true);
      setIsSidePanelOpen(false);
      setPasswordInput("");
    } else {
      alert("❌ 密码错误，请重试。\n(提示：演示密码为 admin)");
    }
  };

  // [Modified] Close logic to stop playback
  const closeMedia = () => {
    setMediaType(null);
    setCurrentMediaUrl(""); // [Fix] Clear URL to stop video/audio immediately
    setIsPlayingAudio(false);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  };

  const handleOpenMedia = (type: "video" | "photo" | "audio") => {
    setMediaType(type);
    setMediaList([]);
    setCurrentMediaUrl("");
    setIsPlayingAudio(false); // Reset audio state

    if (selectedMember && window.CallBridge) {
      window.CallBridge.invoke("fetchMemberResources", selectedMember.id, type);
    }
  };

  const handleUpload = () => {
    if (selectedMember && mediaType && window.CallBridge) {
      setIsUploading(true);
      setTimeout(() => {
        window.CallBridge?.invoke(
          "importResource",
          selectedMember!.id,
          mediaType
        );
      }, 50);
    }
  };

  const handleNextPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex(
      (item) => item.url === currentMediaUrl
    );
    const nextIndex = (currentIndex + 1) % mediaList.length;
    setCurrentMediaUrl(mediaList[nextIndex].url);
  };

  const handlePrevPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex(
      (item) => item.url === currentMediaUrl
    );
    const prevIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    setCurrentMediaUrl(mediaList[prevIndex].url);
  };

  // [Added] Helper to determine video label text based on member status
  const getVideoLabel = () => {
      if (!selectedMember) return "观看影像";
      // If deathDate exists and is not empty, assume deceased -> "生前影像"
      // Otherwise assume living -> "个人视频" or "影像记录"
      if (selectedMember.deathDate && selectedMember.deathDate.length > 0) {
          return "观看生前影像";
      }
      return "观看个人视频";
  };

  return (
    <>
      <div className="top-bar">
        <div className="logo">
          <span style={{ fontSize: "24px" }}>🏛️</span> 宗族记忆
          <span className="admin-badge">管理员模式</span>
        </div>
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 搜索姓名、字号或 '抗战' 等关键词..."
          />
        </div>
        <div
          className="settings-btn"
          onClick={handleSettingClick}
          title={isAdminMode ? "退出管理员模式" : "设置 / 管理员登录"}
        >
          {isAdminMode ? "🚪" : "⚙️"}
        </div>
      </div>

      <ClanTree
        data={familyData}
        onNodeClick={handleNodeClick}
        selectedId={selectedMember?.id}
      />

      <div className="hint-bar">
        {familyData.length === 0 && (
          <div className="hint-pill">
            {isBridgeReady ? "正在加载数据..." : "等待连接核心..."}
          </div>
        )}
        <div className="hint-pill">👆 点击节点查看详情</div>
        <div className="hint-pill">↗️ 点击右上角齿轮体验管理员登录</div>
      </div>

      <div
        className={`side-panel ${isSidePanelOpen ? "active" : ""}`}
        id="sidePanel"
      >
        <button
          className="panel-close"
          onClick={() => setIsSidePanelOpen(false)}
        >
          ✕
        </button>

        {selectedMember && (
          <>
            <div className="profile-header">
              <div className="profile-img-lg">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Profile" />
                ) : (
                  <span style={{ fontSize: "50px", color: "#ccc" }}>
                    {selectedMember.gender === "F" ? "👩" : "👨"}
                  </span>
                )}
              </div>
              <h2 className="profile-name">{selectedMember.name}</h2>
              <div className="profile-generation">
                第{selectedMember.generation}世 · "
                {selectedMember.generationName}"字辈
              </div>
            </div>

            <div className="info-list">
              <div className="info-item">
                <span className="info-label">性别 (Gender)</span>
                <span className="info-value">
                  {selectedMember.gender === "M" ? "男" : "女"}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">配偶 (Spouse)</span>
                <span className="info-value">
                  {selectedMember.spouseName || "无"}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">出生 (Born)</span>
                <span className="info-value">
                  {selectedMember.birthDate || "未知"} (
                  {selectedMember.birthPlace || "未知"})
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">父亲 ID</span>
                <span className="info-value">
                  {selectedMember.parentId || "无"}
                </span>
              </div>
            </div>

            <div className="action-grid">
              <div
                className="action-btn btn-cinema"
                onClick={() => handleOpenMedia("video")}
              >
                <i>🎥</i>
                {/* [Modified] Dynamic Label */}
                <span>{getVideoLabel()}</span>
              </div>
              <div
                className="action-btn"
                onClick={() => handleOpenMedia("photo")}
              >
                <i>📷</i>
                <span>老照片 (12)</span>
              </div>
              <div
                className="action-btn"
                onClick={() => handleOpenMedia("audio")}
              >
                <i>🎙️</i>
                <span>录音片段</span>
              </div>
            </div>

            <div className="bio-summary">
              <h3
                style={{
                  marginTop: 0,
                  color: "white",
                  borderBottom: "1px solid #444",
                  paddingBottom: "10px",
                }}
              >
                生平摘要
              </h3>
              <p>{selectedMember.bio || "暂无生平记录。"}</p>
              <div
                className="read-more-link"
                onClick={() => setIsFullBioOpen(true)}
              >
                <span>阅读完整传记</span>
                <span style={{ fontSize: "18px" }}>→</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`media-overlay ${mediaType ? "active" : ""}`}>
        <button className="media-close" onClick={closeMedia}>
          ← 返回 (Back)
        </button>

        <div
          className={`media-container ${mediaType === "video" ? "active" : ""}`}
        >
          <div
            style={{
              display: "flex",
              width: "90%",
              height: "80%",
              gap: "20px",
            }}
          >
            {/* Left: Player */}
            <div
              style={{
                flex: 3,
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {currentMediaUrl ? (
                <video
                  src={currentMediaUrl}
                  controls
                  autoPlay
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div style={{ color: "#666", textAlign: "center" }}>
                  {mediaList.length === 0
                    ? "暂无视频，请点击右侧上传"
                    : "请选择一个视频播放"}
                </div>
              )}
            </div>

            {/* Right: Playlist & Tools */}
            <div
              style={{
                flex: 1,
                background: "#222",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <button
                onClick={handleUpload}
                disabled={isUploading}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: isUploading ? "#666" : "var(--gold)",
                  color: isUploading ? "#ccc" : "#1a1a1a",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: isUploading ? "wait" : "pointer",
                  marginBottom: "20px",
                }}
              >
                {isUploading ? "⏳ 正在处理..." : "📤 上传新视频"}
              </button>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {mediaList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentMediaUrl(item.url)}
                    style={{
                      padding: "10px",
                      background:
                        currentMediaUrl === item.url ? "#444" : "#333",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: "1px solid #555",
                    }}
                  >
                    <div style={{ fontWeight: "bold", color: "white" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#999" }}>
                      ID: {item.id.substring(0, 8)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Photo Container */}
        {mediaType === "photo" && (
          <div
            className="media-container active"
            style={{ flexDirection: "column", width: "100%", height: "100%" }}
          >
            <div className="photo-stage">
              <button
                className="photo-nav-btn nav-left"
                onClick={handlePrevPhoto}
              >
                ‹
              </button>
              {currentMediaUrl ? (
                <img
                  src={currentMediaUrl}
                  className="main-photo"
                  alt="Old Photo"
                />
              ) : (
                <div style={{ color: "#666" }}>暂无照片，请点击下方上传</div>
              )}
              <button
                className="photo-nav-btn nav-right"
                onClick={handleNextPhoto}
              >
                ›
              </button>
            </div>

            {/* Bottom: Thumbnails & Upload */}
            <div
              style={{
                height: "140px",
                background: "#222",
                width: "100%",
                display: "flex",
                alignItems: "center",
                padding: "0 20px",
                gap: "20px",
              }}
            >
              <button
                onClick={handleUpload}
                disabled={isUploading}
                style={{
                  height: "80px",
                  width: "80px",
                  flexShrink: 0,
                  borderRadius: "8px",
                  background: "var(--gold)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {isUploading ? "⏳" : "➕\n上传"}
              </button>
              <div className="photo-thumbnails">
                {mediaList.map((item, idx) => (
                  <img
                    key={idx}
                    src={item.url}
                    className={`thumb ${
                      currentMediaUrl === item.url ? "active" : ""
                    }`}
                    onClick={() => setCurrentMediaUrl(item.url)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Audio Container */}
        {mediaType === "audio" && (
          <div
            className="media-container active"
            style={{
              display: "flex",
              width: "80%",
              height: "80%",
              gap: "40px",
            }}
          >
            {/* Left: Visualization */}
            <div
              className={`audio-stage ${isPlayingAudio ? "playing" : ""}`}
              style={{ flex: 1 }}
            >
              <div className="audio-disc-container">
                <img
                  src={avatarSrc || "https://via.placeholder.com/150"}
                  className="audio-cover"
                />
              </div>
              <h2 style={{ color: "var(--gold)", marginTop: "30px" }}>
                {mediaList.find((i) => i.url === currentMediaUrl)?.title ||
                  "请选择录音"}
              </h2>
              <div className="sound-wave-container">
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
              </div>
              <audio
                ref={audioRef}
                src={currentMediaUrl}
                controls
                style={{ marginTop: "30px", width: "80%" }}
                onPlay={() => setIsPlayingAudio(true)}
                onPause={() => setIsPlayingAudio(false)}
                onEnded={() => setIsPlayingAudio(false)}
              />
            </div>

            {/* Right: Playlist */}
            <div
              style={{
                width: "300px",
                background: "#222",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="upload-btn"
                style={{ width: "100%", padding: 10, marginBottom: 20 }}
              >
                {isUploading ? "⏳" : "📤 上传录音"}
                {/* [Added] Format hint */}
                <div style={{fontSize:'10px', fontWeight:'normal', marginTop:'5px', color:'#999'}}>
                    支持 mp3, wav, aac
                </div>
              </button>
              {mediaList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentMediaUrl(item.url)}
                  style={{
                    padding: 15,
                    borderBottom: "1px solid #444",
                    cursor: "pointer",
                    color:
                      currentMediaUrl === item.url ? "var(--gold)" : "#ccc",
                  }}
                >
                  🎵 {item.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`full-bio-overlay ${isFullBioOpen ? "active" : ""}`}>
        <div className="bio-header">
          <button className="back-btn" onClick={() => setIsFullBioOpen(false)}>
            ← 返回概览 (Back)
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
                <p>{selectedMember.bio || "暂无详细传记内容。"}</p>
                <p className="no-indent">--- 全文完 ---</p>
              </div>
            </article>
          )}
        </div>
      </div>

      <div className={`modal-overlay ${isLoginModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2 className="modal-title">管理员身份验证</h2>
          <p style={{ color: "#ccc", marginBottom: "30px" }}>
            请输入密码以访问档案编辑台
          </p>
          <input
            type="password"
            className="modal-input"
            placeholder="请输入密码 (演示: admin)"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && attemptLogin()}
          />
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setIsLoginModalOpen(false)}
            >
              取消
            </button>
            <button className="btn btn-primary" onClick={attemptLogin}>
              验证登录
            </button>
          </div>
        </div>
      </div>

      <div
        className={`admin-dashboard ${isDashboardOpen ? "active" : ""}`}
        id="adminDashboard"
      >
        <div className="dashboard-header">
          <div className="dashboard-title">
            <span style={{ fontSize: "24px" }}>🛠️</span> 档案编辑台 (Editor
            Workbench)
          </div>
          <button
            className="close-dashboard-btn"
            onClick={() => setIsDashboardOpen(false)}
            title="隐藏面板 (保持登录状态)"
          >
            ✕
          </button>
        </div>
        <div className="dashboard-content">
          <div className="dash-section">
            <h4>👤 人员节点管理</h4>
            <button
              className="dash-btn"
              onClick={() => alert("演示功能：弹出【新增成员】表单")}
            >
              <span className="dash-btn-icon">➕</span>
              <span>新增成员节点</span>
            </button>
          </div>
          <div className="dash-section">
            <h4>☁️ 媒体资源托管</h4>
            <button
              className="dash-btn upload-dropzone"
              onClick={() => alert("请在【观看影像】界面进行上传")}
            >
              <span className="dash-btn-icon">📂</span>
              <span>
                点击或拖拽文件至此
                <br />
                (自动去重上传)
              </span>
            </button>
          </div>
          <div className="dash-section">
            <h4>💾 数据维护</h4>
            <button
              className="dash-btn"
              onClick={() => alert("演示功能：备份数据库")}
            >
              <span className="dash-btn-icon">📥</span>
              <span>完整全量备份 (Export)</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
