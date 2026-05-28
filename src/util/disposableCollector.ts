import * as vscode from 'vscode';
import { logger } from './logger';

export class DisposableCollector implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];

    public collect(...disposables: vscode.Disposable[]): void {
        this.disposables.push(...disposables);
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            try {
                disposable.dispose();
            } catch (error) {
                logger.error(`Error disposing resource`, error);
            }
        }
        this.disposables.length = 0;
    }
}
