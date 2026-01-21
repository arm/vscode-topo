/// <reference types="vscode" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vscode-webview.d.ts" />

import ReactDOM from 'react-dom/client';
import { ConfigMetadata, ProjectDescription } from '../src/util/types';
import { ComposeEditor } from './composeEditor/composeEditor';
import './main.css';
import { BoardDashboard } from './boardDashboard';

const vscode = acquireVsCodeApi();

let composeEditorRoot: ReactDOM.Root | null = null;
let boardDashboardRoot: ReactDOM.Root | null = null;
const messageQueue: MessageEvent[] = [];
let domReady = false;

function handleMessage(event: MessageEvent) {
    if (!domReady) {
        messageQueue.push(event);
        return;
    }

    const message = event.data;
    const configMetadata = message.configMetadata as ConfigMetadata;
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
                    messageHandler={vscode}
                    project={project}
                    configMetadata={configMetadata}
                />,
            );
            break;
        case 'render-board-dashboard':
            if (!boardDashboardRoot) {
                const boardDashboardContainer =
                    document.getElementById('board-dashboard');
                if (!boardDashboardContainer) {
                    console.error('Board dashboard container not found!');
                    return;
                }
                boardDashboardRoot = ReactDOM.createRoot(
                    boardDashboardContainer,
                );
            }
            boardDashboardRoot.render(
                <BoardDashboard
                    target={message.target}
                    containersData={message.containersData}
                    boardState={message.boardState}
                    messageHandler={vscode}
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
    if (document.getElementById('board-dashboard')) {
        vscode.postMessage({ type: 'board-dashboard-webview-ready' });
    }
    // Process any queued messages
    while (messageQueue.length > 0) {
        handleMessage(messageQueue.shift()!);
    }
});
