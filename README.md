# n8n-nodes-ai-agent-mlflow

![n8n AI Agent with MLflow](https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow/blob/main/assets/node-example.png?raw=true)

An **n8n community node** that provides an **AI Agent with Databricks MLflow observability**.
Built on LangChain's ToolCallingAgent, this node adds comprehensive tracing of your agent's reasoning, tool usage, and LLM interactions directly to Databricks MLflow.

**Key Features:**
- 🤖 **Full AI Agent** - Tool calling, memory, structured outputs, streaming
- 📊 **MLflow Tracing** - Automatic span creation for agents, LLMs, and tools
- 🔧 **MCP Support** - Works with Model Context Protocol (MCP) toolkits
- 🏢 **Databricks-First** - Built specifically for Databricks MLflow 3.0+

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Docker (Recommended)](#docker-recommended)
  - [Manual Installation](#manual-installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

---

## Features

### AI Agent Capabilities
- ✅ **Tool Calling** - Supports any LangChain tool or MCP toolkit
- ✅ **Memory** - Conversation history with BaseChatMemory
- ✅ **Structured Output** - Optional output parser for validated JSON responses
- ✅ **Streaming** - Real-time token streaming support
- ✅ **Fallback Models** - Automatic failover to secondary model
- ✅ **Binary Images** - Automatic passthrough of images to vision models

### MLflow Observability
- 📊 **Automatic Tracing** - Creates MLflow spans for every step
- 🔍 **Span Types**:
  - `AGENT` - Overall agent execution
  - `CHAT_MODEL` - LLM calls with token usage
  - `TOOL` - Tool invocations with arguments and results
  - `RETRIEVER` - Vector store retrievals (if used)
- 📈 **Metrics** - Latency, token counts, model info
- 🏷️ **Tags & Metadata** - Full context for filtering and analysis

### Supported Integrations
- **Chat Models**: OpenAI, Databricks Model Serving, any OpenAI-compatible API
- **Tools**: n8n tools, MCP toolkits, custom LangChain tools
- **Memory**: All LangChain memory types
- **MLflow**: Databricks MLflow 3.0+ (with tracing support)

---

## Installation

### Docker (Recommended)

The easiest way to run this node is with the pre-configured Docker setup.

#### 1. Clone and Build

```bash
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow

# Install dependencies and build
npm install
npm run build

# Create tarball
npm pack
```

#### 2. Build Docker Image

```bash
docker build -f docker/Dockerfile -t n8n:ai-agent-mlflow .
```

#### 3. Run Container

```bash
docker run -it -p 5678:5678 \
  -e DATABRICKS_HOST="https://your-workspace.cloud.databricks.com" \
  -e DATABRICKS_TOKEN="dapi-your-token" \
  -e MLFLOW_TRACKING_URI="databricks" \
  -e MLFLOW_EXPERIMENT_ID="your-experiment-id" \
  -v ~/.n8n:/home/node/.n8n \
  n8n:ai-agent-mlflow
```

Access n8n at [http://localhost:5678](http://localhost:5678)

---

### Manual Installation

If you prefer to install into an existing n8n instance:

```bash
# Build from source
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow
npm install
npm run build
npm pack

# Install into n8n
cd ~/.n8n
npm install /path/to/n8n-nodes-ai-agent-mlflow-0.1.0.tgz

# Restart n8n
n8n start
```

---

## Configuration

### Required Environment Variables

The node requires these environment variables to send traces to Databricks MLflow:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABRICKS_HOST` | Your Databricks workspace URL | `https://e2-demo-field-eng.cloud.databricks.com` |
| `DATABRICKS_TOKEN` | Personal Access Token with MLflow write access | `dapi-***` |
| `MLFLOW_TRACKING_URI` | MLflow tracking backend | `databricks` |
| `MLFLOW_EXPERIMENT_ID` | Target experiment for traces | `1427538817675103` |

### Getting Databricks Credentials

1. **Workspace URL** - Copy from your browser when logged into Databricks
2. **Access Token** - User Settings → Developer → Access Tokens → Generate New Token
3. **Experiment ID** - Create an experiment in MLflow UI, copy the ID from URL

**Example:**
```bash
export DATABRICKS_HOST="https://e2-demo-field-eng.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi7fb35ac06a4ed47fa1dfb788dfe1e0be"
export MLFLOW_TRACKING_URI="databricks"
export MLFLOW_EXPERIMENT_ID="1427538817675103"
```

---

## Usage

### Basic Agent Setup

1. **Add Agent Node** - Drag "AI Agent (MLflow)" to your workflow
2. **Connect Chat Model** - Add OpenAI, Databricks, or compatible model
3. **Connect Tools** (optional) - Add n8n tools or MCP clients
4. **Connect Memory** (optional) - Add chat memory for conversations
5. **Configure Input** - Map user message to the agent

### Node Inputs

The node requires these **connections**:

- **Chat Model** (required) - The LLM to use
- **Tools** (optional) - Zero or more tools the agent can call
- **Memory** (optional) - For conversation history
- **Output Parser** (optional) - For structured JSON validation

### Example Workflow

```
[Chat Trigger] → [AI Agent MLflow] → [Response]
                      ↓
                 [Databricks Chat Model]
                      ↓
                 [MCP Client Tool]
                      ↓
                 [Window Buffer Memory]
```

### MLflow Traces

Every agent execution creates a trace in Databricks MLflow with:

- **Agent Span** - Overall execution with messages and system prompt
- **Chat Model Spans** - Each LLM call with:
  - Input messages
  - Model parameters (temperature, max_tokens, etc.)
  - Response with token usage
  - Latency metrics
- **Tool Spans** - Each tool invocation with:
  - Tool name and description
  - Input arguments
  - Output results
  - Execution time

---

## How It Works

### Architecture

```
n8n Workflow
    ↓
AI Agent (MLflow) Node
    ↓
LangChain ToolCallingAgent
    ↓
┌─────────────────────────┐
│  MLflow CallbackHandler │ → Databricks MLflow
│  - Intercepts events    │    (Traces & Spans)
│  - Creates spans        │
│  - Records metrics      │
└─────────────────────────┘
    ↓
OpenAI/Databricks API
    ↓
Tools (if any)
```

### Key Components

1. **ToolCallingAgent** - LangChain's agent that can use tools
2. **MLflow CallbackHandler** - Intercepts LangChain events and creates MLflow spans
3. **McpToolkit Support** - Detects and expands MCP toolkits into individual tools
4. **Tool Validation** - Ensures all tools have required `name` and `description` fields
5. **Error Handling** - Enhanced error messages with full stack traces

---

## Troubleshooting

### Common Issues

#### 1. "401 Unauthorized" from MLflow

**Cause:** Invalid or expired Databricks token
**Solution:**
- Verify your `DATABRICKS_TOKEN` is correct
- Regenerate a new Personal Access Token in Databricks (User Settings → Developer → Access Tokens)
- Ensure the token has MLflow write permissions

#### 2. "404 Not Found" from MLflow

**Cause:** Invalid experiment ID or workspace URL
**Solution:**
- Verify `MLFLOW_EXPERIMENT_ID` matches an existing experiment
- Check `DATABRICKS_HOST` is the full workspace URL (e.g., `https://your-workspace.cloud.databricks.com`)
- Create a new experiment in MLflow UI if needed

#### 3. No traces appearing in MLflow

**Cause:** Missing environment variables
**Solution:**
- Ensure all 4 required environment variables are set: `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `MLFLOW_TRACKING_URI`, `MLFLOW_EXPERIMENT_ID`
- Restart n8n after setting environment variables
- Check n8n logs for any MLflow connection errors

#### 4. "400 status code (no body)" from OpenAI/Databricks

**Cause:** Invalid tool configuration or malformed request
**Solution:**
- Verify your Chat Model credentials are correct
- Check that connected tools have valid configurations
- Review the model's supported features (some models don't support tool calling)

### Debug Mode

Set n8n log level to debug to see detailed execution information:

```bash
export N8N_LOG_LEVEL=debug
n8n start
```

---

## Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow.git
cd n8n-nodes-ai-agent-mlflow

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run linter
npm run lint

# Fix linting issues
npm run lintfix

# Format code
npm run format
```

### Project Structure

```
n8n-nodes-ai-agent-mlflow/
├── nodes/
│   └── AgentWithMLFlow/
│       ├── AgentWithMLFlow.node.ts    # Node definition
│       ├── V2/
│       │   ├── execute.ts              # Main execution logic
│       │   ├── CallbackHandler.ts      # MLflow tracing handler
│       │   ├── description.ts          # Node properties
│       │   └── utils.ts                # Input configuration
│       └── src/
│           ├── types/                  # TypeScript types
│           └── utils/                  # Shared utilities
├── docker/
│   └── Dockerfile                      # Docker configuration
├── package.json
└── README.md
```

### Running Tests

```bash
# Format check
npm run format

# Lint
npm run lint

# Build
npm run build
```

---

## Known Issues

### Deprecation Warnings

You may see this warning in logs:
```
[DEP0060] DeprecationWarning: The `util._extend` API is deprecated
```

**Cause:** This comes from the `mlflow-tracing` library
**Impact:** No functional impact - it's just a warning
**Status:** Cannot be fixed in this node (upstream dependency issue)

---

## Version History

### v0.1.0 (Current)
- ✅ Initial release with MLflow tracing
- ✅ Full ToolCallingAgent support
- ✅ MCP Toolkit detection and expansion
- ✅ Tool validation and auto-correction
- ✅ Environment variable configuration
- ✅ Streaming support
- ✅ Fallback model support
- ✅ Enhanced error messages
- ✅ Fixed toLowerCase() bugs
- ✅ Fixed metadata undefined issue
- ✅ Removed legacy Langfuse code

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run build`
5. Submit a pull request

---

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Databricks MLflow](https://docs.databricks.com/mlflow/)
- [LangChain Documentation](https://js.langchain.com/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

---

## License

MIT © 2025

---

## Acknowledgments

- Original Langfuse implementation by [@rorubyy](https://github.com/rorubyy)
- MLflow adaptation by [@manfredcalvo](https://github.com/manfredcalvo)
- Fixes and enhancements with assistance from Claude (Anthropic)

---

**Need help?** Open an issue on [GitHub](https://github.com/manfredcalvo/n8n-nodes-ai-agent-mlflow/issues)
