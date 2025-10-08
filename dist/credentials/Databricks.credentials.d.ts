import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class Databricks implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: "file:databricks.svg";
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
