import type { ICredentialDataDecryptedObject, ICredentialTestRequest, ICredentialType, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
type RegionData = {
    name: string;
    displayName: string;
    location: string;
    domain?: string;
};
export declare const regions: RegionData[];
export type AWSRegion = (typeof regions)[number]['name'];
export type AwsCredentialsType = {
    region: AWSRegion;
    accessKeyId: string;
    secretAccessKey: string;
    temporaryCredentials: boolean;
    customEndpoints: boolean;
    sessionToken?: string;
    rekognitionEndpoint?: string;
    lambdaEndpoint?: string;
    snsEndpoint?: string;
    sesEndpoint?: string;
    sqsEndpoint?: string;
    s3Endpoint?: string;
    ssmEndpoint?: string;
};
export declare class Aws implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: {
        readonly light: "file:icons/AWS.svg";
        readonly dark: "file:icons/AWS.dark.svg";
    };
    properties: INodeProperties[];
    authenticate(rawCredentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions>;
    test: ICredentialTestRequest;
}
export {};
//# sourceMappingURL=Aws.credentials.d.ts.map