/**
 * Audio Analysis Utilities for debugging transcription issues
 */

export class AudioAnalyzer {
  /**
   * Analyze audio blob for quality issues
   */
  static async analyzeAudioBlob(blob) {
    console.log("[AudioAnalyzer] 🔍 Starting audio analysis", {
      size: blob.size,
      type: blob.type,
      timestamp: new Date().toISOString(),
    });

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const analysis = {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
        quality: this.assessQuality(audioBuffer),
        issues: this.detectIssues(audioBuffer),
      };

      console.log("[AudioAnalyzer] 📊 Audio analysis complete:", analysis);
      return analysis;
    } catch (error) {
      console.error("[AudioAnalyzer] ❌ Audio analysis failed:", error);
      return {
        error: error.message,
        blobInfo: {
          size: blob.size,
          type: blob.type,
        },
      };
    }
  }

  /**
   * Assess overall audio quality
   */
  static assessQuality(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Calculate basic statistics
    let sum = 0;
    let sumSquares = 0;
    let maxAmplitude = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      sum += Math.abs(sample);
      sumSquares += sample * sample;
      maxAmplitude = Math.max(maxAmplitude, Math.abs(sample));

      // Count zero crossings
      if (i > 0 && channelData[i - 1] >= 0 !== channelData[i] >= 0) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sumSquares / channelData.length);
    const avgAmplitude = sum / channelData.length;
    const zeroCrossingRate = zeroCrossings / (channelData.length / sampleRate);

    // Quality assessment
    let quality = "unknown";
    let issues = [];

    if (maxAmplitude < 0.01) {
      quality = "very_low";
      issues.push("Audio signal is very quiet - may be too soft for transcription");
    } else if (maxAmplitude < 0.1) {
      quality = "low";
      issues.push("Audio signal is quiet - may affect transcription accuracy");
    } else if (maxAmplitude > 0.95) {
      quality = "clipping";
      issues.push("Audio may be clipping - distorted sound");
    } else {
      quality = "good";
    }

    if (zeroCrossingRate < 100) {
      quality = quality === "good" ? "low_frequency" : quality;
      issues.push("Very low frequency content - may indicate poor microphone quality");
    }

    return {
      quality,
      rms,
      maxAmplitude,
      avgAmplitude,
      zeroCrossingRate,
      issues,
    };
  }

  /**
   * Detect specific audio issues
   */
  static detectIssues(audioBuffer) {
    const issues = [];
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Check for silence
    let silentSamples = 0;
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) < 0.001) {
        silentSamples++;
      }
    }
    const silencePercentage = (silentSamples / channelData.length) * 100;

    if (silencePercentage > 90) {
      issues.push({
        type: "mostly_silent",
        severity: "high",
        message: `${Math.round(silencePercentage)}% of audio is silent`,
        recommendation: "Check microphone permissions and volume",
      });
    } else if (silencePercentage > 50) {
      issues.push({
        type: "partially_silent",
        severity: "medium",
        message: `${Math.round(silencePercentage)}% of audio is silent`,
        recommendation: "Speak closer to microphone or increase volume",
      });
    }

    // Check duration
    if (duration < 0.5) {
      issues.push({
        type: "too_short",
        severity: "high",
        message: `Audio is only ${duration.toFixed(2)}s long`,
        recommendation: "Record for at least 1-2 seconds for better transcription",
      });
    }

    // Check for potential noise
    let noiseLevel = 0;
    let speechLevel = 0;
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows

    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      let windowSum = 0;
      for (let j = 0; j < windowSize; j++) {
        windowSum += Math.abs(channelData[i + j]);
      }
      const windowAvg = windowSum / windowSize;

      if (windowAvg > 0.01) {
        speechLevel = Math.max(speechLevel, windowAvg);
      } else {
        noiseLevel = Math.max(noiseLevel, windowAvg);
      }
    }

    if (noiseLevel > speechLevel * 0.5) {
      issues.push({
        type: "high_noise",
        severity: "medium",
        message: "High background noise detected",
        recommendation: "Reduce background noise or use noise cancellation",
      });
    }

    return issues;
  }

  /**
   * Create a visual representation of the audio waveform
   */
  static generateWaveform(audioBuffer, width = 200, height = 50) {
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const waveform = [];

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      waveform.push({ min, max });
    }

    return waveform;
  }

  /**
   * Check if audio might cause "you" transcription issue
   */
  static checkForYouIssue(audioBuffer) {
    const issues = [];
    const channelData = audioBuffer.getChannelData(0);

    // Check for very short duration (common cause of "you")
    if (audioBuffer.duration < 1.0) {
      issues.push({
        type: "duration_too_short",
        severity: "high",
        message: `Duration: ${audioBuffer.duration.toFixed(2)}s - very short audio often transcribes to "you"`,
        recommendation: "Record for at least 2-3 seconds",
      });
    }

    // Check for very low amplitude
    let maxAmplitude = 0;
    for (let i = 0; i < channelData.length; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[i]));
    }

    if (maxAmplitude < 0.05) {
      issues.push({
        type: "amplitude_too_low",
        severity: "high",
        message: `Max amplitude: ${maxAmplitude.toFixed(3)} - very quiet audio often transcribes to "you"`,
        recommendation: "Speak louder or closer to microphone",
      });
    }

    // Check for mostly silent audio
    let silentSamples = 0;
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) < 0.01) {
        silentSamples++;
      }
    }

    const silencePercentage = (silentSamples / channelData.length) * 100;
    if (silencePercentage > 80) {
      issues.push({
        type: "mostly_silent",
        severity: "high",
        message: `${Math.round(silencePercentage)}% silence - likely to transcribe to "you"`,
        recommendation: "Ensure you are speaking clearly into the microphone",
      });
    }

    return issues;
  }
}
