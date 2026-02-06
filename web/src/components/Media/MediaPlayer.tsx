import React, { useState, useEffect, useRef } from "react";
import type { MediaItem } from "../../types";
import "./MediaPlayer.css";

interface MediaPlayerProps {
  isActive: boolean;
  type: "video" | "photo" | "audio" | null;
  mediaList: MediaItem[];
  currentUrl: string;
  isUploading: boolean;
  audioState: {
    isPlaying: boolean;
    progress: number;
    duration: number;
    speed: number;
    ref: React.RefObject<HTMLAudioElement | null>;
  };
  actions: {
    close: () => void;
    select: (url: string) => void;
    upload: () => void;
    next: () => void;
    prev: () => void;
    toggleAudio: () => void;
    seekAudio: (t: number) => void;
    changeSpeed: () => void;
    setAudioPlaying: (p: boolean) => void;
    setAudioProgress: (t: number) => void;
    setAudioDuration: (d: number) => void;
    deleteMedia: (id: string) => void;
  };
  avatarSrc: string;
  isAdminMode?: boolean;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  isActive,
  type,
  mediaList,
  currentUrl,
  isUploading,
  audioState,
  actions,
  avatarSrc,
  isAdminMode = false,
}) => {
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [controlTimeout, setControlTimeout] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Video-specific state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoSpeed, setVideoSpeed] = useState(1);

  // Generate video thumbnails
  useEffect(() => {
    mediaList.forEach(item => {
      if (!thumbnails.has(item.url)) {
        generateThumbnail(item.url);
      }
    });
  }, [mediaList]);

  const generateThumbnail = (videoUrl: string) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    video.currentTime = 1; // Seek to 1 second for thumbnail
    
    video.onloadeddata = () => {
      video.currentTime = 1;
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 68;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
        setThumbnails(prev => new Map(prev).set(videoUrl, thumbnailUrl));
      }
      video.remove();
    };
    
    video.onerror = () => {
      console.warn('Failed to generate thumbnail for:', videoUrl);
      video.remove();
    };
  };

  // Auto-hide controls
  const resetControlTimer = () => {
    setShowControls(true);
    if (controlTimeout) clearTimeout(controlTimeout);
    const isPlaying = type === "video" ? isVideoPlaying : audioState.isPlaying;
    if ((type === "video" || type === "audio") && isPlaying) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      setControlTimeout(timer);
    }
  };

  useEffect(() => {
    return () => {
      if (controlTimeout) clearTimeout(controlTimeout);
    };
  }, [controlTimeout]);

  // Update control timer when playing state changes
  useEffect(() => {
    if (type === "video" && isVideoPlaying) {
      resetControlTimer();
    } else if (type === "audio" && audioState.isPlaying) {
      resetControlTimer();
    }
  }, [isVideoPlaying, audioState.isPlaying]);

  if (!isActive) return null;

  const formatTime = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const currentItem = mediaList.find((i) => i.url === currentUrl);

  // Video controls
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const seekVideo = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setVideoProgress(time);
  };

  const changeVideoVolume = (vol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = vol;
    setVideoVolume(vol);
  };

  const changeVideoSpeed = () => {
    if (!videoRef.current) return;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIdx = speeds.indexOf(videoSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    videoRef.current.playbackRate = newSpeed;
    setVideoSpeed(newSpeed);
  };

  // Icon symbols (using Unicode for better compatibility)
  const icons = {
    back: "←",
    play: "▶",
    pause: "⏸",
    prev: "⏮",
    next: "⏭",
    volume: "🔊",
    mute: "🔇",
    playlist: "☰",
    fullscreenEnter: "⛶",
    fullscreenExit: "⛶",
    collapse: "»",
    expand: "«",
  };

  // Handle playlist toggle
  const handlePlaylistToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPlaylistOpen(!isPlaylistOpen);
  };

  // Shared Playlist Component - auto-hide with controls
  const isPlaylistVisible = isPlaylistOpen && showControls;
  const renderPlaylist = (icon: string, isVideo: boolean = false) => (
    <div className={`media-playlist ${isPlaylistVisible ? "open" : "collapsed"}`}>
      <div className="playlist-header">
        <h3>
          {icon} 播放列表 <span>({mediaList.length})</span>
        </h3>
      </div>

        <div className="playlist-content">
          {isAdminMode && (
            <button
              className="upload-card"
              onClick={actions.upload}
              disabled={isUploading}
            >
              <span className="upload-icon">{isUploading ? "⏳" : "➕"}</span>
              <span>上传{isVideo ? "视频" : "录音"}</span>
            </button>
          )}

        {mediaList.map((item, idx) => (
          <div
            key={idx}
            className={`playlist-item ${currentUrl === item.url ? "active" : ""}`}
            onClick={() => actions.select(item.url)}
          >
            {isVideo ? (
              <div className="item-thumbnail">
                {thumbnails.get(item.url) ? (
                  <img src={thumbnails.get(item.url)} alt="" className="thumbnail-img" />
                ) : (
                  <div className="thumbnail-placeholder">🎬</div>
                )}
                {(item as unknown as { duration?: number }).duration && (
                  <span className="item-duration">
                    {formatTime((item as unknown as { duration: number }).duration)}
                  </span>
                )}
              </div>
            ) : (
              <div className="item-icon">{icon}</div>
            )}
            <div className="item-info">
              <span className="item-title">{item.title || "未命名"}</span>
              <span className="item-meta">
                {(item as unknown as { createdAt?: string }).createdAt
                  ? new Date((item as unknown as { createdAt: string }).createdAt).toLocaleDateString()
                  : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Shared Control Bar for Video and Audio
  const renderControlBar = (isVideo: boolean) => {
    const progress = isVideo ? videoProgress : audioState.progress;
    const duration = isVideo ? videoDuration : audioState.duration;
    const isPlaying = isVideo ? isVideoPlaying : audioState.isPlaying;
    const speed = isVideo ? videoSpeed : audioState.speed;

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      if (isVideo) {
        seekVideo(time);
      } else {
        actions.seekAudio(time);
      }
    };

    const handleTogglePlay = () => {
      if (isVideo) {
        toggleVideoPlay();
      } else {
        actions.toggleAudio();
      }
    };

    const handleChangeSpeed = () => {
      if (isVideo) {
        changeVideoSpeed();
      } else {
        actions.changeSpeed();
      }
    };

    return (
      <div className={`control-bar ${showControls ? "visible" : "hidden"}`}>
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="progress-track" />
          <div 
            className="progress-played" 
            style={{ width: `${(progress / (duration || 1)) * 100}%` }}
          />
          <input
            type="range"
            className="progress-input"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
          />
          <div 
            className="progress-thumb" 
            style={{ left: `${(progress / (duration || 1)) * 100}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="control-buttons">
          {/* Left Controls */}
          <div className="control-left">
            {isVideo && (
              <div className="volume-control">
                <button 
                  className="icon-btn" 
                  onClick={() => changeVideoVolume(videoVolume > 0 ? 0 : 1)}
                  title={videoVolume > 0 ? "静音" : "取消静音"}
                >
                  {videoVolume > 0 ? icons.volume : icons.mute}
                </button>
                <input
                  type="range"
                  className="volume-slider"
                  min={0}
                  max={1}
                  step={0.1}
                  value={videoVolume}
                  onChange={(e) => changeVideoVolume(Number(e.target.value))}
                />
              </div>
            )}
            <div className="time-display">
              <span className="current">{formatTime(progress)}</span>
              <span> / {formatTime(duration)}</span>
            </div>
          </div>

          {/* Center Controls */}
          <div className="control-center">
            <button className="skip-btn" onClick={actions.prev} title="上一个">
              {icons.prev}
            </button>
            <button className="play-btn" onClick={handleTogglePlay} title={isPlaying ? "暂停" : "播放"}>
              {isPlaying ? icons.pause : icons.play}
            </button>
            <button className="skip-btn" onClick={actions.next} title="下一个">
              {icons.next}
            </button>
          </div>

          {/* Right Controls */}
          <div className="control-right">
            <button className="speed-btn" onClick={handleChangeSpeed} title="播放速度">
              {speed}x
            </button>
            <button 
              className="icon-btn" 
              onClick={handlePlaylistToggle}
              title="播放列表"
            >
              {icons.playlist}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="media-overlay-container"
      onMouseMove={resetControlTimer}
      onClick={resetControlTimer}
    >
      {/* Background Layer */}
      <div className="media-backdrop" />

      {/* Top Bar */}
      <div className={`media-top-bar ${showControls ? "visible" : "hidden"}`}>
        <button className="back-btn" onClick={actions.close}>
          {icons.back}
          <span>返回</span>
        </button>
        <div className="media-title-display">
          {currentItem?.title || (type === "video" ? "视频播放" : type === "audio" ? "音频播放" : "媒体查看")}
        </div>
        <div className="top-bar-spacer">
          {isAdminMode && currentItem && (
            <button
              className="icon-btn"
              style={{ color: "#ff4d4f", marginLeft: "auto" }}
              onClick={() => actions.deleteMedia(currentItem.id)}
              title="删除此资源"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="media-stage">
        {/* ======== VIDEO PLAYER ======== */}
        {type === "video" && (
          <div className="video-player-wrapper">
            <div className="video-stage">
              {currentUrl ? (
                <>
                  <video
                    ref={videoRef}
                    key={currentUrl}
                    src={currentUrl}
                    className="main-video"
                    autoPlay
                    onClick={toggleVideoPlay}
                    onPlay={() => {
                      setIsVideoPlaying(true);
                      actions.setAudioPlaying(true);
                    }}
                    onPause={() => {
                      setIsVideoPlaying(false);
                      actions.setAudioPlaying(false);
                      setShowControls(true);
                    }}
                    onTimeUpdate={(e) => setVideoProgress(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                  />
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🎬</div>
                  <p>
                    {isAdminMode
                      ? "暂无视频，请从右侧列表上传"
                      : "暂无视频"}
                  </p>
                </div>
              )}
              
              {/* Control Bar */}
              {currentUrl && renderControlBar(true)}
            </div>
            {renderPlaylist("🎬", true)}
          </div>
        )}

        {/* ======== AUDIO PLAYER ======== */}
        {type === "audio" && (
          <div className="audio-player-wrapper">
            <div className="audio-stage">
              {/* Spinning Disc */}
              <div className={`disc-container ${audioState.isPlaying ? "spinning" : ""}`}>
                <div className="disc-outer">
                  <div className="disc-art">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="disc-icon">🎵</span>
                    )}
                  </div>
                  <div className="disc-center-hole" />
                </div>
              </div>

              {/* Waveform Visualization */}
              <div className="waveform-container">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className={`wave-bar ${audioState.isPlaying ? "anim" : ""}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>

              {/* Title */}
              <div className="audio-title-large">
                {currentItem?.title || "请选择录音播放"}
              </div>

              {/* Hidden Audio Element */}
              <audio
                ref={audioState.ref}
                style={{ display: "none" }}
                onPlay={() => actions.setAudioPlaying(true)}
                onPause={() => actions.setAudioPlaying(false)}
                onEnded={() => {
                  actions.setAudioPlaying(false);
                  actions.setAudioProgress(0);
                }}
                onTimeUpdate={(e) =>
                  actions.setAudioProgress(e.currentTarget.currentTime)
                }
                onLoadedMetadata={(e) =>
                  actions.setAudioDuration(e.currentTarget.duration)
                }
              />

              {/* Control Bar - Only show when item is selected */}
              {currentItem && renderControlBar(false)}
            </div>

            {/* Playlist Sidebar */}
            {renderPlaylist("🎙️")}
          </div>
        )}

        {/* ======== PHOTO GALLERY ======== */}
        {type === "photo" && (
          <div className="photo-gallery-wrapper">
            <div className="main-photo-area">
              <button className="nav-btn prev" onClick={actions.prev}>
                ‹
              </button>
              {currentUrl ? (
                <img src={currentUrl} className="main-display-photo" alt="" />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📷</div>
                  <p>暂无照片</p>
                </div>
              )}
              <button className="nav-btn next" onClick={actions.next}>
                ›
              </button>
            </div>

            <div className="photo-strip">
              {isAdminMode && (
                <button className="strip-upload-btn" onClick={actions.upload}>
                  <span>+</span>
                </button>
              )}
              <div className="strip-scroll">
                {mediaList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`strip-thumb ${
                      currentUrl === item.url ? "active" : ""
                    }`}
                    onClick={() => actions.select(item.url)}
                  >
                    <img src={item.url} alt="" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaPlayer;
