import * as vscode from 'vscode';
import * as manifest from '../manifest';
import * as util from 'node:util';

export const stringifyMessage = (message: unknown): string => {
    if (message === null || message === undefined) {
        return String(message);
    }

    if (typeof message === 'string') {
        return message;
    }

    if (typeof message === 'number') {
        return Number.isFinite(message) ? message.toString() : String(message);
    }

    if (Buffer.isBuffer(message)) {
        return message.toString();
    }

    if (util.types.isNativeError(message)) {
        return message.stack || message.message;
    }

    try {
        return JSON.stringify(message, undefined, '\t');
    } catch {
        return String(message);
    }
};

export class OutputChannelLogger implements vscode.Disposable {
    public static instance = new OutputChannelLogger();

    private outputChannel: vscode.LogOutputChannel | undefined;

    private getOutputChannel(): vscode.LogOutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(
                manifest.DISPLAY_NAME,
                { log: true },
            );
        }
        return this.outputChannel;
    }

    private logMessages(
        messages: unknown[],
        logMessage: (message: string) => void,
    ): void {
        for (const message of messages) {
            logMessage(stringifyMessage(message));
        }
    }

    public error = (...messages: unknown[]): void => {
        const outputChannel = this.getOutputChannel();
        this.logMessages(messages, (message) => outputChannel.error(message));
    };

    public warn = (...messages: unknown[]): void => {
        const outputChannel = this.getOutputChannel();
        this.logMessages(messages, (message) => outputChannel.warn(message));
    };

    public info = (...messages: unknown[]): void => {
        const outputChannel = this.getOutputChannel();
        this.logMessages(messages, (message) => outputChannel.info(message));
    };

    public debug = (...messages: unknown[]): void => {
        const outputChannel = this.getOutputChannel();
        this.logMessages(messages, (message) => outputChannel.debug(message));
    };

    public show(): void {
        this.getOutputChannel().show();
    }

    public dispose(): void {
        this.outputChannel?.dispose();
        this.outputChannel = undefined;
    }
}

export const logger = OutputChannelLogger.instance;
