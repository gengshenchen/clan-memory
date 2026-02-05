export interface FamilyMember {
  id: string;
  name: string;
  gender?: string;
  generation: number;
  generationName: string;
  parentId?: string;
  spouseName?: string;
  motherId?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  portraitPath?: string;
  bio?: string;
  children?: FamilyMember[];
}

export interface MediaItem {
  id: string;
  url: string;
  title: string;
  type: "video" | "photo" | "audio";
}

export interface OperationLog {
  id: number;
  action: "CREATE" | "UPDATE" | "DELETE";
  targetType: "member" | "media";
  targetId: string;
  targetName: string;
  changes?: string;
  createdAt: number;
}

export interface SaveMemberResult {
  success: boolean;
  id?: string;
  action?: string;
  error?: string;
}

export interface DeleteMemberResult {
  success: boolean;
  error?: string;
  hasChildren?: boolean;
}

// 扩展 Window 接口
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => any;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
    onMemberDetailReceived?: (data: FamilyMember) => void;
    onLocalImageLoaded?: (path: string, base64: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResourceImported?: (data: any) => void;
    // Admin management callbacks
    onMemberSaved?: (result: SaveMemberResult) => void;
    onMemberDeleted?: (result: DeleteMemberResult) => void;
    onMemberResourcesReceived?: (data: any[], type: string) => void;
    onMemberPortraitUpdated?: (memberId: string) => void;
    onMediaResourceDeleted?: (result: any) => void;
    onSettingsReceived?: (key: string, value: string[]) => void;
    onOperationLogsReceived?: (logs: OperationLog[]) => void;
    onFileSelected?: (filePath: string) => void;
  }
}
