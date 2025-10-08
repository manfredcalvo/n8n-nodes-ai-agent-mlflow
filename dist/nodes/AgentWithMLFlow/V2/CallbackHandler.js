"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackHandler = void 0;
const base_1 = require("@langchain/core/callbacks/base");
const messages_1 = require("@langchain/core/messages");
const log4js_1 = require("log4js");
const mlflow = __importStar(require("mlflow-tracing"));
class CallbackHandler extends base_1.BaseCallbackHandler {
    name = "MLFlowCallbackHandler";
    runMap = new Map();
    last_trace_id = null;
    constructor(params) {
        super();
    }
    get logger() {
        return (0, log4js_1.getLogger)("Callback-handler");
    }
    async handleLLMNewToken(token, _idx, runId, _parentRunId, _tags, _fields) {
        this.logger.info(`LLM returning token: ${token}`);
    }
    async handleChainStart(chain, inputs, runId, parentRunId, tags, metadata, runType, name) {
        try {
            this.logger.debug(`Chain start with Id: ${runId}`);
            const runName = name ?? chain.id.at(-1)?.toString() ?? "Langchain Run";
            const filter_chains = ["runnablelambda", "runnablemap", "toolcallingagentoutputparser"];
            const filter_span = runName ? filter_chains.some(sub => runName.toLowerCase().includes(sub)) : false;
            if (filter_span) {
                return;
            }
            let chat_history = 'chat_history' in inputs ? inputs['chat_history'] : undefined;
            if (chat_history) {
                chat_history = chat_history.map((m) => this.extractChatMessageContent(m));
            }
            const user_message = { "content": inputs['input'], "role": "user" };
            const messages = chat_history ? chat_history.concat([user_message]) : [user_message];
            this.startAndRegisterOtelSpan({
                type: mlflow.SpanType.AGENT,
                runName: runName,
                runId: runId,
                parentRunId: parentRunId,
                tags: tags,
                metadata: metadata,
                attributes: {
                    messages: messages,
                    system_message: inputs['system_message']
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleAgentAction(action, runId, parentRunId) {
        try {
            this.logger.debug(`Agent action ${action.tool} with ID: ${runId}`);
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleAgentEnd(action, runId, parentRunId) {
        try {
            this.logger.debug(`Agent finish with ID: ${runId}`);
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleChainError(err, runId, parentRunId) {
        try {
            this.logger.debug(`Chain error: ${err} with ID: ${runId}`);
            const azureRefusalError = this.parseAzureRefusalError(err);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    level: "ERROR",
                    statusMessage: err.toString() + azureRefusalError,
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleGenerationStart(llm, messages, runId, parentRunId, extraParams, tags, metadata, name) {
        this.logger.debug(`Generation start with ID: ${runId} and parentRunId ${parentRunId}`);
        const runName = name ?? llm.id.at(-1)?.toString() ?? "Langchain Generation";
        const modelParameters = {};
        const invocationParams = extraParams?.["invocation_params"];
        for (const [key, value] of Object.entries({
            temperature: invocationParams?.temperature,
            max_tokens: invocationParams?.max_tokens,
            top_p: invocationParams?.top_p,
            frequency_penalty: invocationParams?.frequency_penalty,
            presence_penalty: invocationParams?.presence_penalty,
            request_timeout: invocationParams?.request_timeout,
        })) {
            if (value !== undefined && value !== null) {
                modelParameters[key] = value;
            }
        }
        this.startAndRegisterOtelSpan({
            type: mlflow.SpanType.CHAT_MODEL,
            runName: runName,
            runId: runId,
            parentRunId: parentRunId,
            metadata: metadata,
            tags: tags,
            attributes: {
                messages: messages,
                modelParameters: modelParameters
            },
        });
    }
    async handleChatModelStart(llm, messages, runId, parentRunId, extraParams, tags, metadata, name) {
        try {
            this.logger.debug(`Chat model start with ID: ${runId}`);
            const prompts = messages.flatMap((message) => message.map((m) => this.extractChatMessageContent(m)));
            this.handleGenerationStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleChainEnd(outputs, runId, parentRunId) {
        try {
            this.logger.debug(`Chain end with ID: ${runId}`);
            let finalOutput = outputs;
            if (typeof outputs === "object" &&
                "output" in outputs &&
                typeof outputs["output"] === "string") {
                finalOutput = outputs["output"];
            }
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    output: finalOutput,
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleLLMStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name) {
        try {
            this.logger.debug(`LLM start with ID: ${runId}`);
            this.handleGenerationStart(llm, prompts, runId, parentRunId, extraParams, tags, metadata, name);
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleToolStart(tool, input, runId, parentRunId, tags, metadata, name) {
        try {
            this.logger.debug(`Tool start with ID: ${runId}`);
            const tool_name = name ?? tool.id.at(-1)?.toString() ?? "Tool execution";
            this.startAndRegisterOtelSpan({
                type: mlflow.SpanType.TOOL,
                runId: runId,
                parentRunId: parentRunId,
                runName: tool_name,
                attributes: {
                    tool_name: tool_name,
                    args: input,
                },
                metadata: metadata,
                tags: tags,
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleRetrieverStart(retriever, query, runId, parentRunId, tags, metadata, name) {
        try {
            this.logger.debug(`Retriever start with ID: ${runId}`);
            this.startAndRegisterOtelSpan({
                type: mlflow.SpanType.RETRIEVER,
                runId: runId,
                parentRunId: parentRunId,
                runName: name ?? retriever.id.at(-1)?.toString() ?? "Retriever",
                attributes: {
                    input: query,
                },
                tags: tags,
                metadata: metadata,
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleRetrieverEnd(documents, runId, parentRunId) {
        try {
            this.logger.debug(`Retriever end with ID: ${runId}`);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    output: documents,
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleRetrieverError(err, runId, parentRunId) {
        try {
            this.logger.debug(`Retriever error: ${err} with ID: ${runId}`);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    level: "ERROR",
                    statusMessage: err.toString(),
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleToolEnd(output, runId, parentRunId) {
        try {
            this.logger.debug(`Tool end with ID: ${runId}`);
            this.handleOtelSpanEnd({
                runId,
                attributes: { output },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleToolError(err, runId, parentRunId) {
        try {
            this.logger.debug(`Tool error ${err} with ID: ${runId}`);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    level: "ERROR",
                    statusMessage: err.toString(),
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleLLMEnd(output, runId, parentRunId) {
        try {
            this.logger.debug(`LLM end with ID: ${runId}`);
            const lastResponse = output.generations[output.generations.length - 1][output.generations[output.generations.length - 1].length - 1];
            const llmUsage = this.extractUsageMetadata(lastResponse) ??
                output.llmOutput?.["tokenUsage"];
            const modelName = this.extractModelNameFromMetadata(lastResponse);
            const usageDetails = {
                input_tokens: llmUsage?.input_tokens ??
                    ("promptTokens" in llmUsage ? llmUsage?.promptTokens : undefined),
                output_tokens: llmUsage?.output_tokens ??
                    ("completionTokens" in llmUsage
                        ? llmUsage?.completionTokens
                        : undefined),
                total_tokens: llmUsage?.total_tokens ??
                    ("totalTokens" in llmUsage ? llmUsage?.totalTokens : undefined),
            };
            if (llmUsage && "input_token_details" in llmUsage) {
                for (const [key, val] of Object.entries(llmUsage["input_token_details"] ?? {})) {
                    usageDetails[`input_${key}`] = val;
                    if ("input" in usageDetails && typeof val === "number") {
                        usageDetails["input"] = Math.max(0, usageDetails["input"] - val);
                    }
                }
            }
            if (llmUsage && "output_token_details" in llmUsage) {
                for (const [key, val] of Object.entries(llmUsage["output_token_details"] ?? {})) {
                    usageDetails[`output_${key}`] = val;
                    if ("output" in usageDetails && typeof val === "number") {
                        usageDetails["output"] = Math.max(0, usageDetails["output"] - val);
                    }
                }
            }
            let val = lastResponse;
            const llmResponse = this.extractChatMessageContent(val["message"]);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    messages: [llmResponse],
                    model: modelName,
                    usageDetails: usageDetails,
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    async handleLLMError(err, runId, parentRunId) {
        try {
            this.logger.debug(`LLM error ${err} with ID: ${runId}`);
            const azureRefusalError = this.parseAzureRefusalError(err);
            this.handleOtelSpanEnd({
                runId,
                attributes: {
                    level: "ERROR",
                    statusMessage: err.toString() + azureRefusalError,
                },
            });
        }
        catch (e) {
            this.logger.debug(e instanceof Error ? e.message : String(e));
        }
    }
    startAndRegisterOtelSpan(params) {
        const { type, runName, runId, parentRunId, attributes, metadata, tags } = params;
        const parentSpan = parentRunId && this.runMap.has(parentRunId)
            ? this.runMap.get(parentRunId)
            : undefined;
        const joinedMetadata = this.joinTagsAndMetaData(tags, metadata);
        const inputs = { ...attributes };
        if (joinedMetadata !== undefined) {
            inputs.metadata = joinedMetadata;
        }
        const span = mlflow.startSpan({
            name: runName,
            spanType: type,
            inputs,
            parent: parentSpan
        });
        if (parentRunId) {
            span.setAttribute("parentRunID", parentRunId);
        }
        this.runMap.set(runId, span);
        return span;
    }
    handleOtelSpanEnd(params) {
        const { runId, attributes = {} } = params;
        const span = this.runMap.get(runId);
        if (!span) {
            this.logger.warn("Span not found in runMap. Skipping operation");
            return;
        }
        span.setOutputs({ ...attributes });
        span.setStatus(mlflow.SpanStatusCode.OK);
        span.end();
        this.last_trace_id = span.traceId;
        this.runMap.delete(runId);
    }
    parseAzureRefusalError(err) {
        let azureRefusalError = "";
        if (typeof err == "object" && "error" in err) {
            try {
                azureRefusalError =
                    "\n\nError details:\n" + JSON.stringify(err["error"], null, 2);
            }
            catch { }
        }
        return azureRefusalError;
    }
    joinTagsAndMetaData(tags, metadata1, metadata2) {
        const finalDict = {};
        if (tags && tags.length > 0) {
            finalDict.tags = tags;
        }
        if (metadata1) {
            Object.assign(finalDict, metadata1);
        }
        if (metadata2) {
            Object.assign(finalDict, metadata2);
        }
        return Object.keys(finalDict).length > 0 ? finalDict : undefined;
    }
    extractUsageMetadata(generation) {
        try {
            const usageMetadata = "message" in generation &&
                (generation["message"] instanceof messages_1.AIMessage ||
                    generation["message"] instanceof messages_1.AIMessageChunk)
                ? generation["message"].usage_metadata
                : undefined;
            return usageMetadata;
        }
        catch (err) {
            this.logger.debug(`Error extracting usage metadata: ${err}`);
            return;
        }
    }
    extractModelNameFromMetadata(generation) {
        try {
            return "message" in generation
                ? generation["message"].response_metadata.model_name
                : undefined;
        }
        catch { }
        return undefined;
    }
    extractChatMessageContent(message) {
        let response = undefined;
        if (message.getType() == "human") {
            response = { content: message.content, role: "user" };
        }
        else if (message.getType() == "ai") {
            response = { content: message.content, role: "assistant" };
        }
        else if (message.getType() == "system") {
            response = { content: message.content, role: "system" };
        }
        else if (message.getType() == "function") {
            response = {
                content: message.content,
                additional_kwargs: message.additional_kwargs,
                role: message.name,
            };
        }
        else if (message.getType() == "tool") {
            response = {
                content: message.content,
                additional_kwargs: message.additional_kwargs,
                role: "tool",
            };
        }
        else if (!message.name) {
            response = { content: message.content, role: "user" };
        }
        else {
            response = {
                role: message.name,
                content: message.content,
            };
        }
        if (message.additional_kwargs.function_call ||
            message.additional_kwargs.tool_calls) {
            return { ...response, tool_calls: message.additional_kwargs.tool_calls };
        }
        return response;
    }
}
exports.CallbackHandler = CallbackHandler;
//# sourceMappingURL=CallbackHandler.js.map