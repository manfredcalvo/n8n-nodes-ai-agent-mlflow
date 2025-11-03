// Function used in the inputs expression to figure out which inputs to

import {
    type INodeInputConfiguration,
    type INodeInputFilter,
    type NodeConnectionType,
    NodeOperationError,
    type ILoadOptionsFunctions,
    type INodePropertyOptions,
} from 'n8n-workflow';

import { maskTokensInText } from '../src/utils/retry';

import * as mlflow from "mlflow-tracing";
import { validateAndCleanDatabricksCredentials } from '../src/utils/security';

// display based on the agent type
export function getInputs(
    hasMainInput?: boolean,
    hasOutputParser?: boolean,
    needsFallback?: boolean,
): Array<NodeConnectionType | INodeInputConfiguration> {
    interface SpecialInput {
        type: NodeConnectionType;
        filter?: INodeInputFilter;
        displayName: string;
        required?: boolean;
    }

    const getInputData = (
        inputs: SpecialInput[],
    ): Array<NodeConnectionType | INodeInputConfiguration> => {
        return inputs.map(({ type, filter, displayName, required }) => {
            const input: INodeInputConfiguration = {
                type,
                displayName,
                required,
                maxConnections: ['ai_languageModel', 'ai_memory', 'ai_outputParser'].includes(type)
                    ? 1
                    : undefined,
            };

            if (filter) {
                input.filter = filter;
            }

            return input;
        });
    };

    let specialInputs: SpecialInput[] = [
        {
            type: 'ai_languageModel',
            displayName: 'Chat Model',
        },
        {
            type: 'ai_languageModel',
            displayName: 'Fallback Model',
        },
        {
            displayName: 'Memory',
            type: 'ai_memory',
        },
        {
            displayName: 'Tool',
            type: 'ai_tool',
        },
        {
            displayName: 'Output Parser',
            type: 'ai_outputParser',
        },
    ];

    if (hasOutputParser !== true) {
        specialInputs = specialInputs.filter((input) => input.type !== 'ai_outputParser');
    }
    if (needsFallback !== true) {
        specialInputs = specialInputs.filter((input) => input.displayName !== 'Fallback Model');
    }

    // Note cannot use NodeConnectionType.Main
    // otherwise expression won't evaluate correctly on the FE
    const mainInputs = hasMainInput ? ['main' as NodeConnectionType] : [];
    return [...mainInputs, ...getInputData(specialInputs)];
}

export async function getExperimentName(values: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {

        const credentials = await values.getCredentials('databricks');

        const validated = validateAndCleanDatabricksCredentials(credentials);
        const databricksHost = validated.databricksHost;
        const token = validated.token;
        const workflowId = values.getWorkflow().id;

        const experimentName = `/Shared/n8n-workflows-${workflowId}`;

        let experimentId: string | undefined;

        try {
            // Initialize MLflow client for experiment management
            const client = new mlflow.MlflowClient({
                trackingUri: 'databricks',
                host: databricksHost,
                databricksToken: token,
            });

            try {
                // Try to create experiment using SDK
                experimentId = await client.createExperiment(experimentName);
            } catch (createError: unknown) {
                // Experiment already exists, get ID by name
                // Note: MlflowClient doesn't have getExperimentByName method
                const getResponse = await values.helpers.request({
                    method: 'GET',
                    url: `${databricksHost}/api/2.0/mlflow/experiments/get-by-name`,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    qs: {
                        experiment_name: experimentName,
                    },
                    json: true,
                });

                if (getResponse && getResponse.experiment && getResponse.experiment.experiment_id) {
                    experimentId = getResponse.experiment.experiment_id;
                } else {
                    throw createError;
                }
            }

            if (!experimentId) {
                throw new Error('Failed to get or create experiment ID');
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NodeOperationError(
                values.getNode(),
                `Failed to setup MLflow experiment: ${maskTokensInText(errorMessage)}`
            );
        }

    return [
        {
            name: experimentName,
            value: experimentId,
        },
    ];
}