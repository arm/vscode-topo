import * as vscode from 'vscode';
import { ProcessingDomainGroupTreeItem } from './processingDomainGroupTreeItem';
import { errored, loading, unloaded } from '../util/loadable';

describe('ProcessingDomainGroupTreeItem', () => {
    it('sets label, contextValue, icon, and expanded state', () => {
        const item = new ProcessingDomainGroupTreeItem(unloaded());

        expect(item.label).toBe('Processing Domains');
        expect(item.iconPath).toStrictEqual(new vscode.ThemeIcon('layers'));
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('expands when errored', () => {
        const item = new ProcessingDomainGroupTreeItem(
            errored(new Error('Failed to load')),
        );

        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('shows a loading icon when loading', () => {
        const item = new ProcessingDomainGroupTreeItem(loading(unloaded()));

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
