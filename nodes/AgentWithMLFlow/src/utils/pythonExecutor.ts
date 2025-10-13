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

export interface MLFlowConfig{
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

export async function isPythonAvailable(logger?: Logger): Promise<boolean> {
    return new Promise((resolve) => {
        const python = spawn('python3', ['--version']);

        let versionOutput = '';

        python.stdout.on('data', (data) => {
            versionOutput += data.toString();
        });

        python.stderr.on('data', (data) => {
            versionOutput += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                logger?.debug(`Python detected: ${versionOutput.trim()}`);
                resolve(true);
            } else {
                logger?.debug('Python 3 not found in system PATH');
                resolve(false);
            }
        });

        python.on('error', () => {
            logger?.debug('Python 3 not available');
            resolve(false);
        });

        setTimeout(() => {
            python.kill();
            resolve(false);
        }, 5000);
    });
}

export async function isMlflowAvailable(logger?: Logger): Promise<boolean> {
    return new Promise((resolve) => {
        const python = spawn('python3', ['-c', 'import mlflow; print(mlflow.__version__)']);

        let output = '';

        python.stdout.on('data', (data) => {
            output += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                logger?.debug(`MLflow detected: version ${output.trim()}`);
                resolve(true);
            } else {
                logger?.debug('MLflow not installed');
                resolve(false);
            }
        });

        python.on('error', () => {
            resolve(false);
        });

        setTimeout(() => {
            python.kill();
            resolve(false);
        }, 5000);
    });
}

function generateScorerScript(configs: ScorerConfig[]): string {
    const scorerImports = new Set<string>();
    const scorerActivations: string[] = [];

    configs.forEach((config, index) => {
        const className = SCORER_CLASS_MAP[config.scorerType];
        if (className) {
            scorerImports.add(className);
            const sampleRatePercent = Math.round(config.sampleRate * 100);

            // Sanitize name for Python variable (remove invalid characters, ensure starts with letter)
            const sanitizeName = (name: string) => {
                let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
                // Python variables cannot start with a number
                if (/^[0-9]/.test(sanitized)) {
                    sanitized = 'n8n_' + sanitized;
                }
                return sanitized;
            };
            const scorerVarName = config.name
                ? sanitizeName(config.name)
                : `${config.scorerType}_${index}`;
            const registrationName = config.name || `n8n_${config.scorerType}_${index}`;

            // Build scorer initialization
            let scorerInit = '';
            if (config.scorerType === 'guidelines') {
                const guidelines = config.guidelines || 'Follow best practices';
                const guidelineName = config.name || 'custom_guidelines';
                scorerInit = `${className}(name="${guidelineName}", guidelines="${guidelines}")`;
            } else {
                scorerInit = `${className}()`;
            }

            scorerActivations.push(`
    try:
        ${scorerVarName}_scorer = ${scorerInit}.register(name="${registrationName}")
        ${scorerVarName}_scorer = ${scorerVarName}_scorer.start(
            sampling_config=ScorerSamplingConfig(sample_rate=${config.sampleRate})
        )
        print("Scorer activated: ${className} (name=${registrationName}, sample_rate=${sampleRatePercent}%)")
    except Exception as e:
        print(f"Warning: Failed to activate ${className} scorer: {e}")`);
        }
    });

    // Use first config for shared settings (all scorers use same experiment)
    const firstConfig = configs[0];

    // Build list of current scorer names for cleanup
    const currentScorerNames = configs.map((c, index) => c.name || `n8n_${c.scorerType}_${index}`);
    const currentScorerNamesStr = currentScorerNames.map(name => `"${name}"`).join(', ');

    return `
import sys
import os

os.environ['DATABRICKS_HOST'] = '${firstConfig.databricksHost}'
os.environ['DATABRICKS_TOKEN'] = '${firstConfig.databricksToken}'

try:
    from mlflow.genai.scorers import ${Array.from(scorerImports).join(', ')}, ScorerSamplingConfig, get_scorer, list_scorers, delete_scorer
    import mlflow

    mlflow.set_tracking_uri('databricks')
    mlflow.set_experiment('${firstConfig.experimentName}')

    print("MLflow configured for experiment: ${firstConfig.experimentName}")

    # Get list of currently configured scorer names from n8n
    current_scorer_names = {${currentScorerNamesStr}}

    # List all existing scorers and clean up n8n-managed ones not in current config
    try:
        existing_scorers = list_scorers()
        for scorer_info in existing_scorers:
            scorer_name = scorer_info.get('name', '')
            # If it's an n8n-managed scorer (starts with 'n8n_' or was previously managed)
            # and it's NOT in our current config, delete it
            if scorer_name.startswith('n8n_') and scorer_name not in current_scorer_names:
                try:
                    delete_scorer(scorer_name)
                    print(f"Deleted obsolete scorer: {scorer_name}")
                except Exception as e:
                    print(f"Note: Could not delete scorer {scorer_name}: {e}")
    except Exception as e:
        print(f"Note: Could not list/cleanup existing scorers: {e}")

    # Now activate or update scorers
${scorerActivations.map(activation => {
        // Extract scorer name from the activation code
        const nameMatch = activation.match(/name="([^"]+)"/);
        const scorerName = nameMatch ? nameMatch[1] : '';
        const sampleRateMatch = activation.match(/sample_rate=([\d.]+)/);
        const sampleRate = sampleRateMatch ? sampleRateMatch[1] : '1.0';

        // Indent the activation code by 8 spaces (2 levels: try block + except block)
        const indentedActivation = activation.split('\n').map(line =>
            line.trim() ? '        ' + line : line
        ).join('\n');

        return `
    # Handle scorer: ${scorerName}
    try:
        existing_scorer = get_scorer("${scorerName}")
        # Scorer exists, update it
        existing_scorer.update(sampling_config=ScorerSamplingConfig(sample_rate=${sampleRate}))
        print(f"Updated existing scorer: ${scorerName} (sample_rate=${sampleRate})")
    except Exception:
        # Scorer doesn't exist, create it
${indentedActivation}`;
    }).join('\n')}

    print("All scorers activated/updated successfully")
    sys.exit(0)

except ImportError as e:
    print(f"Error: MLflow with Databricks support not installed: {e}")
    print("Install with: pip install 'mlflow[databricks]'")
    sys.exit(1)
except Exception as e:
    print(f"Error activating scorers: {e}")
    sys.exit(1)
`.trim();
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

        const script = generateScorerScript(configs);
        //In this function we create the json that contains the scorers config.
        //In this function you can keep all the validations you are adding in generateScorerScript.
        //json_string = generateScorersJsonConfig(configs);

        const python = spawn('python3', ['-c', "create_scorers.py", "--creation_config", "json_string"], {
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
                error: 'Python execution timed out after 30 seconds',
            });
        }, 30000);
    });
}
