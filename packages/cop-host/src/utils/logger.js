/**
 * Unified Logger System - Sends frontend logs to backend for centralized display
 */

export class UnifiedLogger {
  constructor(options = {}) {
    this.backendUrl = options.backendUrl || "/api/logs";
    this.enabled = options.enabled !== false;
    this.logBuffer = [];
    this.maxBufferSize = options.maxBufferSize || 100;
    this.flushInterval = options.flushInterval || 2000; // 2 seconds
    this.sessionId = this.generateSessionId();
    this.isDisabled = false; // Disable on repeated errors
    this.errorCount = 0;
    this.maxErrors = 3; // Disable after 3 consecutive errors

    if (this.enabled) {
      this.startFlushTimer();
      this.setupGlobalInterceptors();
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  setupGlobalInterceptors() {
    // Intercept console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    // Only intercept logs that contain our markers
    const self = this;

    console.log = function (...args) {
      originalConsole.log.apply(console, args);
      if (self.shouldIntercept(args)) {
        self.addLog("log", args);
      }
    };

    console.warn = function (...args) {
      originalConsole.warn.apply(console, args);
      if (self.shouldIntercept(args)) {
        self.addLog("warn", args);
      }
    };

    console.error = function (...args) {
      originalConsole.error.apply(console, args);
      if (self.shouldIntercept(args)) {
        self.addLog("error", args);
      }
    };

    console.info = function (...args) {
      originalConsole.info.apply(console, args);
      if (self.shouldIntercept(args)) {
        self.addLog("info", args);
      }
    };
  }

  shouldIntercept(args) {
    // Only intercept logs containing our markers
    const firstArg = args[0];
    if (typeof firstArg === "string") {
      return (
        firstArg.includes("[TalkButton]") ||
        firstArg.includes("[useVoiceHandler]") ||
        firstArg.includes("[useVocalMessage]") ||
        firstArg.includes("[AudioAnalyzer]") ||
        firstArg.includes("[Gateway]")
      );
    }
    return false;
  }

  addLog(level, args) {
    if (!this.enabled) return;

    const logEntry = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      level,
      message: this.formatArgs(args),
      args: args.map((arg) => this.serializeArg(arg)),
      url: window.location.href,
      userAgent: navigator.userAgent,
      memory: this.getMemoryUsage(),
    };

    this.logBuffer.push(logEntry);

    // Flush immediately for errors
    if (level === "error") {
      this.flush();
    }
  }

  formatArgs(args) {
    return args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return "[Object]";
          }
        }
        return String(arg);
      })
      .join(" ");
  }

  serializeArg(arg) {
    if (typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean") {
      return arg;
    }
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.parse(
          JSON.stringify(arg, (key, value) => {
            if (typeof value === "function") return "[Function]";
            if (value instanceof Error)
              return {
                name: value.name,
                message: value.message,
                stack: value.stack,
              };
            if (value instanceof HTMLElement) return "[HTMLElement]";
            if (value instanceof Blob)
              return {
                type: "Blob",
                size: value.size,
                mimeType: value.type,
              };
            return value;
          })
        );
      } catch (e) {
        return "[Unserializable Object]";
      }
    }
    return "[Unknown]";
  }

  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: Math.round((performance.memory.usedJSHeapSize / 1024 / 1024) * 100) / 100,
        total: Math.round((performance.memory.totalJSHeapSize / 1024 / 1024) * 100) / 100,
        limit: Math.round((performance.memory.jsHeapSizeLimit / 1024 / 1024) * 100) / 100,
      };
    }
    return null;
  }

  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  async flush() {
    if (!this.enabled || this.logBuffer.length === 0 || this.isDisabled) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const response = await fetch(this.backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        this.errorCount++;
        console.warn(
          `[UnifiedLogger] Failed to send logs to backend: ${response.status} (${this.errorCount}/${this.maxErrors})`
        );

        // Disable after max consecutive errors
        if (this.errorCount >= this.maxErrors) {
          this.isDisabled = true;
          this.stopFlushTimer();
          console.warn(
            `[UnifiedLogger] ❌ DISABLED: Too many consecutive errors (${this.errorCount}). Restart required.`
          );

          // Show user-friendly message once
          if (this.errorCount === this.maxErrors) {
            console.warn(
              "[UnifiedLogger] 💡 To re-enable: Refresh the page or call logger.restart()"
            );
          }
        }

        // Re-add failed logs to buffer (up to max size)
        this.logBuffer = [
          ...logsToSend.slice(-this.maxBufferSize + this.logBuffer.length),
          ...this.logBuffer,
        ];
      } else {
        // Reset error count on success
        this.errorCount = 0;
      }
    } catch (error) {
      this.errorCount++;
      console.warn(
        `[UnifiedLogger] Error sending logs to backend: ${error.message} (${this.errorCount}/${this.maxErrors})`
      );

      // Disable after max consecutive errors
      if (this.errorCount >= this.maxErrors) {
        this.isDisabled = true;
        this.stopFlushTimer();
        console.warn(
          `[UnifiedLogger] ❌ DISABLED: Too many consecutive errors (${this.errorCount}). Restart required.`
        );

        // Show user-friendly message once
        if (this.errorCount === this.maxErrors) {
          console.warn(
            "[UnifiedLogger] 💡 To re-enable: Refresh the page or call logger.restart()"
          );
        }
      }

      // Re-add failed logs to buffer
      this.logBuffer = [
        ...logsToSend.slice(-this.maxBufferSize + this.logBuffer.length),
        ...this.logBuffer,
      ];
    }
  }

  // Manual log methods
  log(...args) {
    console.log(...args);
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }

  info(...args) {
    console.info(...args);
  }

  // Custom vocal-specific logging
  vocal(message, data = {}) {
    this.log(`[VOCAL] ${message}`, data);
  }

  talkButton(message, data = {}) {
    this.log(`[TalkButton] ${message}`, data);
  }

  voiceHandler(message, data = {}) {
    this.log(`[useVoiceHandler] ${message}`, data);
  }

  gateway(message, data = {}) {
    this.log(`[Gateway] ${message}`, data);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // Restart logger after errors
  restart() {
    this.isDisabled = false;
    this.errorCount = 0;
    console.log("[UnifiedLogger] 🔄 Restarted - attempting to send logs again");

    if (!this.flushTimer) {
      this.startFlushTimer();
    }

    // Try to flush any pending logs
    if (this.logBuffer.length > 0) {
      this.flush();
    }
  }

  // Get status
  getStatus() {
    return {
      enabled: this.enabled,
      isDisabled: this.isDisabled,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors,
      bufferSize: this.logBuffer.length,
      sessionId: this.sessionId,
      backendUrl: this.backendUrl,
    };
  }

  // Cleanup
  destroy() {
    this.stopFlushTimer();
    this.flush(); // Final flush
  }
}

// Singleton instance
let loggerInstance = null;

export function getLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new UnifiedLogger(options);
  }
  return loggerInstance;
}

export function initLogger(options = {}) {
  loggerInstance = new UnifiedLogger(options);
  return loggerInstance;
}
