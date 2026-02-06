import { useState, useEffect, useRef } from "react";
import type { FamilyMember } from "../types";

export const useMedia = (selectedMember: FamilyMember | null) => {
  const [mediaType, setMediaType] = useState<
    "video" | "photo" | "audio" | null
  >(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Media counts for SidePanel display
  const [mediaCounts, setMediaCounts] = useState<{
    video: number;
    photo: number;
    audio: number;
  }>({ video: 0, photo: 0, audio: 0 });

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlayedUrlRef = useRef<string>("");

  const memberRef = useRef(selectedMember);
  const typeRef = useRef(mediaType);

  useEffect(() => {
    memberRef.current = selectedMember;
  }, [selectedMember]);
  useEffect(() => {
    typeRef.current = mediaType;
  }, [mediaType]);

  // 1. 初始化回调
  useEffect(() => {
    window.onMemberResourcesReceived = (data, type) => {
      console.log(`Received ${type} list:`, data);
      // 根据 URL 去重
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueMap = new Map();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.forEach((item: any) => {
        if (!uniqueMap.has(item.url)) uniqueMap.set(item.url, item);
      });
      const uniqueList = Array.from(uniqueMap.values());
      
      // Update counts for this type
      if (type === 'video' || type === 'photo' || type === 'audio') {
        setMediaCounts(prev => ({ ...prev, [type]: uniqueList.length }));
      }
      
      // Only update media list if this is the currently active type
      if (type === typeRef.current) {
        setMediaList(uniqueList);
      }
    };

    window.onResourceImported = (data) => {
      setIsUploading(false);
      if (data && data.status === "cancelled") return;

      const currentMember = memberRef.current;
      const currentType = typeRef.current;
      if (currentMember && currentType) {
        window.CallBridge?.invoke(
          "fetchMemberResources",
          currentMember.id,
          currentType
        );
      }
    };

    // Batch import callback - handles multi-file import results
    window.onMultipleResourcesImported = (result) => {
      setIsUploading(false);
      if (result.status === "cancelled") return;

      // Show import results summary
      if (result.imported > 0 || result.failed > 0) {
        let message = `✅ 成功导入 ${result.imported} 个文件`;
        if (result.failed > 0) {
          message += `\n❌ 失败 ${result.failed} 个文件`;
          if (result.errors && result.errors.length > 0) {
            message += ":\n" + result.errors.map(e => `  - ${e.file}: ${e.error}`).join("\n");
          }
        }
        alert(message);
      }

      // Refresh media list
      const currentMember = memberRef.current;
      const currentType = typeRef.current;
      if (currentMember && currentType) {
        window.CallBridge?.invoke(
          "fetchMemberResources",
          currentMember.id,
          currentType
        );
      }
    };
  }, []);

  // 2. 自动播放第一首
  useEffect(() => {
    if (mediaList.length > 0 && !currentMediaUrl) {
      setCurrentMediaUrl(mediaList[0].url);
    }
  }, [mediaList, currentMediaUrl]);

  // 2.5 Auto-fetch media counts when member changes
  useEffect(() => {
    if (selectedMember?.id && window.CallBridge) {
      // Reset counts first
      setMediaCounts({ video: 0, photo: 0, audio: 0 });
      // Fetch counts for all three types
      const types = ['video', 'photo', 'audio'] as const;
      types.forEach(type => {
        window.CallBridge?.invoke("fetchMemberResources", selectedMember.id, type);
      });
    }
  }, [selectedMember?.id]);

  // 3. 音频核心逻辑
  useEffect(() => {
    if (mediaType === "audio" && audioRef.current && currentMediaUrl) {
      if (lastPlayedUrlRef.current !== currentMediaUrl) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
        setAudioProgress(0);

        audioRef.current.src = currentMediaUrl;
        audioRef.current.load();

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Auto-play blocked", error);
            setIsPlayingAudio(false);
          });
        }
        lastPlayedUrlRef.current = currentMediaUrl;
      }
    } else if (!currentMediaUrl && audioRef.current) {
      audioRef.current.pause();
      lastPlayedUrlRef.current = "";
    }
  }, [currentMediaUrl, mediaType]);

  // --- Actions ---

  const openMedia = (type: "video" | "photo" | "audio") => {
    setMediaType(type);
    setMediaList([]);
    setCurrentMediaUrl("");
    setIsPlayingAudio(false);
    lastPlayedUrlRef.current = "";
    if (selectedMember) {
      window.CallBridge?.invoke(
        "fetchMemberResources",
        selectedMember.id,
        type
      );
    }
  };

  const closeMedia = () => {
    setMediaType(null);
    setCurrentMediaUrl("");
    setIsPlayingAudio(false);
    lastPlayedUrlRef.current = "";
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const uploadMedia = () => {
    if (selectedMember && mediaType) {
      setIsUploading(true);
      setTimeout(() => {
        window.CallBridge?.invoke(
          "importMultipleResources",  // Changed to batch import
          selectedMember.id,
          mediaType
        );
      }, 50);
    }
  };

  // [Fix] 补全照片切换逻辑
  const handleNextPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex(
      (item) => item.url === currentMediaUrl
    );
    // 如果找不到当前(比如刚上传), 默认第一张
    const idx = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (idx + 1) % mediaList.length;
    setCurrentMediaUrl(mediaList[nextIndex].url);
  };

  const handlePrevPhoto = () => {
    if (mediaList.length === 0) return;
    const currentIndex = mediaList.findIndex(
      (item) => item.url === currentMediaUrl
    );
    const idx = currentIndex === -1 ? 0 : currentIndex;
    const prevIndex = (idx - 1 + mediaList.length) % mediaList.length;
    setCurrentMediaUrl(mediaList[prevIndex].url);
  };

      const deleteMedia = (resourceId: string) => {
    if (!window.confirm("确定删除该媒体资源吗？")) return;

    window.onMediaResourceDeleted = (result: any) => {
        const success = (result === true || String(result) === "true" || (result && result.success));
        if (success) {
          setMediaList((prev) => prev.filter((item) => item.id !== resourceId));
          const deletedItem = mediaList.find((i) => i.id === resourceId);
          if (deletedItem && currentMediaUrl === deletedItem.url) {
            setCurrentMediaUrl("");
            setIsPlayingAudio(false);
          }
        } else {
          alert("删除失败");
        }
    };

    if (window.CallBridge) {
        window.CallBridge.invoke("deleteMediaResource", resourceId);
    }
  };

  // Audio Controls
  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  const seekAudio = (time: number) => {
    setAudioProgress(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const changeSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1.0, 1.5, 2.0];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    audioRef.current.playbackRate = next;
    setPlaybackSpeed(next);
  };

  return {
    mediaType,
    mediaList,
    currentMediaUrl,
    setCurrentMediaUrl,
    isUploading,
    mediaCounts,  // Add for SidePanel display
    audioState: {
      isPlaying: isPlayingAudio,
      progress: audioProgress,
      duration: audioDuration,
      speed: playbackSpeed,
      ref: audioRef,
    },
    actions: {
      openMedia,
      closeMedia,
      uploadMedia,
      deleteMedia, // New action
      next: handleNextPhoto, // [Fix] 绑定方法
      prev: handlePrevPhoto, // [Fix] 绑定方法
      toggleAudio,
      seekAudio,
      changeSpeed,
      setAudioPlaying: setIsPlayingAudio,
      setAudioProgress,
      setAudioDuration,
      setCurrentMediaUrl,
      fetchMediaCounts: (memberId: string) => {
        // Fetch counts for all three types
        const types = ['video', 'photo', 'audio'] as const;
        types.forEach(type => {
          window.CallBridge?.invoke("fetchMemberResources", memberId, type);
        });
      },
    },
  };
};
