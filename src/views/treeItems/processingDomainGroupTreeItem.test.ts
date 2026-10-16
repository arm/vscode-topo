import * as vscode from 'vscode';
import { ProcessingDomainGroupTreeItem } from './processingDomainGroupTreeItem';
import { errored, loaded, loading, unloaded } from '../../util/loadable';
import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';
import { ErrorTreeItem } from './errorTreeItem';

describe('ProcessingDomainGroupTreeItem', () => {
    it('sets label, contextValue, icon, and expanded state', () => {
        const item = new ProcessingDomainGroupTreeItem(unloaded());

        expect(item.label).toBe('Processing Domains');
        expect(item.iconPath).toStrictEqual(new vscode.ThemeIcon('layers'));
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('expands and returns an error child when the description fails to load', () => {
        const description = errored('Failed to load target description');
        const item = new ProcessingDomainGroupTreeItem(description);

        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
        expect(item.getChildren()).toStrictEqual([
            new ErrorTreeItem('Failed to load processing domains', description),
        ]);
    });

    it('returns ordered processing domains without container children', () => {
        const item = new ProcessingDomainGroupTreeItem(
            loaded({
                hostProcessors: [],
                remoteProcessors: [
                    { name: 'other-rproc' },
                    { name: 'imx-rproc' },
                ],
                totalMemoryKb: 1024,
            }),
        );

        expect(item.getChildren()).toMatchObject([
            {
                label: PRIMARY_PROCESSING_DOMAIN,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
            },
            {
                label: 'imx-rproc',
                collapsibleState: vscode.TreeItemCollapsibleState.None,
            },
            {
                label: 'other-rproc',
                collapsibleState: vscode.TreeItemCollapsibleState.None,
            },
        ]);
    });

    it('shows a loading icon when loading', () => {
        const item = new ProcessingDomainGroupTreeItem(loading(unloaded()));

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
