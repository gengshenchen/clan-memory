import React, { useState } from 'react';

interface TopBarProps {
  onAdminClick: () => void;
  isAdmin: boolean;
  onSearch: (text: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onAdminClick, isAdmin, onSearch }) => {
  const [searchText, setSearchText] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(searchText);
    }
  };

  return (
    <div className="top-bar">
      <div className="logo"><span style={{ fontSize: "24px" }}>🏛️</span> 宗族记忆<span className="admin-badge">管理员模式</span></div>
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 搜索姓名 (按回车定位)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="settings-btn" onClick={onAdminClick} title={isAdmin ? "退出" : "登录"}>
        {isAdmin ? "🚪" : "⚙️"}
      </div>
    </div>
  );
};

export default TopBar;
