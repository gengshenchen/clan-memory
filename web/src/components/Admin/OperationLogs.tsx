import React, { useEffect, useState } from 'react';
import './OperationLogs.css';

interface LogEntry {
  id: number;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  changes?: string;
  createdAt: number;
}

interface OperationLogsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OperationLogs: React.FC<OperationLogsProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const fetchLogs = () => {
    setLoading(true);
    if (window.CallBridge) {
        window.onOperationLogsReceived = (data: LogEntry[]) => {
             setLoading(false);
             if (Array.isArray(data)) {
                 setLogs(data);
             }
        };
        window.CallBridge.invoke("getOperationLogs", 100, 0);
    } else {
        setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  const exportJSON = () => {
    if (logs.length === 0) {
      alert("没有日志可导出");
      return;
    }
    const jsonString = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operation_logs_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`logs-overlay ${isOpen ? 'active' : ''}`}>
      <div className="logs-box">
        <div className="logs-header">
           <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
             <h2>操作日志</h2>
             <button className="export-btn" onClick={exportJSON} title="导出 JSON">
                💾
             </button>
           </div>
           <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="logs-content">
            {loading ? <div className="loading">加载中...</div> : (
                <table className="logs-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>操作</th>
                            <th>对象类型</th>
                            <th>对象名称</th>
                            <th>详情</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{formatDate(log.createdAt)}</td>
                                <td className={`action-${log.action.toLowerCase()}`}>{log.action}</td>
                                <td>{log.targetType}</td>
                                <td>{log.targetName}</td>
                                <td className="changes-cell" title={log.changes}>
                                  {log.changes ? (
                                    <span className="detail-badge">JSON</span>
                                  ) : "-"}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                          <tr><td colSpan={5} style={{textAlign: "center", padding: "20px"}}>暂无日志</td></tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
};
