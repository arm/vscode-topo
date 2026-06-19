import * as vscode from 'vscode';
import { TargetTreeItem } from './targetTreeItem';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { errored, loaded, loading, unloaded } from '../util/loadable';
import { TargetDescription } from '../util/types';

vi.mock('../util/logger');

const testTargetHealth: TargetHealthCheck = {
    destination: 'ssh://host.local',
    isLocalhost: false,
    connectivity: {
        name: 'Connectivity',
        status: 'ok',
        value: 'ok',
    },
    dependencies: [],
    processingDomainDriver: {
        name: 'ProcessingDomainDriver',
        status: 'ok',
        value: 'ready',
    },
};

const testTargetDescription: TargetDescription = {
    hostProcessors: [],
    remoteProcessors: [],
    totalMemoryKb: 1024,
};

describe('TargetTreeItem', () => {
    const baseTarget = 'root@host.local';

    it('sets basic fields', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
        });

        expect(item.id).toBe(baseTarget);
        expect(item.label).toBe(baseTarget);
        expect(item.displayName).toBe(baseTarget);
        expect(item.contextValue).toContain('Target');
    });

    it('defaults to unloaded target state when health is omitted', () => {
        const item = new TargetTreeItem({ target: baseTarget });

        expect(item.description).toBeUndefined();
        expect(item.iconPath).toBeUndefined();
        expect(item.contextValue).not.toContain('Connected');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows loading icon while target is refreshing', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            health: loading(unloaded()),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows error icon and detail when selected target health is errored', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            health: errored(new Error('ssh connection failed')),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'error',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
        expect(item.description).toBe('ssh connection failed');
        expect(item.tooltip).toBe(`${baseTarget}: ssh connection failed`);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('does not mark unloaded selected target health as Connected', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            health: unloaded(),
        });

        expect(item.contextValue).not.toContain('Connected');
    });

    it('is expanded and Connected when selected target health is loaded', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            health: loaded(testTargetHealth),
            targetDescription: loaded(testTargetDescription),
        });

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('returns no remote processors while description data is pending', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            targetDescription: unloaded(),
        });

        expect(item.remoteProcessorNames).toEqual([]);
    });

    it('adds HasFixableIssues context when visible issues have executable fixes', () => {
        const dependency: IssueCheck = {
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
            health: loaded({
                ...testTargetHealth,
                dependencies: [dependency],
            }),
        });

        expect(item.contextValue).toContain('HasFixableIssues');
        expect(item.visibleIssues).toEqual([dependency]);
        expect(item.fixableIssues).toEqual([dependency]);
    });

    it('does not add HasFixableIssues context when visible issue fix has no command', () => {
        const dependency: IssueCheck = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Manual setup required',
            },
        };
        const item = new TargetTreeItem({
            target: baseTarget,
            health: loaded({
                ...testTargetHealth,
                dependencies: [dependency],
            }),
        });

        expect(item.contextValue).not.toContain('HasFixableIssues');
        expect(item.visibleIssues).toEqual([dependency]);
        expect(item.fixableIssues).toEqual([]);
    });

    it('adds HasFixableIssues context when connectivity has a fix command', () => {
        const connectivityIssue: IssueCheck = {
            name: 'Connectivity',
            status: 'error',
            value: 'unreachable',
            fix: {
                description: 'Set up connectivity',
                command: 'topo setup-keys',
            },
        };
        const item = new TargetTreeItem({
            target: baseTarget,
            health: loaded({
                ...testTargetHealth,
                connectivity: connectivityIssue,
            }),
        });

        expect(item.contextValue).toContain('HasFixableIssues');
        expect(item.fixableIssues).toEqual([connectivityIssue]);
    });

    it('shows connectivity diagnostics as a description and tooltip', () => {
        const item = new TargetTreeItem({
            target: baseTarget,
            health: loaded({
                ...testTargetHealth,
                connectivity: {
                    name: 'Connectivity',
                    status: 'error',
                    value: 'ssh connection failed',
                },
            }),
        });

        expect(item.description).toBe('ssh connection failed');
        expect(item.tooltip).toBe(`${baseTarget}: ssh connection failed`);
    });
});
