import * as vscode from 'vscode';
import { DisposableCollector } from './disposableCollector';

export class TransientDocumentProvider
    implements vscode.TextDocumentContentProvider, vscode.Disposable
{
    private readonly disposables = new DisposableCollector();
    private readonly docs = new Map<string, string>();

    constructor(private readonly scheme: string) {
        this.disposables.collect(
            vscode.workspace.registerTextDocumentContentProvider(
                this.scheme,
                this,
            ),
        );
    }

    public provideTextDocumentContent(uri: vscode.Uri): string | undefined {
        return this.docs.get(uri.toString());
    }

    public createUri(path: string): vscode.Uri {
        return vscode.Uri.from({
            scheme: this.scheme,
            path,
        });
    }

    public async open(documentUri: vscode.Uri, content: string): Promise<void> {
        this.docs.clear();
        this.docs.set(documentUri.toString(), content);

        const document = await vscode.workspace.openTextDocument(documentUri);
        await vscode.window.showTextDocument(document, { preview: true });
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
