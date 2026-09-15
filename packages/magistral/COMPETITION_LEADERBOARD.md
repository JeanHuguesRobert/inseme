---
title: 🏆 Magistral Model Competition Leaderboard
author: Jean Hugues Noël Robert, baron Mariani
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
date: '2026-09-15'
last_modified_at: '2026-09-15'
version: '0.1'
status: working-paper
license: CC BY-SA 4.0
language: en
document_role: archive
document_kind: software-doc
update_policy: UP-DEFAULT-REVIEWED
provenance:
  origin_type: repository
  origin_repository: unknown
  origin_ref: unknown
  origin_date: '2026-09-15'
  derived_from: []
review:
  status: unreviewed
  reviewed_by: []
---

# 🏆 Magistral Model Competition Leaderboard

_Generated dynamically on: 12/07/2026 18:41:33_

This leaderboard ranks models based on direct head-to-head competition across three standard
representative tasks (Guide RAG Synthesis, Inox VM Code Generation, and JSON Parameter Extraction).

### Overall Rankings

|  Rank   | Model / Node                                                | Competitive Score | Quality Score | Speed (tokens/s) | Avg Latency | Success Rate |
| :-----: | :---------------------------------------------------------- | :---------------: | :-----------: | :--------------: | :---------: | :----------: |
| **#1**  | groq-strong (`llama-3.3-70b-versatile`)                     |      **100**      |     100%      |      112/s       |    259ms    |     100%     |
| **#2**  | mistral-fast (`mistral-small-latest`)                       |      **83**       |     100%      |       43/s       |    734ms    |     100%     |
| **#3**  | groq-fast (`llama-3.1-8b-instant`)                          |      **81**       |      90%      |       54/s       |    547ms    |     100%     |
| **#4**  | mistral-strong (`mistral-large-latest`)                     |      **80**       |     100%      |       32/s       |    946ms    |     100%     |
| **#5**  | gemini-fast (`gemini-2.5-flash`)                            |      **77**       |     100%      |       22/s       |   1362ms    |     100%     |
| **#6**  | openai-strong (`gpt-4o`)                                    |      **75**       |      90%      |       34/s       |    912ms    |     100%     |
| **#7**  | openai-fast (`gpt-4o-mini`)                                 |      **71**       |      90%      |       21/s       |   1229ms    |     100%     |
| **#8**  | ollama-fallback (`qwen2.5:3b`)                              |      **66**       |      90%      |       4/s        |   11011ms   |     100%     |
| **#9**  | agent-claude (`claude-code`)                                |      **36**       |      20%      |       19/s       |    396ms    |     100%     |
| **#10** | agent-codex (`codex`)                                       |      **36**       |      20%      |       19/s       |    392ms    |     100%     |
| **#11** | agent-grok (`grok-build`)                                   |      **35**       |      20%      |       15/s       |    476ms    |     100%     |
| **#12** | together-strong (`meta-llama/Llama-3.1-70B-Instruct-Turbo`) |       **0**       |      0%       |       0/s        |     0ms     |      0%      |

### Detailed Task Breakdowns

#### Model: groq-strong (llama-3.3-70b-versatile)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    |  284ms  | 190/s |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  212ms  | 47/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  281ms  | 100/s |     100%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Correct needs_rag boolean (+3)                                    |

#### Model: mistral-fast (mistral-small-latest)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    | 1134ms  | 51/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  562ms  | 14/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  506ms  | 63/s  |     100%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Correct needs_rag boolean (+3)                                    |

#### Model: groq-fast (llama-3.1-8b-instant)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    | 1028ms  | 54/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  207ms  | 43/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  405ms  | 64/s  |      70%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Missing needs_rag field or wrong type                             |

#### Model: mistral-strong (mistral-large-latest)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    | 1414ms  | 43/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  575ms  | 14/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  849ms  | 38/s  |     100%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Correct needs_rag boolean (+3)                                    |

#### Model: gemini-fast (gemini-2.5-flash)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    | 1722ms  | 34/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  769ms  | 12/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    | 1595ms  | 20/s  |     100%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Correct needs_rag boolean (+3)                                    |

#### Model: openai-strong (gpt-4o)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    |  973ms  | 57/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    | 1005ms  |  7/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  759ms  | 38/s  |      70%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Missing needs_rag field or wrong type                             |

#### Model: openai-fast (gpt-4o-mini)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                             |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------------------ |
| Guide RAG Synthesis       |    ✓    | 1877ms  | 29/s  |     100%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  853ms  |  8/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  957ms  | 25/s  |      70%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Missing needs_rag field or wrong type                             |

#### Model: ollama-fallback (qwen2.5:3b)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                          |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :--------------------------------------------------------------------------------------------------------------- |
| Guide RAG Synthesis       |    ✓    | 22944ms |  5/s  |      70%      | Found 'Developer-Human-in-the-Loop' (+3), Found exact source citation format (+4), Response too short or verbose |
| Inox VM Code Generation   |    ✓    | 3143ms  |  3/s  |     100%      | Outputted clean code block (+3), Contains number 42 (+4), Strictly concise (+3)                                  |
| JSON Parameter Extraction |    ✓    | 6947ms  |  4/s  |     100%      | Valid JSON parsed (+4), Correct locale 'fr' (+3), Correct needs_rag boolean (+3)                                 |

#### Model: agent-claude (claude-code)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                  |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------- |
| Guide RAG Synthesis       |    ✓    |  469ms  | 15/s  |      30%      | Missing keyword 'Developer-Human-in-the-Loop', Missing source citation, Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  337ms  | 22/s  |      30%      | No code block syntax, Missing target value 42, Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  383ms  | 19/s  |      0%       | Failed to parse JSON                                                                                     |

#### Model: agent-codex (codex)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                  |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------- |
| Guide RAG Synthesis       |    ✓    |  421ms  | 17/s  |      30%      | Missing keyword 'Developer-Human-in-the-Loop', Missing source citation, Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  387ms  | 19/s  |      30%      | No code block syntax, Missing target value 42, Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  368ms  | 20/s  |      0%       | Failed to parse JSON                                                                                     |

#### Model: agent-grok (grok-build)

| Task                      | Success | Latency | Speed | Quality Score | Details                                                                                                  |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :------------------------------------------------------------------------------------------------------- |
| Guide RAG Synthesis       |    ✓    |  406ms  | 18/s  |      30%      | Missing keyword 'Developer-Human-in-the-Loop', Missing source citation, Appropriate response length (+3) |
| Inox VM Code Generation   |    ✓    |  482ms  | 15/s  |      30%      | No code block syntax, Missing target value 42, Strictly concise (+3)                                     |
| JSON Parameter Extraction |    ✓    |  539ms  | 13/s  |      0%       | Failed to parse JSON                                                                                     |

#### Model: together-strong (meta-llama/Llama-3.1-70B-Instruct-Turbo)

| Task                      | Success | Latency | Speed | Quality Score | Details         |
| :------------------------ | :-----: | :-----: | :---: | :-----------: | :-------------- |
| Guide RAG Synthesis       |   ❌    |   0ms   |  0/s  |      0%       | Error: HTTP 401 |
| Inox VM Code Generation   |   ❌    |   0ms   |  0/s  |      0%       | Error: HTTP 401 |
| JSON Parameter Extraction |   ❌    |   0ms   |  0/s  |      0%       | Error: HTTP 401 |
