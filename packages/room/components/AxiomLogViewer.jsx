import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  X,
  Download,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Filter,
  BarChart3,
  AlertTriangle,
  Mic,
  Brain,
} from "lucide-react";

export function AxiomLogViewer({ isVisible, onClose, maxHeight = 500, className = "" }) {
  const [logs, setLogs] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [queryType, setQueryType] = useState("recent");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const logContainerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh && isVisible) {
      refreshTimerRef.current = setInterval(() => {
        fetchLogs();
      }, refreshInterval);
    } else {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isVisible, queryType, sessionId]);

  // Initial load and when visibility changes
  useEffect(() => {
    if (isVisible) {
      fetchLogs();
      fetchDashboard();
    }
  }, [isVisible]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = "/api/logs/query";
      const params = new URLSearchParams();

      params.append("type", queryType);
      if (sessionId) params.append("sessionId", sessionId);

      const response = await fetch(`${url}?${params}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data?.matches || []);
      } else {
        console.error("Failed to fetch logs:", result.error);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch("/api/logs/query?type=dashboard");
      const result = await response.json();

      if (result.success) {
        setDashboard(result.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const exportLogs = () => {
    const logText = logs
      .map(
        (log) =>
          `[${new Date(log._time).toLocaleString()}] [${log.level}] [${log.source}] ${log.message}
${log.data ? JSON.stringify(log.data, null, 2) : ""}
`
      )
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axiom-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(
    (log) =>
      filter === "" ||
      log.message?.toLowerCase().includes(filter.toLowerCase()) ||
      log.source?.toLowerCase().includes(filter.toLowerCase()) ||
      log.level?.toLowerCase().includes(filter.toLowerCase())
  );

  const getLevelColor = (level) => {
    switch (level) {
      case "ERROR":
        return "text-red-600 bg-red-50 border-red-200";
      case "WARN":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "INFO":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getSourceIcon = (source) => {
    if (source.includes("TalkButton")) return <Mic className="w-3 h-3" />;
    if (source.includes("useVoiceHandler")) return <Brain className="w-3 h-3" />;
    if (source.includes("Gateway")) return <Terminal className="w-3 h-3" />;
    return <div className="w-3 h-3 rounded-full bg-gray-400" />;
  };

  const getSourceColor = (source) => {
    if (source.includes("TalkButton")) return "text-purple-600 bg-purple-100 border-purple-200";
    if (source.includes("useVoiceHandler")) return "text-green-600 bg-green-100 border-green-200";
    if (source.includes("Gateway")) return "text-red-600 bg-red-100 border-red-200";
    if (source.includes("AudioAnalyzer")) return "text-orange-600 bg-orange-100 border-orange-200";
    return "text-gray-600 bg-gray-100 border-gray-200";
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-2xl ${isExpanded ? "w-[600px]" : "w-[500px]"} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-600" />
          <span className="text-gray-900 font-mono text-sm font-semibold">Axiom Logs</span>
          <span className="text-gray-500 text-xs">({filteredLogs.length})</span>
          {loading && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? (
              <EyeOff className="w-3 h-3 text-gray-600" />
            ) : (
              <Eye className="w-3 h-3 text-gray-600" />
            )}
          </button>
          <button
            onClick={fetchLogs}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={exportLogs}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Export logs"
          >
            <Download className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3 text-gray-600" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Close"
          >
            <X className="w-3 h-3 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Dashboard Summary */}
      {dashboard && (
        <div className="p-3 border-b border-gray-200 bg-blue-50">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600">{dashboard.totalLogs}</div>
              <div className="text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-red-600">{dashboard.errorCount}</div>
              <div className="text-gray-600">Errors</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-green-600">{dashboard.transcriptionCount}</div>
              <div className="text-gray-600">Transcriptions</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-orange-600">{dashboard.youIssueCount}</div>
              <div className="text-gray-600">"You" Issues</div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        <div className="flex gap-2">
          <select
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="recent">Recent Logs</option>
            <option value="errors">Errors Only</option>
            <option value="transcriptions">Transcriptions</option>
            <option value="you-issues">"You" Issues</option>
            <option value="source">By Source</option>
            <option value="session">By Session</option>
          </select>

          {queryType === "session" && (
            <input
              type="text"
              placeholder="Session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            />
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Logs Container */}
      <div
        ref={logContainerRef}
        className="overflow-y-auto p-3 font-mono text-xs"
        style={{
          maxHeight: isExpanded ? maxHeight : 300,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {loading ? "Loading logs..." : filter ? "No logs match filter" : "No logs found"}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="mb-3 leading-relaxed border-l-2 border-gray-200 pl-3">
              <div className="flex items-start gap-2">
                <span
                  className={`px-1 py-0.5 rounded text-xs font-semibold ${getLevelColor(log.level)}`}
                >
                  {log.level}
                </span>
                <div
                  className={`flex items-center gap-1 px-1 py-0.5 rounded text-xs ${getSourceColor(log.source)}`}
                >
                  {getSourceIcon(log.source)}
                  <span>{log.source}</span>
                </div>
                <span className="text-gray-500 whitespace-nowrap">
                  {new Date(log._time).toLocaleTimeString()}
                </span>
                {log.sessionId && (
                  <span className="text-gray-400 text-xs">{log.sessionId.substring(0, 8)}...</span>
                )}
              </div>

              <div className="mt-1 text-gray-800 break-all">{log.message}</div>

              {/* Show additional data if available */}
              {log.data && Object.keys(log.data).length > 0 && (
                <div className="ml-4 mt-1 text-gray-600 text-xs">
                  <details className="cursor-pointer">
                    <summary className="hover:text-gray-800">
                      📊 Data ({Object.keys(log.data).length})
                    </summary>
                    <pre className="mt-1 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {/* Show memory usage if available */}
              {log.memory && (
                <div className="ml-4 mt-1 text-gray-500 text-xs">
                  💾 Memory: {log.memory.used}MB / {log.memory.total}MB ({log.memory.limit}MB limit)
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Status Bar */}
      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Query: {queryType}
            {autoRefresh && ` • Auto-refresh: ${refreshInterval / 1000}s`}
          </span>
          <span>{logs.length} logs from Axiom</span>
        </div>
      </div>
    </div>
  );
}
