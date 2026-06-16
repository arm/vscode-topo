import * as vscode from 'vscode';
import { HealthCheckDependencyGroupTreeItem } from './healthCheckDependencyGroupTreeItem';
import { loaded, loading } from '../util/loadable';

describe('HealthCheckDependencyGroupTreeItem', () => {
    it('sets group metadata for dependencies', () => {
        const dependencies = [
            {
                name: 'Container Engine',
                status: 'ok' as const,
                value: 'docker',
            },
        ];
        const item = new HealthCheckDependencyGroupTreeItem(
            loaded(dependencies),
        );

        expect(item.label).toBe('Dependencies');
        expect(item.contextValue).toBe('Dependencies');
        expect(item.dependencies).toBe(dependencies);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        expect(item.iconPath).toStrictEqual(new vscode.ThemeIcon('library'));
    });

    it('sets loading icon when loading', () => {
        const item = new HealthCheckDependencyGroupTreeItem(
            loading(loaded([])),
        );

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
