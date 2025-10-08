import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { promptTypeOptions, textFromPreviousNode, textInput } from './src/utils/descriptions';
// import { getInputs } from './utils';
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
				required: true,
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
			{
				displayName: 'MLflow Experiment',
				name: 'experimentMode',
				type: 'options',
				options: [
					{
						name: 'Select Existing',
						value: 'select',
					},
					{
						name: 'Create or Use Existing',
						value: 'create',
					},
				],
				default: 'select',
				description: 'Whether to select an existing experiment or create a new one (will reuse if already exists)',
			},
			{
				displayName: 'Experiment',
				name: 'experimentId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				displayOptions: {
					show: {
						experimentMode: ['select'],
					},
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchExperiments',
							searchable: true,
						},
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
						validation: [
							{
								type: 'regex',
								properties: {
									regex: '^[0-9]+$',
									errorMessage: 'Experiment ID must be a number',
								},
							},
						],
						placeholder: 'e.g. 1427538817675103',
					},
				],
			},
			{
				displayName: 'Experiment Name',
				name: 'experimentName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. my-ai-agent-experiment',
				description: 'Name for the new MLflow experiment. Can be a simple name (will be created under /Users/<your-user>/) or an absolute path starting with / (e.g., /Shared/my-experiment)',
				displayOptions: {
					show: {
						experimentMode: ['create'],
					},
				},
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

	methods = {
		listSearch: {
			async searchExperiments(
				this: ILoadOptionsFunctions,
			): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('databricks');
				const databricksHost = (credentials.host as string).replace(/\/$/, '');
				const results: INodeListSearchResult = { results: [] };

				try {
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: `${databricksHost}/api/2.0/mlflow/experiments/search`,
						headers: {
							Authorization: `Bearer ${credentials.token}`,
						},
						qs: {
							max_results: 1000,
						},
					});

					if (response.experiments && Array.isArray(response.experiments)) {
						results.results = response.experiments.map((exp: any) => ({
							name: exp.name,
							value: exp.experiment_id,
							url: `${databricksHost}/ml/experiments/${exp.experiment_id}`,
						}));
					}
				} catch (error) {
					// If error, return empty list
					console.error('Error fetching experiments:', error);
				}

				return results;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await toolsAgentExecute.call(this);
	}
}
