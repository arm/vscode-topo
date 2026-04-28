/// <reference types="vscode" />

import ReactDOM from 'react-dom/client';
import './main.css';
import { TargetDashboard } from './targetDashboard';

const vscode = acquireVsCodeApi();

let targetDashboardRoot: ReactDOM.Root | null = null;
const messageQueue: MessageEvent[] = [];
let domReady = false;

function handleMessage(event: MessageEvent) {
    if (!domReady) {
        messageQueue.push(event);
        return;
    }

    const message = event.data;
    switch (message.type) {
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
    if (document.getElementById('target-dashboard')) {
        vscode.postMessage({ type: 'target-dashboard-webview-ready' });
    }
    // Process any queued messages
    while (messageQueue.length > 0) {
        handleMessage(messageQueue.shift()!);
    }
});
