/// <reference types="vscode" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vscode-webview.d.ts" />

import { Deferred } from '../src/util/deferred';

/* eslint-disable @typescript-eslint/no-explicit-any */

const vscode = acquireVsCodeApi();

export type QuickPicker<T> = {
  showQuickPick(
    items: T[],
    options?: {
      placeHolder?: string;
      canPickMany?: boolean;
      matchOnDetail?: boolean;
      matchOnDescription?: boolean;
    }
  ): Thenable<T | undefined>;
  createQuickPick(
    items: T[],
    options?: {
      placeHolder?: string;
      canPickMany?: boolean;
      matchOnDetail?: boolean;
      matchOnDescription?: boolean;
    }) : Thenable<T | undefined>;
}

export const quickPicker: QuickPicker<string> = {
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
