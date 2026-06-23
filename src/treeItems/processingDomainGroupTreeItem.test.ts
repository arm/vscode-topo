import * as vscode from 'vscode';
import { ProcessingDomainGroupTreeItem } from './processingDomainGroupTreeItem';
import { ContainerItem } from '../util/types';
import { errored, loaded, loading } from '../util/loadable';

const container: ContainerItem = {
    id: 'abc123',
    name: 'demo-container',
    image: 'demo-image',
    state: 'running',
    status: 'Up',
    labels: '',
    runningFor: '1m',
    createdAt: '',
    runtime: '',
    annotations: {},
    ports: {},
    target: 'root@host.local',
};

describe('ProcessingDomainGroupTreeItem', () => {
    it('sets label, description, contextValue, icon, remote processor names, and containers', () => {
        const remoteProcessorNames = ['imx-rproc'];
        const containers = loaded<ContainerItem[]>([container]);
        const item = new ProcessingDomainGroupTreeItem(
            'root@host.local',
            remoteProcessorNames,
            containers,
        );

        expect(item.label).toBe('Processing Domains');
        expect(item.description).toBe('1 container');
        expect(item.contextValue).toBe('ProcessingDomains');
        expect(item.remoteProcessorNames).toBe(remoteProcessorNames);
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toStrictEqual(new vscode.ThemeIcon('layers'));
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('shows a loading icon when containers are refreshing', () => {
        const item = new ProcessingDomainGroupTreeItem(
            'root@host.local',
            [],
            loading(errored('Containers data is not ready')),
        );

        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('loading~spin'),
        );
    });
});
