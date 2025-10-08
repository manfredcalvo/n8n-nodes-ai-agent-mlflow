import type { IDataObject, INode, DataTableFilter, IDataStoreProjectAggregateService, IDataStoreProjectService, IExecuteFunctions, ILoadOptionsFunctions, DataStoreColumnJsType } from 'n8n-workflow';
import type { FieldEntry, FilterType } from './constants';
export declare function getDataTableProxyExecute(ctx: IExecuteFunctions, index?: number): Promise<IDataStoreProjectService>;
export declare function getDataTableProxyLoadOptions(ctx: ILoadOptionsFunctions): Promise<IDataStoreProjectService | undefined>;
export declare function getDataTableAggregateProxy(ctx: IExecuteFunctions | ILoadOptionsFunctions): Promise<IDataStoreProjectAggregateService>;
export declare function isFieldEntry(obj: unknown): obj is FieldEntry;
export declare function isMatchType(obj: unknown): obj is FilterType;
export declare function buildGetManyFilter(fieldEntries: FieldEntry[], matchType: FilterType): DataTableFilter;
export declare function isFieldArray(value: unknown): value is FieldEntry[];
export declare function dataObjectToApiInput(data: IDataObject, node: INode, row: number): Record<string, DataStoreColumnJsType>;
export declare function getDryRunParameter(ctx: IExecuteFunctions, index: number): boolean;
//# sourceMappingURL=utils.d.ts.map