import * as vscode from 'vscode';
import { AddTargetTool } from './addTargetTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { TargetStore } from '../target/targetStore';
import * as ssh from '../util/ssh';

jest.mock('../util/ssh');
const mockGetHosts = jest.mocked(ssh.getHosts);

describe('AddTargetTool', () => {
    let tool: AddTargetTool;
    let targetStore: MockProxy<TargetStore>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    beforeEach(() => {
        targetStore = mock<TargetStore>();
        tool = new AddTargetTool(targetStore);
        mockGetHosts.mockResolvedValue([]);
    });

    it('adds and selects a user@host target without checking ssh config', async () => {
        targetStore.addTarget.mockResolvedValue(undefined);
        targetStore.setSelected.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: { ssh: 'root@192.168.1.1' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        expect(mockGetHosts).not.toHaveBeenCalled();
        expect(targetStore.addTarget).toHaveBeenCalledWith('root@192.168.1.1');
        expect(targetStore.setSelected).toHaveBeenCalledWith(
            'root@192.168.1.1',
        );
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('added and selected');
    });

    it('adds a hostname found in ssh config', async () => {
        mockGetHosts.mockResolvedValue(['my-board', 'other-host']);
        targetStore.addTarget.mockResolvedValue(undefined);
        targetStore.setSelected.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: { ssh: 'my-board' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        expect(mockGetHosts).toHaveBeenCalled();
        expect(targetStore.addTarget).toHaveBeenCalledWith('my-board');
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('added and selected');
    });

    it('matches hostname case-insensitively', async () => {
        mockGetHosts.mockResolvedValue(['My-Board']);
        targetStore.addTarget.mockResolvedValue(undefined);
        targetStore.setSelected.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: { ssh: 'my-board' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        expect(targetStore.addTarget).toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('added and selected');
    });

    it('warns when hostname not found in ssh config and lists known hosts', async () => {
        mockGetHosts.mockResolvedValue(['board-a', 'board-b']);

        const result = await tool.invoke(
            {
                input: { ssh: 'unknown-host' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('not found in ~/.ssh/config');
        expect(text).toContain('board-a');
        expect(text).toContain('board-b');
    });

    it('warns when hostname not found and no known hosts exist', async () => {
        mockGetHosts.mockResolvedValue([]);

        const result = await tool.invoke(
            {
                input: { ssh: 'unknown-host' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('not found in ~/.ssh/config');
        expect(text).not.toContain('Known hosts:');
    });

    it('returns error when target already exists', async () => {
        mockGetHosts.mockResolvedValue(['topo.local']);
        targetStore.addTarget.mockRejectedValue(
            new Error('Target "topo.local" already exists'),
        );

        const result = await tool.invoke(
            {
                input: { ssh: 'topo.local' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Failed to add target');
        expect(text).toContain('already exists');
    });

    it('returns error when ssh is empty', async () => {
        const result = await tool.invoke(
            {
                input: { ssh: '  ' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{ ssh: string }>,
            token,
        );

        expect(targetStore.addTarget).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('SSH connection string');
    });

    it('prepareInvocation returns confirmation', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { ssh: 'root@192.168.1.1' },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                ssh: string;
            }>,
            token,
        );

        expect(prepared?.confirmationMessages?.title).toBe('Add Topo Target');
        expect(prepared?.invocationMessage).toContain('root@192.168.1.1');
    });
});
