import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import { BaseMessage, type BaseMessageFields } from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";
import type { ChainValues } from "@langchain/core/utils/types";
export type LlmMessage = {
    role: string;
    content: BaseMessageFields["content"];
    additional_kwargs?: BaseMessageFields["additional_kwargs"];
};
export type AnonymousLlmMessage = {
    content: BaseMessageFields["content"];
    additional_kwargs?: BaseMessageFields["additional_kwargs"];
};
type ConstructorParams = {
    userId?: string;
    sessionId?: string;
    tags?: string[];
    version?: string;
    traceMetadata?: Record<string, unknown>;
};
export declare class CallbackHandler extends BaseCallbackHandler {
    name: string;
    private runMap;
    last_trace_id: string | null;
    constructor(params?: ConstructorParams);
    get logger(): import("log4js").Logger;
    handleLLMNewToken(token: string, _idx: any, runId: string, _parentRunId?: string, _tags?: string[], _fields?: any): Promise<void>;
    handleChainStart(chain: Serialized, inputs: ChainValues, runId: string, parentRunId?: string | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, runType?: string, name?: string): Promise<void>;
    handleAgentAction(action: AgentAction, runId: string, parentRunId?: string): Promise<void>;
    handleAgentEnd?(action: AgentFinish, runId: string, parentRunId?: string): Promise<void>;
    handleChainError(err: any, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleGenerationStart(llm: Serialized, messages: Record<string, any>, runId: string, parentRunId?: string | undefined, extraParams?: Record<string, unknown> | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, name?: string): Promise<void>;
    handleChatModelStart(llm: Serialized, messages: BaseMessage[][], runId: string, parentRunId?: string | undefined, extraParams?: Record<string, unknown> | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, name?: string): Promise<void>;
    handleChainEnd(outputs: ChainValues, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleLLMStart(llm: Serialized, prompts: string[], runId: string, parentRunId?: string | undefined, extraParams?: Record<string, unknown> | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, name?: string): Promise<void>;
    handleToolStart(tool: Serialized, input: string, runId: string, parentRunId?: string | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, name?: string): Promise<void>;
    handleRetrieverStart(retriever: Serialized, query: string, runId: string, parentRunId?: string | undefined, tags?: string[] | undefined, metadata?: Record<string, unknown> | undefined, name?: string): Promise<void>;
    handleRetrieverEnd(documents: Document<Record<string, any>>[], runId: string, parentRunId?: string | undefined): Promise<void>;
    handleRetrieverError(err: any, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleToolEnd(output: string, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleToolError(err: any, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string | undefined): Promise<void>;
    handleLLMError(err: any, runId: string, parentRunId?: string | undefined): Promise<void>;
    private startAndRegisterOtelSpan;
    private handleOtelSpanEnd;
    private parseAzureRefusalError;
    private joinTagsAndMetaData;
    private extractUsageMetadata;
    private extractModelNameFromMetadata;
    private extractChatMessageContent;
}
export {};
