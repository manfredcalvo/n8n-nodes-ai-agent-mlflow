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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsAgentExecute = toolsAgentExecute;
const runnables_1 = require("@langchain/core/runnables");
const agents_1 = require("langchain/agents");
const omit_1 = __importDefault(require("lodash/omit"));
const n8n_workflow_1 = require("n8n-workflow");
const node_assert_1 = __importDefault(require("node:assert"));
const CallbackHandler_1 = require("../V2/CallbackHandler");
const mlflow = __importStar(require("mlflow-tracing"));
const helpers_1 = require("../src/utils/helpers");
const N8nOutputParser_1 = require("../src/utils/N8nOutputParser");
const common_1 = require("../src/utils/common");
const prompt_1 = require("../src/utils/prompt");
function createAgentExecutor(model, tools, prompt, options, outputParser, memory, fallbackModel, mlflowHandler) {
    const callbacks = mlflowHandler ? [mlflowHandler] : [];
    const agent = (0, agents_1.createToolCallingAgent)({
        llm: model,
        tools,
        prompt,
        streamRunnable: false,
    });
    let fallbackAgent;
    if (fallbackModel) {
        fallbackAgent = (0, agents_1.createToolCallingAgent)({
            llm: fallbackModel,
            tools,
            prompt,
            streamRunnable: false,
        });
    }
    const runnableAgent = runnables_1.RunnableSequence.from([
        fallbackAgent ? agent.withFallbacks([fallbackAgent]) : agent,
        (0, common_1.getAgentStepsParser)(outputParser, memory),
        common_1.fixEmptyContentMessage,
    ]);
    runnableAgent.singleAction = false;
    runnableAgent.streamRunnable = false;
    return agents_1.AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        memory,
        tools,
        returnIntermediateSteps: options.returnIntermediateSteps === true,
        maxIterations: options.maxIterations ?? 10,
        callbacks,
    });
}
async function processEventStream(ctx, eventStream, itemIndex, returnIntermediateSteps = false) {
    const agentResult = {
        output: '',
    };
    if (returnIntermediateSteps) {
        agentResult.intermediateSteps = [];
    }
    ctx.sendChunk('begin', itemIndex);
    for await (const event of eventStream) {
        switch (event.event) {
            case 'on_chat_model_stream':
                const chunk = event.data?.chunk;
                if (chunk?.content) {
                    const chunkContent = chunk.content;
                    let chunkText = '';
                    if (Array.isArray(chunkContent)) {
                        for (const message of chunkContent) {
                            chunkText += message?.text;
                        }
                    }
                    else if (typeof chunkContent === 'string') {
                        chunkText = chunkContent;
                    }
                    ctx.sendChunk('item', itemIndex, chunkText);
                    agentResult.output += chunkText;
                }
                break;
            case 'on_chat_model_end':
                if (returnIntermediateSteps && event.data) {
                    const chatModelData = event.data;
                    const output = chatModelData.output;
                    if (output?.tool_calls && output.tool_calls.length > 0) {
                        for (const toolCall of output.tool_calls) {
                            agentResult.intermediateSteps.push({
                                action: {
                                    tool: toolCall.name,
                                    toolInput: toolCall.args,
                                    log: output.content ||
                                        `Calling ${toolCall.name} with input: ${JSON.stringify(toolCall.args)}`,
                                    messageLog: [output],
                                    toolCallId: toolCall.id,
                                    type: toolCall.type,
                                },
                            });
                        }
                    }
                }
                break;
            case 'on_tool_end':
                if (returnIntermediateSteps && event.data && agentResult.intermediateSteps.length > 0) {
                    const toolData = event.data;
                    const matchingStep = agentResult.intermediateSteps.find((step) => !step.observation && step.action.tool === event.name);
                    if (matchingStep) {
                        matchingStep.observation = toolData.output;
                    }
                }
                break;
            default:
                break;
        }
    }
    ctx.sendChunk('end', itemIndex);
    return agentResult;
}
async function toolsAgentExecute() {
    this.logger.debug('Executing Tools Agent V2');
    const credentials = await this.getCredentials('databricks');
    const databricksHost = credentials.host.replace(/\/$/, '');
    process.env.DATABRICKS_HOST = databricksHost;
    process.env.DATABRICKS_TOKEN = credentials.token;
    const experimentMode = this.getNodeParameter('experimentMode', 0);
    let experimentId;
    if (experimentMode === 'create') {
        const experimentName = this.getNodeParameter('experimentName', 0);
        try {
            let currentUser = '';
            try {
                const userResponse = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${databricksHost}/api/2.0/preview/scim/v2/Me`,
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                    },
                    json: true,
                });
                currentUser = userResponse.userName;
            }
            catch (userError) {
                this.logger.warn('Could not fetch current user, using default path');
            }
            let fullExperimentPath;
            if (experimentName.startsWith('/')) {
                fullExperimentPath = experimentName;
            }
            else if (currentUser) {
                fullExperimentPath = `/Users/${currentUser}/${experimentName}`;
            }
            else {
                fullExperimentPath = `/Shared/${experimentName}`;
            }
            this.logger.info(`Attempting to create MLflow experiment: ${fullExperimentPath}`);
            const response = await this.helpers.httpRequest({
                method: 'POST',
                url: `${databricksHost}/api/2.0/mlflow/experiments/create`,
                headers: {
                    Authorization: `Bearer ${credentials.token}`,
                    'Content-Type': 'application/json',
                },
                body: {
                    name: fullExperimentPath,
                },
                json: true,
                returnFullResponse: true,
                ignoreHttpStatusErrors: true,
            });
            if (response.statusCode && response.statusCode >= 400) {
                const errorBody = response.body;
                if (errorBody.error_code === 'RESOURCE_ALREADY_EXISTS') {
                    this.logger.info(`Experiment ${fullExperimentPath} already exists, fetching its ID...`);
                    try {
                        const searchResponse = await this.helpers.httpRequest({
                            method: 'GET',
                            url: `${databricksHost}/api/2.0/mlflow/experiments/get-by-name`,
                            headers: {
                                Authorization: `Bearer ${credentials.token}`,
                            },
                            qs: {
                                experiment_name: fullExperimentPath,
                            },
                            json: true,
                        });
                        experimentId = searchResponse.experiment.experiment_id;
                        this.logger.info(`Using existing MLflow experiment: ${fullExperimentPath} (ID: ${experimentId})`);
                    }
                    catch (getError) {
                        throw new Error(`Experiment exists but could not retrieve ID: ${getError.message}`);
                    }
                }
                else {
                    this.logger.error(`Databricks API error response: ${JSON.stringify(errorBody)}`);
                    throw new Error(`Databricks returned ${response.statusCode}: ${errorBody.message || JSON.stringify(errorBody)}`);
                }
            }
            else {
                experimentId = response.body.experiment_id;
                this.logger.info(`Created new MLflow experiment: ${fullExperimentPath} (ID: ${experimentId})`);
            }
        }
        catch (error) {
            let errorMessage = error.message;
            let errorDetails = '';
            this.logger.error(`Error creating experiment: ${JSON.stringify(error, null, 2)}`);
            if (error.cause) {
                errorDetails += `\nCause: ${JSON.stringify(error.cause)}`;
            }
            if (error.response?.body) {
                try {
                    const errorBody = typeof error.response.body === 'string'
                        ? JSON.parse(error.response.body)
                        : error.response.body;
                    errorMessage = errorBody.message || errorBody.error_code || error.message;
                    errorDetails += `\nDetails: ${JSON.stringify(errorBody)}`;
                }
                catch {
                    errorDetails += `\nRaw body: ${error.response.body}`;
                }
            }
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to create MLflow experiment: ${errorMessage}${errorDetails}`);
        }
    }
    else {
        const experimentResource = this.getNodeParameter('experimentId', 0);
        if (experimentResource.mode === 'list') {
            experimentId = experimentResource.value;
        }
        else if (experimentResource.mode === 'id') {
            experimentId = experimentResource.value;
        }
        else {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Please select an experiment or provide an experiment ID');
        }
    }
    mlflow.init({
        trackingUri: process.env.MLFLOW_TRACKING_URI || "databricks",
        experimentId: experimentId,
    });
    const returnData = [];
    const items = this.getInputData();
    const batchSize = this.getNodeParameter('options.batching.batchSize', 0, 1);
    const delayBetweenBatches = this.getNodeParameter('options.batching.delayBetweenBatches', 0, 0);
    const needsFallback = this.getNodeParameter('needsFallback', 0, false);
    const memory = await (0, common_1.getOptionalMemory)(this);
    const model = await (0, common_1.getChatModel)(this, 0);
    (0, node_assert_1.default)(model, 'Please connect a model to the Chat Model input');
    const fallbackModel = needsFallback ? await (0, common_1.getChatModel)(this, 1) : null;
    if (needsFallback && !fallbackModel) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Please connect a model to the Fallback Model input or disable the fallback option');
    }
    const enableStreaming = this.getNodeParameter('options.enableStreaming', 0, true);
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async (_item, batchItemIndex) => {
            const itemIndex = i + batchItemIndex;
            const input = (0, helpers_1.getPromptInputByType)({
                ctx: this,
                i: itemIndex,
                inputKey: 'text',
                promptTypeKey: 'promptType',
            });
            if (input === undefined) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'The "text" parameter is empty.');
            }
            const outputParser = await (0, N8nOutputParser_1.getOptionalOutputParser)(this, itemIndex);
            const tools = await (0, common_1.getTools)(this, outputParser);
            const options = this.getNodeParameter('options', itemIndex, {});
            const mlflowHandler = new CallbackHandler_1.CallbackHandler({});
            const messages = await (0, common_1.prepareMessages)(this, itemIndex, {
                systemMessage: options.systemMessage,
                passthroughBinaryImages: options.passthroughBinaryImages ?? true,
                outputParser,
            });
            const prompt = (0, common_1.preparePrompt)(messages);
            const executor = createAgentExecutor(model, tools, prompt, options, outputParser, memory, fallbackModel, mlflowHandler);
            const invokeParams = {
                input,
                system_message: options.systemMessage ?? prompt_1.SYSTEM_MESSAGE,
                formatting_instructions: 'IMPORTANT: For your response to user, you MUST use the `format_final_json_response` tool with your complete answer formatted according to the required schema. Do not attempt to format the JSON manually - always use this tool. Your response will be rejected if it is not properly formatted through this tool. Only use this tool once you are ready to provide your final answer.',
            };
            const executeOptions = {
                signal: this.getExecutionCancelSignal(),
                callbacks: [mlflowHandler]
            };
            const isStreamingAvailable = 'isStreaming' in this ? this.isStreaming?.() : undefined;
            if ('isStreaming' in this &&
                enableStreaming &&
                isStreamingAvailable &&
                this.getNode().typeVersion >= 2.1) {
                const chatHistory = await memory?.chatHistory.getMessages();
                const eventStream = executor.streamEvents({
                    ...invokeParams,
                    chat_history: chatHistory ?? undefined,
                }, {
                    version: 'v2',
                    ...executeOptions,
                });
                const tracedProcessEventStream = mlflow.trace(processEventStream, { name: "agent_with_tools",
                    spanType: mlflow.SpanType.CHAIN
                });
                return await tracedProcessEventStream(this, eventStream, itemIndex, options.returnIntermediateSteps);
            }
            else {
                return await executor.invoke(invokeParams, executeOptions);
            }
        });
        const batchResults = await Promise.allSettled(batchPromises);
        const outputParser = await (0, N8nOutputParser_1.getOptionalOutputParser)(this, 0);
        batchResults.forEach((result, index) => {
            const itemIndex = i + index;
            if (result.status === 'rejected') {
                const error = result.reason;
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message, stack: error.stack },
                        pairedItem: { item: itemIndex },
                    });
                    return;
                }
                else {
                    const enhancedError = new Error(`Agent execution failed: ${error.message}\n\nOriginal stack:\n${error.stack}`);
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), enhancedError);
                }
            }
            const response = result.value;
            if (memory && outputParser) {
                const parsedOutput = (0, n8n_workflow_1.jsonParse)(response.output);
                response.output = parsedOutput?.output ?? parsedOutput;
            }
            const itemResult = {
                json: (0, omit_1.default)(response, 'system_message', 'formatting_instructions', 'input', 'chat_history', 'agent_scratchpad'),
                pairedItem: { item: itemIndex },
            };
            returnData.push(itemResult);
        });
        if (i + batchSize < items.length && delayBetweenBatches > 0) {
            await (0, n8n_workflow_1.sleep)(delayBetweenBatches);
        }
    }
    return [returnData];
}
//# sourceMappingURL=execute.js.map