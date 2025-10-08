import type { DataTableFilter, DataStoreRowReturn, IDataStoreProjectService, IDisplayOptions, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
export declare function getSelectFields(displayOptions: IDisplayOptions, requireCondition?: boolean, skipOperator?: boolean): INodeProperties[];
export declare function getSelectFilter(ctx: IExecuteFunctions, index: number): Promise<DataTableFilter>;
export declare function executeSelectMany(ctx: IExecuteFunctions, index: number, dataStoreProxy: IDataStoreProjectService, rejectEmpty?: boolean, limit?: number): Promise<Array<{
    json: DataStoreRowReturn;
}>>;
//# sourceMappingURL=selectMany.d.ts.map