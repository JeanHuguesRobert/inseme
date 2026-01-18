/**
 * Smart Audio System
 *
 * Architecture:
 * 1. Signal Layer (HostAudioIO): Local mic, VAD, Silence Detection, Snapshots.
 * 2. Media Layer (MediaManager): Orchestrator, abstract API.
 * 3. Transport Layer (Adapters): WebRTC, Mock, etc.
 * 4. Playback Layer (AudioQueue): FIFO queue for civilized listening.
 */

/* =========================
   1. AudioQueue (FIFO)
   ========================= */

export class AudioQueue {
  constructor(playbackFn) {
    this.queue = [];
    this.isPlaying = false;
    this.playbackFn = playbackFn;
  }

  enqueue(chunk, priority = false) {
    if (priority) this.queue.unshift(chunk);
    else this.queue.push(chunk);
    this.playNext();
  }

  async playNext() {
    if (this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;
    const chunk = this.queue.shift();
    try {
      await this.playbackFn(chunk);
    } catch (err) {
      console.error("AudioQueue playback error", err);
    } finally {
      this.isPlaying = false;
      this.playNext();
    }
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
  }
}

/* =========================
   2. HostAudioIO (Local Signal)
   ========================= */

export class HostAudioIO {
  constructor(audioQueue, options = {}) {
    this.audioQueue = audioQueue;
    this.localStream = null;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // VAD & Silence
    this.vadThreshold = options.vadThreshold || 0.01;
    this.silenceTimeout = options.silenceTimeout || 1000;
    this.silenceStart = null;
    this.isSpeaking = false;
    this.options = options;
    this.captureEnabled = true;

    // Snapshot
    this.videoTrack = null;
    this.videoStream = null;

    this.processor = null;
    this.semanticCaptor = null;
    this.callbacks = {
      onChunk: null,
      onSpeechStart: null,
      onSpeechEnd: null,
      onSnapshot: null,
      onSemanticState: null,
    };
  }

  /**
   * Start capture (Audio + Optional Video for Snapshot)
   */
  async startCapture({ onChunk, onSpeechStart, onSpeechEnd, onSnapshot, onSemanticState }) {
    this.callbacks = {
      onChunk,
      onSpeechStart,
      onSpeechEnd,
      onSnapshot,
      onSemanticState,
    };

    // Request Audio
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (e) {
      console.error("Camera/Mic permission denied:", e);
      throw e;
    }

    // Attempt to warm up video for snapshots (optional)
    this._initVideo().catch((err) => console.warn("Video snapshot not available:", err));

    const source = this.audioCtx.createMediaStreamSource(this.localStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    // Initialize Semantic Captor
    if (this.options.enableSemantic) {
      const { SemanticCaptor } = await import("./SemanticCaptor.js");
      this.semanticCaptor = new SemanticCaptor({
        roomId: this.options.roomId,
        userId: this.options.userId,
        onStateUpdate: (state) => this.callbacks.onSemanticState?.(state),
      });
    }

    source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      if (!this.captureEnabled) {
        if (this.semanticCaptor) {
          this.semanticCaptor.processChunk(input, false);
        }
        return;
      }
      const isNowSpeaking = this._vad(input);

      this._handleStateChange(isNowSpeaking);

      if (this.semanticCaptor) {
        this.semanticCaptor.processChunk(input, isNowSpeaking);
      }

      if (isNowSpeaking) {
        // Clone buffer to send
        const chunk = this.audioCtx.createBuffer(1, input.length, this.audioCtx.sampleRate);
        chunk.copyToChannel(input, 0);

        // Convert to ArrayBuffer/Blob if needed depending on Adapter expectation.
        // For now we send the raw Float32Array
        this.callbacks.onChunk?.(input.slice()); // Copy Float32Array
      }
    };
  }

  async _initVideo() {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      this.videoTrack = this.videoStream.getVideoTracks()[0];
    } catch (e) {
      // Optional
    }
  }

  _takeSnapshot() {
    if (!this.videoTrack || !this.callbacks.onSnapshot) return;

    const imageCapture = new ImageCapture(this.videoTrack);
    imageCapture
      .grabFrame()
      .then((bitmap) => {
        // Convert to Blob/DataURL
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        this.callbacks.onSnapshot(dataUrl);
      })
      .catch((err) => console.warn("Snapshot failed:", err));
  }

