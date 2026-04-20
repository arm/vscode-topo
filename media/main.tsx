/// <reference types="vscode" />

import ReactDOM from 'react-dom/client';
import { ComposeEditor } from './composeEditor/composeEditor';
import './main.css';
import { TargetDashboard } from './targetDashboard';
import { ProjectDescription } from '../src/topoCliSchema';

const vscode = acquireVsCodeApi();

let composeEditorRoot: ReactDOM.Root | null = null;
let targetDashboardRoot: ReactDOM.Root | null = null;
const messageQueue: MessageEvent[] = [];
let domReady = false;

function handleMessage(event: MessageEvent) {
    if (!domReady) {
        messageQueue.push(event);
        return;
    }

    const message = event.data;
    const subsystems = message.subsystems as string[];
    const project = message.project as ProjectDescription;
    switch (message.type) {
        case 'render-compose-editor':
            if (!composeEditorRoot) {
                const composeEditorContainer =
                    document.getElementById('compose-editor');
                if (!composeEditorContainer) {
                    console.error('Compose editor container not found!');
                    return;
                }
                composeEditorRoot = ReactDOM.createRoot(composeEditorContainer);
            }
            composeEditorRoot.render(
                <ComposeEditor
                    messagePoster={vscode}
                    project={project}
                    subsystems={subsystems}
                />,
            );
            break;
        case 'render-target-dashboard':
            if (!targetDashboardRoot) {
                const targetDashboardContainer =
                    document.getElementById('target-dashboard');
                if (!targetDashboardContainer) {
                    console.error('Target dashboard container not found!');
                    return;
                }
                targetDashboardRoot = ReactDOM.createRoot(
                    targetDashboardContainer,
                );
            }
            targetDashboardRoot.render(
                <TargetDashboard
                    target={message.target}
                    containersData={message.containersData}
                    targetState={message.targetState}
                    messagePoster={vscode}
                    subsystems={message.subsystems || ['Host']}
                />,
            );
            break;
    }
}

window.addEventListener('message', handleMessage);

document.addEventListener('DOMContentLoaded', () => {
    domReady = true;
    if (document.getElementById('compose-editor')) {
        vscode.postMessage({ type: 'compose-editor-webview-ready' });
    }
    if (document.getElementById('target-dashboard')) {
        vscode.postMessage({ type: 'target-dashboard-webview-ready' });
    }
    // Process any queued messages
    while (messageQueue.length > 0) {
        handleMessage(messageQueue.shift()!);
    }
});
