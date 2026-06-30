import * as vscode from 'vscode';
import packageJson from '../../../package.json';
import { showOutput } from '../../commands';
import { ErrorTreeItem } from './errorTreeItem';
import { errored, loading } from '../../util/loadable';

describe('ErrorTreeItem', () => {
    it('sets the visual properties correctly', () => {
        const item = new ErrorTreeItem('Failed to load', errored('uh oh'));

        expect(item.label).toBe('Failed to load');
        expect(item.description).toBe('uh oh');
        expect(item.tooltip).toBe('Failed to load: uh oh');
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

    it('sets context for the inline output action without a row command', () => {
        const item = new ErrorTreeItem('Another error');

        expect(item.contextValue).toBe('OpenableError');
        expect(item.command).toBeUndefined();
        expect(item.tooltip).toBeUndefined();
        expect(
            packageJson.contributes.menus['view/item/context'],
        ).toContainEqual({
            command: showOutput,
            when: 'viewItem =~ /OpenableError/',
            group: 'inline@1',
        });
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
