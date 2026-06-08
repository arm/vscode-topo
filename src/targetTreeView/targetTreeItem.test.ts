import * as vscode from 'vscode';
import { TargetTreeItem } from './targetTreeItem';
import { IssueCheck } from '../topoCliSchema';

describe('TargetTreeItem', () => {
    const baseTarget = 'root@host.local';

    it('sets basic fields (id, label, description)', () => {
        const item = new TargetTreeItem(baseTarget, false, 'connected');

        expect(item.id).toBe(baseTarget);
        expect(item.label).toBe(baseTarget);
        expect(item.displayName).toBe(baseTarget);
        expect(item.contextValue).toContain('Target');
    });

    it('shows loading icon and Selected context when selected but not connected', () => {
        const item = new TargetTreeItem(baseTarget, true, 'disconnected');

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
        const item = new TargetTreeItem(baseTarget, true, 'error');

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
        const item = new TargetTreeItem(baseTarget, false, 'disconnected');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('is expanded when selected and connected', () => {
        const item = new TargetTreeItem(baseTarget, true, 'connected');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('adds HasFixableIssues context when target has fixable dependencies', () => {
        const dependency: IssueCheck = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install container engine',
                command: 'topo install container-engine',
            },
        };
        const item = new TargetTreeItem(baseTarget, true, 'connected', [
            dependency,
        ]);

        expect(item.contextValue).toContain('HasFixableIssues');
        expect(item.visibleIssues).toEqual([dependency]);
        expect(item.fixableIssues).toEqual([dependency]);
    });

    it('does not add HasFixableIssues context when dependency fix has no command', () => {
        const dependency: IssueCheck = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Manual setup required',
            },
        };

        const item = new TargetTreeItem(baseTarget, true, 'connected', [
            dependency,
        ]);

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

        const item = new TargetTreeItem(
            baseTarget,
            true,
            'error',
            [],
            [],
            connectivityIssue,
        );

        expect(item.contextValue).toContain('HasFixableIssues');
        expect(item.fixableIssues).toEqual([connectivityIssue]);
    });

    it('shows diagnostics as a description and tooltip when provided', () => {
        const item = new TargetTreeItem(baseTarget, true, 'error', [], [], {
            name: 'Connectivity',
            status: 'error',
            value: 'ssh connection failed',
        });

        expect(item.description).toBe('ssh connection failed');
        expect(item.tooltip).toBe(`${baseTarget}: ssh connection failed`);
    });

    it('does not show connectivity diagnostics when target is unselected', () => {
        const item = new TargetTreeItem(baseTarget, false, 'error', [], [], {
            name: 'Connectivity',
            status: 'error',
            value: 'ssh connection failed',
        });

        expect(item.description).toBeUndefined();
        expect(item.tooltip).toBeUndefined();
    });
});
