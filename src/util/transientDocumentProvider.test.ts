import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { TransientDocumentProvider } from './transientDocumentProvider';

describe('TransientDocumentProvider', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers itself as a content provider for the supplied scheme', () => {
        const provider = new TransientDocumentProvider('topo-health');

        expect(
            vscode.workspace.registerTextDocumentContentProvider,
        ).toHaveBeenCalledWith('topo-health', provider);
    });

    it('opens content in a preview virtual document', async () => {
        const content = '{"status":"ok"}';
        const scheme = 'topo-health';
        const path = '/host-health.json';
        const provider = new TransientDocumentProvider(scheme);
        const document = mock<vscode.TextDocument>();
        const openedUris: vscode.Uri[] = [];
        vi.mocked(vscode.workspace.openTextDocument).mockImplementationOnce(
            async (uri) => {
                openedUris.push(uri as vscode.Uri);
                return document;
            },
        );

        await provider.open(path, content);

        expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
        expect(openedUris).toHaveLength(1);
        const uri = openedUris[0];
        expect(uri.scheme).toBe(scheme);
        expect(uri.path).toBe(path);
        expect(provider.provideTextDocumentContent(uri)).toBe(content);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(document, {
            preview: true,
        });
    });

    it('only keeps content for the most recently opened document', async () => {
        const scheme = 'topo-health';
        const provider = new TransientDocumentProvider(scheme);
        const openedUris: vscode.Uri[] = [];
        vi.mocked(vscode.workspace.openTextDocument).mockImplementation(
            async (uri) => {
                openedUris.push(uri as vscode.Uri);
                return mock<vscode.TextDocument>();
            },
        );

        await provider.open('/first.json', 'first');
        await provider.open('/second.json', 'second');

        expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(2);
        expect(openedUris).toHaveLength(2);
        const firstUri = openedUris[0];
        const secondUri = openedUris[1];
        expect(firstUri.scheme).toBe(scheme);
        expect(firstUri.path).toBe('/first.json');
        expect(secondUri.scheme).toBe(scheme);
        expect(secondUri.path).toBe('/second.json');
        expect(provider.provideTextDocumentContent(firstUri)).toBeUndefined();
        expect(provider.provideTextDocumentContent(secondUri)).toBe('second');
    });

    it('disposes the content provider registration', () => {
        const registration = mock<vscode.Disposable>();
        vi.mocked(
            vscode.workspace.registerTextDocumentContentProvider,
        ).mockReturnValueOnce(registration);
        const provider = new TransientDocumentProvider('topo-health');

        provider.dispose();

        expect(registration.dispose).toHaveBeenCalledWith();
    });
});
