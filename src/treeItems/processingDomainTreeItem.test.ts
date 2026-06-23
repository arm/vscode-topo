import * as vscode from 'vscode';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ContainerItem } from '../util/types';

const target = 'user@topo.local';
const containers: ContainerItem[] = [];

describe('ProcessingDomainTreeItem', () => {
    it('should set label, contextValue, and container reference', () => {
        const item = new ProcessingDomainTreeItem(
            'PrimaryOS',
            target,
            containers,
        );
        expect(item.label).toBe('PrimaryOS');
        expect(item.contextValue).toBe('ProcessingDomain PrimaryOS');
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('multiple-windows'),
        );
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('should accept dynamic processing domain names', () => {
        const item = new ProcessingDomainTreeItem(
            'imx-rproc',
            target,
            containers,
        );
        expect(item.label).toBe('imx-rproc');
        expect(item.contextValue).toBe('ProcessingDomain imx-rproc');
        expect(item.processingDomainId).toBe('imx-rproc');
    });
});
