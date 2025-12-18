import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// 引入类型
import type { FamilyMember } from '../components/ClanTree';

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

    window.onMemberDetailReceived = (data: FamilyMember) => {
      console.log("前端收到详情数据:", data);
      if (data && data.id === id) {
        setMember(data);
        setLoading(false);
        const path = data.portraitPath;
        if (!path) {
          setAvatarSrc(''); // 没头像
        } else if (path.startsWith('http') || path.startsWith('//')) {
          setAvatarSrc(path); // 网络图片，直接用
        } else {
          // 本地图片 -> 向 C++ 请求 Base64
          if (window.CallBridge) {
            window.CallBridge.invoke("getLocalImage", path);
          }
        }
      }
    };

    window.onLocalImageLoaded = (_originalPath, base64Data) => {
      setAvatarSrc(base64Data);
    };

    let checkCount = 0;
    const maxChecks = 20;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        window.CallBridge.invoke("fetchMemberDetail", id);
        clearInterval(timer);
      } else if (checkCount >= maxChecks) {
        setLoading(false);
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(timer);
      window.onMemberDetailReceived = undefined;
    };
  }, [id]);

  // 辅助函数：格式化显示空数据
  const displayValue = (val?: string) => val || '未知';

  return (
    <div className="detail-container" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* 顶部导航 */}
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: '20px', padding: '8px 16px', cursor: 'pointer', background: '#f0f0f0', border: 'none', borderRadius: '4px' }}
      >
        ← 返回族谱
      </button>

      {loading ? (
        <p>正在读取档案...</p>
      ) : member ? (
        <div className="card" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

          {/* 1. 头部 Banner：包含头像和基本信息 */}
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '40px', display: 'flex', alignItems: 'center' }}>
          {/* 头像区域 */}
            <div style={{
              width: '120px', height: '120px',
              borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)',
              marginRight: '30px', background: '#fff', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '50px', color: '#ccc' }}>
                   {member?.gender === 'F' ? '👩' : '👨'}
                </span>
              )}
            </div>

            {/* 名字与头衔 */}
            <div>
              <h1 style={{ margin: 0, fontSize: '2.5em', fontWeight: 'bold' }}>{member.name}</h1>
              <div style={{ marginTop: '10px', opacity: 0.9 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px', marginRight: '10px' }}>
                  第 {member.generation} 世
                </span>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px' }}>
                  {member.gender === 'F' ? '女' : '男'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. 详细信息网格 */}
          <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>

            {/* 左侧：生卒年月与地点 */}
            <div style={{ background: '#f9f9f9', color: '#333', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: 0 }}>📅 生平时间轴</h3>
              <p><strong>出生日期:</strong> {displayValue(member.birthDate)}</p>
              <p><strong>出生地点:</strong> {displayValue(member.birthPlace)}</p>
              <p><strong>逝世日期:</strong> {displayValue(member.deathDate)}</p>
              <p><strong>逝世地点:</strong> {displayValue(member.deathPlace)}</p>
            </div>

            {/* 右侧：家族关系 */}
            <div style={{ background: '#f9f9f9', color: '#333' , padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginTop: 0 }}>🌳 家族关系</h3>
              <p><strong>父亲 ID:</strong> {displayValue(member.parentId)}</p>
              <p><strong>母亲 ID:</strong> {displayValue(member.motherId)}</p>
              <p><strong>配偶姓名:</strong> {displayValue(member.mateName)}</p>
            </div>
          </div>

            {/* 3. 生平事迹 (全宽) */}
          <div style={{  background: '#f9f9f9',color: '#333',padding: '0 40px 40px 40px' }}>
            <h3 style={{ borderLeft: '5px solid #764ba2', paddingLeft: '15px' }}>📜 生平事迹</h3>
            <div style={{ lineHeight: '1.8', fontSize: '16px', color: '#444', whiteSpace: 'pre-wrap' }}>
              {member.bio || "暂无详细生平记录。"}
            </div>
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '50px', color: '#666' }}>
          <h2>未找到成员信息</h2>
          <p>ID: {id}</p>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
