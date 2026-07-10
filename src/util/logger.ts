import * as vscode from 'vscode';
import * as manifest from '../manifest';

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

    public error = (
        ...args: Parameters<vscode.LogOutputChannel['error']>
    ): void => {
        this.getOutputChannel().error(...args);
    };

    public warn = (
        ...args: Parameters<vscode.LogOutputChannel['warn']>
    ): void => {
        this.getOutputChannel().warn(...args);
    };

    public info = (
        ...args: Parameters<vscode.LogOutputChannel['info']>
    ): void => {
        this.getOutputChannel().info(...args);
    };

    public debug = (
        ...args: Parameters<vscode.LogOutputChannel['debug']>
    ): void => {
        this.getOutputChannel().debug(...args);
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
