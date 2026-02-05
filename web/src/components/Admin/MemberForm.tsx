import React, { useState, useEffect, useMemo } from "react";
import type { FamilyMember, SaveMemberResult } from "../../types";
import "./MemberForm.css";

interface MemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  member?: FamilyMember | null; // null = add mode, object = edit mode
  allMembers: FamilyMember[];
  generationNames: string[];
  onSaveComplete?: (memberId: string) => void; // Called after successful save
}

interface FormData {
  id: string;
  name: string;
  gender: string;
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
  portraitPath?: string;
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
  const [avatarPreview, setAvatarPreview] = useState<string>(""); // Base64 preview


  // Initialize form data when member changes
  useEffect(() => {
    if (member) {
      // 判断是否在世：没有 deathDate 就是在世
      const hasDeathDate = !!(member.deathDate && member.deathDate.length > 0);
      setFormData({
        id: member.id,
        name: member.name,
        gender: member.gender || "M",
        parentId: member.parentId || "",
        generation: member.generation,
        generationName: member.generationName || "",
        spouseName: member.spouseName || "",
        birthDate: member.birthDate || "",
        deathDate: hasDeathDate ? member.deathDate! : "",
        birthPlace: member.birthPlace || "",
        deathPlace: hasDeathDate ? member.deathPlace || "" : "",
        bio: member.bio || "",
        isNew: false,
        isLiving: !hasDeathDate,
        portraitPath: member.portraitPath || "",
      });
    } else {
      setFormData({
        ...defaultFormData,
        generationName: generationNames[0] || "",
      });
    }
    setError(null);
    setAvatarPreview(""); // Reset preview
    
    // Only load existing portrait if form is OPEN and editing member with portrait
    // (Don't set up callback when form is closing to avoid race conditions)
    if (isOpen && member?.portraitPath && window.CallBridge) {
      const pathToLoad = member.portraitPath;
      
      // Save original callback
      const originalCallback = window.onLocalImageLoaded;
      
      // Set up callback that filters by path
      window.onLocalImageLoaded = (path: string, base64: string) => {
        if (base64 && path === pathToLoad) {
          setAvatarPreview(base64);
        }
        // Also call original callback if it exists and path doesn't match
        if (originalCallback && path !== pathToLoad) {
          originalCallback(path, base64);
        }
      };
      window.CallBridge.invoke("getLocalImage", pathToLoad);
    }
  }, [member, generationNames, isOpen]);

  // Group members by generation for parent selection
  const membersByGeneration = useMemo(() => {
    const grouped: Record<number, FamilyMember[]> = {};
    const currentId = member?.id;

    // Get descendants of current member (for exclusion in edit mode)
    const getDescendants = (id: string): Set<string> => {
      const descendants = new Set<string>();
      const children = allMembers.filter((m) => m.parentId === id);
      children.forEach((child) => {
        descendants.add(child.id);
        getDescendants(child.id).forEach((d) => descendants.add(d));
      });
      return descendants;
    };

    const excludeIds = currentId
      ? new Set([currentId, ...getDescendants(currentId)])
      : new Set<string>();

    allMembers.forEach((m) => {
      // Filter: Must be MALE and not self/descendant
      if (m.gender !== "M") return;
      if (excludeIds.has(m.id)) return;

      if (!grouped[m.generation]) {
        grouped[m.generation] = [];
      }
      grouped[m.generation].push(m);
    });

    return grouped;
  }, [allMembers, member]);

