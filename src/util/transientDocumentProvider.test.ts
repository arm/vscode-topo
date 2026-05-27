import { mock } from 'jest-mock-extended';
import * as vscode from 'vscode';
import { TransientDocumentProvider } from './transientDocumentProvider';

describe('TransientDocumentProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
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
        jest.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            document,
        );

        await provider.open(path, content);

        const uri = jest.mocked(vscode.workspace.openTextDocument).mock
            .calls[0][0] as vscode.Uri;
        expect(uri.scheme).toBe(scheme);
        expect(uri.path).toBe(path);
        expect(provider.provideTextDocumentContent(uri)).toBe(content);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(document, {
            preview: true,
        });
    });

    it('only keeps content for the most recently opened document', async () => {
        const provider = new TransientDocumentProvider('topo-health');
        jest.mocked(vscode.workspace.openTextDocument).mockResolvedValue(
            mock<vscode.TextDocument>(),
        );

        await provider.open('/first.json', 'first');
        const firstUri = jest.mocked(vscode.workspace.openTextDocument).mock
            .calls[0][0] as vscode.Uri;

        await provider.open('/second.json', 'second');
        const secondUri = jest.mocked(vscode.workspace.openTextDocument).mock
            .calls[1][0] as vscode.Uri;

        expect(provider.provideTextDocumentContent(firstUri)).toBeUndefined();
        expect(provider.provideTextDocumentContent(secondUri)).toBe('second');
    });

    it('disposes the content provider registration', () => {
        const registration = mock<vscode.Disposable>();
        jest.mocked(
            vscode.workspace.registerTextDocumentContentProvider,
        ).mockReturnValueOnce(registration);
        const provider = new TransientDocumentProvider('topo-health');

        provider.dispose();

        expect(registration.dispose).toHaveBeenCalledWith();
    });
});
