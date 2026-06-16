import * as vscode from 'vscode';
import { TargetProcessingDomainTreeItem } from './targetProcessingDomainTreeItem';
import { ContainerItem } from '../util/types';

const target = 'user@topo.local';
const containers: ContainerItem[] = [];

describe('TargetProcessingDomainTreeItem', () => {
    it('should set label, contextValue, and container reference', () => {
        const item = new TargetProcessingDomainTreeItem(
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
        const item = new TargetProcessingDomainTreeItem(
            'imx-rproc',
            target,
            containers,
        );
        expect(item.label).toBe('imx-rproc');
        expect(item.contextValue).toBe('ProcessingDomain imx-rproc');
        expect(item.processingDomainId).toBe('imx-rproc');
    });
});
