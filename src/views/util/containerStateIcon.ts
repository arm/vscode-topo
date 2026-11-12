import * as vscode from 'vscode';

export const runningIcon = new vscode.ThemeIcon(
    'debug-breakpoint-log',
    new vscode.ThemeColor('terminal.ansiGreen'),
);

export const notRunningIcon = new vscode.ThemeIcon(
    'debug-breakpoint-log-unverified',
    new vscode.ThemeColor('terminal.ansiWhite'),
);
