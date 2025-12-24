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

// 扩展 Window 接口
declare global {
  interface Window {
    CallBridge?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: (name: string, ...args: any[]) => void;
    };
    onFamilyTreeDataReceived?: (data: FamilyMember[]) => void;
    onMemberDetailReceived?: (data: FamilyMember) => void;
    onLocalImageLoaded?: (path: string, base64: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onMemberResourcesReceived?: (data: any[], type: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onResourceImported?: (data: any) => void;
  }
}
