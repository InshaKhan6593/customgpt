# Langfuse LLM-as-a-Judge Evaluator Setup Guide

This guide provides instructions for configuring LLM-as-a-Judge evaluators in the Langfuse UI. These evaluators are essential for the RSIL (Recursive Self-Improving Loop) pipeline to measure weblet performance and make automated optimization decisions.

## Overview

LLM-as-a-Judge evaluators use advanced models like GPT-4o to analyze chat traces and assign scores based on specific criteria. The RSIL analyzer fetches these scores asynchronously to calculate a composite performance metric for each weblet version.

## Data Flow

1.  **Generation**: A user interacts with an RSIL-enabled weblet.
2.  **Evaluation**: Langfuse runs configured LLM evaluators on the trace.
3.  **Storage**: Scores are attached to the trace in Langfuse, tagged with a `versionId`.
4.  **Analysis**: The `analyzeVersion()` function in `lib/rsil/analyzer.ts` queries Langfuse scores by `versionId`.
5.  **Optimization**: RSIL uses these scores to suggest or automatically apply prompt improvements.

## Prerequisites

*   Active Langfuse account with a project configured.
*   Weblet with `rsilEnabled: true` in its configuration.
*   Langfuse Core plan or higher (required for LLM-as-a-Judge features).

## Navigation

To set up a new evaluator:
1.  Log in to your Langfuse UI.
2.  Navigate to **Evaluations** in the sidebar.
3.  Select the **LLM-as-a-Judge** tab.
4.  Click **+ Set up Evaluator**.

## The 6 Evaluators

> [!IMPORTANT]
> Evaluator names are case-sensitive and must match the keys below exactly. The RSIL analyzer will ignore scores with non-matching names.

| Name | Description | Max Score | Direction | Weight |
| :--- | :--- | :--- | :--- | :--- |
| `helpfulness` | Measures if the response directly addresses the user's intent. | 1 | Higher is better | 0.20 |
| `correctness` | Evaluates the factual accuracy of the information provided. | 1 | Higher is better | 0.15 |
| `context-relevance` | Checks if the response stays on topic and within the provided context. | 1 | Higher is better | 0.15 |
| `hallucination` | Detects information not supported by the context or general facts. | 1 | Lower is better | 0.10 |
| `toxicity` | Identifies harmful, biased, or inappropriate content. | 1 | Lower is better | 0.05 |
| `conciseness` | Assesses if the response is appropriately brief and efficient. | 1 | Higher is better | 0.05 |

### Recommended Configuration
*   **Judge Model**: `openai/gpt-4o` (highly recommended for reliable structured output).
*   **Filter**: Set a Tag filter for `rsil-enabled` to ensure evaluators only run on relevant weblet traces.

## User Rating (user-rating)

The `user-rating` dimension is distinct from LLM evaluators. It represents direct feedback from the chat UI (thumbs-up/down), which is submitted to the `/api/public/scores` endpoint.

*   **Weight**: 0.30 (the highest single weight in the composite score).
*   **Setup**: No configuration is required in the Langfuse LLM-as-a-Judge UI. The system handles these scores automatically via API integration.

## Composite Score Formula

The analyzer calculates a single performance metric using the weighted sum of all dimensions:

`composite = Σ(normalizedDimensionScore × weight)`

### Decision Thresholds
*   **≥ 0.8**: No action required.
*   **0.6 - 0.8**: Suggestion (prompt improvement recommended).
*   **< 0.6**: Auto-Update (automatic prompt improvement applied).

## Verification

After completing the setup, verify the integration:
1.  Initiate a few conversations with an RSIL-enabled weblet.
2.  Check the **Scores** tab in the Langfuse UI for the specific traces.
3.  Confirm that scores for `helpfulness`, `correctness`, etc., are appearing.
4.  Alternatively, use the Langfuse API (`GET /api/public/v2/scores`) to verify score records.
