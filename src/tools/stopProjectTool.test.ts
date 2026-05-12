import * as vscode from 'vscode';
import { StopProjectTool } from './stopProjectTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { Stop } from '../actions/stop';

describe('StopProjectTool', () => {
    let tool: StopProjectTool;
    let stop: MockProxy<Stop>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    beforeEach(() => {
        stop = mock<Stop>();
        tool = new StopProjectTool(stop);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('stops with explicit compose file path', async () => {
        stop.stop.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: { composeFilePath: '/workspace/compose.yaml' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                composeFilePath: string;
            }>,
            token,
        );

        expect(stop.stop).toHaveBeenCalledWith('/workspace/compose.yaml');
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Stop started');
    });

    it('searches workspace for compose file when not provided', async () => {
        const composeUri = vscode.Uri.file('/workspace/compose.yaml');
        jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([
            composeUri,
        ]);
        stop.stop.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        expect(stop.stop).toHaveBeenCalledWith(composeUri.fsPath);
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Stop started');
    });

    it('returns error when no compose file found', async () => {
        jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);

        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        expect(stop.stop).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('No compose file found');
    });

    it('returns error message on stop failure', async () => {
        stop.stop.mockRejectedValue(new Error('No target selected'));

        const result = await tool.invoke(
            {
                input: { composeFilePath: '/workspace/compose.yaml' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                composeFilePath: string;
            }>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Stop failed');
        expect(text).toContain('No target selected');
    });

    it('prepareInvocation returns confirmation with file path', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { composeFilePath: '/workspace/compose.yaml' },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                composeFilePath: string;
            }>,
            token,
        );

        expect(prepared?.confirmationMessages?.title).toBe('Stop Topo Project');
        expect(prepared?.invocationMessage).toContain(
            '/workspace/compose.yaml',
        );
    });

    it('prepareInvocation uses default name when no path given', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: {},
            } as vscode.LanguageModelToolInvocationPrepareOptions<object>,
            token,
        );

        expect(prepared?.invocationMessage).toContain('compose.yaml');
    });
});
