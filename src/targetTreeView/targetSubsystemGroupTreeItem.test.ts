import * as vscode from 'vscode';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';
import { ContainerItem } from '../util/types';
import { errored, loaded, loading } from '../util/loadable';

describe('TargetSubsystemGroupTreeItem', () => {
    it('sets label, contextValue, icon, remote processor names, and containers', () => {
        const remoteProcessorNames = ['imx-rproc'];
        const containers = loaded<ContainerItem[]>([]);
        const item = new TargetSubsystemGroupTreeItem(
            'root@host.local',
            remoteProcessorNames,
            containers,
        );

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.remoteProcessorNames).toBe(remoteProcessorNames);
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('layers');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('shows a loading icon when containers are refreshing', () => {
        const item = new TargetSubsystemGroupTreeItem(
            'root@host.local',
            [],
            loading(errored('Containers data is not ready')),
        );

        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect((item.iconPath as vscode.ThemeIcon).id).toBe('loading~spin');
    });
});
