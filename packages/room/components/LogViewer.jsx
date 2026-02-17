import React, { useState, useEffect, useRef } from "react";
import { Terminal, X, Download, Trash2, Eye, EyeOff } from "lucide-react";

export function LogViewer({ isVisible, onClose, maxHeight = 400, className = "" }) {
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  // Simulate receiving logs from backend (in real implementation, this would be WebSocket or polling)
  useEffect(() => {
    if (!isVisible) return;

    // In a real implementation, you'd connect to WebSocket or poll the backend
    // For now, we'll just show that the system is working
    const mockLogs = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        source: "LogViewer",
        message: "Log viewer initialized - waiting for logs from frontend...",
        sessionId: "demo_session",
      },
    ];

    setLogs(mockLogs);
  }, [isVisible]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
      )
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocal-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(
    (log) =>
      filter === "" ||
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.source.toLowerCase().includes(filter.toLowerCase()) ||
      log.level.toLowerCase().includes(filter.toLowerCase())
  );

  const getLevelColor = (level) => {
    switch (level) {
      case "error":
        return "text-red-600";
      case "warn":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const getSourceColor = (source) => {
    if (source.includes("TalkButton")) return "text-purple-600";
    if (source.includes("useVoiceHandler")) return "text-green-600";
    if (source.includes("useVocalMessage")) return "text-blue-600";
    if (source.includes("AudioAnalyzer")) return "text-orange-600";
    if (source.includes("Gateway")) return "text-red-600";
    return "text-gray-600";
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-black border border-gray-700 rounded-lg shadow-2xl ${isExpanded ? "w-96" : "w-80"} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-white font-mono text-sm">Vocal System Logs</span>
          <span className="text-gray-400 text-xs">({filteredLogs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? (
              <EyeOff className="w-3 h-3 text-gray-400" />
            ) : (
              <Eye className="w-3 h-3 text-gray-400" />
            )}
          </button>
          <button
            onClick={exportLogs}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Export logs"
          >
            <Download className="w-3 h-3 text-gray-400" />
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3 text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
            title="Close"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-gray-700 space-y-2">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <div className="flex gap-2 text-xs">
            <span className="text-red-400">Errors</span>
            <span className="text-yellow-400">Warnings</span>
            <span className="text-blue-400">Info</span>
          </div>
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={logContainerRef}
        className="overflow-y-auto p-3 font-mono text-xs"
        style={{
          maxHeight: isExpanded ? maxHeight : 200,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            {filter ? "No logs match filter" : "Waiting for logs..."}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="mb-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`whitespace-nowrap ${getLevelColor(log.level)}`}>
                  [{log.level.toUpperCase()}]
                </span>
                <span className={`whitespace-nowrap ${getSourceColor(log.source)}`}>
                  [{log.source}]
                </span>
                <span className="text-gray-300 break-all">{log.message}</span>
              </div>

              {/* Show additional data if available */}
              {log.args && log.args.length > 1 && (
                <div className="ml-6 mt-1 text-gray-500 text-xs">
                  {log.args.slice(1).map((arg, argIndex) => (
                    <div key={argIndex} className="ml-2">
                      └─ Data {argIndex + 1}:{" "}
                      {typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)}
                    </div>
                  ))}
                </div>
              )}

              {/* Show memory usage if available */}
              {log.memory && (
                <div className="ml-6 mt-1 text-gray-500 text-xs">
                  └─ Memory: {log.memory.used}MB / {log.memory.total}MB ({log.memory.limit}MB limit)
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Status Bar */}
      <div className="p-2 border-t border-gray-700 bg-gray-900">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Session: {logs[0]?.sessionId || "unknown"}</span>
          <span>Auto-refresh: Active</span>
        </div>
      </div>
    </div>
  );
}
