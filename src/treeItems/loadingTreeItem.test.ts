import * as vscode from 'vscode';
import { LoadingTreeItem } from './loadingTreeItem';

describe('LoadingTreeItem', () => {
    it('sets the visual properties correctly', () => {
        const item = new LoadingTreeItem('Loading projects');

        expect(item.label).toBe('Loading projects');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(item.iconPath).toEqual(new vscode.ThemeIcon('loading~spin'));
    });
});
