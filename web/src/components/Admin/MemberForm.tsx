import React, { useState, useEffect, useMemo } from "react";
import type { FamilyMember, SaveMemberResult } from "../../types";
import { DeleteMemberDialog } from "./DeleteMemberDialog";
import "./MemberForm.css";

interface MemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
  allMembers: FamilyMember[];
  generationNames: string[];
  onSaveComplete?: (newMemberId: string) => void;
}

interface FormData {
  id: string;
  name: string;
  gender: "M" | "F";
  parentId: string;
  generation: number;
  generationName: string;
  spouseName: string;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  deathPlace: string;
  bio: string;
  isNew: boolean;
  isLiving: boolean;

  portraitPath: string;
  aliases: string;
}

const defaultFormData: FormData = {
  id: "",
  name: "",
  gender: "M",
  parentId: "",
  generation: 1,
  generationName: "",
  spouseName: "",
  birthDate: "",
  deathDate: "",
  birthPlace: "",
  deathPlace: "",
  bio: "",
  isNew: true,
  isLiving: true,
  portraitPath: "",
  aliases: "",
};

export const MemberForm: React.FC<MemberFormProps> = ({
  isOpen,
  onClose,
  member,
  allMembers,
  generationNames,
  onSaveComplete,
}) => {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Delete Dialog State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (member) {
        setFormData({
          id: member.id,
          name: member.name,
          gender: member.gender as "M" | "F",
          parentId: member.parentId || "",
          generation: member.generation,
          generationName: member.generationName || "",
          spouseName: member.spouseName || "",
          birthDate: member.birthDate || "",
          deathDate: member.deathDate || "",
          birthPlace: member.birthPlace || "",
          deathPlace: member.deathPlace || "",
          bio: member.bio || "",
          isNew: false,
          isLiving: !member.deathDate,

          portraitPath: member.portraitPath || "",
          aliases: member.aliases || "",
        });
        
        // Load avatar preview if exists
        if (member.portraitPath && window.CallBridge) {
             const result = window.CallBridge.invoke("getLocalImage", member.portraitPath);
             // Note: invoke returns string directly (base64)
             if (result && result.length > 100) {
                 setAvatarPreview(result);
             }
        } else {
             setAvatarPreview(null);
        }
      } else {
        setFormData(defaultFormData);
        setAvatarPreview(null);
      }
      setErrors({});
      setError(null);
      
      // Setup window callback for file selection if needed
      if (window.CallBridge) {
          // Re-bind onFileSelected in case it was overwritten
          // Ideally this should be centralized but we do it here for context
      }
      
      // Fix callback race condition: Reset onMemberDetailReceived when form opens
      // This prevents App.tsx's callback from interfering if it's still active
      if (window.onMemberDetailReceived) {
          // Temporarily disable global detail callback to avoid confusion?
          // No, actually we rely on local logic.
      }
    } else {
       // When closed, clean up callbacks
       if (window.CallBridge) {
           // We don't nullify global callbacks to avoid breaking other components
           // But we should ensure we don't react to them
       }
    }
  }, [isOpen, member]);

  // Group members by generation for parent selection
  const membersByGeneration = useMemo(() => {
    const grouped: Record<number, FamilyMember[]> = {};
    allMembers.forEach((m) => {
      if (!grouped[m.generation]) {
        grouped[m.generation] = [];
      }
      grouped[m.generation].push(m);
    });
    return grouped;
  }, [allMembers]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === "parentId") {
        // Special logic for parent change
        const newParentId = value;
        const parent = allMembers.find((m) => m.id === newParentId);
        if (parent) {
            setFormData(prev => ({
                ...prev,
                parentId: newParentId,
                generation: parent.generation + 1,
                generationName: generationNames[parent.generation] || "", // generation is 1-indexed, so parent.generation (index) is next gen
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                parentId: "",
                // don't check generation if parent removed
            }));
        }
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "姓名不能为空";
    if (!formData.birthDate) newErrors.birthDate = "出生日期不能为空";
    
    // Validate dates logic
    if (formData.birthDate && formData.deathDate) {
        if (new Date(formData.birthDate) > new Date(formData.deathDate)) {
            newErrors.deathDate = "去世日期不能早于出生日期";
        }
    }

    // Check generation name
    if (!formData.generationName.trim()) {
         newErrors.generationName = "字辈不能为空";
    }
    
    // Check first ancestor (strict check)
    if (!formData.parentId && formData.generation > 1) {
        newErrors.parentId = "非始祖成员必须选择父亲";
    }
    
    // Check duplicate name (simple check)
    if (formData.isNew) {
        const exists = allMembers.some(m => m.name === formData.name && m.parentId === formData.parentId);
        if (exists) {
            if (!confirm(`存在同名成员 (父ID: ${formData.parentId||"无"})，确定要继续吗？`)) {
                 newErrors.duplicate = "用户取消保存"; // Add a special error or just return non-empty
                 return newErrors;
            }
        }
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleSave = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
        // If the only error is 'duplicate' (cancelled), just return without alert
        if (validationErrors.duplicate && Object.keys(validationErrors).length === 1) {
            return;
        }
        
        const msg = Object.values(validationErrors).join("\n");
        // Alert the user about missing fields
        alert("请完善以下信息：\n" + msg);
        return;
    }

    setSaving(true);
    setError(null);

    const memberData = {
      ...formData,
      // If living, clear death date
      deathDate: formData.isLiving ? "" : formData.deathDate,
      deathPlace: formData.isLiving ? "" : formData.deathPlace,
      // Normalize aliases: split by comma, Chinese comma, or whitespace
      aliases: formData.aliases
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(","),
    };

    // Callback setup
    window.onMemberSaved = (result: SaveMemberResult) => {
      setSaving(false);
      if (result.success) {
        if (onSaveComplete && result.id) {
            onSaveComplete(result.id);
        }
        onClose();
      } else {
        setError(result.error || "保存失败");
      }
    };

    if (window.CallBridge) {
      window.CallBridge.invoke("saveMember", JSON.stringify(memberData));
    } else {
      setError("无法连接到后端服务");
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSave();
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="member-form-overlay" onClick={onClose}>
        <div
          className="member-form-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="member-form-header">
            <h2>{member ? "编辑成员" : "添加成员"}</h2>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>

          {/* Avatar Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              <div 
                  style={{ 
                      width: 100, height: 100, borderRadius: '50%', background: '#444', 
                      border: formData.portraitPath ? '3px solid #48bb78' : '3px solid #666',
                      overflow: 'hidden', cursor: 'pointer', position: 'relative',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}
                  onClick={() => {
                      // Set up callback to receive selected file path
                      window.onFileSelected = (filePath: string) => {
                          if (filePath) {
                              setFormData(prev => ({ ...prev, portraitPath: filePath }));
                              
                              // Store the path we're expecting
                              const expectedFilePath = filePath;
                              
                              // Set up a simple one-shot callback that only handles this specific request
                              window.onLocalImageLoaded = (path: string, base64: string) => {
                                  // Only handle if this is the path we requested
                                  if (path === expectedFilePath && base64) {
                                      setAvatarPreview(base64);
                                  }
                              };
                              // Load image as base64 for preview
                              window.CallBridge?.invoke("getLocalImage", filePath);
                          }
                      };
                      // Call selectFile to open file dialog
                      window.CallBridge?.invoke("selectFile", "Images (*.png *.jpg *.jpeg *.bmp)");
                  }}
                  title="点击选择头像"
              >
                  {avatarPreview ? (
                     <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  ) : (
                     <div style={{ fontSize: 40, color: '#888' }}>📷</div>
                  )}
                  
                  {/* Overlay hint */}
                  <div style={{ 
                      position: 'absolute', bottom: 0, width: '100%', background: formData.portraitPath ? '#48bb78' : 'rgba(0,0,0,0.6)', 
                      color: 'white', fontSize: 10, textAlign: 'center', padding: '2px 0', transition: 'background 0.3s'
                  }}>
                      {formData.portraitPath ? "已选择" : "点击上传"}
                  </div>
              </div>
          </div>

          {error && <div className="member-form-error">{error}</div>}

          <form className="member-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>基本信息</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">
                    姓名 <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="请输入姓名"
                    maxLength={20}
                    autoFocus
                  />
                  {errors.name && <span className="error-msg">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label>
                    性别 <span className="required">*</span>
                  </label>
                  <div className="gender-options">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="gender"
                        value="M"
                        checked={formData.gender === "M"}
                        onChange={handleChange}
                      />
                      <span>男</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="gender"
                        value="F"
                        checked={formData.gender === "F"}
                        onChange={handleChange}
                      />
                      <span>女</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label htmlFor="aliases">别名 / 昵称</label>
                  <input
                    type="text"
                    id="aliases"
                    name="aliases"
                    value={formData.aliases}
                    onChange={handleChange}
                    placeholder="如有多个，可用逗号或空格分隔 (如: 字某某 号某某)"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="parentId">父亲</label>
                  <select
                    id="parentId"
                    name="parentId"
                    value={formData.parentId}
                    onChange={handleChange}
                    disabled={!!member} // 编辑模式下不可修改父亲
                  >
                    <option value="">-- 无 (始祖) --</option>
                    {Object.entries(membersByGeneration)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([gen, members]) => (
                        <optgroup key={gen} label={`第${gen}世`}>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.generationName})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="generation">世代</label>
                  <input
                    type="number"
                    id="generation"
                    name="generation"
                    value={formData.generation}
                    onChange={handleChange}
                    min={1}
                    readOnly={!!formData.parentId}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="generationName">
                    字辈 <span className="required">*</span>
                  </label>
                  <select
                    id="generationName"
                    name="generationName"
                    value={formData.generationName}
                    onChange={handleChange}
                  >
                    <option value="">-- 请选择 --</option>
                    {generationNames.map((name, index) => (
                      <option key={index} value={name}>
                        {name} (第{index + 1}世)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="spouseName">配偶姓名</label>
                  <input
                    type="text"
                    id="spouseName"
                    name="spouseName"
                    value={formData.spouseName}
                    onChange={handleChange}
                    placeholder="选填"
                    maxLength={20}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>时间与地点</h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="birthDate">出生日期 {errors.birthDate && <span className="required">*</span>}</label>
                  <input
                    type="date"
                    id="birthDate"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleChange}
                    max={new Date().toISOString().split("T")[0]}
                    className={errors.birthDate ? "error" : ""}
                  />
                   {errors.birthDate && <span className="error-msg">{errors.birthDate}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="birthPlace">出生地点</label>
                  <input
                    type="text"
                    id="birthPlace"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleChange}
                    placeholder="省市区"
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="form-row living-status-row">
                <label className="checkbox-label living-checkbox">
                  <input
                    type="checkbox"
                    name="isLiving"
                    checked={formData.isLiving}
                    onChange={handleChange}
                  />
                  <span className="checkmark"></span>
                  <span className="checkbox-text">
                    在世 {formData.isLiving && "✓"}
                  </span>
                </label>
              </div>

              {!formData.isLiving && (
                <div className="form-row death-fields">
                  <div className="form-group">
                    <label htmlFor="deathDate">去世日期</label>
                    <input
                      type="date"
                      id="deathDate"
                      name="deathDate"
                      value={formData.deathDate}
                      onChange={handleChange}
                      max={new Date().toISOString().split("T")[0]}
                      min={formData.birthDate || undefined}
                    />
                    {errors.deathDate && <span className="error-msg">{errors.deathDate}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="deathPlace">去世地点</label>
                    <input
                      type="text"
                      id="deathPlace"
                      name="deathPlace"
                      value={formData.deathPlace}
                      onChange={handleChange}
                      placeholder="选填"
                      maxLength={50}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>生平传记</h3>
              <div className="form-group full-width">
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  placeholder="记录先人生平事迹..."
                  maxLength={2000}
                />
                <div className="char-count">
                  {formData.bio.length}/2000
                </div>
              </div>
            </div>

            <div className="member-form-actions">
              {member && member.id && (
                <button
                  type="button"
                  className="btn-delete"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saving}
                  title="删除此成员"
                >
                  删除
                </button>
              )}
              <div className="right-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                  disabled={saving}
                >
                  取消
                </button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Unified Delete Dialog */}
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
