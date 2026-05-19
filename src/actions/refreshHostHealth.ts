import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { HostHealthModel } from '../models/hostHealthModel';
import { TopoCli } from '../topoCli';

export class RefreshHostHealth implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    public static readonly refreshHostHealthCommand = `${manifest.PACKAGE_NAME}.refreshHostHealth`;

    constructor(
        private readonly hostHealthModel: HostHealthModel,
        private readonly topoCli: TopoCli,
    ) {}

    public activate(): void {
        this.disposables.push(
            vscode.commands.registerCommand(
                RefreshHostHealth.refreshHostHealthCommand,
                () => this.refresh(),
            ),
        );
        this.refresh();
    }

    private refresh(): void {
        this.hostHealthModel.health = this.topoCli.hostHealth();
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
