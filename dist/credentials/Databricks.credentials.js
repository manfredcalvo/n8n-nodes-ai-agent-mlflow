"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Databricks = void 0;
class Databricks {
    name = 'databricks';
    displayName = 'Databricks';
    documentationUrl = 'https://docs.databricks.com/dev-tools/api/latest/authentication.html';
    icon = 'file:databricks.svg';
    properties = [
        {
            displayName: 'Host',
            name: 'host',
            type: 'string',
            default: '',
            placeholder: 'https://adb-xxxxx.xx.azure.databricks.com',
            required: true,
            description: 'Domain of your Databricks workspace',
        },
        {
            displayName: 'Personal Access Token',
            name: 'token',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            placeholder: 'dapixxxxxxxxxxxxxxxxxxxxxx',
            required: true,
            description: 'Databricks personal access token',
        },
    ];
    authenticate = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.token}}',
            },
        },
    };
    test = {
        request: {
            baseURL: '={{$credentials.host}}',
            url: '/api/2.0/serving-endpoints',
            method: 'GET',
        },
    };
}
exports.Databricks = Databricks;
//# sourceMappingURL=Databricks.credentials.js.map