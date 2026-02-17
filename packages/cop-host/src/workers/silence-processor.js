class SilenceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = 0.01; // Seuil de silence (très sensible)
    this.silenceFrames = 0;
    this.sampleRate = 48000; // Sample rate par défaut
    this.silenceDurationMs = 2000; // 2 secondes de silence avant arrêt
    this.silenceFrameThreshold = Math.floor((this.sampleRate * this.silenceDurationMs) / 1000);

    // État pour le débogage
    this.frameCount = 0;
    this.lastVolumeReport = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    const volume = Math.max(...samples.map(Math.abs));

    this.frameCount += samples.length;

    // Détection de silence
    if (volume < this.threshold) {
      this.silenceFrames += samples.length;
    } else {
      this.silenceFrames = 0;
    }

    // Envoyer le volume pour visualisation (toutes les 100ms environ)
    if (this.frameCount - this.lastVolumeReport > 4800) {
      // 100ms à 48kHz
      this.port.postMessage({
        type: "volume",
        volume: volume,
        isSilent: volume < this.threshold,
      });
      this.lastVolumeReport = this.frameCount;
    }

    // Détecter silence prolongé
    if (this.silenceFrames > this.silenceFrameThreshold) {
      this.port.postMessage({
        type: "silence_detected",
        duration: (this.silenceFrames / this.sampleRate) * 1000,
      });
      this.silenceFrames = 0; // Reset pour éviter déclenchements multiples
    }

    return true;
  }
}

registerProcessor("silence-processor", SilenceProcessor);
