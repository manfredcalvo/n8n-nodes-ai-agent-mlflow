/**
 * MLflow GenAI Built-in Scorers Configuration
 * Based on: https://docs.databricks.com/aws/en/mlflow3/genai/eval-monitor/predefined-judge-scorers
 */

export interface ScorerDefinition {
    name: string;
    value: string;
    description: string;
    pythonClass: string;
}

export const AVAILABLE_SCORERS: ScorerDefinition[] = [
    {
        name: 'Safety',
        value: 'safety',
        description: 'Evaluates if response avoids harmful/toxic content',
        pythonClass: 'Safety',
    },
    {
        name: 'Correctness',
        value: 'correctness',
        description: 'Compares response to expected facts (requires ground truth)',
        pythonClass: 'Correctness',
    },
    {
        name: 'Relevance to Query',
        value: 'relevance_to_query',
        description: 'Checks if response directly addresses user input',
        pythonClass: 'RelevanceToQuery',
    },
    {
        name: 'Retrieval Groundedness',
        value: 'retrieval_groundedness',
        description: 'Checks if response is grounded in retrieved information',
        pythonClass: 'RetrievalGroundedness',
    },
    {
        name: 'Retrieval Relevance',
        value: 'retrieval_relevance',
        description: 'Assesses relevance of retrieved documents',
        pythonClass: 'RetrievalRelevance',
    },
    {
        name: 'Retrieval Sufficiency',
        value: 'retrieval_sufficiency',
        description: 'Determines if retrieved documents contain necessary info (requires ground truth)',
        pythonClass: 'RetrievalSufficiency',
    },
    {
        name: 'Custom Guidelines',
        value: 'guidelines',
        description: 'Evaluates against custom guidelines you define (can add multiple)',
        pythonClass: 'Guidelines',
    },
];

export const SCORER_CLASS_MAP: Record<string, string> = Object.fromEntries(
    AVAILABLE_SCORERS.map(s => [s.value, s.pythonClass])
);

// Only Guidelines can be repeated (each with different custom rules)
export const ALLOW_MULTIPLE_INSTANCES = new Set(['guidelines']);

/**
 * Get user-friendly name for a scorer type
 */
export function getScorerDisplayName(scorerType: string): string {
    const scorer = AVAILABLE_SCORERS.find(s => s.value === scorerType);
    return scorer?.name || scorerType;
}

/**
 * Generate n8n options from scorer definitions
 */
export function getScorerOptions() {
    return AVAILABLE_SCORERS.map(scorer => ({
        name: scorer.name,
        value: scorer.value,
        description: scorer.description,
    }));
}
