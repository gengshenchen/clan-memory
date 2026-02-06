import React, { useState, useEffect } from "react";
import { type FamilyMember } from "../../types";
import "./DeleteMemberDialog.css";

interface DeleteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember;
  allMembers: FamilyMember[];
  onDeleteSuccess?: () => void;
}

export const DeleteMemberDialog: React.FC<DeleteMemberDialogProps> = ({
  isOpen,
  onClose,
  member,
  allMembers,
  onDeleteSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);

  useEffect(() => {
    if (isOpen && member) {
      // Check for children synchronously in frontend
      const children = allMembers.filter(
        (m) => m.parentId === member.id || m.motherId === member.id
      );
      setHasChildren(children.length > 0);
      setError(null);
    }
  }, [isOpen, member, allMembers]);

  const handleDelete = () => {
    if (hasChildren) return;
    setIsDeleting(true);

    // Set up callback
    window.onMemberDeleted = (result: any) => {
      setIsDeleting(false);
      const success =
        result === true ||
        String(result) === "true" ||
        (result && result.success);

      if (success) {
        if (onDeleteSuccess) onDeleteSuccess();
        onClose();
      } else {
        const resultError = result && result.error ? result.error : "删除失败";
        // Handle backend detecting children (double check)
        if (result && result.hasChildren) {
             setHasChildren(true);
             setError("无法删除：该成员有后代，请先删除后代。");
        } else {
             setError(resultError);
        }
      }
    };

    if (window.CallBridge) {
      window.CallBridge.invoke("deleteMember", member.id);
    } else {
      setError("无法连接到后端服务");
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="delete-dialog-overlay" onClick={onClose}>
      <div
        className="delete-dialog-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="delete-dialog-header">
          <h3 className="delete-dialog-title">
            <span className="delete-icon">🗑️</span> 删除成员
          </h3>
          <button onClick={onClose} className="close-btn" title="关闭">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="delete-dialog-content">
          <div className="member-info-card">
             <div className="member-avatar-container">
                {member.portraitPath ? (
                    <img src={member.portraitPath} alt={member.name} className="member-avatar" />
                ) : (
                    <div className="member-avatar-placeholder">
                        {member.gender === 'F' ? '👩' : '👨'}
                    </div>
                )}
             </div>
             <div className="member-details">
                <h4>{member.name}</h4>
                <p className="member-meta">
                    第 {member.generation} 世 | {member.gender === 'M' ? '男' : '女'}
                </p>
             </div>
          </div>

          {hasChildren ? (
            <div className="warning-box">
              <div className="warning-icon">⚠️</div>
              <div className="warning-text">
                <h5>无法删除此成员</h5>
                <p>
                  检测到该成员有 <span style={{fontWeight: 'bold', color: '#fff'}}>关联后代</span>。<br/>
                  为了保持族谱完整性，请先删除其所有子女或断开父子关系。
                </p>
              </div>
            </div>
          ) : (
            <div className="confirmation-box">
                <p className="confirmation-text">
                    确定要彻底删除该成员吗？
                    <span className="sub-text">
                    此操作不可撤销，关联的媒体资料也将被移除。
                    </span>
                </p>
            </div>
          )}

          {error && !hasChildren && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="delete-dialog-footer">
          <button
            onClick={onClose}
            className="btn-dialog-cancel"
            disabled={isDeleting}
          >
            取消
          </button>
          
          {!hasChildren && (
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-dialog-delete"
            >
                {isDeleting ? (
                    <>
                    <div className="spinner"></div>
                    删除中...
                    </>
                ) : (
                    "确认删除"
                )}
            </button>
          )}
          
          {hasChildren && (
             <button
                onClick={onClose}
                className="btn-dialog-ok"
            >
                知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
