/**
 * packages/brique-kudocracy/src/index.js
 * Index des composants partagés de la brique Kudocracy
 */

export {
  default as ConsultationLayout,
  PieChartSection,
  BarChartSection,
  ScoreSection,
} from "./components/consultations/KudocracyConsultationLayout";
export {
  default as ShareConsultation,
  ShareCallToAction,
  ShareButton,
} from "./components/consultations/ShareConsultation";
export {
  default as PetitionLinkSimple,
  PetitionLinkCard,
  PetitionLinks,
  PetitionUrlField,
} from "./components/common/PetitionLink";
export { default as PropositionList } from "./components/kudocracy/PropositionList";
export { default as CreateProposition } from "./components/kudocracy/CreateProposition";
export { default as DelegationManager } from "./components/kudocracy/DelegationManager";
export { default as GovernanceSettings } from "./components/kudocracy/GovernanceSettings";
export { default as PropositionCard } from "./components/kudocracy/PropositionCard";
export { default as VoteButton } from "./components/kudocracy/VoteButton";
export { default as VotingDashboard } from "./components/kudocracy/VotingDashboard";

export * from "./governance.js";
export * from "./Kudocracytasks.js";
export * from "./lib/petitions.js";
export * from "./hooks/useVoteRecommendation.js";
export * from "./constants.js";
export { createPropositionWithTags } from "@inseme/cop-host";

/**
 * Chemins vers les fichiers légaux (servis via /public/generated/kudocracy/)
 */
export const LEGAL_PATHS = {
  TERMS_OF_USE: "/generated/kudocracy/legal/terms-of-use.md",
  PRIVACY_POLICY: "/generated/kudocracy/legal/privacy-policy.md",
};
