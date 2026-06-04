import * as vscode from 'vscode';
import { showOutput } from '../commands';
import { DISPLAY_NAME } from '../manifest';
import { ErrorTreeItem } from './errorTreeItem';

describe('ErrorTreeItem', () => {
    it('sets the visual properties correctly', () => {
        const item = new ErrorTreeItem('Failed to load', 'uh oh');

        expect(item.label).toBe('Failed to load');
        expect(item.description).toBe('uh oh');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('error');
        expect(icon.color).toBeInstanceOf(vscode.ThemeColor);
        expect(icon.color!.id).toBe('testing.iconFailed');
    });

    it('sets context and command to open the output channel', () => {
        const item = new ErrorTreeItem('Failed to load');

        expect(item.contextValue).toBe('OpenableError');
        expect(item.command).toStrictEqual({
            command: showOutput,
            title: `Open ${DISPLAY_NAME} Output`,
        });
        expect(item.tooltip).toBe(
            `Open the ${DISPLAY_NAME} output channel for details.`,
        );
    });
});
