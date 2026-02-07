import React, { useState } from "react";
import type { FamilyMember } from "../../types";
import { DeleteMemberDialog } from "../Admin/DeleteMemberDialog";

interface SidePanelProps {
  member: FamilyMember | null;
  allMembers: FamilyMember[];
  isOpen: boolean;
  onClose: () => void;
  avatarSrc: string;
  onOpenMedia: (type: "video" | "photo" | "audio") => void;
  onReadBio: () => void;
  onUpdatePortrait: () => void;
  isAdminMode?: boolean;
  onEditMember?: () => void;
  mediaCounts?: { video: number; photo: number; audio: number };
}

const SidePanel: React.FC<SidePanelProps> = ({
  member,
  allMembers,
  isOpen,
  onClose,
  avatarSrc,
  onOpenMedia,
  onReadBio,
  onUpdatePortrait,
  isAdminMode = false,
  onEditMember,
  mediaCounts = { video: 0, photo: 0, audio: 0 },
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!member) return null;

  const getVideoLabel = () => {
    if (member.deathDate && member.deathDate.length > 0) return "观看生前影像";
    return "观看个人视频";
  };

  return (
    <>
      <div className={`side-panel ${isOpen ? "active" : ""}`} id="sidePanel">
        <button className="panel-close" onClick={onClose}>
          ✕
        </button>

        <div className="profile-header">
          {/* 头像容器 */}
          <div
            className="profile-img-lg"
            onClick={() => {
              if (isAdminMode) {
                console.log("Avatar clicked, triggering update...");
                onUpdatePortrait();
              }
            }}
            title={isAdminMode ? "点击更换头像" : "头像"}
            style={{
              cursor: isAdminMode ? "pointer" : "default",
              position: "relative",
              pointerEvents: "auto",
              zIndex: 10,
            }}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <span
                style={{ fontSize: "50px", color: "#ccc", pointerEvents: "none" }}
              >
                {member.gender === "F" ? "👩" : "👨"}
              </span>
            )}

            {isAdminMode && (
              <div
                className="avatar-hover-hint"
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  background: "rgba(0,0,0,0.6)",
                  color: "white",
                  fontSize: "10px",
                  textAlign: "center",
                  padding: "2px 0",
                  pointerEvents: "none",
                }}
              >
                更换
              </div>
            )}
          </div>

          <h2 className="profile-name">
            {member.name}
            {member.aliases && <span style={{fontSize: '0.6em', color: '#aaa', marginLeft: '10px', fontWeight: 'normal'}}>({member.aliases})</span>}
          </h2>
          <div className="profile-generation">
            第{member.generation}世 · "{member.generationName}"字辈
          </div>
        </div>

        <div className="info-list">
          <div className="info-item">
            <span className="info-label">性别</span>
            <span className="info-value">
              {member.gender === "M" ? "男" : "女"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">配偶</span>
            <span className="info-value">{member.spouseName || "无"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">出生</span>
            <span className="info-value">
              {member.birthDate || "未知"} ({member.birthPlace || "未知"})
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">父亲 ID</span>
            <span className="info-value">{member.parentId || "无"}</span>
          </div>
        </div>

        <div className="action-grid">
          <div
            className="action-btn btn-cinema"
            onClick={() => onOpenMedia("video")}
          >
            <i>🎥</i>
            <span>{getVideoLabel()}{mediaCounts.video > 0 && ` (${mediaCounts.video})`}</span>
          </div>
          <div className="action-btn" onClick={() => onOpenMedia("photo")}>
            <i>📷</i>
            <span>照片{mediaCounts.photo > 0 && ` (${mediaCounts.photo})`}</span>
          </div>
          <div className="action-btn" onClick={() => onOpenMedia("audio")}>
            <i>🎙️</i>
            <span>录音{mediaCounts.audio > 0 && ` (${mediaCounts.audio})`}</span>
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
          <p>{member.bio || "暂无生平记录。"}</p>
          <div className="read-more-link" onClick={onReadBio}>
            <span>阅读完整传记</span>
            <span style={{ fontSize: "18px" }}>→</span>
          </div>
        </div>

        {isAdminMode && (
          <div className="action-grid admin-actions" style={{ marginTop: "30px" }}>
            <div className="action-btn" onClick={onEditMember} style={{ background: '#2c5282', borderColor: '#4299e1' }}>
               <i style={{ fontSize: '24px', fontStyle: 'normal' }}>✏️</i>
               <span>编辑信息</span>
            </div>
            <div 
              className="action-btn" 
              onClick={() => setShowDeleteDialog(true)} 
              style={{ background: '#742a2a', borderColor: '#e53e3e' }}
            >
               <i style={{ fontSize: '24px', fontStyle: 'normal' }}>🗑️</i>
               <span>删除成员</span>
            </div>
          </div>
        )}
      </div>

      {member && (
        <DeleteMemberDialog 
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          member={member}
          allMembers={allMembers}
          onDeleteSuccess={onClose}
        />
      )}
    </>
  );
};

export default SidePanel;
