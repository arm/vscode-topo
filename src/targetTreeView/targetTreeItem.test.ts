import * as vscode from 'vscode';
import { TargetTreeItem } from './targetTreeItem';
import { TargetDescription, TargetState } from '../util/types';
import { TargetHealthCheckResult } from '../topoCliSchema';

const targetDescription: TargetDescription = {
    hostProcessors: [],
    remoteProcessors: [{ name: 'imx-rproc' }],
};

function targetState(status: TargetState['status']): TargetState {
    return { status, health: undefined };
}

function connectedTargetState(
    health: TargetHealthCheckResult | undefined = undefined,
): TargetState {
    return { status: 'connected', health };
}

describe('TargetTreeItem', () => {
    const baseTarget = 'root@host.local';

    it('sets basic fields (id, label, description)', () => {
        const item = new TargetTreeItem(
            baseTarget,
            false,
            connectedTargetState(),
            undefined,
        );

        expect(item.id).toBe(baseTarget);
        expect(item.label).toBe(baseTarget);
        expect(item.displayName).toBe(baseTarget);
        expect(item.contextValue).toContain('Target');
    });

    it('shows loading icon and Selected context when selected but not connected', () => {
        const item = new TargetTreeItem(
            baseTarget,
            true,
            targetState('disconnected'),
            undefined,
        );

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeDefined();
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon).toBeDefined();
        expect(icon!.id).toBe('loading~spin');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows error icon when errored', () => {
        const item = new TargetTreeItem(
            baseTarget,
            true,
            targetState('error'),
            undefined,
        );

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeDefined();
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('error');
        const color = icon.color;
        expect(color).toBeDefined();
        expect(color!.id).toBe('terminal.ansiRed');

        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('has no special contexts or icon when not selected and disconnected', () => {
        const item = new TargetTreeItem(
            baseTarget,
            false,
            targetState('disconnected'),
            undefined,
        );

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('is expanded when selected and connected', () => {
        const item = new TargetTreeItem(
            baseTarget,
            true,
            connectedTargetState(),
            undefined,
        );

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('adds HasFixableDependencies context when target has fixable dependencies', () => {
        const item = new TargetTreeItem(
            baseTarget,
            true,
            connectedTargetState({
                isLocalhost: false,
                connectivity: {
                    name: 'Connectivity',
                    status: 'ok',
                    value: 'ok',
                },
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install container engine',
                            command: 'topo install container-engine',
                        },
                    },
                ],
                subsystemDriver: {
                    name: 'SubsystemDriver',
                    status: 'ok',
                    value: 'ready',
                },
            }),
            targetDescription,
        );

        expect(item.contextValue).toContain('HasFixableDependencies');
        expect(
            item.visibleDependencies.map((dependency) => dependency.name),
        ).toContain('Container Engine');
    });
});
