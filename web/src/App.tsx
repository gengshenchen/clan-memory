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

  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string>("");

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);

  const [mediaType, setMediaType] = useState<"video" | "photo" | "audio" | null>(null);
  const [isFullBioOpen, setIsFullBioOpen] = useState(false);

  // Media Data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // Audio Player State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlayedUrlRef = useRef<string>("");

  // [Fix 1] 使用 Ref 追踪最新的状态，解决闭包陷阱
  const selectedMemberRef = useRef(selectedMember);
  const mediaTypeRef = useRef(mediaType);

  useEffect(() => { selectedMemberRef.current = selectedMember; }, [selectedMember]);
  useEffect(() => { mediaTypeRef.current = mediaType; }, [mediaType]);

  // Helper: Format Time
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // =================================================================
  // 1. Audio Logic
  // =================================================================
  useEffect(() => {
    if (mediaType === "audio" && audioRef.current && currentMediaUrl) {
      if (lastPlayedUrlRef.current !== currentMediaUrl) {
        console.log("Loading new audio:", currentMediaUrl);

        audioRef.current.pause();
        setIsPlayingAudio(false);
        setAudioProgress(0);

        audioRef.current.src = currentMediaUrl;
        audioRef.current.load();

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {})
            .catch(error => {
              console.warn("Auto-play prevented:", error);
              setIsPlayingAudio(false);
            });
        }

        lastPlayedUrlRef.current = currentMediaUrl;
      }
    } else if (!currentMediaUrl && audioRef.current) {
        audioRef.current.pause();
        lastPlayedUrlRef.current = "";
    }
  }, [currentMediaUrl, mediaType]);

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(e => console.error("Play failed", e));
    } else {
      audioRef.current.pause();
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setAudioProgress(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const togglePlaybackSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1.0, 1.5, 2.0];
    const nextSpeedIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextSpeedIndex];
    audioRef.current.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  // Events
  const onAudioPlay = () => setIsPlayingAudio(true);
  const onAudioPause = () => setIsPlayingAudio(false);
  const onAudioEnded = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
  };
  const onAudioTimeUpdate = () => {
      if (audioRef.current) setAudioProgress(audioRef.current.currentTime);
  };
  const onAudioLoadedMetadata = () => {
      if (audioRef.current) setAudioDuration(audioRef.current.duration);
  };

  // =================================================================
  // 2. Bridge Logic
  // =================================================================

  useEffect(() => {
      if (mediaList.length > 0 && !currentMediaUrl) {
          setCurrentMediaUrl(mediaList[0].url);
      }
  }, [mediaList, currentMediaUrl]);

  useEffect(() => {
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        clearInterval(timer);

        window.onFamilyTreeDataReceived = (data) => setFamilyData(data);

        window.onMemberDetailReceived = (data) => {
          if (data) {
            setSelectedMember(data);
            if (!isDashboardOpen) setIsSidePanelOpen(true);
            if (data.portraitPath) {
              if (data.portraitPath.startsWith("http") || data.portraitPath.startsWith("//")) {
                setAvatarSrc(data.portraitPath);
              } else if (window.CallBridge) {
                window.CallBridge.invoke("getLocalImage", data.portraitPath);
              }
            } else {
              setAvatarSrc("");
            }
          }
        };

        window.onLocalImageLoaded = (_path, base64) => setAvatarSrc(base64);

        window.onMemberResourcesReceived = (data, type) => {
          console.log(`Received ${type} list:`, data);

          // [Fix 2] 前端去重：根据 URL 去重
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniqueMap = new Map();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((item: any) => {
              if (!uniqueMap.has(item.url)) {
                  uniqueMap.set(item.url, item);
              }
          });
          const uniqueList = Array.from(uniqueMap.values());

          setMediaList(uniqueList);
        };

        // [Fix 1] 上传完成回调：使用 Ref 获取最新的状态，确保列表刷新
        window.onResourceImported = (data) => {
          console.log("Import result:", data);
          setIsUploading(false);
          if (data && data.status === "cancelled") return;

          const currentMember = selectedMemberRef.current;
          const currentType = mediaTypeRef.current;

          // 这里的 console.log 是关键，可以检查是不是因为这里没拿到 ID 导致没刷新
          console.log("Refining list for:", currentMember?.id, currentType);

          if (currentMember && currentType) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).CallBridge?.invoke("fetchMemberResources", currentMember.id, currentType);
          }
        };

        window.CallBridge.invoke("fetchFamilyTree", "init");
      } else if (checkCount > 50) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // =================================================================
  // 3. UI Helpers
  // =================================================================
  const handleNodeClick = (id: string) => {
    if (window.CallBridge) window.CallBridge.invoke("fetchMemberDetail", id);
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

  const closeMedia = () => {
    setMediaType(null);
    setCurrentMediaUrl("");
    setIsPlayingAudio(false);
    lastPlayedUrlRef.current = "";
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  };

  const handleOpenMedia = (type: "video" | "photo" | "audio") => {
    setMediaType(type);
    setMediaList([]);
    setCurrentMediaUrl("");
    setIsPlayingAudio(false);
    setAudioProgress(0);
    lastPlayedUrlRef.current = "";

    if (selectedMember && window.CallBridge) {
      window.CallBridge.invoke("fetchMemberResources", selectedMember.id, type);
    }
  };

  const handleUpload = () => {
    if (selectedMember && mediaType && window.CallBridge) {
      setIsUploading(true);
      setTimeout(() => {
        window.CallBridge?.invoke("importResource", selectedMember!.id, mediaType);
      }, 50);
    }
  };

  const handleNextPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex((item) => item.url === currentMediaUrl);
    const nextIndex = (currentIndex + 1) % mediaList.length;
    setCurrentMediaUrl(mediaList[nextIndex].url);
  };

  const handlePrevPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex((item) => item.url === currentMediaUrl);
    const prevIndex = (currentIndex - 1 + mediaList.length) % mediaList.length;
    setCurrentMediaUrl(mediaList[prevIndex].url);
  };

  const getVideoLabel = () => {
      if (!selectedMember) return "观看影像";
      if (selectedMember.deathDate && selectedMember.deathDate.length > 0) {
          return "观看生前影像";
      }
      return "观看个人视频";
  };

  return (
    <>
      <div className="top-bar">
        <div className="logo"><span style={{ fontSize: "24px" }}>🏛️</span> 宗族记忆<span className="admin-badge">管理员模式</span></div>
        <div className="search-container"><input type="text" className="search-input" placeholder="🔍 搜索姓名、字号或 '抗战' 等关键词..." /></div>
        <div className="settings-btn" onClick={handleSettingClick} title={isAdminMode ? "退出管理员模式" : "设置 / 管理员登录"}>{isAdminMode ? "🚪" : "⚙️"}</div>
      </div>

      <ClanTree data={familyData} onNodeClick={handleNodeClick} selectedId={selectedMember?.id} />

      <div className="hint-bar">
        {familyData.length === 0 && <div className="hint-pill">{isBridgeReady ? "正在加载数据..." : "等待连接核心..."}</div>}
        <div className="hint-pill">👆 点击节点查看详情</div>
        <div className="hint-pill">↗️ 点击右上角齿轮体验管理员登录</div>
      </div>

      <div className={`side-panel ${isSidePanelOpen ? "active" : ""}`} id="sidePanel">
        <button className="panel-close" onClick={() => setIsSidePanelOpen(false)}>✕</button>
        {selectedMember && (
          <>
            <div className="profile-header">
              <div className="profile-img-lg">
                {avatarSrc ? <img src={avatarSrc} alt="Profile" /> : <span style={{ fontSize: "50px", color: "#ccc" }}>{selectedMember.gender === "F" ? "👩" : "👨"}</span>}
              </div>
              <h2 className="profile-name">{selectedMember.name}</h2>
              <div className="profile-generation">第{selectedMember.generation}世 · "{selectedMember.generationName}"字辈</div>
            </div>
            <div className="info-list">
              <div className="info-item"><span className="info-label">性别 (Gender)</span><span className="info-value">{selectedMember.gender === "M" ? "男" : "女"}</span></div>
              <div className="info-item"><span className="info-label">配偶 (Spouse)</span><span className="info-value">{selectedMember.spouseName || "无"}</span></div>
              <div className="info-item"><span className="info-label">出生 (Born)</span><span className="info-value">{selectedMember.birthDate || "未知"} ({selectedMember.birthPlace || "未知"})</span></div>
              <div className="info-item"><span className="info-label">父亲 ID</span><span className="info-value">{selectedMember.parentId || "无"}</span></div>
            </div>
            <div className="action-grid">
              <div className="action-btn btn-cinema" onClick={() => handleOpenMedia("video")}><i>🎥</i><span>{getVideoLabel()}</span></div>
              <div className="action-btn" onClick={() => handleOpenMedia("photo")}><i>📷</i><span>老照片 (12)</span></div>
              <div className="action-btn" onClick={() => handleOpenMedia("audio")}><i>🎙️</i><span>录音片段</span></div>
            </div>
            <div className="bio-summary">
              <h3 style={{ marginTop: 0, color: "white", borderBottom: "1px solid #444", paddingBottom: "10px" }}>生平摘要</h3>
              <p>{selectedMember.bio || "暂无生平记录。"}</p>
              <div className="read-more-link" onClick={() => setIsFullBioOpen(true)}><span>阅读完整传记</span><span style={{ fontSize: "18px" }}>→</span></div>
            </div>
          </>
        )}
      </div>

      <div className={`media-overlay ${mediaType ? "active" : ""}`}>
        <button className="media-close" onClick={closeMedia}>← 返回 (Back)</button>

        {/* Video Container */}
        {mediaType === "video" && (
            <div className={`media-container active`}>
                <div style={{ display: "flex", width: "90%", height: "80%", gap: "20px" }}>
                    <div style={{ flex: 3, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {currentMediaUrl ? (
                        <video src={currentMediaUrl} controls autoPlay style={{ width: "100%", height: "100%" }} />
                    ) : (
                        <div style={{ color: "#666" }}>{mediaList.length === 0 ? "暂无视频，请点击右侧上传" : "请选择一个视频播放"}</div>
                    )}
                    </div>
                    <div style={{ flex: 1, background: "#222", padding: "20px", overflowY: "auto" }}>
                        <button onClick={handleUpload} disabled={isUploading} className="upload-btn" style={{ width: "100%", marginBottom: "20px" }}>{isUploading ? "⏳" : "📤 上传新视频"}</button>
                        {mediaList.map((item, idx) => (
                            <div key={idx} onClick={() => setCurrentMediaUrl(item.url)} style={{ padding: "10px", background: currentMediaUrl === item.url ? "#444" : "#333", borderRadius: "8px", cursor: "pointer", marginBottom: "5px" }}>
                                <div style={{ fontWeight: "bold" }}>{item.title}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Photo Container */}
        {mediaType === "photo" && (
          <div className="media-container active" style={{ flexDirection: "column", width: "100%", height: "100%" }}>
            <div className="photo-stage">
              <button className="photo-nav-btn nav-left" onClick={handlePrevPhoto}>‹</button>
              {currentMediaUrl ? <img src={currentMediaUrl} className="main-photo" alt="Old Photo" /> : <div style={{ color: "#666" }}>暂无照片</div>}
              <button className="photo-nav-btn nav-right" onClick={handleNextPhoto}>›</button>
            </div>
            <div style={{ height: "140px", background: "#222", width: "100%", display: "flex", alignItems: "center", padding: "0 20px", gap: "20px" }}>
              <button onClick={handleUpload} disabled={isUploading} style={{ height: "80px", width: "80px", borderRadius: "8px", background: "var(--gold)", border: "none" }}>{isUploading ? "⏳" : "➕"}</button>
              <div className="photo-thumbnails">
                {mediaList.map((item, idx) => (
                  <img key={idx} src={item.url} className={`thumb ${currentMediaUrl === item.url ? "active" : ""}`} onClick={() => setCurrentMediaUrl(item.url)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audio Container */}
        {mediaType === "audio" && (
          <div className="media-container active" style={{ display: "flex", width: "80%", height: "80%", gap: "40px" }}>
            <div className={`audio-stage ${isPlayingAudio ? "playing" : ""}`} style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div className="audio-disc-container">
                <img src={avatarSrc || "https://via.placeholder.com/150"} className="audio-cover" />
              </div>
              <h2 style={{ color: "var(--gold)", marginTop: "30px" }}>{mediaList.find((i) => i.url === currentMediaUrl)?.title || "请选择录音"}</h2>

              <div className="sound-wave-container" style={{ margin: "20px 0" }}>
                {[...Array(5)].map((_, i) => <div key={i} className="wave-bar"></div>)}
              </div>

              {/* Custom Controls */}
              <div style={{ width: '80%', background: '#333', padding: '20px', borderRadius: '15px', border: '1px solid #555' }}>
                  {/* Progress Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#ccc', marginBottom: '15px' }}>
                      <span style={{ minWidth: '40px' }}>{formatTime(audioProgress)}</span>
                      <input
                          type="range"
                          min={0}
                          max={audioDuration || 0}
                          value={audioProgress}
                          onChange={handleProgressChange}
                          style={{ flex: 1, height: '6px', accentColor: 'var(--gold)', cursor: 'pointer' }}
                      />
                      <span style={{ minWidth: '40px' }}>{formatTime(audioDuration)}</span>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px' }}>
                      <button onClick={togglePlaybackSpeed} style={{ background: 'transparent', border: '1px solid #777', color: '#fff', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer' }}>{playbackSpeed}x</button>
                      <button onClick={toggleAudioPlay} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--gold)', border: 'none', fontSize: '28px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'black' }}>
                          {isPlayingAudio ? "⏸" : "▶"}
                      </button>
                      <div style={{ width: '40px' }}></div>
                  </div>
              </div>

              {/* Native Audio */}
              <audio
                ref={audioRef}
                style={{ display: "none" }}
                onPlay={onAudioPlay}
                onPause={onAudioPause}
                onEnded={onAudioEnded}
                onTimeUpdate={onAudioTimeUpdate}
                onLoadedMetadata={onAudioLoadedMetadata}
              />
            </div>

            <div style={{ width: "300px", background: "#222", padding: "20px", overflowY: "auto" }}>
              <button onClick={handleUpload} disabled={isUploading} className="upload-btn" style={{ width: "100%", marginBottom: "20px" }}>{isUploading ? "⏳" : "📤 上传录音"}</button>
              {mediaList.map((item, idx) => (
                <div key={idx} onClick={() => setCurrentMediaUrl(item.url)} style={{ padding: "15px", borderBottom: "1px solid #444", cursor: "pointer", color: currentMediaUrl === item.url ? "var(--gold)" : "#ccc", background: currentMediaUrl === item.url ? "#333" : "transparent" }}>
                  🎵 {item.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`full-bio-overlay ${isFullBioOpen ? "active" : ""}`}>
        <div className="bio-header"><button className="back-btn" onClick={() => setIsFullBioOpen(false)}>← 返回</button></div>
        <div className="bio-content-scroll">
          {selectedMember && (
            <article className="bio-article">
              <h1>{selectedMember.name} 生平传略</h1>
              <div className="bio-article-meta">第{selectedMember.generation}世 · {selectedMember.generationName}字辈</div>
              <div className="bio-body"><p>{selectedMember.bio || "暂无。"}</p></div>
            </article>
          )}
        </div>
      </div>

      <div className={`modal-overlay ${isLoginModalOpen ? "active" : ""}`}>
        <div className="modal-box">
          <h2>管理员登录</h2>
          <input type="password" className="modal-input" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
          <button className="btn btn-primary" onClick={attemptLogin}>登录</button>
          <button className="btn btn-secondary" onClick={() => setIsLoginModalOpen(false)}>取消</button>
        </div>
      </div>

      <div className={`admin-dashboard ${isDashboardOpen ? "active" : ""}`} id="adminDashboard">
        <div className="dashboard-header"><button className="close-dashboard-btn" onClick={() => setIsDashboardOpen(false)}>✕</button></div>
        <div className="dashboard-content">
          <div className="dash-section">
            <h4>👤 人员节点管理</h4>
            <button className="dash-btn" onClick={() => alert("演示功能：弹出【新增成员】表单")}><span className="dash-btn-icon">➕</span><span>新增成员节点</span></button>
          </div>
          <div className="dash-section">
            <h4>☁️ 媒体资源托管</h4>
            <button className="dash-btn upload-dropzone" onClick={() => alert("请在【观看影像】界面进行上传")}><span className="dash-btn-icon">📂</span><span>点击或拖拽文件至此<br />(自动去重上传)</span></button>
          </div>
          <div className="dash-section">
            <h4>💾 数据维护</h4>
            <button className="dash-btn" onClick={() => alert("演示功能：备份数据库")}><span className="dash-btn-icon">📥</span><span>完整全量备份 (Export)</span></button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
