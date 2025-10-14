import { spawn } from 'child_process';
import type { Logger } from 'n8n-workflow';
import { SCORER_CLASS_MAP } from './scorers';

/**
 * Result of Python execution
 */
export interface PythonExecutionResult {
    success: boolean;
    output?: string;
    error?: string;
}

export interface MLFlowConfig {
    experimentName: string;
    databricksHost: string;
    databricksToken: string;
}

/**
 * Configuration for a single MLflow scorer activation
 */
export interface ScorerConfig {
    name?: string;
    scorerType: string;
    sampleRate: number;
    guidelines?: string;
}

export async function activateScorers(
    mlflow_config: MLFlowConfig,
    configs: ScorerConfig[],
    logger?: Logger,
): Promise<PythonExecutionResult> {
    return new Promise((resolve) => {
        if (configs.length === 0) {
            resolve({
                success: false,
                error: 'No scorers configured',
            });
            return;
        }

        // Build the JSON configuration for create_scorers.py
        const scorersConfig = configs.map((config) => {
            // Map scorer type from n8n value to Python class name
            // e.g., "relevance_to_query" -> "RelevanceToQuery"
            const pythonClassName = SCORER_CLASS_MAP[config.scorerType];

            if (!pythonClassName) {
                throw new Error(`Unknown scorer type: ${config.scorerType}`);
            }

            // Use default name based on Python class for non-Guidelines scorers
            // For Guidelines, use custom name or generate one
            const scorerName = pythonClassName === 'Guidelines'
                ? (config.name || `guideline_${Date.now()}`)
                : pythonClassName;

            const scorerObj: any = {
                name: scorerName,
                scorer_type: pythonClassName,
                sample_rate: config.sampleRate,
            };

            // Add guidelines for Guidelines scorer type
            if (pythonClassName === 'Guidelines') {
                scorerObj.guidelines = config.guidelines
                    ? config.guidelines.split('\n').filter((line: string) => line.trim())
                    : [];
            }

            return scorerObj;
        });

        const creationConfig = {
            experiment_name: mlflow_config.experimentName,
            scorers: scorersConfig,
        };

        const jsonString = JSON.stringify(creationConfig);

        // Path to create_scorers.py in package root
        const scriptPath = require('path').resolve(__dirname, '../../../../../create_scorers.py');

        logger?.debug(`Executing create_scorers.py at: ${scriptPath}`);
        logger?.debug(`Config: ${jsonString}`);

        const python = spawn('python3', [scriptPath, '--creation_config', jsonString], {
            env: {
                ...process.env,
                DATABRICKS_HOST: mlflow_config.databricksHost,
                DATABRICKS_TOKEN: mlflow_config.databricksToken,
            },
        });

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            logger?.debug(`Python stdout: ${output.trim()}`);
        });

        python.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            logger?.debug(`Python stderr: ${output.trim()}`);
        });

        python.on('close', (code) => {
            if (code === 0) {
                logger?.info('Scorers activated successfully via Python');
                resolve({
                    success: true,
                    output: stdout.trim(),
                });
            } else {
                logger?.warn(`Python script failed with code ${code}: ${stderr.trim()}`);
                resolve({
                    success: false,
                    error: stderr.trim() || stdout.trim(),
                });
            }
        });

        python.on('error', (err) => {
            logger?.warn(`Failed to spawn Python process: ${err.message}`);
            resolve({
                success: false,
                error: err.message,
            });
        });

        setTimeout(() => {
            python.kill();
            resolve({
                success: false,
                error: 'Python execution timed out after 60 seconds',
            });
        }, 60000);
    });
}
