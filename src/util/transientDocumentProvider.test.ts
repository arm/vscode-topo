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

    it('creates document URIs for the supplied path', () => {
        const scheme = 'topo-health';
        const path = '/host-health.json';
        const provider = new TransientDocumentProvider(scheme);

        const uri = provider.createUri(path);

        expect(uri.scheme).toBe(scheme);
        expect(uri.path).toBe(path);
    });

    it('opens content in a preview virtual document', async () => {
        const content = '{"status":"ok"}';
        const scheme = 'topo-health';
        const path = '/host-health.json';
        const provider = new TransientDocumentProvider(scheme);
        const uri = mock<vscode.Uri>({
            scheme,
            path,
            toString: () => `${scheme}:${path}`,
        });
        const document = mock<vscode.TextDocument>({ uri });
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            document,
        );

        await provider.open(uri, content);

        expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(uri);
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
        const firstUri = mock<vscode.Uri>({
            toString: () => `${scheme}:/first.json`,
        });
        const secondUri = mock<vscode.Uri>({
            toString: () => `${scheme}:/second.json`,
        });
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            mock<vscode.TextDocument>(),
        );
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            mock<vscode.TextDocument>(),
        );

        await provider.open(firstUri, 'first');
        await provider.open(secondUri, 'second');

        expect(vscode.workspace.openTextDocument).toHaveBeenCalledTimes(2);
        expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
            1,
            firstUri,
        );
        expect(vscode.workspace.openTextDocument).toHaveBeenNthCalledWith(
            2,
            secondUri,
        );
        expect(provider.provideTextDocumentContent(firstUri)).toBeUndefined();
        expect(provider.provideTextDocumentContent(secondUri)).toBe('second');
    });
});
