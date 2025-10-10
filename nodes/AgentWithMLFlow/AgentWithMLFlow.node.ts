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
import { getScorerOptions } from './src/utils/scorers';

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
		{
			displayName: '⚠️ Important: Each scorer type (except Guidelines) can only be added once. Adding duplicates will cause execution to fail.',
			name: 'scorerWarning',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
		},
		{
			displayName: 'Quality Scorers',
			name: 'qualityScorers',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			default: {},
			placeholder: 'Add Scorer',
			description: 'Configure quality scorers to evaluate agent responses. Changes take effect on next execution (existing scorers are stopped and restarted).',
			noDataExpression: true,
			displayOptions: {
				show: {
					enableMLflow: [true],
					enableMLflowMonitoring: [true],
				},
			},
			options: [
				{
					name: 'scorers',
					displayName: 'Scorer',
					values: [
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
							placeholder: 'e.g., my_safety_check',
							description: 'Optional custom identifier for this scorer',
							noDataExpression: true,
						},
						{
							displayName: 'Type',
							name: 'type',
							type: 'options',
							default: 'safety',
							description: 'Quality metric to evaluate. Note: Only "Custom Guidelines" can be added multiple times.',
							options: getScorerOptions(),
							noDataExpression: true,
						},
						{
							displayName: 'Sample Rate (%)',
							name: 'sampleRate',
							type: 'number',
							default: 100,
							description: 'Percentage to evaluate (1-100)',
							typeOptions: {
								minValue: 1,
								maxValue: 100,
								numberPrecision: 0,
							},
							noDataExpression: true,
						},
						{
							displayName: 'Guidelines',
							name: 'guidelines',
							type: 'string',
							typeOptions: {
								rows: 4,
							},
							default: '',
							placeholder: 'e.g., The response must not mention competitor products',
							description: 'Specific guidelines to evaluate against',
							displayOptions: {
								show: {
									type: ['guidelines'],
								},
							},
						},
					],
				},
			],
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