  stopCapture() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }
    this.videoTrack = null;
  }

  async playChunk(chunk) {
    // Expecting Float32Array or ArrayBuffer
    let buffer;
    if (chunk instanceof Float32Array) {
      buffer = this.audioCtx.createBuffer(1, chunk.length, this.audioCtx.sampleRate);
      buffer.copyToChannel(chunk, 0);
    } else {
      buffer = await this.audioCtx.decodeAudioData(chunk);
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start();
    return new Promise((resolve) => (source.onended = resolve));
  }

  _vad(float32Array) {
    let sum = 0;
    for (let i = 0; i < float32Array.length; i++) sum += float32Array[i] ** 2;
    const rms = Math.sqrt(sum / float32Array.length);
    return rms > this.vadThreshold;
  }

  _handleStateChange(isNowSpeaking) {
    const now = Date.now();

    if (isNowSpeaking) {
      this.silenceStart = null;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.callbacks.onSpeechStart?.();
        // TRIGGER VISUAL SIGNAL: Snapshot on speech start
        this._takeSnapshot();
      }
    } else {
      if (this.isSpeaking) {
        if (!this.silenceStart) {
          this.silenceStart = now;
        } else if (now - this.silenceStart >= this.silenceTimeout) {
          this.isSpeaking = false;
          this.silenceStart = null;
          this.callbacks.onSpeechEnd?.();
        }
      }
    }
  }
}

/* =========================
   3. MediaLayer (Abstract)
   ========================= */

export class MediaLayer {
  async connect(roomId, userId, userData) {}
  async disconnect() {}
  async publishChunk(chunk) {}
  async publishSnapshot(imageUrl) {} // Visual Signal
  onRemoteChunk(callback) {} // (userId, chunk) => {}
  onRemoteSnapshot(callback) {} // (userId, imageUrl) => {}
}

/* =========================
   4. Adapters
   ========================= */

export class MockAdapter extends MediaLayer {
  constructor() {
    super();
    this.callbacks = { chunk: null, snapshot: null };
  }
  async connect(roomId, userId) {
    console.log(`[MockAdapter] Connected ${userId}`);
  }
  async disconnect() {
    console.log(`[MockAdapter] Disconnected`);
  }
  async publishChunk(chunk) {
    /* Loopback handled by test runner usually */
  }
  async publishSnapshot(url) {
    console.log(`[MockAdapter] Snapshot published`);
  }

  onRemoteChunk(cb) {
    this.callbacks.chunk = cb;
  }
  onRemoteSnapshot(cb) {
    this.callbacks.snapshot = cb;
  }

  // Test helpers
  simulateRemoteChunk(userId, chunk) {
    this.callbacks.chunk?.(userId, chunk);
  }
  simulateRemoteSnapshot(userId, url) {
    this.callbacks.snapshot?.(userId, url);
  }
}

/* =========================
   5. MediaManager (Orchestrator)
   ========================= */

export class MediaManager {
  constructor(initialAdapter) {
    this.adapter = initialAdapter;
    this.hostIO = null; // Initialized lazily or passed in
    this.AudioQueue = new AudioQueue(async (chunk) => {
      const host = this.hostIO;
      if (!host) return;
      this.emit("onPlaybackStart", { chunk });
      host.captureEnabled = false;
      try {
        await host.playChunk(chunk);
      } finally {
        host.captureEnabled = true;
        this.emit("onPlaybackEnd", { chunk });
      }
    });

    this.eventListeners = {
      onSnapshot: [],
      onSemanticState: [],
      onPlaybackStart: [],
      onPlaybackEnd: [],
    };

    // Bind Adapter -> Queue
    this.adapter.onRemoteChunk((userId, chunk) => {
      // Here we could add logic: is userId allowed to speak?
      this.AudioQueue.enqueue(chunk);
    });

    this.adapter.onRemoteSnapshot((userId, url) => {
      this.emit("onSnapshot", { userId, url });
    });
  }

  initHostIO(options) {
    this.hostIO = new HostAudioIO(this.AudioQueue, options);
  }

  async startSession(onSpeechStart, onSpeechEnd) {
    if (!this.hostIO) throw new Error("HostIO not initialized");

    await this.hostIO.startCapture({
      onChunk: (chunk) => this.adapter.publishChunk(chunk),
      onSnapshot: (url) => this.adapter.publishSnapshot(url),
      onSpeechStart: () => onSpeechStart?.(),
      onSpeechEnd: () => onSpeechEnd?.(),
      onSemanticState: (state) => this.emit("onSemanticState", state),
    });
  }

  stopSession() {
    this.hostIO?.stopCapture();
  }

  on(event, cb) {
    if (this.eventListeners[event]) this.eventListeners[event].push(cb);
  }

  emit(event, data) {
    this.eventListeners[event]?.forEach((cb) => cb(data));
  }
}
