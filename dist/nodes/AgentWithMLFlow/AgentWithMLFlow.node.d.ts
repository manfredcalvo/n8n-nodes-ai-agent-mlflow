import type { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodeListSearchResult, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class AgentWithMLFlow implements INodeType {
    description: INodeTypeDescription;
    methods: {
        listSearch: {
            searchExperiments(this: ILoadOptionsFunctions): Promise<INodeListSearchResult>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
