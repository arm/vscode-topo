import * as vscode from 'vscode';
import { ErrorTreeItem } from './errorTreeItem';
import { errored, loading } from '../../util/loadable';

describe('ErrorTreeItem', () => {
    it('sets the visual properties correctly', () => {
        const item = new ErrorTreeItem('Failed to load', errored('uh oh'));

        expect(item.label).toBe('Failed to load');
        expect(item.description).toBe('uh oh');
        expect(item.tooltip).toBe('Failed to load: uh oh');
        expect(item.contextValue).toBe('OpenableError');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'error',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
    });

    it('sets loading icon when loading', () => {
        const item = new ErrorTreeItem(
            'Loading error',
            loading(errored('uh oh')),
        );

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
