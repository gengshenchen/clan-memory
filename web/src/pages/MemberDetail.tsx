import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { FamilyMember } from '../components/ClanTree';

// Global types for Qt bridge
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onMemberDetailReceived?: (data: FamilyMember) => void;
    onLocalImageLoaded?: (originalPath: string, base64Data: string) => void;
  }
}

const MemberDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [avatarSrc, setAvatarSrc] = useState<string>('');

  useEffect(() => {
    if (!id) return;

    // 1. Setup Callback
    window.onMemberDetailReceived = (data: FamilyMember) => {
      console.log("[React] Received Detail:", data);
      if (data && data.id === id) {
        setMember(data);
        setLoading(false);

        // Handle Avatar
        const path = data.portraitPath;
        if (!path) {
          setAvatarSrc('');
        } else if (path.startsWith('http') || path.startsWith('data:')) {
          setAvatarSrc(path);
        } else {
          // Request local image from C++
          if (window.CallBridge) {
            window.CallBridge.invoke("getLocalImage", path);
          }
        }
      }
    };

    // 2. Setup Image Callback
    window.onLocalImageLoaded = (_originalPath, base64Data) => {
      setAvatarSrc(base64Data);
    };

    // 3. Request Data
    setLoading(true);
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.CallBridge) {
        window.CallBridge.invoke("fetchMemberDetail", id);
        clearInterval(interval);
      } else if (attempts > 20) {
        setLoading(false); // Timeout
        clearInterval(interval);
      }
    }, 50);

    return () => {
      clearInterval(interval);
      // Cleanup callbacks to avoid leaks or zombie calls
      window.onMemberDetailReceived = undefined;
      window.onLocalImageLoaded = undefined;
    };
  }, [id]);

  // Helper for empty fields
  const displayValue = (val?: string) => val || <span style={{color: '#94a3b8'}}>--</span>;

  // Render Loading
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>
        <p>正在读取宗族档案...</p>
      </div>
    );
  }

  // Render Not Found
  if (!member) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>未找到成员档案</h2>
        <button onClick={() => navigate(-1)} style={buttonStyle}>返回族谱</button>
      </div>
    );
  }

  return (
    <div className="detail-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: '"Noto Sans SC", sans-serif' }}>

      {/* Navigation */}
      <button onClick={() => navigate(-1)} style={buttonStyle}>
        &larr; 返回族谱
      </button>

      {/* Main Card */}
      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', overflow: 'hidden', marginTop: '20px' }}>

        {/* Header Section */}
        <div style={{
            background: 'linear-gradient(120deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            padding: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '30px'
        }}>
          {/* Avatar */}
          <div style={{
            width: '140px', height: '140px',
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.4)',
            background: '#f1f5f9',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            {avatarSrc ? (
              <img src={avatarSrc} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '64px' }}>
                {member.gender === 'F' ? '👩' : '👨'}
              </span>
            )}
          </div>

          {/* Name & Titles */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <h1 style={{ margin: 0, fontSize: '3rem', fontWeight: 700 }}>{member.name}</h1>
                {member.generationName && (
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '1rem' }}>
                        字辈: {member.generationName}
                    </span>
                )}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', fontSize: '1.1rem', opacity: 0.9 }}>
              <Badge text={`第 ${member.generation} 世`} />
              <Badge text={member.gender === 'F' ? '女性' : '男性'} />
              {member.mateName && <Badge text={`配偶: ${member.mateName}`} />}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>

          {/* Panel 1: Timeline */}
          <InfoPanel title="📅 生平时间轴">
            <InfoRow label="出生日期" value={displayValue(member.birthDate)} />
            <InfoRow label="出生地点" value={displayValue(member.birthPlace)} />
            <div style={{ height: '1px', background: '#e2e8f0', margin: '10px 0' }}></div>
            <InfoRow label="逝世日期" value={displayValue(member.deathDate)} />
            <InfoRow label="逝世地点" value={displayValue(member.deathPlace)} />
          </InfoPanel>

          {/* Panel 2: Family Relations */}
          <InfoPanel title="🌳 家族血脉">
            <InfoRow label="父亲" value={displayValue(member.parentId)} isId />
            <InfoRow label="母亲" value={displayValue(member.motherId)} isId />
            <InfoRow label="配偶" value={displayValue(member.mateName)} />
            <div style={{ marginTop: '20px', padding: '10px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.9rem', color: '#1e40af' }}>
                💡 提示：点击 ID 可直接跳转（开发中）
            </div>
          </InfoPanel>

        </div>

        {/* Biography Section */}
        <div style={{ padding: '0 40px 60px 40px' }}>
          <h3 style={{
              borderLeft: '4px solid #3b82f6',
              paddingLeft: '12px',
              fontSize: '1.5rem',
              color: '#1e293b',
              marginBottom: '20px'
          }}>
            📜 生平事迹
          </h3>
          <div style={{
              background: '#f8fafc',
              padding: '24px',
              borderRadius: '12px',
              lineHeight: '1.8',
              color: '#334155',
              whiteSpace: 'pre-wrap',
              fontSize: '1.05rem'
          }}>
            {member.bio ? member.bio : "暂无生平记录。"}
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Subcomponents for styling ---

const Badge: React.FC<{text: string}> = ({text}) => (
    <span style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.3)',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.9rem'
    }}>
        {text}
    </span>
);

const InfoPanel: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div style={{ background: '#fff' }}>
        <h3 style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', marginTop: 0, color: '#64748b' }}>
            {title}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {children}
        </div>
    </div>
);

const InfoRow: React.FC<{label: string, value: React.ReactNode, isId?: boolean}> = ({label, value, isId}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8', fontWeight: 500 }}>{label}</span>
        <span style={{
            color: '#334155',
            fontWeight: 600,
            fontFamily: isId ? 'monospace' : 'inherit'
        }}>
            {value}
        </span>
    </div>
);

const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    background: '#e2e8f0',
    color: '#475569',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    transition: 'background 0.2s'
};

export default MemberDetail;
