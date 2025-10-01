# n8n-nodes-ai-agent-mlflow (Databricks MLflow)

![node-example](https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow/blob/main/assets/node-example.png?raw=true)

An **n8n community node** that adds **Databricks MLflow observability** to your **AI Agent** workflows.  
Supports **tool-calling agents**, **memory**, **structured output**, and **full tracing** of reasoning steps, tool calls, and final responses.

npm: **[n8n-nodes-ai-agent-mlflow](https://www.npmjs.com/package/n8n-nodes-ai-agent-mlflow)**

---

- [Features](#features)  
- [Installation](#installation)  
- [Credentials (Databricks)](#credentials-databricks)  
- [Operations](#operations)  
- [Usage](#usage)  
- [Compatibility](#compatibility)  
- [Resources](#resources)  
- [Version History](#version-history)  
- [License](#license)

---

## Features

- **AI Agent**: Works with LangChain (AgentExecutor, ToolCallingAgent) and OpenAI-compatible providers.
- **MLflow 3.0 Observability (Databricks)**: Creates **traces**, **spans** (LLM/tool), **metrics**, **tags**, and **artifacts** for audits and evaluation.
- **First-class Databricks**: Built to log into **Databricks MLflow** (best UI/UX for GenAI tracing and evaluation).

> n8n is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

---

## Installation

Follow the official n8n guide for Community Nodes:  
https://docs.n8n.io/integrations/community-nodes/installation/

### UI (Recommended)

For **n8n v0.187+**:

1. **Settings → Community Nodes**  
2. **Install**  
3. Enter: `n8n-nodes-ai-agent-mlflow`  
4. Accept the community node risk prompt  
5. **Install**

### Docker (Recommended for Production)

```bash
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow

docker build -f docker/Dockerfile -t n8n:nodes-ai-agent-mlflow .
docker run -it -p 5678:5678 n8n:nodes-ai-agent-mlflow
```

Access n8n at: <http://localhost:5678>

### Manual (Without Docker)

```bash
# go to your n8n install
cd ~/.n8n
# install the node
npm install n8n-nodes-ai-agent-mlflow
# restart n8n
n8n start
```

---

## Credentials (Databricks)

This node sends **traces**, **spans**, **metrics**, and optionally **artifacts** to **Databricks MLflow**.

| Field | Description | Example |
|---|---|---|
| **Databricks Host** | Workspace base URL | `https://<your-workspace>.cloud.databricks.com` |
| **Databricks Token** | PAT with write access to MLflow/Experiments | `dapi-***` |
| **MLflow Experiment ID** | Target experiment to store runs/traces | `1111111111111111` |
| **Default Tags (JSON)** | Tags applied to all runs | `{"project":"ai-agents","env":"dev"}` |

**Environment variables (optional):**
```bash
export DATABRICKS_HOST="https://<your-workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi-***"
export MLFLOW_EXPERIMENT_ID="1111111111111111"
export MLFLOW_DEFAULT_TAGS='{"project":"ai-agents","env":"dev"}'
```

*Tips*
- Create the experiment in the Databricks UI and copy the **experiment_id**.
- The token must have **Write** permission on that experiment.

---

## Operations

The node executes your AI Agent (with or without tools) and records a **complete trace** in MLflow:

- **LLM spans** (prompt, parameters, latency, tokens if available)
- **Tool spans** (name, args, results, duration)
- **Messages** (system/user/assistant)
- **Metrics** (latencies, token counts, error flags)
- **Tags & metadata** (sessionId, userId, workflow, env)
- **Artifacts** (optional serialized inputs/outputs for audits/evals)

### Supported Fields

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Logical session to group related runs (e.g., a chat session) |
| `userId` | `string` | End-user identifier |
| `traceName` | `string` | Human-readable label (e.g., `qna`, `order-bot`) |
| `metadata` | `object` | Free-form JSON context (e.g., `workflowId`, `tenant`, `env`) |
| `evaluate` | `boolean` | If `true`, persist extra artifacts for later evaluation |

> All fields become MLflow tags/attributes to power filtering in the Databricks UI.

---

## Usage

### Quick Example (Node Inputs)

| Field | Example |
|---|---|
| **Session ID** | `{{$json.sessionId}}` |
| **User ID** | `enterprise-user-42` |
| **Trace Name** | `qna` |
| **Evaluate** | `true` |
| **Custom Metadata (JSON)** | ```json
{ "project":"test-project", "env":"dev", "workflow":"main-flow" }
``` |

### Example Agent Output Payload

Provide the node with a structured payload like:

```json
{
  "messages": [
    {"role":"system","content":"You are a helpful assistant."},
    {"role":"user","content":"Find last month's revenue and explain briefly."}
  ],
  "tools_called": [
    {
      "name": "sql.query",
      "args": {"sql":"SELECT SUM(amount) FROM revenue WHERE month='2025-08'"},
      "result": {"sum": 1234567}
    }
  ],
  "final_answer": "Total revenue in 2025-08 was 1,234,567. It grew 8% MoM."
}
```

The node converts this into:
- **Span tree** (LLM → Tool → LLM → Final)
- **Metrics** (per-span and overall latency; tokens if available)
- **Tags** (`sessionId`, `userId`, `traceName`, `workflow`, `env`)
- **Artifacts** (optional JSON snapshots for audits/evals)

### Session/User Grouping

- Use `sessionId` to chain multiple turns of the same conversation.
- Use `userId` to attribute requests to a specific end user.

---

## Compatibility

- **n8n**: 1.0.0+  
- **LLM Providers**:
  - OpenAI official API
  - OpenAI-compatible providers (LiteLLM, LocalAI, Azure OpenAI, Databricks Model Serving with OpenAI-style endpoints)
- **MLflow**:
  - **Databricks MLflow 3.0+** (best tracing & evaluation UX)

---

## Resources

- n8n Community Nodes: <https://docs.n8n.io/integrations/community-nodes/>  
- Databricks MLflow (GenAI/Tracing): (refer to your Databricks workspace docs)  
- MLflow (general): <https://mlflow.org/>  
- n8n Community Forum: <https://community.n8n.io/>  

> This project focuses on the **Databricks MLflow** experience for GenAI tracing and evaluation.

---

## Version History

- **v1.0.0** – First public release with Databricks MLflow, tool-call support, metadata, and full tracing.

---

## License

MIT © 2025 Wistron DXLab