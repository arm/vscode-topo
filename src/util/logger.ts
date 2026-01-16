import * as vscode from 'vscode';
import * as manifest from '../manifest';
import * as util from 'util';

export enum Verbosity {
    off = 0,
    error = 1,
    warn = 2,
    info = 3,
    debug = 4
}

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

    if (util.types.isNativeError(message) || Buffer.isBuffer(message)) {
        return message.toString();
    }

    try {
        return JSON.stringify(message, undefined, '\t');
    } catch {
        return String(message);
    }
};

abstract class Logger {
    private logVerbosity: Verbosity;

    constructor() {
        this.logVerbosity = this.getVerbosity();
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_LOGGING_VERBOSITY}`)) {
                this.logVerbosity = this.getVerbosity();
            }
        });
    }

    public getVerbosity(): Verbosity {
        const config =
            vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string>(manifest.CONFIG_LOGGING_VERBOSITY) ||
            manifest.DEFAULT_LOGGING_VERBOSITY;
        return Verbosity[config as keyof typeof Verbosity];
    }

    protected abstract logMessage(message: string): void;

    public log(verbosity: Verbosity, ...messages: unknown[]): void {
        if (this.logVerbosity === Verbosity.off) {
            return;
        }

        if (verbosity <= this.logVerbosity) {
            for (const message of messages) {
                this.logMessage(stringifyMessage(message));
            }
        }
    }

    public error = (...messages: unknown[]): void => this.log(Verbosity.error, ...messages);
    public warn = (...messages: unknown[]): void => this.log(Verbosity.warn, ...messages);
    public info = (...messages: unknown[]): void => this.log(Verbosity.info, ...messages);
    public debug = (...messages: unknown[]): void => this.log(Verbosity.debug, ...messages);
}

export class OutputChannelLogger extends Logger {
    public static instance = new OutputChannelLogger();

    private outputChannel: vscode.OutputChannel | undefined;

    protected logMessage(message: string): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(manifest.DISPLAY_NAME);
        }
        this.outputChannel.appendLine(message);
    }

    public show(): void {
        this.outputChannel?.show();
    }
}

export const logger = OutputChannelLogger.instance;
