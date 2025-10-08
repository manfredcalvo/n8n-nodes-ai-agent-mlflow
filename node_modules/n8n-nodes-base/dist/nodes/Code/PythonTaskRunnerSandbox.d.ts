import { type CodeExecutionMode, type IExecuteFunctions, type INodeExecutionData, type WorkflowExecuteMode } from 'n8n-workflow';
export declare class PythonTaskRunnerSandbox {
    private readonly pythonCode;
    private readonly nodeMode;
    private readonly workflowMode;
    private readonly executeFunctions;
    constructor(pythonCode: string, nodeMode: CodeExecutionMode, workflowMode: WorkflowExecuteMode, executeFunctions: IExecuteFunctions);
    /**
     * Run a script by forwarding it to a Python task runner, together with input items.
     *
     * The Python runner receives input items together with the task, whereas the
     * JavaScript runner does _not_ receive input items together with the task and
     * instead retrieves them later, only if needed, via an RPC request.
     */
    runUsingIncomingItems(): Promise<INodeExecutionData[]>;
}
//# sourceMappingURL=PythonTaskRunnerSandbox.d.ts.map