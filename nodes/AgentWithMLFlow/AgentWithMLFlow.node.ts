import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { promptTypeOptions, textFromPreviousNode, textInput } from './src/utils/descriptions';
import { getToolsAgentProperties } from './V2/description';
import { toolsAgentExecute } from './V2/execute';
import { getInputs } from './V2/utils';

export class AgentWithMLFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Agent with MLFlow',
		name: 'agentWithMLFlow',
		icon: { light: 'file:AgentWithMLFlowLight.icon.svg', dark: 'file:AgentWithMLFlowDark.icon.svg' },
		group: ['transform'],
		description: 'Generates an action plan and executes it. Can use external tools.',
		defaults: {
			name: 'AI Agent with MLFlow',
		},
		version: 2,
		credentials: [
			{
				name: 'databricks',
				required: false,
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Agents', 'Root Nodes'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/',
					},
				],
			},
		},
		inputs: `={{
				((hasOutputParser, needsFallback) => {
					${getInputs.toString()};
					return getInputs(true, hasOutputParser, needsFallback);
				})(
					!!$parameter.hasOutputParser, 
					!!$parameter.needsFallback   
					)
			}}`,
		outputs: ['main'],
		properties: [
			{
				displayName:
					'Tip: Get a feel for agents with our quick <a href="https://docs.n8n.io/advanced-ai/intro-tutorial/" target="_blank">tutorial</a> or see an <a href="/workflows/templates/1954" target="_blank">example</a> of how this node works',
				name: 'aiAgentStarterCallout',
				type: 'callout',
				default: '',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased
				displayName: 'Get started faster with our',
				name: 'preBuiltAgentsCallout',
				type: 'callout',
				typeOptions: {
					calloutAction: {
						label: 'pre-built agents',
						icon: 'bot',
						type: 'openPreBuiltAgentsCollection',
					},
				},
				default: '',
			},
			promptTypeOptions,
			{
				...textFromPreviousNode,
				displayOptions: {
					show: {
						promptType: ['auto'],
					},
				},
			},
			{
				...textInput,
				displayOptions: {
					show: {
						promptType: ['define'],
					},
				},
			},
			{
				displayName: 'Require Specific Output Format',
				name: 'hasOutputParser',
				type: 'boolean',
				default: false,
				noDataExpression: true,
			},
			{
				displayName: `Connect an <a data-action='openSelectiveNodeCreator' data-action-parameter-connectiontype='ai_outputParser'>output parser</a> on the canvas to specify the output format you require`,
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						hasOutputParser: [true],
					},
				},
			},
		{
			displayName: 'Enable MLflow Tracking',
			name: 'enableMLflow',
			type: 'boolean',
			default: false,
			description: 'Whether to log agent execution traces to MLflow. Uses workflow ID as experiment name, creating it if needed.',
		},
		{
			displayName: 'Enable Quality Monitoring',
			name: 'enableMLflowMonitoring',
			type: 'boolean',
			default: false,
			description: 'Automatically evaluate agent responses for safety and correctness',
			displayOptions: {
				show: {
					enableMLflow: [true],
				},
			},
		},
		// Safety Scorer
		{
			displayName: 'Safety',
			name: 'enableSafetyScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate responses for safety concerns',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'safetySampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableSafetyScorer: [true],
				},
			},
		},
		// Correctness Scorer
		{
			displayName: 'Correctness',
			name: 'enableCorrectnessScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate responses for correctness',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'correctnessSampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableCorrectnessScorer: [true],
				},
			},
		},
		// Relevance to Query Scorer
		{
			displayName: 'Relevance to Query',
			name: 'enableRelevanceToQueryScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate if responses are relevant to the query',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'relevanceToQuerySampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableRelevanceToQueryScorer: [true],
				},
			},
		},
		// Retrieval Groundedness Scorer
		{
			displayName: 'Retrieval Groundedness',
			name: 'enableRetrievalGroundednessScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate if responses are grounded in retrieved content',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'retrievalGroundednessSampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableRetrievalGroundednessScorer: [true],
				},
			},
		},
		// Retrieval Relevance Scorer
		{
			displayName: 'Retrieval Relevance',
			name: 'enableRetrievalRelevanceScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate if retrieved content is relevant',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'retrievalRelevanceSampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableRetrievalRelevanceScorer: [true],
				},
			},
		},
		// Retrieval Sufficiency Scorer
		{
			displayName: 'Retrieval Sufficiency',
			name: 'enableRetrievalSufficiencyScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate if retrieved content is sufficient',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'retrievalSufficiencySampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableRetrievalSufficiencyScorer: [true],
				},
			},
		},
		// Guidelines Scorer
		{
			displayName: 'Guidelines',
			name: 'enableGenericGuidelinesScorer',
			type: 'boolean',
			default: false,
			description: 'Evaluate responses against custom guidelines',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Sample Rate (%)',
			name: 'genericGuidelinesSampleRate',
			type: 'number',
			default: 100,
			description: 'Percentage of responses to evaluate',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableGenericGuidelinesScorer: [true],
				},
			},
		},
		{
			displayName: 'Guidelines Text',
			name: 'genericGuidelines',
			type: 'string',
			typeOptions: {
				rows: 4,
			},
			default: '',
			placeholder: 'e.g., The response must not mention competitor products',
			description: 'Specific guidelines to evaluate against',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
					enableGenericGuidelinesScorer: [true],
				},
			},
		},
			{
				displayName: 'Enable Fallback Model',
				name: 'needsFallback',
				type: 'boolean',
				default: false,
				noDataExpression: true,
				displayOptions: {
					show: {
						'@version': [{ _cnd: { gte: 2.1 } }],
					},
				},
			},
			{
				displayName:
					'Connect an additional language model on the canvas to use it as a fallback if the main model fails',
				name: 'fallbackNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						needsFallback: [true],
					},
				},
			},

			...getToolsAgentProperties({ withStreaming: true }),
		],
		hints: [
			{
				message:
					'You are using streaming responses. Make sure to set the response mode to "Streaming Response" on the connected trigger node.',
				type: 'warning',
				location: 'outputPane',
				whenToDisplay: 'afterExecution',
				displayCondition: '={{ $parameter["enableStreaming"] === true }}',
			},
		],
	};


	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await toolsAgentExecute.call(this);
	}
}
