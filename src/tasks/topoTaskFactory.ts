import * as vscode from 'vscode';
import { createTopoComposeTask } from './topoComposeTask';
import {
    TOPO_DEPLOY_TASK_TYPE,
    topoDeployTaskSpec,
    type TopoDeployTaskDefinition,
} from './topoDeployTask';
import {
    TOPO_STOP_TASK_TYPE,
    topoStopTaskSpec,
    type TopoStopTaskDefinition,
} from './topoStopTask';

export type TopoTaskDefinition =
    TopoDeployTaskDefinition | TopoStopTaskDefinition;

export class TopoTaskFactory {
    public createTask(definition: TopoTaskDefinition): vscode.Task {
        switch (definition.type) {
            case TOPO_DEPLOY_TASK_TYPE:
                return createTopoComposeTask(topoDeployTaskSpec, definition);
            case TOPO_STOP_TASK_TYPE:
                return createTopoComposeTask(topoStopTaskSpec, definition);
        }
    }
}
