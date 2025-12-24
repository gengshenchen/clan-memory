import { useState, useEffect } from 'react';
import type { FamilyMember } from '../types'; // [Fix] type import

export const useClanBridge = () => {
  const [isBridgeReady, setIsBridgeReady] = useState(false);
  const [familyData, setFamilyData] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>("");

  // 暴露给外部调用 C++ 的方法
  const fetchMemberDetail = (id: string) => {
    window.CallBridge?.invoke("fetchMemberDetail", id);
  };

  const fetchFamilyTree = () => {
    window.CallBridge?.invoke("fetchFamilyTree", "init");
  };

  const getLocalImage = (path: string) => {
    window.CallBridge?.invoke("getLocalImage", path);
  };

  useEffect(() => {
    let checkCount = 0;
    const timer = setInterval(() => {
      checkCount++;
      if (window.CallBridge) {
        setIsBridgeReady(true);
        clearInterval(timer);

        // 绑定全局回调
        window.onFamilyTreeDataReceived = (data) => setFamilyData(data);

        window.onMemberDetailReceived = (data) => {
          if (data) {
            setSelectedMember(data);
            // 处理头像逻辑
            if (data.portraitPath) {
              if (data.portraitPath.startsWith("http") || data.portraitPath.startsWith("//")) {
                setAvatarSrc(data.portraitPath);
              } else {
                getLocalImage(data.portraitPath);
              }
            } else {
              setAvatarSrc("");
            }
          }
        };

        window.onLocalImageLoaded = (_path, base64) => setAvatarSrc(base64);

        // 初始化加载
        fetchFamilyTree();
      } else if (checkCount > 50) {
        clearInterval(timer);
        console.error("Bridge Connection Timeout");
      }
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return {
    isBridgeReady,
    familyData,
    selectedMember,
    setSelectedMember, // 允许手动关闭详情
    avatarSrc,
    fetchMemberDetail
  };
};
