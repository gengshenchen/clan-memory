import React from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import { UserOutlined, ApartmentOutlined, FormOutlined } from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

// 简单的页面占位
const FamilyTreePage = () => <div style={{padding:20}}><h2>🌲 宗族树谱展示页</h2></div>;
const EntryPage = () => <div style={{padding:20}}><h2>📝 资料录入页</h2></div>;
const SettingsPage = () => <div style={{padding:20}}><h2>⚙️ 系统设置页</h2></div>;

const AppMenu = () => {
  const navigate = useNavigate();
  return (
    <Menu
      theme="dark"
      mode="inline"
      defaultSelectedKeys={['/']}
      onClick={(e) => navigate(e.key)}
      items={[
        { key: '/', icon: <ApartmentOutlined />, label: '宗族树谱' },
        { key: '/entry', icon: <FormOutlined />, label: '资料录入' },
        { key: '/settings', icon: <UserOutlined />, label: '系统设置' },
      ]}
    />
  );
};

const App: React.FC = () => {
  const { token: { colorBgContainer } } = theme.useToken();
  return (
    // 使用 HashRouter 防止白屏
    <HashRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider collapsible>
          <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: '#fff', lineHeight: '32px' }}>
            Clan Memory
          </div>
          <AppMenu />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer }} />
          <Content style={{ margin: '16px' }}>
            <div style={{ padding: 24, minHeight: 360, background: colorBgContainer }}>
              <Routes>
                <Route path="/" element={<FamilyTreePage />} />
                <Route path="/entry" element={<EntryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </HashRouter>
  );
};

export default App;
