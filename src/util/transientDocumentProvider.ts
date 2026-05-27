import * as vscode from 'vscode';

export class TransientDocumentProvider
    implements vscode.TextDocumentContentProvider, vscode.Disposable
{
    private disposables: vscode.Disposable[] = [];
    private readonly docs = new Map<string, string>();

    constructor(private readonly scheme: string) {
        this.disposables.push(
            vscode.workspace.registerTextDocumentContentProvider(
                this.scheme,
                this,
            ),
        );
    }

    public provideTextDocumentContent(uri: vscode.Uri): string | undefined {
        return this.docs.get(uri.toString());
    }

    public async open(path: string, content: string): Promise<void> {
        const documentUri = vscode.Uri.from({
            scheme: this.scheme,
            path,
        });

        this.docs.clear();
        this.docs.set(documentUri.toString(), content);

        const document = await vscode.workspace.openTextDocument(documentUri);
        await vscode.window.showTextDocument(document, { preview: true });
    }

    public dispose(): void {
        for (const disposable of [...this.disposables].reverse()) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
