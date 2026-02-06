import React, { useState, useEffect } from "react";
import { type FamilyMember } from "../../types";

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
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[400px] bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <span className="text-red-500">🗑️</span> 删除成员
          </h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
             <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex-shrink-0 border border-white/20">
                {member.portraitPath ? (
                    <img src={member.portraitPath} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                )}
             </div>
             <div>
                <h4 className="text-lg font-medium text-[var(--gold)]">{member.name}</h4>
                <p className="text-sm text-white/50 mt-1">
                    第 {member.generation} 世 | {member.gender === 'M' ? '男' : '女'}
                </p>
             </div>
          </div>

          {hasChildren ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
              <div className="text-xl">⚠️</div>
              <div>
                <h5 className="text-red-400 font-medium mb-1">无法删除此成员</h5>
                <p className="text-sm text-red-300/80 leading-relaxed">
                  检测到该成员有 <span className="text-white font-bold">关联后代</span>。<br/>
                  为了保持族谱完整性，请先删除其所有子女或断开父子关系。
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-white/80 leading-relaxed">
                    确定要彻底删除该成员吗？<br/>
                    <span className="text-sm text-white/50 block mt-2">
                    此操作不可撤销，关联的媒体资料也将被移除。
                    </span>
                </p>
            </div>
          )}

          {error && !hasChildren && (
            <div className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-black/20 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            取消
          </button>
          
          {!hasChildren && (
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isDeleting ? (
                    <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
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
                className="px-4 py-2 rounded-lg text-sm font-medium text-black bg-white/90 hover:bg-white shadow-lg transition-all"
            >
                知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
