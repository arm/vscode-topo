import * as vscode from 'vscode';
import { showOutput } from '../commands';
import { DISPLAY_NAME } from '../manifest';
import { ErrorTreeItem } from './errorTreeItem';
import { errored, loading } from '../util/loadable';

describe('ErrorTreeItem', () => {
    it('sets the visual properties correctly', () => {
        const item = new ErrorTreeItem('Failed to load', errored('uh oh'));

        expect(item.label).toBe('Failed to load');
        expect(item.description).toBe('uh oh');
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

    it('sets context and command to open the output channel', () => {
        const item = new ErrorTreeItem('Another error');

        expect(item.contextValue).toBe('OpenableError');
        expect(item.command).toStrictEqual({
            command: showOutput,
            title: `Open ${DISPLAY_NAME} Output`,
        });
        expect(item.tooltip).toBe(
            `Open the ${DISPLAY_NAME} output channel for details.`,
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
