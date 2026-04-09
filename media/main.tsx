/// <reference types="vscode" />

import ReactDOM from 'react-dom/client';
import { ConfigMetadata, ProjectDescription } from '../src/util/types';
import { ComposeEditor, QuickPicker } from './composeEditor/composeEditor';
import './main.css';
import { Deferred } from '../src/util/deferred';
import { BoardDashboard } from './boardDashboard';

/* eslint-disable @typescript-eslint/no-explicit-any */

declare function acquireVsCodeApi(): {
  postMessage: (msg: any) => void;
  setState: (state: any) => void;
  getState: () => any;
};

const vscode = acquireVsCodeApi();

let composeEditorRoot: ReactDOM.Root | null = null;
let boardDashboardRoot: ReactDOM.Root | null = null;
const messageQueue: any[] = [];
let domReady = false;

function handleMessage(event: MessageEvent) {
    if (!domReady) {
        messageQueue.push(event);
        return;
    }
  
    const message = event.data;
    const templates = message.templates;
    const configMetadata = message.configMetadata as ConfigMetadata;
    const project = message.project as ProjectDescription;
    switch (message.type) {
    case 'render-compose-editor':
        if (!composeEditorRoot) {
            const composeEditorContainer = document.getElementById('compose-editor');
            if (!composeEditorContainer) {
                console.error('Compose editor container not found!');
                return;
            }
            composeEditorRoot = ReactDOM.createRoot(composeEditorContainer);
        }
        composeEditorRoot.render(
            <ComposeEditor
                yamlText={message.text}
                messageHandler={vscode}
                quickPicker={quickPicker}
                project={project}
                templates={templates}
                configMetadata={configMetadata}
            />
        );
        break;
    case 'render-board-dashboard':
        if (!boardDashboardRoot) {
            const boardDashboardContainer = document.getElementById('board-dashboard');
            if (!boardDashboardContainer) {
                console.error('Board dashboard container not found!');
                return;
            }
            boardDashboardRoot = ReactDOM.createRoot(boardDashboardContainer);
        }
        boardDashboardRoot.render(
            <BoardDashboard
                containersData={message.containersData}
                isBoardAvailable={message.isBoardAvailable}
                messageHandler={vscode}
            />
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

const quickPicker: QuickPicker<string> = {
    showQuickPick: async (items) => {
        const result = new Deferred<string>();
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'quick-pick-result') {
                window.removeEventListener('message', handler);
                result.resolve(message.result);
            }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({
            type: 'show-quick-pick',
            items: items
        });
        return result.promise;
    },
    createQuickPick: async (items, options) => {
        const result = new Deferred<string>();
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'quick-pick-result') {
                window.removeEventListener('message', handler);
                result.resolve(message.result);
            }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({
            type: 'create-quick-pick',
            items: items,
            placeholder: options?.placeHolder || 'Choose an option',
        });
        return result.promise;
    },
};
