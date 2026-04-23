import * as vscode from 'vscode';
import { DeployProjectTool } from './deployProjectTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { Deploy } from '../actions/deploy';

describe('DeployProjectTool', () => {
    let tool: DeployProjectTool;
    let deploy: MockProxy<Deploy>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    beforeEach(() => {
        deploy = mock<Deploy>();
        tool = new DeployProjectTool(deploy);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('deploys with explicit compose file path', async () => {
        deploy.deploy.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: { composeFilePath: '/workspace/compose.yaml' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                composeFilePath: string;
            }>,
            token,
        );

        expect(deploy.deploy).toHaveBeenCalledWith('/workspace/compose.yaml');
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Deployment started');
    });

    it('searches workspace for compose file when not provided', async () => {
        const composeUri = vscode.Uri.file('/workspace/compose.yaml');
        jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([
            composeUri,
        ]);
        deploy.deploy.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        expect(deploy.deploy).toHaveBeenCalledWith(composeUri.fsPath);
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Deployment started');
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

        expect(deploy.deploy).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('No compose file found');
    });

    it('returns error message on deploy failure', async () => {
        deploy.deploy.mockRejectedValue(new Error('No target selected'));

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
        expect(text).toContain('Deployment failed');
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

        expect(prepared?.confirmationMessages?.title).toBe(
            'Deploy Topo Project',
        );
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
