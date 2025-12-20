import { useState, useEffect } from 'react';
import './App.css';
import ClanTree, {type FamilyMember } from './components/ClanTree';

// 2. TypeScript 声明
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
    onMemberDetailReceived?: (data: FamilyMember) => void;
    onLocalImageLoaded?: (path: string, base64: string) => void;
  }
}

function App() {
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [isBridgeReady, setIsBridgeReady] = useState<boolean>(false);

  // UI 状态管理
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [avatarSrc, setAvatarSrc] = useState<string>('');

  // 1. 初始化 Bridge 连接
  useEffect(() => {
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        clearInterval(timer);

        // 挂载全局回调
        window.onFamilyTreeDataReceived = (data) => {
          setFamilyData(data);
        };

        window.onMemberDetailReceived = (data) => {
          if (data) {
            setSelectedMember(data);
            setIsSidePanelOpen(true); // 打开侧边栏

            // 处理头像
            if (data.portraitPath) {
                if (data.portraitPath.startsWith('http') || data.portraitPath.startsWith('//')) {
                    setAvatarSrc(data.portraitPath);
                } else if (window.CallBridge) {
                    // 请求本地图片
                    window.CallBridge.invoke("getLocalImage", data.portraitPath);
                }
            } else {
                setAvatarSrc('');
            }
          }
        };

        window.onLocalImageLoaded = (_path, base64) => {
            setAvatarSrc(base64);
        };

        // 自动拉取初始数据
        window.CallBridge.invoke("fetchFamilyTree", "init");
      } else if (checkCount > 50) {
        clearInterval(timer);
        console.error("Bridge Connection Timeout");
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // 2. 交互逻辑处理
  const handleNodeClick = (id: string) => {
    if (window.CallBridge) {
        // 请求详情数据
        window.CallBridge.invoke("fetchMemberDetail", id);
    }
  };

  const handleSettingClick = () => {
    if (isAdminMode) {
      if (confirm("确定要退出管理员模式吗？")) {
        setIsAdminMode(false);
        document.body.classList.remove('admin-mode');
      }
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const attemptLogin = () => {
    if (passwordInput === 'admin') {
      setIsAdminMode(true);
      document.body.classList.add('admin-mode');
      setIsLoginModalOpen(false);
      setPasswordInput('');
    } else {
      alert('❌ 密码错误，请重试。\n(提示：演示密码为 admin)');
    }
  };

  return (
    <>
      {/* 1. 顶部导航栏 */}
      <div className="top-bar">
        <div className="logo">
          <span style={{fontSize: '24px'}}>🏛️</span> 宗族记忆
          <span className="admin-badge">管理员模式</span>
        </div>
        <div className="search-container">
          <input type="text" className="search-input" placeholder="🔍 搜索姓名、字号或 '抗战' 等关键词..." />
        </div>
        <div
            className="settings-btn"
            onClick={handleSettingClick}
            title={isAdminMode ? "退出管理员模式" : "设置 / 管理员登录"}
        >
            {isAdminMode ? '🚪' : '⚙️'}
        </div>
      </div>

      {/* 2. 主画布 */}
      <div className="main-canvas" id="canvas">
        {familyData.length > 0 ? (
            <ClanTree
                data={familyData}
                onNodeClick={handleNodeClick}
            />
        ) : (
            <div style={{color: '#666'}}>
                {isBridgeReady ? '正在加载数据...' : '等待连接核心...'}
            </div>
        )}

        <div className="hint-bar">
          <div className="hint-pill hint-highlight">👆 点击节点查看详情</div>
          <div className="hint-pill">↗️ 点击右上角齿轮体验管理员登录</div>
        </div>
      </div>

      {/* 3. 侧边详情面板 */}
      <div className={`side-panel ${isSidePanelOpen ? 'active' : ''}`} id="sidePanel">
        <button className="panel-close" onClick={() => setIsSidePanelOpen(false)}>✕</button>

        {selectedMember && (
            <>
                <div className="profile-header">
                    <div className="profile-img-lg">
                        {avatarSrc ? (
                            <img src={avatarSrc} alt="Profile" />
                        ) : (
                            <span style={{ fontSize: '50px', color: '#ccc' }}>
                                {selectedMember.gender === 'F' ? '👩' : '👨'}
                            </span>
                        )}
                    </div>
                    <h2 className="profile-name">{selectedMember.name}</h2>
                    <div className="profile-generation">第{selectedMember.generation}世 · "建"字辈</div>
                </div>

                <div className="info-list">
                    <div className="info-item">
                        <span className="info-label">性别 (Gender)</span>
                        <span className="info-value">{selectedMember.gender === 'M' ? '男' : '女'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">配偶 (Spouse)</span>
                        <span className="info-value">{selectedMember.spouseName || '无'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">出生 (Born)</span>
                        <span className="info-value">{selectedMember.birthDate || '未知'} ({selectedMember.birthPlace || '未知'})</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">父亲 ID</span>
                        <span className="info-value">{selectedMember.parentId || '无'}</span>
                    </div>
                </div>

                <div className="bio-summary">
                    <h3 style={{marginTop:0, color:'white', borderBottom: '1px solid #444', paddingBottom: '10px'}}>生平摘要</h3>
                    <p>{selectedMember.bio || "暂无生平记录。"}</p>
                </div>
            </>
        )}
      </div>

      {/* 4. 登录模态框 */}
      <div className={`modal-overlay ${isLoginModalOpen ? 'active' : ''}`}>
        <div className="modal-box">
          <h2 className="modal-title">管理员身份验证</h2>
          <p style={{color: '#ccc', marginBottom: '30px'}}>请输入密码以访问档案编辑台</p>
          <input
            type="password"
            className="modal-input"
            placeholder="请输入密码 (演示: admin)"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && attemptLogin()}
          />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setIsLoginModalOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={attemptLogin}>验证登录</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
