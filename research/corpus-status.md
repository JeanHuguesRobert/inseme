---
title: "Corpus Status — inseme"
description:
  "Current state of the inseme knowledge corpus — what is proved, what is open, what remains
  possible"
layout: default
nav_order: 2
last_modified_at: 2026-06-08
canonical_url: https://github.com/JeanHuguesRobert/inseme/blob/main/research/corpus-status.md
last_stamped_at: 2026-06-01
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: 2026-05-27
creator: Jean Hugues Noël Robert, baron Mariani (généré automatiquement par les outils du corpus)
---

# Corpus Status — inseme

_Auto-refreshed by `cogentia.js corpus-status`. The structural sections_ — _Registered Repositories,
Cross-Reference Graph, Published, What Remains Possible_ — _are regenerated from the registry and
from [`research/index.md`](index.md) on every run._ _The substantive sections_ — _What Is Proved_
_and_ _Open Objections_ — _are manually curated and preserved across refreshes._

---

## Registered Repositories
<!-- BEGIN_AUTO: registered_repos -->
| Repository | research/index.md | Branch | Policy | Visibility | Public presence |
|---|---|---|---|---|---|
| cogentia | yes | main | all | public | full |
| FractaVolta | yes | main | all | public | full |
| marenostrum | yes | main | all | public | full |
| barons-Mariani | yes | main | all | public | full |
| inseme | yes | main | research | public | full |
| survey | yes | main | all | public | full |
| Inox | yes | master | all | public | full |
| registre-mariani | yes | main | all | private | stub |
| ubikia | yes | main | all | public | full |
| operium | yes | main | all | public | full |
| serra | yes | main | all | public | full |
| JeanHuguesRobert | yes | main | all | public | full |
| privai | yes | main | all | public | full |
| gouvernance | yes | main | all | public | full |
| marianivillage | yes | main | all | public | full |
| institut-mariani | yes | main | all | public | full |
| Kudos | yes | main | all | public | full |
| .github | yes | main | all | public | full |
| acorsica.org | yes | main | all | public | full |
| StructEnv | no | main | all | public | full |
<!-- END_AUTO: registered_repos -->
## Cross-Reference Graph
<!-- BEGIN_AUTO: graph -->
```mermaid
graph LR
  r_cogentia["cogentia"]
  r_fractavolta["FractaVolta"]
  r_marenostrum["marenostrum"]
  r_barons_mariani["barons-Mariani"]
  r_inseme["inseme"]
  r_survey["survey"]
  r_inox["Inox"]
  r_registre_mariani["registre-mariani"]
  r_ubikia["ubikia"]
  r_operium["operium"]
  r_serra["serra"]
  r_jeanhuguesrobert["JeanHuguesRobert"]
  r_privai["privai"]
  r_gouvernance["gouvernance"]
  r_marianivillage["marianivillage"]
  r_institut_mariani["institut-mariani"]
  r_kudos["Kudos"]
  r_github[".github"]
  r_acorsica_org["acorsica.org"]
  r_structenv["StructEnv"]
  r_cogentia -->|110| r_barons_mariani
  r_barons_mariani -->|71| r_cogentia
  r_jeanhuguesrobert -->|68| r_barons_mariani
  r_fractavolta -->|52| r_cogentia
  r_inseme -->|40| r_cogentia
  r_fractavolta -->|37| r_marenostrum
  r_jeanhuguesrobert -->|37| r_cogentia
  r_cogentia -->|30| r_inseme
  r_barons_mariani -->|22| r_marenostrum
  r_fractavolta -->|22| r_inseme
  r_inseme -->|20| r_barons_mariani
  r_barons_mariani -->|19| r_fractavolta
  r_cogentia -->|19| r_marenostrum
  r_fractavolta -->|19| r_barons_mariani
  r_barons_mariani -->|18| r_inseme
  r_inox -->|16| r_cogentia
  r_jeanhuguesrobert -->|16| r_marenostrum
  r_marenostrum -->|16| r_cogentia
  r_inseme -->|12| r_fractavolta
  r_inseme -->|12| r_inox
  r_marenostrum -->|12| r_fractavolta
  r_inox -->|11| r_barons_mariani
  r_marenostrum -->|11| r_barons_mariani
  r_inox -->|10| r_fractavolta
  r_inox -->|9| r_inseme
  r_jeanhuguesrobert -->|9| r_fractavolta
  r_fractavolta -->|8| r_inox
  r_inox -->|8| r_marenostrum
  r_cogentia -->|7| r_jeanhuguesrobert
  r_inseme -->|7| r_jeanhuguesrobert
  r_jeanhuguesrobert -->|7| r_inseme
  r_inseme -->|6| r_kudos
  r_jeanhuguesrobert -->|6| r_inox
  r_ubikia -->|6| r_cogentia
  r_barons_mariani -->|5| r_inox
  r_barons_mariani -->|5| r_jeanhuguesrobert
  r_cogentia -->|5| r_fractavolta
  r_operium -->|5| r_cogentia
  r_barons_mariani -->|4| r_ubikia
  r_fractavolta -->|4| r_jeanhuguesrobert
  r_marianivillage -->|4| r_fractavolta
  r_operium -->|4| r_marenostrum
  r_ubikia -->|4| r_jeanhuguesrobert
  r_github -->|3| r_gouvernance
  r_cogentia -->|3| r_operium
  r_jeanhuguesrobert -->|3| r_ubikia
  r_kudos -->|3| r_barons_mariani
  r_operium -->|3| r_barons_mariani
  r_operium -->|3| r_inseme
  r_cogentia -->|2| r_inox
  r_gouvernance -->|2| r_barons_mariani
  r_gouvernance -->|2| r_fractavolta
  r_inox -->|2| r_jeanhuguesrobert
  r_inseme -->|2| r_marenostrum
  r_institut_mariani -->|2| r_barons_mariani
  r_institut_mariani -->|2| r_fractavolta
  r_marenostrum -->|2| r_jeanhuguesrobert
  r_marenostrum -->|2| r_inseme
  r_marenostrum -->|2| r_inox
  r_github -->|1| r_institut_mariani
  r_cogentia -->|1| r_kudos
  r_gouvernance -->|1| r_jeanhuguesrobert
  r_gouvernance -->|1| r_cogentia
  r_gouvernance -->|1| r_inseme
  r_gouvernance -->|1| r_marenostrum
  r_gouvernance -->|1| r_inox
  r_gouvernance -->|1| r_kudos
  r_gouvernance -->|1| r_marianivillage
  r_inseme -->|1| r_operium
  r_inseme -->|1| r_privai
  r_inseme -->|1| r_ubikia
  r_institut_mariani -->|1| r_privai
  r_institut_mariani -->|1| r_kudos
  r_institut_mariani -->|1| r_marianivillage
  r_institut_mariani -->|1| r_inseme
  r_institut_mariani -->|1| r_cogentia
  r_institut_mariani -->|1| r_marenostrum
  r_institut_mariani -->|1| r_inox
  r_jeanhuguesrobert -->|1| r_operium
  r_kudos -->|1| r_institut_mariani
  r_marianivillage -->|1| r_institut_mariani
  r_privai -->|1| r_barons_mariani
  r_privai -->|1| r_institut_mariani
```
<!-- END_AUTO: graph -->
## Concepts
<!-- BEGIN_AUTO: concepts -->
| Concept | Scope | Status | Type |
|---|---|---|---|
| [Cogentia](./concepts.md#cogentia) | - | - | abstract concept / agentivity class **Scope:** Global **Status:** Working |
| [Cogentigram](./concepts.md#cogentigram) | - | - | representation / map **Scope:** Global **Status:** Working |
| [COP (Continuous Operation Protocol)](./concepts.md#cop-continuous-operation-protocol) | - | - | protocol / runtime **Scope:** Global **Status:** Canonical |
| [Briques](./concepts.md#briques) | - | - | modular component **Scope:** Global **Status:** Operational |
| [Kudocracy](./concepts.md#kudocracy) | - | - | governance system **Scope:** Global **Status:** Defined |
| [Agora](./concepts.md#agora) | - | - | system model **Scope:** Global **Status:** Defined |
| [Ophélia](./concepts.md#ophelia) | - | - | agent **Scope:** Global **Status:** Operational |
| [COP Invariants](./concepts.md#cop-invariants) | - | - | protocol constraints / architectural invariants **Scope:** Global **Status:** Canonical |
| [Non-deterministic Cognitive Step (Agentic Step)](./concepts.md#non-deterministic-cognitive-step-agentic-step) | - | - | process concept **Scope:** Global **Status:** Working |
| [Human Enacted Decision Artifact](./concepts.md#human-enacted-decision-artifact) | - | - | artifact type / imputability anchor **Scope:** Global **Status:** Working |
| [Causal Trace Replay (Auditable Causal Reconstruction)](./concepts.md#causal-trace-replay-auditable-causal-reconstruction) | - | - | audit / replay mechanism **Scope:** Global **Status:** Working |
| [COP (Cognitive Orchestration Protocol)](./concepts.md#cop-cognitive-orchestration-protocol) | - | - | protocol / runtime **Scope:** Global **Status:** Canonical |
| [Brique Spec / Multi-Instance](./concepts.md#brique-spec-multi-instance) | - | - | technical specification **Scope:** project-specific **Status:** Defined |
| [Modular System](./concepts.md#modular-system) | - | - | frontend architecture **Scope:** repository-specific **Status:** Working |
<!-- END_AUTO: concepts -->
## Concept Graph
<!-- BEGIN_AUTO: concept_graph -->
```mermaid
graph LR
  c_civilizational_stakes["Civilizational Stakes"]
  c_machine_a_explorer["Machine à explorer"]
  c_machine_a_empecher["Machine à empêcher"]
  c_effet_ubik["Effet Ubik"]
  c_stabilisateurs_anti_ubik_proceduraux["Stabilisateurs (anti-Ubik / procéduraux)"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_continuation_protocol["Continuation Protocol"]
  c_non_deterministic_cognitive_step_agentic_step["Non-deterministic Cognitive Step (Agentic Step)"]
  c_human_enacted_decision_artifact["Human Enacted Decision Artifact"]
  c_causal_trace_replay_auditable_causal_reconstruction["Causal Trace Replay (Auditable Causal Reconstruction)"]
  c_cognitive_packet["Cognitive Packet"]
  c_cogentia_commons["Cogentia Commons"]
  c_cogentia_pipeline["Cogentia Pipeline"]
  c_derived_product["Derived Product"]
  c_sovereign_digital_twin["Sovereign Digital Twin"]
  c_agent_resumable_cli["Agent-Resumable CLI"]
  c_kernel_extractor["Kernel Extractor"]
  c_kys_know_your_self_psychocognitive_analysis["KYS (Know Your Self) / Psychocognitive Analysis"]
  c_cogentia_workflows["Cogentia Workflows"]
  c_packet_capsule["Packet Capsule"]
  c_human_routed_handoff["Human-Routed Handoff"]
  c_recursive_reality_test["Recursive Reality Test"]
  c_eventual_reconciliation["Eventual Reconciliation"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_ipn_inference_packet_network["IPN (Inference Packet Network)"]
  c_epn_energy_packet_network["EPN (Energy Packet Network)"]
  c_pgn_power_generation_node["PGN (Power Generation Node)"]
  c_packet_attractors_fractanet_routing["Packet Attractors (Fractanet routing)"]
  c_packet_as_evolutionary_attractor["Packet as evolutionary attractor"]
  c_the_unconscious_grid["The Unconscious Grid"]
  c_mariani_village["Mariani Village"]
  c_value_shaped_solar["Value-Shaped Solar"]
  c_containerized_compute_tera["Containerized Compute (Tera)"]
  c_traceable_governance["Traceable Governance"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_dhitl_democratic_human_in_the_loop["DHITL (Democratic Human In The Loop)"]
  c_cxu_compute_and_exergy_unit["CXU (Compute and Exergy Unit)"]
  c_safe_compute_exergy["Safe Compute Exergy"]
  c_constellia["Constellia"]
  c_corsica_forest_synergies["Corsica Forest Synergies"]
  c_infrastructure_is_all_you_need["Infrastructure is All You Need"]
  c_sun_to_sovereignty["Sun to Sovereignty"]
  c_civilizational_stakes["Civilizational Stakes"]
  c_machine_a_explorer["Machine à explorer"]
  c_machine_a_empecher["Machine à empêcher"]
  c_effet_ubik["Effet Ubik"]
  c_stabilisateurs_anti_ubik_proceduraux["Stabilisateurs (anti-Ubik / procéduraux)"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_potentics["Potentics"]
  c_the_possible["The Possible"]
  c_the_realized["The Realized"]
  c_spirit_of_synthesis["Spirit of Synthesis"]
  c_presencology["Presencology"]
  c_presence["Presence"]
  c_presence_map["Presence Map"]
  c_latent_functional_map["Latent Functional Map"]
  c_projection_of_the_possible["Projection of The Possible"]
  c_cognitive_waves["Cognitive Waves"]
  c_mimetic_desynchronization["Mimetic Desynchronization"]
  c_invidia["Invidia"]
  c_transition_markets["Transition Markets"]
  c_the_uchronian_museum["The Uchronian Museum"]
  c_possibilism["Possibilism"]
  c_applied_possibilism["Applied Possibilism"]
  c_territoires_possibilistes["Territoires Possibilistes"]
  c_autonomie_de_capacite["Autonomie de capacité"]
  c_kudocracy["Kudocracy"]
  c_kudos["Kudos"]
  c_pathologie_du_secret["Pathologie du secret"]
  c_the_second_method["The Second Method"]
  c_projet_minesteggio["Projet Minesteggio"]
  c_discret_holography["Discret Holography"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_cop_continuous_operation_protocol["COP (Continuous Operation Protocol)"]
  c_briques["Briques"]
  c_kudocracy["Kudocracy"]
  c_agora["Agora"]
  c_ophelia["Ophélia"]
  c_cop_invariants["COP Invariants"]
  c_non_deterministic_cognitive_step_agentic_step["Non-deterministic Cognitive Step (Agentic Step)"]
  c_human_enacted_decision_artifact["Human Enacted Decision Artifact"]
  c_causal_trace_replay_auditable_causal_reconstruction["Causal Trace Replay (Auditable Causal Reconstruction)"]
  c_cop_cognitive_orchestration_protocol["COP (Cognitive Orchestration Protocol)"]
  c_brique_spec_multi_instance["Brique Spec / Multi-Instance"]
  c_modular_system["Modular System"]
  c_concatenative_language["Concatenative language"]
  c_stack_vm["Stack VM"]
  c_control_data_plane_separation["Control/data plane separation"]
  c_named_values["Named values"]
  c_reactive_sets["Reactive sets"]
  c_actors["Actors"]
  c_dialects["Dialects"]
  c_fractanet["Fractanet"]
  c_cogentia["Cogentia"]
  c_cogentigram["Cogentigram"]
  c_possibilism --> c_machine_a_explorer
  c_democratic_ai_safety --> c_machine_a_explorer
  c_machine_a_explorer --> c_cogentia_commons_declinaison_manuelle
  c_machine_a_explorer --> c_fractanet_cop_declinaison_automatisee
  c_machine_a_explorer --> c_stabilisateurs_anti_ubik
  c_machine_a_explorer -.-> c_continuation_protocol
  c_machine_a_explorer -.-> c_cognitive_packet
  c_machine_a_explorer -.-> c_dhitl_couches_4_5
  c_machine_a_explorer -.-> c_effet_ubik_oppose
  c_machine_a_empecher -.-> c_effet_ubik
  c_machine_a_empecher -.-> c_machine_a_explorer_oppose_symetrique
  c_machine_a_empecher -.-> c_fm_11_outer_optimizer_capture
  c_machine_a_empecher -.-> c_concentration_de_compute_85_frontier
  c_machine_a_empecher --> c_effet_ubik
  c_effet_ubik -.-> c_stabilisateurs_anti_ubik
  c_effet_ubik -.-> c_pathologie_du_secret
  c_effet_ubik -.-> c_invidia_densite_sociale_destructrice
  c_machine_a_explorer --> c_stabilisateurs_anti_ubik_proceduraux
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_effet_ubik
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_continuation_protocol
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_cognitive_packet
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_dhitl_compute_exergy_comme_unite_tracable
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  c_agent_resumable_cli --> c_continuation_protocol
  c_machine_a_explorer --> c_continuation_protocol
  c_continuation_protocol -.-> c_non_deterministic_cognitive_step
  c_continuation_protocol -.-> c_human_enacted_decision_artifact
  c_continuation_protocol -.-> c_causal_trace_replay
  c_machine_a_explorer --> c_non_deterministic_cognitive_step_agentic_step
  c_non_deterministic_cognitive_step_agentic_step -.-> c_human_enacted_decision_artifact
  c_non_deterministic_cognitive_step_agentic_step -.-> c_causal_trace_replay
  c_non_deterministic_cognitive_step_agentic_step -.-> c_continuation_protocol
  c_machine_a_explorer --> c_human_enacted_decision_artifact
  c_cop_hitl_profile --> c_human_enacted_decision_artifact
  c_human_enacted_decision_artifact -.-> c_non_deterministic_cognitive_step
  c_human_enacted_decision_artifact -.-> c_rule_0_seconde_methode
  c_human_enacted_decision_artifact -.-> c_dhitl_layer_5
  c_human_enacted_decision_artifact -.-> c_engagement_levels_e3_e4
  c_cop_invariants --> c_causal_trace_replay_auditable_causal_reconstruction
  c_machine_a_explorer --> c_causal_trace_replay_auditable_causal_reconstruction
  c_causal_trace_replay_auditable_causal_reconstruction -.-> c_continuation_protocol
  c_causal_trace_replay_auditable_causal_reconstruction -.-> c_non_deterministic_cognitive_step
  c_continuation_protocol --> c_cognitive_packet
  c_agent_resumable_cli --> c_cognitive_packet
  c_cognitive_packet --> c_envelope_kind_agnostic_metadata_layer
  c_cognitive_packet --> c_payload_kind_specific_content_layer
  c_cognitive_packet --> c_continuation_payload
  c_cognitive_packet --> c_objection_payload
  c_cognitive_packet --> c_hypothesis_payload
  c_cognitive_packet --> c_decision_payload
  c_cognitive_packet --> c_failure_payload
  c_cognitive_packet --> c_routing_payload
  c_cognitive_packet -.-> c_cogentia_commons
  c_cogentia_commons --> c_cogentia_pipeline
  c_cognitive_packet --> c_cogentia_pipeline
  c_cogentia_pipeline --> c_source_document
  c_cogentia_pipeline --> c_derived_product
  c_cogentia_pipeline --> c_derived_product
  c_derived_product -.-> c_source_document
  c_traceable_agency --> c_cogentia
  c_cogentia --> c_cogentigram
  c_cogentia --> c_operational_memory
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  c_traceable_agency --> c_cogentia
  c_cogentia --> c_cogentigram
  c_cogentia --> c_operational_memory
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  c_dhitl --> c_infrastructure_is_all_you_need
  c_possibilism --> c_machine_a_explorer
  c_democratic_ai_safety --> c_machine_a_explorer
  c_machine_a_explorer --> c_cogentia_commons_declinaison_manuelle
  c_machine_a_explorer --> c_fractanet_cop_declinaison_automatisee
  c_machine_a_explorer --> c_stabilisateurs_anti_ubik
  c_machine_a_explorer -.-> c_continuation_protocol
  c_machine_a_explorer -.-> c_cognitive_packet
  c_machine_a_explorer -.-> c_dhitl_couches_4_5
  c_machine_a_explorer -.-> c_effet_ubik_oppose
  c_machine_a_empecher -.-> c_effet_ubik
  c_machine_a_empecher -.-> c_machine_a_explorer_oppose_symetrique
  c_machine_a_empecher -.-> c_fm_11_outer_optimizer_capture
  c_machine_a_empecher -.-> c_concentration_de_compute_85_frontier
  c_machine_a_empecher --> c_effet_ubik
  c_effet_ubik -.-> c_stabilisateurs_anti_ubik
  c_effet_ubik -.-> c_pathologie_du_secret
  c_effet_ubik -.-> c_invidia_densite_sociale_destructrice
  c_machine_a_explorer --> c_stabilisateurs_anti_ubik_proceduraux
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_effet_ubik
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_continuation_protocol
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_cognitive_packet
  c_stabilisateurs_anti_ubik_proceduraux -.-> c_dhitl_compute_exergy_comme_unite_tracable
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  c_potentics -.-> c_presencology
  c_potentics -.-> c_the_possible
  c_potentics -.-> c_rational_odyssey
  c_potentics -.-> c_rational_exploration_of_the_possible
  c_potentics -.-> c_potentiality_map
  c_the_possible -.-> c_potentics
  c_the_possible -.-> c_the_realized
  c_the_possible -.-> c_spirit_of_synthesis
  c_the_possible -.-> c_projection_of_the_possible
  c_the_possible -.-> c_presencology
  c_the_realized -.-> c_the_possible
  c_the_realized -.-> c_potentics
  c_the_realized -.-> c_spirit_of_synthesis
  c_spirit_of_synthesis -.-> c_the_possible
  c_spirit_of_synthesis -.-> c_the_realized
  c_spirit_of_synthesis -.-> c_potentics
  c_spirit_of_synthesis -.-> c_rational_exploration_of_the_possible
  c_presence_map -.-> c_potentiality_map
  c_presence_map -.-> c_projection_of_the_possible
  c_presence_map -.-> c_latent_functional_map
  c_presence_map -.-> c_explicit_supermap
  c_latent_functional_map -.-> c_presence_map
  c_latent_functional_map -.-> c_rich_stigmergy
  c_latent_functional_map -.-> c_flotilla_architecture
  c_latent_functional_map -.-> c_cartographer
  c_latent_functional_map -.-> c_explicit_supermap
  c_possibilism_academic_framework --> c_applied_possibilism
  c_cop_stigmergic_orchestration --> c_applied_possibilism
  c_dhitl_democratic_human_in_the_loop --> c_applied_possibilism
  c_applied_possibilism --> c_digital_twins_as_cognitive_liberation
  c_applied_possibilism --> c_attractor_based_exploration
  c_applied_possibilism --> c_stateless_agents_for_scalable_exploration
  c_applied_possibilism --> c_joy_as_method_against_grim_optimization
  c_applied_possibilism -.-> c_musee_mariani_des_possibles_museological_application
  c_applied_possibilism -.-> c_applied_possibilism_in_agile_style
  c_applied_possibilism -.-> c_continuations_as_resumable_exploration
  c_possibilism --> c_autonomie_de_capacite
  c_capabilities_approach_sen_nussbaum --> c_autonomie_de_capacite
  c_autonomie_de_capacite --> c_specificite_de_phase
  c_autonomie_de_capacite --> c_flexibilite_d_usage_redistributive_vs_predatory
  c_autonomie_de_capacite -.-> c_territoires_possibilistes
  c_autonomie_de_capacite -.-> c_auto_institution_democratique_castoriadis
  c_possibilism --> c_kudocracy
  c_auto_institution_democratique_castoriadis --> c_kudocracy
  c_kudocracy -.-> c_autonomie_de_capacite
  c_kudocracy -.-> c_kudos
  c_kudocracy -.-> c_pathologie_du_secret
  c_kudocracy -.-> c_cognitive_packet
  c_possibilism --> c_kudos
  c_communs_ostrom --> c_kudos
  c_kudos -.-> c_kudocracy
  c_kudos -.-> c_autonomie_de_capacite
  c_kudos -.-> c_mauss_gift_counter_gift
  c_democratic_ai_safety_thesis_kernel --> c_pathologie_du_secret
  c_the_second_method --> c_pathologie_du_secret
  c_pathologie_du_secret -.-> c_dhitl_democratic_humans_in_the_loop
  c_pathologie_du_secret -.-> c_cogentia_commons_auditable_knowledge
  c_pathologie_du_secret -.-> c_tracabilite_civique_anti_mafieuse
  c_possibilism --> c_projet_minesteggio
  c_machine_a_explorer --> c_projet_minesteggio
  c_autonomie_de_capacite --> c_projet_minesteggio
  c_the_uchronian_museum --> c_projet_minesteggio
  c_projet_minesteggio --> c_museologie_capacitaire
  c_projet_minesteggio --> c_indice_de_friction_administrative
  c_projet_minesteggio --> c_indice_de_capacite_retrouvee
  c_projet_minesteggio --> c_grille_de_remise_en_service
  c_projet_minesteggio -.-> c_machine_a_empecher
  c_projet_minesteggio -.-> c_stabilisateurs_anti_ubik_proceduraux
  c_projet_minesteggio -.-> c_projet_minesteggio
  c_projet_minesteggio -.-> c_the_second_method
  c_projet_minesteggio -.-> c_kudos
  c_traceable_agency --> c_cogentia
  c_cogentia --> c_cogentigram
  c_cogentia --> c_operational_memory
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  c_machine_a_explorer --> c_cop_invariants
  c_stabilisateurs_anti_ubik_proceduraux --> c_cop_invariants
  c_machine_a_explorer --> c_non_deterministic_cognitive_step_agentic_step
  c_non_deterministic_cognitive_step_agentic_step -.-> c_human_enacted_decision_artifact
  c_non_deterministic_cognitive_step_agentic_step -.-> c_causal_trace_replay
  c_machine_a_explorer --> c_human_enacted_decision_artifact
  c_cop_hitl_profile --> c_human_enacted_decision_artifact
  c_human_enacted_decision_artifact -.-> c_non_deterministic_cognitive_step
  c_human_enacted_decision_artifact -.-> c_rule_0_seconde_methode
  c_human_enacted_decision_artifact -.-> c_dhitl_layer_5
  c_cop_invariants --> c_causal_trace_replay_auditable_causal_reconstruction
  c_machine_a_explorer --> c_causal_trace_replay_auditable_causal_reconstruction
  c_causal_trace_replay_auditable_causal_reconstruction -.-> c_deterministic_replay_protocol_layer_only
  c_causal_trace_replay_auditable_causal_reconstruction -.-> c_non_deterministic_cognitive_step
  c_concatenative_language -.-> c_stack_vm
  c_concatenative_language -.-> c_named_values
  c_stack_vm -.-> c_concatenative_language
  c_stack_vm -.-> c_control_data_plane_separation
  c_stack_vm -.-> c_named_values
  c_stack_vm --> c_control_data_plane_separation
  c_control_data_plane_separation -.-> c_energy_packet_network_fractavolta
  c_control_data_plane_separation -.-> c_cognitive_packet_envelope_payload_cogentia
  c_stack_vm --> c_named_values
  c_fractanet -.-> c_energy_packet_network_fractavolta
  c_fractanet -.-> c_auxilia_inseme_brique_human_scale_fractanet_exchange
  c_fractanet -.-> c_actors
  c_traceable_agency --> c_cogentia
  c_cogentia --> c_cogentigram
  c_cogentia --> c_operational_memory
  c_cogentia --> c_cogentigram
  c_cogentigram -.-> c_map_vs_territory
  c_cogentigram -.-> c_operational_memory
  c_cogentigram -.-> c_traceable_agency
  click c_civilizational_stakes "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#civilizational-stakes" "Open Civilizational Stakes"
  click c_machine_a_explorer "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#machine-a-explorer" "Open Machine à explorer"
  click c_machine_a_empecher "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#machine-a-empecher" "Open Machine à empêcher"
  click c_effet_ubik "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#effet-ubik" "Open Effet Ubik"
  click c_stabilisateurs_anti_ubik_proceduraux "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#stabilisateurs-anti-ubik-proceduraux" "Open Stabilisateurs (anti-Ubik / procéduraux)"
  click c_cogentia "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
  click c_continuation_protocol "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#continuation-protocol" "Open Continuation Protocol"
  click c_non_deterministic_cognitive_step_agentic_step "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#non-deterministic-cognitive-step-agentic-step" "Open Non-deterministic Cognitive Step (Agentic Step)"
  click c_human_enacted_decision_artifact "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#human-enacted-decision-artifact" "Open Human Enacted Decision Artifact"
  click c_causal_trace_replay_auditable_causal_reconstruction "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#causal-trace-replay-auditable-causal-reconstruction" "Open Causal Trace Replay (Auditable Causal Reconstruction)"
  click c_cognitive_packet "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cognitive-packet" "Open Cognitive Packet"
  click c_cogentia_commons "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cogentia-commons" "Open Cogentia Commons"
  click c_cogentia_pipeline "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cogentia-pipeline" "Open Cogentia Pipeline"
  click c_derived_product "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#derived-product" "Open Derived Product"
  click c_sovereign_digital_twin "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#sovereign-digital-twin" "Open Sovereign Digital Twin"
  click c_agent_resumable_cli "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#agent-resumable-cli" "Open Agent-Resumable CLI"
  click c_kernel_extractor "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#kernel-extractor" "Open Kernel Extractor"
  click c_kys_know_your_self_psychocognitive_analysis "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#kys-know-your-self-psychocognitive-analysis" "Open KYS (Know Your Self) / Psychocognitive Analysis"
  click c_cogentia_workflows "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#cogentia-workflows" "Open Cogentia Workflows"
  click c_packet_capsule "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#packet-capsule" "Open Packet Capsule"
  click c_human_routed_handoff "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#human-routed-handoff" "Open Human-Routed Handoff"
  click c_recursive_reality_test "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#recursive-reality-test" "Open Recursive Reality Test"
  click c_eventual_reconciliation "https://github.com/JeanHuguesRobert/cogentia/blob/main/research/concepts.md#eventual-reconciliation" "Open Eventual Reconciliation"
  click c_cogentia "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
  click c_ipn_inference_packet_network "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#ipn-inference-packet-network" "Open IPN (Inference Packet Network)"
  click c_epn_energy_packet_network "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#epn-energy-packet-network" "Open EPN (Energy Packet Network)"
  click c_pgn_power_generation_node "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#pgn-power-generation-node" "Open PGN (Power Generation Node)"
  click c_packet_attractors_fractanet_routing "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#packet-attractors-fractanet-routing" "Open Packet Attractors (Fractanet routing)"
  click c_packet_as_evolutionary_attractor "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#packet-as-evolutionary-attractor" "Open Packet as evolutionary attractor"
  click c_the_unconscious_grid "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#the-unconscious-grid" "Open The Unconscious Grid"
  click c_mariani_village "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#mariani-village" "Open Mariani Village"
  click c_value_shaped_solar "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#value-shaped-solar" "Open Value-Shaped Solar"
  click c_containerized_compute_tera "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#containerized-compute-tera" "Open Containerized Compute (Tera)"
  click c_traceable_governance "https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/concepts.md#traceable-governance" "Open Traceable Governance"
  click c_cogentia "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
  click c_dhitl_democratic_human_in_the_loop "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#dhitl-democratic-human-in-the-loop" "Open DHITL (Democratic Human In The Loop)"
  click c_cxu_compute_and_exergy_unit "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#cxu-compute-and-exergy-unit" "Open CXU (Compute and Exergy Unit)"
  click c_safe_compute_exergy "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#safe-compute-exergy" "Open Safe Compute Exergy"
  click c_constellia "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#constellia" "Open Constellia"
  click c_corsica_forest_synergies "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#corsica-forest-synergies" "Open Corsica Forest Synergies"
  click c_infrastructure_is_all_you_need "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#infrastructure-is-all-you-need" "Open Infrastructure is All You Need"
  click c_sun_to_sovereignty "https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/concepts.md#sun-to-sovereignty" "Open Sun to Sovereignty"
  click c_civilizational_stakes "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#civilizational-stakes" "Open Civilizational Stakes"
  click c_machine_a_explorer "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#machine-a-explorer" "Open Machine à explorer"
  click c_machine_a_empecher "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#machine-a-empecher" "Open Machine à empêcher"
  click c_effet_ubik "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#effet-ubik" "Open Effet Ubik"
  click c_stabilisateurs_anti_ubik_proceduraux "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#stabilisateurs-anti-ubik-proceduraux" "Open Stabilisateurs (anti-Ubik / procéduraux)"
  click c_cogentia "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
  click c_potentics "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#potentics" "Open Potentics"
  click c_the_possible "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#the-possible" "Open The Possible"
  click c_the_realized "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#the-realized" "Open The Realized"
  click c_spirit_of_synthesis "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#spirit-of-synthesis" "Open Spirit of Synthesis"
  click c_presencology "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#presencology" "Open Presencology"
  click c_presence "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#presence" "Open Presence"
  click c_presence_map "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#presence-map" "Open Presence Map"
  click c_latent_functional_map "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#latent-functional-map" "Open Latent Functional Map"
  click c_projection_of_the_possible "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#projection-of-the-possible" "Open Projection of The Possible"
  click c_cognitive_waves "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#cognitive-waves" "Open Cognitive Waves"
  click c_mimetic_desynchronization "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#mimetic-desynchronization" "Open Mimetic Desynchronization"
  click c_invidia "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#invidia" "Open Invidia"
  click c_transition_markets "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#transition-markets" "Open Transition Markets"
  click c_the_uchronian_museum "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#the-uchronian-museum" "Open The Uchronian Museum"
  click c_possibilism "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#possibilism" "Open Possibilism"
  click c_applied_possibilism "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#applied-possibilism" "Open Applied Possibilism"
  click c_territoires_possibilistes "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#territoires-possibilistes" "Open Territoires Possibilistes"
  click c_autonomie_de_capacite "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#autonomie-de-capacite" "Open Autonomie de capacité"
  click c_kudocracy "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#kudocracy" "Open Kudocracy"
  click c_kudos "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#kudos" "Open Kudos"
  click c_pathologie_du_secret "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#pathologie-du-secret" "Open Pathologie du secret"
  click c_the_second_method "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#the-second-method" "Open The Second Method"
  click c_projet_minesteggio "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#projet-minesteggio" "Open Projet Minesteggio"
  click c_discret_holography "https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/concepts.md#discret-holography" "Open Discret Holography"
  click c_cogentia "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
  click c_cop_continuous_operation_protocol "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#cop-continuous-operation-protocol" "Open COP (Continuous Operation Protocol)"
  click c_briques "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#briques" "Open Briques"
  click c_kudocracy "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#kudocracy" "Open Kudocracy"
  click c_agora "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#agora" "Open Agora"
  click c_ophelia "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#ophelia" "Open Ophélia"
  click c_cop_invariants "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#cop-invariants" "Open COP Invariants"
  click c_non_deterministic_cognitive_step_agentic_step "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#non-deterministic-cognitive-step-agentic-step" "Open Non-deterministic Cognitive Step (Agentic Step)"
  click c_human_enacted_decision_artifact "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#human-enacted-decision-artifact" "Open Human Enacted Decision Artifact"
  click c_causal_trace_replay_auditable_causal_reconstruction "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#causal-trace-replay-auditable-causal-reconstruction" "Open Causal Trace Replay (Auditable Causal Reconstruction)"
  click c_cop_cognitive_orchestration_protocol "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#cop-cognitive-orchestration-protocol" "Open COP (Cognitive Orchestration Protocol)"
  click c_brique_spec_multi_instance "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#brique-spec-multi-instance" "Open Brique Spec / Multi-Instance"
  click c_modular_system "https://github.com/JeanHuguesRobert/inseme/blob/main/research/concepts.md#modular-system" "Open Modular System"
  click c_concatenative_language "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#concatenative-language" "Open Concatenative language"
  click c_stack_vm "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#stack-vm" "Open Stack VM"
  click c_control_data_plane_separation "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#control-data-plane-separation" "Open Control/data plane separation"
  click c_named_values "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#named-values" "Open Named values"
  click c_reactive_sets "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#reactive-sets" "Open Reactive sets"
  click c_actors "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#actors" "Open Actors"
  click c_dialects "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#dialects" "Open Dialects"
  click c_fractanet "https://github.com/JeanHuguesRobert/Inox/blob/master/research/concepts.md#fractanet" "Open Fractanet"
  click c_cogentia "https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/concepts.md#cogentia" "Open Cogentia"
  click c_cogentigram "https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/concepts.md#cogentigram" "Open Cogentigram"
```

*Orphan concepts: `Civilizational Stakes` (cogentia), `Cogentia` (cogentia), `Cogentia Commons` (cogentia), `Sovereign Digital Twin` (cogentia), `Agent-Resumable CLI` (cogentia), `Kernel Extractor` (cogentia), `KYS (Know Your Self) / Psychocognitive Analysis` (cogentia), `Cogentia Workflows` (cogentia), `Packet Capsule` (cogentia), `Human-Routed Handoff` (cogentia), `Recursive Reality Test` (cogentia), `Eventual Reconciliation` (cogentia), `IPN (Inference Packet Network)` (FractaVolta), `EPN (Energy Packet Network)` (FractaVolta), `PGN (Power Generation Node)` (FractaVolta), `Packet Attractors (Fractanet routing)` (FractaVolta), `Packet as evolutionary attractor` (FractaVolta), `The Unconscious Grid` (FractaVolta), `Mariani Village` (FractaVolta), `Value-Shaped Solar` (FractaVolta), `Containerized Compute (Tera)` (FractaVolta), `Traceable Governance` (FractaVolta), `DHITL (Democratic Human In The Loop)` (marenostrum), `CXU (Compute and Exergy Unit)` (marenostrum), `Safe Compute Exergy` (marenostrum), `Constellia` (marenostrum), `Corsica Forest Synergies` (marenostrum), `Sun to Sovereignty` (marenostrum), `Civilizational Stakes` (barons-Mariani), `Cogentia` (barons-Mariani), `Presencology` (barons-Mariani), `Presence` (barons-Mariani), `Projection of The Possible` (barons-Mariani), `Cognitive Waves` (barons-Mariani), `Mimetic Desynchronization` (barons-Mariani), `Invidia` (barons-Mariani), `Transition Markets` (barons-Mariani), `The Uchronian Museum` (barons-Mariani), `Possibilism` (barons-Mariani), `Territoires Possibilistes` (barons-Mariani), `The Second Method` (barons-Mariani), `Discret Holography` (barons-Mariani), `COP (Continuous Operation Protocol)` (inseme), `Briques` (inseme), `Kudocracy` (inseme), `Agora` (inseme), `Ophélia` (inseme), `COP (Cognitive Orchestration Protocol)` (inseme), `Brique Spec / Multi-Instance` (inseme), `Modular System` (inseme), `Reactive sets` (Inox), `Actors` (Inox), `Dialects` (Inox).*

*Referenced but undefined: `Democratic AI Safety`, `Cogentia Commons (déclinaison manuelle)`, `Fractanet / COP (déclinaison automatisée)`, `Stabilisateurs (anti-Ubik)`, `DHITL (couches 4/5)`, `Effet Ubik (opposé)`, `Machine à explorer (opposé symétrique)`, `FM-11 (outer optimizer capture)`, `Concentration de compute (85% frontier)`, `Invidia (densité sociale destructrice)`, `DHITL (Compute Exergy comme unité traçable)`, `Map vs territory`, `Operational memory`, `Traceable agency`, `Non-deterministic Cognitive Step`, `Causal Trace Replay`, `COP/HITL Profile`, `Rule 0 (seconde méthode)`, `DHITL Layer 5`, `Engagement levels (E3/E4)`, `Envelope (kind-agnostic metadata layer)`, `Payload (kind-specific content layer)`, `Continuation payload`, `Objection payload`, `Hypothesis payload`, `Decision payload`, `Failure payload`, `Routing payload`, `Source Document`, `DHITL`, `Rational Odyssey`, `Rational Exploration of The Possible`, `Potentiality Map`, `Explicit Supermap`, `Rich Stigmergy`, `Flotilla Architecture`, `Cartographer`, `Possibilism (academic framework)`, `COP (stigmergic orchestration)`, `DHITL (democratic human-in-the-loop)`, `Digital twins as cognitive liberation`, `Attractor-based exploration`, `Stateless agents for scalable exploration`, `Joy as method (against grim optimization)`, `Musée Mariani des Possibles (muséological application)`, `Applied Possibilism in agile style`, `Continuations as resumable exploration`, `Capabilities approach (Sen, Nussbaum)`, `Spécificité de phase`, `Flexibilité d'usage (redistributive vs. predatory)`, `Auto-institution démocratique (Castoriadis)`, `Communs (Ostrom)`, `Mauss — gift / counter-gift`, `Democratic AI Safety (thesis kernel)`, `DHITL — Democratic Humans in the Loop`, `Cogentia Commons (auditable knowledge)`, `Traçabilité civique anti-mafieuse`, `Muséologie capacitaire`, `Indice de friction administrative`, `Indice de capacité retrouvée`, `Grille de remise en service`, `Deterministic Replay (protocol layer only)`, `Energy Packet Network (FractaVolta)`, `Cognitive Packet envelope/payload (Cogentia)`, `Auxilia (Inseme brique — human-scale Fractanet exchange)`.*
<!-- END_AUTO: concept_graph -->
## Published in this repo
<!-- BEGIN_AUTO: published -->
| Title                                                                                                                                                                                                                                                                                                               | Location  | Date        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| [Instance map — locked names and regimes](instance_map.md) _(Pertitellu first collective; JHN personal TwinRoot; Guide infant surface)_                                                                                                                                                                            | this repo | 2026-07-29  |
| [User ↔ Personal Twin link on collective instances](user_personal_twin_link.md) _(planned: optional membership→twin address; email correlation; personal-twin email authoritative for later follow — [inseme#34](https://github.com/JeanHuguesRobert/inseme/issues/34))_                                                                 | this repo | 2026-08-08  |
| [Personal Twin access policy](personal_twin_access_policy.md) _(visitor / registered / peer / delegate / owner; agent + server enforcement — [inseme#35](https://github.com/JeanHuguesRobert/inseme/issues/35))_                                                                                                                                    | this repo | 2026-08-08  |
| [Interactions Registry & multichannel messaging](interactions_registry_and_multichannel_messaging.md) _(email spine + fragmented channels; Twin desk; cross-repo — [inseme#36](https://github.com/JeanHuguesRobert/inseme/issues/36) · [JHR#2](https://github.com/JeanHuguesRobert/JeanHuguesRobert/issues/2) · [cogentia#84](https://github.com/JeanHuguesRobert/cogentia/issues/84))_ | this repo | 2026-08-08  |
| [Personal Twin public intelligence core](personal_twin_public_intelligence_core.md) _(John public ⊇ Guide; factor OpenAI + MCP + CLI + web UX — [inseme#37](https://github.com/JeanHuguesRobert/inseme/issues/37) · [cogentia#85](https://github.com/JeanHuguesRobert/cogentia/issues/85))_                                                                                                                              | this repo | 2026-08-08  |
| [ActivityPub Edge — Inseme / Fractanet Federation Boundary](activitypub_edge.md) _(architecture decision: ActivityPub as federated projection, Fedify as reference implementation, multi-tenancy, mandates, and guarantees)_ | this repo | 2026-07-31  |
| [Lien avec C.O.R.S.I.C.A. et l’Institut Mariani](acorsica-institut-mariani.md) _(institutional boundary note — Inseme, C.O.R.S.I.C.A. and Institut Mariani)_                                                                                                                                                        | this repo | 2026-06-03  |
| [COP — Cognitive Orchestration Protocol (Architecture)](../packages/cop-core/Architecture.md) _(canonical protocol spec)_                                                                                                                                                                                           | this repo | 2025-12     |
| [COP Invariants — non-negotiable rules of the protocol](../packages/cop-core/Invariants.md)                                                                                                                                                                                                                         | this repo | 2025-12     |
| [COP Manifesto](../packages/cop-core/Manifesto.md)                                                                                                                                                                                                                                                                  | this repo | 2025-12     |
| [COP FAQ](../packages/cop-core/FAQ.md)                                                                                                                                                                                                                                                                              | this repo | 2025-12     |
| [COP Comparison with other orchestration frameworks](../packages/cop-core/COMPARISON.md)                                                                                                                                                                                                                            | this repo | 2025-12     |
| [COP Roadmap](../packages/cop-core/ROADMAP.md)                                                                                                                                                                                                                                                                      | this repo | 2025-12     |
| [Reactive Cognitive COP Extension](reactive_cognitive_cop_extension.md) _(Toubkal/Inox/COP source document: Packet Attractors, pressure strategies, control/data plane)_                                                                                                                                            | this repo | 2026-06-01  |
| [Packet Attractor — Fractanet Distributed Demand and Capability Routing](packet_attractor_fractanet.md) _(canonical COP-side crystallization: attractor matching, intermittent nodes, Fractanet blackboard, `cop/packet-attractor`)_                                                                               | this repo | 2026-07-03  |
| [COP Reactive Cognitive Extension](../packages/cop-core/REACTIVE_COGNITIVE_EXTENSION.md) _(operational COP-core protocol note derived from the source document)_                                                                                                                                                    | this repo | 2026-06-01  |
| [COP Implementation Profiles](../packages/cop-core/ImplementationProfiles.md) _(working-note — documentation convention for concrete COP implementations; companion to the kernel profile)_                                                                                                                         | this repo | 2026-06-01  |
| [COP Identity / Kudocracy Profile](cop_identity_kudocracy_profile.md) _(source document — subjects, capacities, mandates, public civic acts and civic audit traces for Kudocracy-sensitive COP profiles)_                                                                                                           | this repo | 2026-06-19  |
| [COP Memory Profile](cop_memory_profile.md) _(source document — pragmatic memory layer for COP profiles, identified things, traces, and operational recurrence)_                                                                                                                                                    | this repo | 2026-06-21  |
| [COP Memory — Map and Territory](cop_memory_map_territory.md) _(source document — representation, approximation, manipulable maps, and situated judgment for COP memory)_                                                                                                                                           | this repo | 2026-06-21  |
| [COP Memory Metadata and Recursive Trace Layers](cop_memory_metadata_recursion.md) _(source document — metadata recursion, trace layers, and auditability of memory representations)_                                                                                                                               | this repo | 2026-06-21  |
| [COP Memory — Necessity and Local Equilibrium](cop_memory_necessity_local_equilibrium.md) _(source document — necessity, entropy, negentropy, free energy, and local equilibrium for COP memory)_                                                                                                                   | this repo | 2026-06-21  |
| [COP FractaLog Profile](cop_fractalog_profile.md) _(source document — agent-bound logs, custody, inheritance, restricted traces and delayed transparency for COP)_                                                                                                                                                  | this repo | 2026-07-06  |
| [Modular System Architecture — the Brique pattern](../docs/MODULAR_SYSTEM.md)                                                                                                                                                                                                                                       | this repo | 2025-12     |
| [BRIQUE_SPEC — the brique manifest contract](../packages/cop-host/BRIQUE_SPEC.md)                                                                                                                                                                                                                                   | this repo | 2025-12     |
| [Multi-Instance Architecture](../packages/cop-host/docs/MULTI_INSTANCE.md)                                                                                                                                                                                                                                          | this repo | 2025-12     |
| [Corpus Status](corpus-status.md) _(living view — auto-refreshed by `cogentia.js corpus-status`)_                                                                                                                                                                                                                   | this repo | refreshable |
| [Concept Index](concepts.md) _(typed concept registry — mapped by `cogentia.js concepts`)_                                                                                                                                                                                                                          | this repo | refreshable |
| [COP State of Play — Asynchronous Orchestration & Traceability](COP_STATE_OF_PLAY.md) _(living document — focus on async, event-driven, strongly traceable aspects of COP; sync apps temporarily deprioritized)_                                                                                                    | this repo | 2026-05     |
| [Cyrnea State of Play](CYRNEA_STATE_OF_PLAY.md) _(living assessment for the bar/conviviality app — AI + human collaborator reference)_                                                                                                                                                                              | this repo | 2026-05-28  |
| [COOP — Tutorial and Near-Specification](coop_tutorial.md) _(auto-generated tutorial v0.1 — COP kernel, cognitive packet router, reusable helpers (cogentiaRoutePacket etc.), hybrid policy layer (bus agent + JobScheduler), bac-à-sable usage, emissions, resets; sufficient for extension or re-implementation)_ | this repo | 2026-06-04  |
| [Instance personnelle, démocratie et match non achetable](personal_instance_democracy_and_non_capturable_match.md) _(strategic positioning — personal TwinRoot vs personal-agent race; private life vs mandataire obligations; OpenClaw-class runtimes under mandate; non-capturable match invariants)_ | this repo | 2026-07-19  |
<!-- END_AUTO: published -->
## What Is Proved

_Manually curated: claims demonstrated by the published work in this corpus._

| Claim               | Status | Evidence |
| ------------------- | ------ | -------- |
| _(add claims here)_ |        |          |

---

## Open Objections

_Manually curated: objections received publicly, not yet fully resolved._

| Objection               | Source | Status |
| ----------------------- | ------ | ------ |
| _(add objections here)_ |        |        |

---

## What Remains Possible
<!-- BEGIN_AUTO: possibilities -->
- A formal "brique developer guide" consolidating BRIQUE_SPEC + concrete examples from
- An "Ophélia mediator profile" — operational semantics of the AI mediator as it interfaces with
- A `brique-` template generator (`cogentia.js init-brique <name>` or equivalent).
- [Research Index — barons-Mariani](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/index.md)
- [Research Index — Cogentia](https://github.com/JeanHuguesRobert/cogentia/blob/main/research/index.md)
- [Research Index — FractaVolta](https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/index.md)
- [Research Index — Inox](https://github.com/JeanHuguesRobert/Inox/blob/master/research/index.md)
- [Inseme](../README.md)
- [Corpus Start Here — Carte globale du Corpus](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/corpus-map.md)
- [Research Index — Jean Hugues Noël Robert (Profile / Entry Point)](https://github.com/JeanHuguesRobert/JeanHuguesRobert/blob/main/research/index.md)
- [Research Index — MareNostrum](https://github.com/JeanHuguesRobert/marenostrum/blob/main/research/index.md)
<!-- END_AUTO: possibilities -->
---

_Generated with `cogentia.js corpus-status` —
[scripts/cogentia.js](https://github.com/JeanHuguesRobert/cogentia/blob/main/scripts/cogentia.js)_
_Challenge via issues. Fork to explore alternatives._
<!-- BEGIN_AUTO: backlinks -->
### Backlinks

*These documents link to this file:*
- [Rendre capable — noyau doctrinal provisoire](https://github.com/JeanHuguesRobert/barons-Mariani/blob/main/research/noyau_doctrinal_rendre_capable.md)
- [Inseme](../README.md)
- [Research Index — Inseme](index.md)
<!-- END_AUTO: backlinks -->
