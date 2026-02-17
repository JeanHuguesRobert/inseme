"use client";

import { Logger, AxiomJSTransport } from "@axiomhq/logging";
import { Axiom } from "@axiomhq/js";
import { createUseLogger, createWebVitalsComponent } from "@axiomhq/react";
import { getConfig } from "../config/instanceConfig.client.js";

// Check if all required Axiom config parameters are set
const axiomToken = getConfig("AXIOM_TOKEN");
const axiomOrgId = getConfig("AXIOM_ORG_ID");
const axiomDataset = getConfig("AXIOM_DATASET");

let axiomClient = null;
let logger = null;

if (axiomToken && axiomOrgId && axiomDataset) {
  // All required parameters are set, initialize Axiom
  try {
    axiomClient = new Axiom({
      token: axiomToken,
      orgId: axiomOrgId,
    });

    logger = new Logger({
      transports: [
        new AxiomJSTransport({
          axiom: axiomClient,
          dataset: axiomDataset,
        }),
      ],
    });
  } catch (error) {
    console.error("[Axiom] Failed to initialize Axiom client:", error);
    logger = null;
  }
} else if (axiomToken || axiomOrgId || axiomDataset) {
  // Partial configuration - warn the user
  const missing = [];
  if (!axiomToken) missing.push("AXIOM_TOKEN");
  if (!axiomOrgId) missing.push("AXIOM_ORG_ID");
  if (!axiomDataset) missing.push("AXIOM_DATASET");

  console.warn(
    `[Axiom] Partial configuration detected. Missing: ${missing.join(", ")}. Axiom logging disabled.`
  );
}

// Fallback logger if Axiom is not configured
if (!logger) {
  logger = new Logger({
    transports: [], // No transports - logs will be discarded
  });
}

// Create React hook and component
export const useLogger = createUseLogger(logger);
export const WebVitals = createWebVitalsComponent(logger);

// Export convenience methods for vocal logging
export const vocalLogger = {
  info: (message, data = {}) => {
    logger.info(`[VOCAL] ${message}`, {
      ...data,
      source: "vocal-system",
      category: "vocal",
    });
  },

  warn: (message, data = {}) => {
    logger.warn(`[VOCAL] ${message}`, {
      ...data,
      source: "vocal-system",
      category: "vocal",
    });
  },

  error: (message, data = {}) => {
    logger.error(`[VOCAL] ${message}`, {
      ...data,
      source: "vocal-system",
      category: "vocal",
    });
  },

  // Specific vocal events
  talkButton: (message, data = {}) => {
    logger.info(`[TalkButton] ${message}`, {
      ...data,
      source: "TalkButton",
      category: "vocal",
    });
  },

  voiceHandler: (message, data = {}) => {
    logger.info(`[useVoiceHandler] ${message}`, {
      ...data,
      source: "useVoiceHandler",
      category: "vocal",
    });
  },

  audioAnalyzer: (message, data = {}) => {
    logger.info(`[AudioAnalyzer] ${message}`, {
      ...data,
      source: "AudioAnalyzer",
      category: "vocal",
    });
  },

  gateway: (message, data = {}) => {
    logger.info(`[Gateway] ${message}`, {
      ...data,
      source: "Gateway",
      category: "vocal",
    });
  },

  transcription: (message, data = {}) => {
    logger.info(`[Transcription] ${message}`, {
      ...data,
      source: "Transcription",
      category: "vocal",
    });
  },
};
