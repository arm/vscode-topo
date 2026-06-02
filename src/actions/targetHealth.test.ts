import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { ContainersManager } from '../target/containersManager';
import { TargetHealth } from './targetHealth';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TargetState } from '../util/types';
import { executeCommand } from '../util/test/executeCommand';

vi.mock('../util/logger');

const targetState: TargetState = {
    health: {
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'ok',
        },
        dependencies: [
            {
                name: 'Podman',
                status: 'ok',
                value: 'present',
            },
        ],
        subsystemDriver: {
            name: 'SubsystemDriver',
            status: 'ok',
            value: 'ready',
        },
    },
    status: 'connected',
};

describe('TargetHealth', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('registers inspectHealth command and document provider when activated', async () => {
        const targetHealth = new TargetHealth(mock<ContainersManager>());

        targetHealth.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            TargetHealth.inspectTargetHealthCommand,
            expect.any(Function),
        );
        expect(
            vscode.workspace.registerTextDocumentContentProvider,
        ).toHaveBeenCalledWith(
            TargetHealth.inspectTargetHealthScheme,
            expect.any(Object),
        );
    });

    it('opens a readonly health JSON virtual document for selected target', async () => {
        const targetHealth = new TargetHealth(
            mock<ContainersManager>({
                getTargetState: vi.fn().mockResolvedValue(targetState),
            }),
        );
        targetHealth.activate();
        const targetItem = new TargetTreeItem(
            'user@foobar',
            true,
            {
                health: undefined,
                status: 'connected',
            },
            undefined,
        );
        const textDocument = mock<vscode.TextDocument>();
        vi.mocked(vscode.workspace.openTextDocument).mockResolvedValueOnce(
            textDocument,
        );

        await executeCommand(
            TargetHealth.inspectTargetHealthCommand,
            targetItem,
        );

        const providerRegistration = vi.mocked(
            vscode.workspace.registerTextDocumentContentProvider,
        ).mock.calls[0];
        const contentProvider = providerRegistration[1];
        const uri = vi.mocked(vscode.workspace.openTextDocument).mock
            .calls[0][0] as vscode.Uri;
        const content = await Promise.resolve(
            contentProvider.provideTextDocumentContent(
                uri,
                mock<vscode.CancellationToken>(),
            ),
        );

        expect(uri.scheme).toBe(TargetHealth.inspectTargetHealthScheme);
        expect(content).toBeDefined();
        expect(JSON.parse(content!)).toEqual(targetState.health);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
            textDocument,
            { preview: true },
        );
    });

    it('does not open health document for non-selected target', async () => {
        const targetHealth = new TargetHealth(mock<ContainersManager>());
        targetHealth.activate();
        const targetItem = new TargetTreeItem(
            'abc.com',
            false,
            {
                health: undefined,
                status: 'disconnected',
            },
            undefined,
        );

        await executeCommand(
            TargetHealth.inspectTargetHealthCommand,
            targetItem,
        );

        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });
});
