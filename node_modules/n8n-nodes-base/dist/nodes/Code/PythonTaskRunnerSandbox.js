"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonTaskRunnerSandbox = void 0;
const throw_execution_error_1 = require("./throw-execution-error");
class PythonTaskRunnerSandbox {
    pythonCode;
    nodeMode;
    workflowMode;
    executeFunctions;
    constructor(pythonCode, nodeMode, workflowMode, executeFunctions) {
        this.pythonCode = pythonCode;
        this.nodeMode = nodeMode;
        this.workflowMode = workflowMode;
        this.executeFunctions = executeFunctions;
    }
    /**
     * Run a script by forwarding it to a Python task runner, together with input items.
     *
     * The Python runner receives input items together with the task, whereas the
     * JavaScript runner does _not_ receive input items together with the task and
     * instead retrieves them later, only if needed, via an RPC request.
     */
    async runUsingIncomingItems() {
        const itemIndex = 0;
        const node = this.executeFunctions.getNode();
        const workflow = this.executeFunctions.getWorkflow();
        const taskSettings = {
            code: this.pythonCode,
            nodeMode: this.nodeMode,
            workflowMode: this.workflowMode,
            continueOnFail: this.executeFunctions.continueOnFail(),
            items: this.executeFunctions.getInputData(),
            nodeId: node.id,
            nodeName: node.name,
            workflowId: workflow.id,
            workflowName: workflow.name,
            /** Whether this task can log to the browser console. */
            canLog: this.executeFunctions.getMode() === 'manual',
        };
        const executionResult = await this.executeFunctions.startJob('python', taskSettings, itemIndex);
        return executionResult.ok
            ? executionResult.result
            : (0, throw_execution_error_1.throwExecutionError)('error' in executionResult ? executionResult.error : {});
    }
}
exports.PythonTaskRunnerSandbox = PythonTaskRunnerSandbox;
//# sourceMappingURL=PythonTaskRunnerSandbox.js.map