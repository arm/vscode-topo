import * as vscode from 'vscode';
import { TargetTreeItem } from './targetTreeItem';
import {
    HealthCheckDependency,
    TargetHealthCheckResult,
} from '../topoCliSchema';
import { errored, loaded, loading } from '../util/loadable';
import { TargetDescription } from '../util/types';

const testTargetHealth: TargetHealthCheckResult = {
    isLocalhost: false,
    connectivity: {
        name: 'Connectivity',
        status: 'ok',
        value: 'ok',
    },
    dependencies: [],
    subsystemDriver: {
        name: 'SubsystemDriver',
        status: 'ok',
        value: 'ready',
    },
};

const testTargetDescription: TargetDescription = {
    hostProcessors: [],
    remoteProcessors: [],
};

describe('TargetTreeItem', () => {
    const baseTarget = 'root@host.local';

    it('sets basic fields', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: false,
        });

        expect(item.id).toBe(baseTarget);
        expect(item.label).toBe(baseTarget);
        expect(item.displayName).toBe(baseTarget);
        expect(item.contextValue).toContain('Target');
    });

    it('defaults to target state not ready when health is omitted', () => {
        const item = new TargetTreeItem({ target: baseTarget, selected: true });

        expect(item.description).toBe('Target health not available');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows loading icon and Selected context while selected target is refreshing', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: true,
            health: loading(errored('Target state is not ready')),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('loading~spin');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows error icon and detail when selected target health is errored', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: true,
            health: errored(new Error('ssh connection failed')),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('error');
        expect(icon.color?.id).toBe('testing.iconFailed');
        expect(item.description).toBe('ssh connection failed');
        expect(item.tooltip).toBe(`${baseTarget}: ssh connection failed`);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('does not show health error when target is unselected', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: false,
            health: errored('Target not selected'),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.iconPath).toBeUndefined();
        expect(item.description).toBeUndefined();
        expect(item.tooltip).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('does not mark undefined selected target health as Connected', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: true,
            health: loaded(undefined),
        });

        expect(item.contextValue).not.toContain('Connected');
    });

    it('is expanded and Connected when selected target health is loaded', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: true,
            health: loaded(testTargetHealth),
            targetDescription: loaded(testTargetDescription),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('adds HasFixableDependencies context when visible dependencies have executable fixes', () => {
        const dependency: HealthCheckDependency = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install container engine',
                command: 'topo install container-engine',
            },
        };
        const item = new TargetTreeItem({
            target: baseTarget,
            selected: true,
            health: loaded({
                ...testTargetHealth,
                dependencies: [dependency],
            }),
        });

        expect(item.contextValue).toContain('HasFixableDependencies');
        expect(item.visibleDependencies).toEqual([dependency]);
    });
});
