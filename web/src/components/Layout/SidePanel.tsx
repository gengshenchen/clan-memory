import React from 'react';
import type { FamilyMember } from '../../types'; // [Fix] type import

interface SidePanelProps {
  member: FamilyMember | null;
  isOpen: boolean;
  onClose: () => void;
  avatarSrc: string;
  onOpenMedia: (type: 'video' | 'photo' | 'audio') => void;
  onReadBio: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ member, isOpen, onClose, avatarSrc, onOpenMedia, onReadBio }) => {
  if (!member) return null;

  const getVideoLabel = () => {
    if (member.deathDate && member.deathDate.length > 0) return "观看生前影像";
    return "观看个人视频";
  };

  return (
    <div className={`side-panel ${isOpen ? "active" : ""}`} id="sidePanel">
      <button className="panel-close" onClick={onClose}>✕</button>

      <div className="profile-header">
        <div className="profile-img-lg">
          {avatarSrc ? <img src={avatarSrc} alt="Profile" /> : <span style={{ fontSize: "50px", color: "#ccc" }}>{member.gender === "F" ? "👩" : "👨"}</span>}
        </div>
        <h2 className="profile-name">{member.name}</h2>
        <div className="profile-generation">第{member.generation}世 · "{member.generationName}"字辈</div>
      </div>

      <div className="info-list">
        <div className="info-item"><span className="info-label">性别</span><span className="info-value">{member.gender === "M" ? "男" : "女"}</span></div>
        <div className="info-item"><span className="info-label">配偶</span><span className="info-value">{member.spouseName || "无"}</span></div>
        <div className="info-item"><span className="info-label">出生</span><span className="info-value">{member.birthDate || "未知"} ({member.birthPlace || "未知"})</span></div>
        <div className="info-item"><span className="info-label">父亲 ID</span><span className="info-value">{member.parentId || "无"}</span></div>
      </div>

      <div className="action-grid">
        <div className="action-btn btn-cinema" onClick={() => onOpenMedia("video")}><i>🎥</i><span>{getVideoLabel()}</span></div>
        <div className="action-btn" onClick={() => onOpenMedia("photo")}><i>📷</i><span>老照片</span></div>
        <div className="action-btn" onClick={() => onOpenMedia("audio")}><i>🎙️</i><span>录音片段</span></div>
      </div>

      <div className="bio-summary">
        <h3 style={{ marginTop: 0, color: "white", borderBottom: "1px solid #444", paddingBottom: "10px" }}>生平摘要</h3>
        <p>{member.bio || "暂无生平记录。"}</p>
        <div className="read-more-link" onClick={onReadBio}><span>阅读完整传记</span><span style={{ fontSize: "18px" }}>→</span></div>
      </div>
    </div>
  );
};

export default SidePanel;
