# n8n-nodes-ai-agent-mlflow (Databricks MLflow)

![node-example](https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow/blob/main/assets/node-example.png?raw=true)

An **n8n community node** that adds **Databricks MLflow observability** to your **AI Agent** workflows.  
Supports **tool-calling agents**, **memory**, **structured output**, and **full tracing** of reasoning steps, tool calls, and final responses.

npm: **[n8n-nodes-ai-agent-mlflow](https://www.npmjs.com/package/n8n-nodes-ai-agent-mlflow)**

---

- [Features](#features)  
- [Installation](#installation) 
  - [Install from source (local tarball)](#install-from-source-local-tarball)  
  - [Docker Installation (recommended for production)](#docker-installation-recommended-for-production)  
  - [Manual (without Docker)](#manual-without-docker)  
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

### Install from source (local tarball)

When installing from the repository source, you must **build and pack** the node before using it.

```bash
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow

# REQUIRED before any build/pack:
npm install
npm run build

# Create a local tarball (outputs something like n8n-nodes-ai-agent-mlflow-1.0.0.tgz)
npm pack

# Install the .tgz into your n8n setup
# (replace X.Y.Z with the actual version printed by npm pack)
cd ~/.n8n
npm install /path/to/n8n-nodes-ai-agent-mlflow/n8n-nodes-ai-agent-mlflow-X.Y.Z.tgz

# restart n8n
n8n start
```

> Tip: You can also publish the package to a private registry and install by name/version if preferred.

---

## Docker Installation (Recommended for Production)

> This repo is not published on the Community Store. Install **from source** by
> building and packing the node **before** creating the Docker image.

A preconfigured Docker setup is available in the `docker/` directory.

1) **Clone the repository**
```bash
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow
```

2) **Build the node locally (required)**
```bash
# install deps and compile
npm install
npm run build

# create a local tarball (e.g., n8n-nodes-ai-agent-mlflow-1.0.0.tgz)
npm pack
```

3) **(Option A) Build using the repository root as context**
```bash
# build the image; Dockerfile is at docker/Dockerfile
# if your Dockerfile expects the tgz name as a build-arg, pass it as below:
PKG=$(ls -1 n8n-nodes-ai-agent-mlflow-*.tgz | head -n1)
docker build -f docker/Dockerfile \
  --build-arg NODE_TGZ="$PKG" \
  -t n8n-ai-agent-mlflow .
```

4) **(Option B) Build using the docker/ directory as context**
```bash
# copy the packed tgz next to the Dockerfile
cp n8n-nodes-ai-agent-mlflow-*.tgz docker/
cd docker

# build the image from inside docker/
docker build -t n8n-ai-agent-mlflow .
```

> Your `docker/Dockerfile` should **COPY** the `.tgz` into the image and run
> `npm install` for that tarball (so the node becomes available to n8n).  
> Example excerpt:
> ```dockerfile
> ARG NODE_TGZ=n8n-nodes-ai-agent-mlflow-1.0.0.tgz
> COPY ${NODE_TGZ} /tmp/${NODE_TGZ}
> # install the node into n8n's data dir
> RUN mkdir -p /home/node/.n8n && cd /home/node/.n8n && npm install /tmp/${NODE_TGZ}
> ```

5) **Run the container**
```bash
docker run -it -p 5678:5678 \
  -e DATABRICKS_HOST="https://<your-workspace>.cloud.databricks.com" \
  -e DATABRICKS_TOKEN="dapi-***" \
  -e MLFLOW_EXPERIMENT_ID="1091378939953898" \
  --name n8n-mlflow \
  n8n-ai-agent-mlflow
```

You can now access n8n at <http://localhost:5678>.

---

### Manual (without Docker)

If you want to install directly from **npm**:

```bash
# go to your n8n install
cd ~/.n8n

# install the node from npm
npm install n8n-nodes-ai-agent-mlflow

# restart n8n
n8n start
```

If you want to install directly from a **local build** (tarball), use the steps in **Install from source (local tarball)**.

---

## Credentials (Databricks)

This node sends **traces**, **spans**, **metrics**, and optionally **artifacts** to **Databricks MLflow**.

| Field | Description | Example |
|---|---|---|
| **Databricks Host** | Workspace base URL | `https://e2-demo-field-eng.cloud.databricks.com` |
| **Databricks Token** | PAT with write access to MLflow/Experiments | `dapi-***` |
| **MLflow Experiment ID** | Target experiment to store runs/traces | `1091378939953898` |
| **Default Tags (JSON)** | Tags applied to all runs | `{"project":"ai-agents","env":"dev"}` |

**Environment variables (optional):**
```bash
export DATABRICKS_HOST="https://<your-workspace>.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi-***"
export MLFLOW_EXPERIMENT_ID="1091378939953898"
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