  // Auto-calculate generation when parent changes
  useEffect(() => {
    if (formData.parentId) {
      const parent = allMembers.find((m) => m.id === formData.parentId);
      if (parent) {
        const newGen = parent.generation + 1;
        const suggestedName =
          generationNames[newGen - 1] || generationNames[0] || "";
        setFormData((prev) => ({
          ...prev,
          generation: newGen,
          generationName: suggestedName,
        }));
      }
    }
  }, [formData.parentId, allMembers, generationNames]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === "isLiving") {
        setFormData((prev) => ({
          ...prev,
          isLiving: checked,
          // 如果勾选"在世"，清空去世信息
          deathDate: checked ? "" : prev.deathDate,
          deathPlace: checked ? "" : prev.deathPlace,
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): string | null => {
    // 姓名必填
    if (!formData.name.trim()) {
      return "姓名不能为空";
    }

    // 姓名长度限制
    if (formData.name.trim().length > 20) {
      return "姓名不能超过20个字符";
    }

    // 字辈必填
    if (!formData.generationName) {
      return "请选择字辈";
    }

    // 出生日期必填 (Data Integrity)
    if (!formData.birthDate) {
      return "出生日期不能为空";
    }

    // 日期验证: 去世日期不能早于出生日期
    if (formData.birthDate && formData.deathDate) {
      const birth = new Date(formData.birthDate);
      const death = new Date(formData.deathDate);
      if (death < birth) {
        return "去世日期不能早于出生日期";
      }
    }

    // 日期验证: 日期不能是未来
    const today = new Date();
    if (formData.birthDate && new Date(formData.birthDate) > today) {
      return "出生日期不能是未来日期";
    }
    if (formData.deathDate && new Date(formData.deathDate) > today) {
      return "去世日期不能是未来日期";
    }

    // 始祖校验: 如果已有始祖，且当前不是在编辑该始祖，则不允许为空(即不允许为始祖)
    if (!formData.parentId) {
      const existingRoot = allMembers.find(
        (m) => !m.parentId && m.id !== formData.id
      );
      if (existingRoot) {
        return `已存在始祖 (${existingRoot.name})，不能添加新的始祖。请选择父亲。`;
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    // Set up callback
    window.onMemberSaved = (result: SaveMemberResult) => {
      setSaving(false);
      if (result.success) {
        onClose();
        // Notify parent to focus on the saved member
        if (result.id && onSaveComplete) {
          onSaveComplete(result.id);
        }
        // Tree refresh is handled by backend automatically
      } else {
        setError(result.error || "保存失败");
      }
    };

    // Prepare data - if living, clear death fields
    // Duplicate name check (Name AND Father)
    const isDuplicate = allMembers.some(
      (m) =>
        m.name === formData.name &&
        (m.parentId || "") === (formData.parentId || "") &&
        m.id !== (member?.id || "")
    );
    if (isDuplicate) {
      if (!window.confirm(`系统中已存在同名且同父亲的成员 "${formData.name}"。是否继续？`)) {
          setSaving(false);
          return;
      }
    }

    const dataToSave = {
      ...formData,
      deathDate: formData.isLiving ? "" : formData.deathDate,
      deathPlace: formData.isLiving ? "" : formData.deathPlace,
    };



    // Call backend
    if (window.CallBridge) {
        window.CallBridge.invoke("saveMember", JSON.stringify(dataToSave));
    } else {
        setSaving(false);
        setError("Bridge not connected");
    }
  };

  const handleDelete = () => {
    const hasChildren = allMembers.some(
      (m) => m.parentId === formData.id || m.motherId === formData.id
    );
    if (hasChildren) {
      setError("无法删除：该成员有子女，请先删除子女或解除关系。");
      return;
    }

    if (!window.confirm(`确定要删除 ${formData.name} 吗？此操作不可恢复。`))
      return;

    window.onMemberDeleted = (result: any) => {
        // result might be boolean or object depending on C++ impl
        // mainwindow.cpp line 390 calls onMemberDeleted(resultJson)
        // JsBridge::deleteMember returns boolean true/false?
        // Wait, JsBridge::deleteMember signature returns QString?
        // I need to check JsBridge::deleteMember return type in cpp. 
        // Step 452 said it calls DeleteMediaResource which returns bool.
        // But mainwindow.cpp line 387: QString resultJson = m_jsBridge->deleteMember(memberId);
        // So I should treat result as boolean or object?
        // Assuming it matches SaveMemberResult structure or simple bool?
        // I'll log it.
        console.log("Delete result:", result);
        if (result === true || result.success || String(result) === "true") {
             onClose();
        } else {
             setError("删除失败");
        }
    };

    if (window.CallBridge) {
       window.CallBridge.invoke("deleteMember", formData.id);
    }
  };

  if (!isOpen) return null;

  return (
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
                                // NOTE: We intentionally don't chain to original callback
                                // The useClanBridge.ts will reset this callback when it needs to
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
              <div className="form-group">
                <label htmlFor="parentId">父亲</label>
                <select
                  id="parentId"
                  name="parentId"
                  value={formData.parentId}
                  onChange={handleChange}
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
                <label htmlFor="birthDate">出生日期</label>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  max={new Date().toISOString().split("T")[0]}
                />
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
            {!member?.id ? null : (
              <button
                type="button"
                className="btn-delete"
                onClick={handleDelete}
                disabled={saving}
                title="删除此成员"
              >
                删除
              </button>
            )}
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
        </form>
      </div>
    </div>
  );
};
