import React, { useState } from 'react';
import type { MediaItem } from '../../types';

interface MediaPlayerProps {
  isActive: boolean;
  type: 'video' | 'photo' | 'audio' | null;
  mediaList: MediaItem[];
  currentUrl: string;
  isUploading: boolean;
  audioState: {
    isPlaying: boolean;
    progress: number;
    duration: number;
    speed: number;
    ref: React.RefObject<HTMLAudioElement | null>
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
  };
  avatarSrc: string;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  isActive, type, mediaList, currentUrl, isUploading, audioState, actions, avatarSrc
}) => {
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  if (!isActive) return null;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // 播放列表组件 (复用)
  const PlaylistPanel = ({ icon }: { icon: string }) => {
    if (isListCollapsed) {
        return (
            <div style={{ width: '40px', background: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderLeft: '1px solid #444' }}>
                <button onClick={() => setIsListCollapsed(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>◀</button>
            </div>
        );
    }

    return (
        <div style={{
            width: '320px',
            background: '#222',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #444',
            transition: 'width 0.3s'
        }}>
            {/* Header */}
            <div style={{ padding: '10px 15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#eee' }}>
                <span style={{ fontWeight: 'bold' }}>播放列表 ({mediaList.length})</span>
                <button onClick={() => setIsListCollapsed(true)} style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>▶ 折叠</button>
            </div>

            {/* Content (Grid Layout) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexWrap: 'wrap', content: 'flex-start', gap: '10px' }}>
                {/* Upload Button */}
                <div onClick={actions.upload}
                     style={{
                         width: '85px', height: '85px',
                         borderRadius: '8px', cursor: 'pointer',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                         background: 'var(--gold)', color: '#000', fontWeight: 'bold', fontSize: '12px',
                         textAlign: 'center', padding: '5px'
                     }}>
                   <div style={{ fontSize: '20px', marginBottom: '2px' }}>➕</div>
                   <div>{isUploading ? "上传中" : "上传"}</div>
                </div>

                {/* Items */}
                {mediaList.map((item, idx) => (
                  <div key={idx} onClick={() => actions.select(item.url)}
                       style={{
                         width: '85px', height: '85px',
                         borderRadius: '8px', cursor: 'pointer',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                         padding: '5px', boxSizing: 'border-box',
                         border: '1px solid',
                         background: currentUrl === item.url ? '#444' : '#333',
                         color: currentUrl === item.url ? 'var(--gold)' : '#ccc',
                         borderColor: currentUrl === item.url ? 'var(--gold)' : '#444',
                         fontSize: '12px', textAlign: 'center', overflow: 'hidden'
                       }}>
                    <div style={{ fontSize: '20px', marginBottom: '2px' }}>{icon}</div>
                    <div style={{ width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                  </div>
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="media-overlay active">
      <button className="media-close" onClick={actions.close}>← 返回</button>

      {/* Video Layout (Left-Right) */}
      {type === "video" && (
        <div className="media-container active" style={{ display: 'flex', width: '95%', height: '90%', background: '#111', overflow: 'hidden', flexDirection: 'row' }}>
          {/* Player Area */}
          <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {currentUrl ? <video src={currentUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        : <div style={{ color: '#666' }}>暂无视频，请从右侧上传</div>}
          </div>
          {/* Playlist */}
          <PlaylistPanel icon="🎬" />
        </div>
      )}

      {/* Audio Layout (Left-Right) */}
      {type === "audio" && (
        <div className="media-container active" style={{ display: 'flex', width: '90%', height: '80%', background: '#1a1a1a', overflow: 'hidden', flexDirection: 'row', borderRadius: '12px' }}>
          {/* Visualizer & Controls Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="audio-disc-container" style={{ width: '200px', height: '200px', marginBottom: '20px' }}>
                <img src={avatarSrc || "https://via.placeholder.com/150"} className="audio-cover" />
            </div>
            <h2 style={{ color: "var(--gold)", fontSize: '18px', marginBottom: '20px' }}>
                {mediaList.find(i => i.url === currentUrl)?.title || "请选择录音"}
            </h2>

            {/* Controls */}
            <div style={{ width: '80%', maxWidth: '500px', background: '#333', padding: '20px', borderRadius: '15px', border: '1px solid #555' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, color: '#ccc', marginBottom: 15 }}>
                <span style={{ minWidth: 40, fontSize: '12px' }}>{formatTime(audioState.progress)}</span>
                <input type="range" min={0} max={audioState.duration || 0} value={audioState.progress}
                       onChange={(e) => actions.seekAudio(Number(e.target.value))} style={{ flex: 1, height: 6, accentColor: 'var(--gold)', cursor: 'pointer' }} />
                <span style={{ minWidth: 40, fontSize: '12px' }}>{formatTime(audioState.duration)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 30 }}>
                <button onClick={actions.changeSpeed} style={{ background: 'transparent', border: '1px solid #777', color: '#fff', borderRadius: 5, padding: '5px 10px', cursor:'pointer' }}>{audioState.speed}x</button>
                <button onClick={actions.toggleAudio} style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--gold)', border: 'none', fontSize: 24, display:'flex', alignItems:'center', justifyContent:'center', color:'black', cursor:'pointer' }}>{audioState.isPlaying ? "⏸" : "▶"}</button>
                <div style={{ width: 40 }}></div>
              </div>
            </div>

            <audio ref={audioState.ref} style={{ display: 'none' }}
                   onPlay={() => actions.setAudioPlaying(true)}
                   onPause={() => actions.setAudioPlaying(false)}
                   onEnded={() => { actions.setAudioPlaying(false); actions.setAudioProgress(0); }}
                   onTimeUpdate={(e) => actions.setAudioProgress(e.currentTarget.currentTime)}
                   onLoadedMetadata={(e) => actions.setAudioDuration(e.currentTarget.duration)} />
          </div>

          {/* Playlist */}
          <PlaylistPanel icon="🎙️" />
        </div>
      )}

      {/* Photo (保持原样) */}
      {type === "photo" && (
        <div className="media-container active" style={{ flexDirection: 'column', width: '100%', height: '100%' }}>
          <div className="photo-stage">
            <button className="photo-nav-btn nav-left" onClick={actions.prev}>‹</button>
            {currentUrl ? <img src={currentUrl} className="main-photo" alt="" /> : <div style={{ color: '#666' }}>暂无照片</div>}
            <button className="photo-nav-btn nav-right" onClick={actions.next}>›</button>
          </div>
          <div style={{ height: 140, background: '#222', width: '100%', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20 }}>
            <button onClick={actions.upload} disabled={isUploading} style={{ height: 80, width: 80, borderRadius: 8, background: 'var(--gold)', border: 'none', cursor: 'pointer' }}>{isUploading ? "⏳" : "➕"}</button>
            <div className="photo-thumbnails">
              {mediaList.map((item, idx) => (
                <img key={idx} src={item.url} className={`thumb ${currentUrl === item.url ? 'active' : ''}`} onClick={() => actions.select(item.url)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaPlayer;
