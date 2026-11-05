import * as vscode from 'vscode';
import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';
import { loaded, unloaded } from '../../util/loadable';
import { ProjectMetadata } from '../../util/project';
import { ContainerItem } from '../../util/types';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ProjectTreeItem } from './projectTreeItem';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/fake/workspace/demo'),
    composeFileUri: vscode.Uri.file('/fake/workspace/demo/compose.yaml'),
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

const container: ContainerItem = {
    id: 'abc123',
    names: 'app',
    image: 'demo-app',
    status: 'Up 1 minute',
    state: 'running',
    processingDomain: PRIMARY_PROCESSING_DOMAIN,
    address: 'localhost:8000',
    target: 'user@topo.local',
    service: 'app',
    composeFileUri: project.composeFileUri,
};

describe('ProjectTreeItem', () => {
    it('marks projects with containers', () => {
        const item = new ProjectTreeItem(project, false, loaded([container]));

        expect(item.contextValue).toBe('Project HasContainers');
    });

    it('makes loaded empty projects non-expandable', () => {
        const item = new ProjectTreeItem(project, false, loaded([]));

        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
        expect(item.contextValue).toBe('Project');
    });

    it('groups containers by domain, with the primary domain first and others alphabetical', () => {
        const containers = [
            { ...container, id: 'mno345', processingDomain: '' },
            { ...container, id: 'ghi789', processingDomain: 'other-rproc' },
            container,
            { ...container, id: 'jkl012', processingDomain: 'imx-rproc' },
            { ...container, id: 'def456', names: 'worker', service: 'worker' },
        ];
        const item = new ProjectTreeItem(project, false, loaded(containers));

        const domains = item.getChildren() as ProcessingDomainTreeItem[];
        expect(domains).toMatchObject([
            { label: PRIMARY_PROCESSING_DOMAIN },
            { label: 'imx-rproc' },
            { label: 'other-rproc' },
            { label: 'Unknown' },
        ]);
        expect(domains[0].getChildren()).toMatchObject([
            { serviceItem: { name: 'app', containers: [{ id: 'abc123' }] } },
            { serviceItem: { name: 'worker', containers: [{ id: 'def456' }] } },
        ]);
        expect(domains[1].getChildren()).toMatchObject([
            { serviceItem: { containers: [{ id: 'jkl012' }] } },
        ]);
        expect(domains[2].getChildren()).toMatchObject([
            { serviceItem: { containers: [{ id: 'ghi789' }] } },
        ]);
        expect(domains[3].getChildren()).toMatchObject([
            { serviceItem: { containers: [{ id: 'mno345' }] } },
        ]);
    });

    it('returns no children when containers are unloaded', () => {
        const item = new ProjectTreeItem(project, false, unloaded());

        expect(item.contextValue).toBe('Project');
        expect(item.getChildren()).toEqual([]);
    });
});
