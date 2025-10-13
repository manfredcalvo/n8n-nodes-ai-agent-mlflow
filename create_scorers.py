import json
import os
import argparse

import mlflow
from mlflow.genai.scorers import ScorerSamplingConfig, delete_scorer, list_scorers
from mlflow.genai.scorers import Safety, Correctness, RelevanceToQuery, RetrievalGroundedness, RetrievalRelevance, RetrievalSufficiency, Guidelines

input_example_data = {
    "experiment_name": "my_experiment",
    "scorers":[
        {"name": "my_safety",
        "scorer_type": "Safety",
        "sample_rate": 0.5,
        "guidelines": []
        },
        {"name": "my_custom_guidelines",
        "scorer_type": "Guidelines",
        "sample_rate": 0.5,
        "guidelines": ["Be polite.", "Answers with less than 10 characters."]
        },
    ]
}

CLASS_BY_NAME = {
    "Safety": Safety,
    "Correctness": Correctness,
    "RelevanceToQuery": RelevanceToQuery,
    "RetrievalGroundedness": RetrievalGroundedness,
    "RetrievalRelevance": RetrievalRelevance,
    "RetrievalSufficiency": RetrievalSufficiency,
    "Guidelines": Guidelines
}

def get_class_by_name(name:str):
    try:
        return CLASS_BY_NAME[name]
    except:
        raise NameError("Scorer with name '{name}' is not a pre-built mlflow scorer.")

def create_or_update_scorers(experiment_name, scorers_config):
    
    mlflow.set_tracking_uri('databricks')
    mlflow.set_experiment(experiment_name)

    print(f"MLflow configured for experiment: {experiment_name}")

    config_scorer_names = set(scorer["name"] for scorer in scorers_config)

    # List all existing scorers and clean up n8n-managed ones not in current config
    try:
        existing_scorers = list_scorers()
        actual_scorers = dict()
        for scorer_info in existing_scorers:
            scorer_name = scorer_info.name
            actual_scorers[scorer_name] = scorer_info
            # If it's an n8n-managed scorer (starts with 'n8n_' or was previously managed)
            # and it's NOT in our current config, delete it
            if scorer_name.startswith('n8n_') and scorer_name not in config_scorer_names:
                try:
                    delete_scorer(name=scorer_name)
                    print(f"Deleted obsolete scorer: {scorer_name}")
                except Exception as e:
                    print(f"Note: Could not delete scorer {scorer_name}: {e}")
    except Exception as e:
        print(f"Note: Could not list/cleanup existing scorers: {e}")

    # Now activate or update scorers

    for scorer_config in scorers_config:
        sample_rate = scorer_config['sample_rate']
        scorer_name = scorer_config['name']
        if scorer_name in actual_scorers:
            actual_scorer = actual_scorers[scorer_name]
            actual_scorer.update(sampling_config=ScorerSamplingConfig(sample_rate=sample_rate))
        else:
            scorer_type = scorer_config['scorer_type']
            scorer_cls = get_class_by_name(scorer_type)
            args = {"name": scorer_name}
            if scorer_type == 'Guidelines':
                try:
                    args["guidelines"] = scorer_config['guidelines']
                except:
                    raise KeyError("Guidelines scorer needs a set of guidelines to be defined.")
            scorer_fn = scorer_cls(**args)
            created_scorer = scorer_fn.register(name=scorer_name)
            created_scorer.start(sampling_config=ScorerSamplingConfig(sample_rate=sample_rate))

def get_parser():
    parser = argparse.ArgumentParser(description="Script to create or update scorers of a genai mlflow experiment.")
    parser.add_argument("--creation_config", help="JSON specification of the scorers config and mlflow experiment.")

if __name__ == "__main__":
    assert all(env_variable in os.environ for env_variable in ["DATABRICKS_HOST", "DATABRICKS_TOKEN"]), "You need to set DATABRICKS_HOST and DATABRICKS_TOKEN environment variables before running this script."

    parser= get_parser()
    
    args = parser.parse_args()

    try:
        creation_config = json.loads(args.creation_config)
    except:
        raise Exception("Creation config must a valid json string with keys: ['experiment_name', 'scorers']")


    create_or_update_scorers(creation_config["experiment_name"], creation_config["scorers"])
