/**
 * packages/room/lib/media/SemanticCaptor.js
 *
 * Local Semantic Capture Module.
 * Analyzes audio chunks to extract pseudonymized speaker features,
 * intensity, and interaction types without storing verbatim.
 */

export class SemanticCaptor {
  constructor(options = {}) {
    this.roomId = options.roomId;
    this.userId = options.userId;
    this.onStateUpdate = options.onStateUpdate; // Callback for periodic JSON output

    this.interval = options.interval || 5000; // 5-10s
    this.lastFlush = Date.now();

    this.currentState = {
      locuteur_id: null,
      profil: "observateur",
      themes_detectes: [],
      type_interaction: "observation",
      intensite: 0,
      instabilite: false,
      timestamp: Date.now(),
    };

    this.voiceSignatures = new Map(); // local pseudonyms
    this.activeSegments = [];
  }

  /**
   * Process a Float32Array audio chunk
   */
  processChunk(float32Array, isSpeaking) {
    if (!isSpeaking) {
      this.currentState.intensite = 0;
      return;
    }

    const { rms, pitch, spectralCentroid } = this._extractLowLevelFeatures(float32Array);

    // Update intensity
    this.currentState.intensite = Math.min(1, rms * 10); // Heuristic scaling

    // Simple Diarization / Pseudonymization
    const pseudonym = this._getPseudonym(pitch, spectralCentroid);
    this.currentState.locuteur_id = pseudonym;

    // Interaction Type Heuristic
    this._updateInteractionType(pitch, float32Array);

    // Periodic Flush
    if (Date.now() - this.lastFlush > this.interval) {
      this.flush();
    }
  }

  _extractLowLevelFeatures(data) {
    let sum = 0;
    let sumSqu = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      sumSqu += data[i] ** 2;
    }
    const rms = Math.sqrt(sumSqu / data.length);

    // Very basic pitch detection (Zero Crossing Rate)
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
        crossings++;
      }
    }
    const pitch = crossings / (data.length / 2); // Normalized ZCR

    // Spectral centroid approximation (very rough)
    const spectralCentroid = pitch * 1.5; // Placeholder for actual FFT if needed

    return { rms, pitch, spectralCentroid };
  }

  _getPseudonym(pitch, centroid) {
    // Generate a stable hash from voice features
    // In a real app, we'd use more robust features (MFCC)
    const signature = `${Math.round(pitch * 100)}-${Math.round(centroid * 100)}`;

    // Find closest signature or create new one
    for (const [existingSign, id] of this.voiceSignatures) {
      const [ePitch, eCentroid] = existingSign.split("-").map(Number);
      const dist = Math.sqrt((pitch * 100 - ePitch) ** 2 + (centroid * 100 - eCentroid) ** 2);
      if (dist < 10) return id; // Match!
    }

    const newId = "actor_" + Math.random().toString(36).substr(2, 4).toUpperCase();
    this.voiceSignatures.set(signature, newId);
    return newId;
  }

  _updateInteractionType(pitch, data) {
    // If pitch rises at the end of bursts, it might be a question
    // This is very simplified logic
    if (pitch > 0.4) {
      this.currentState.type_interaction = "question";
      this.currentState.profil = "questionneur";
    } else if (this.currentState.intensite > 0.5) {
      this.currentState.type_interaction = "declaration";
      this.currentState.profil = "intervenant";
    }
  }

  flush() {
    this.currentState.timestamp = Date.now();
    this.onStateUpdate?.({ ...this.currentState });
    this.lastFlush = Date.now();

    // Reset transient fields but keep ID and Profile context
    this.currentState.themes_detectes = [];
  }
}
