import * as vscode from 'vscode';
import { TargetTreeView } from './targetTreeView';
import { TargetDescription } from '../util/types';
import { mock } from 'vitest-mock-extended';
import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import { TargetModel } from '../models/targetModel';
import { TargetDataIssueTreeItem } from '../targetTreeView/targetDataIssueTreeItem';
import { ErrorTreeItem } from '../treeItems/errorTreeItem';
import { LoadingTreeItem } from '../treeItems/loadingTreeItem';
import { errored, loaded, loading, unloaded } from '../util/loadable';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let targetModel: TargetModel;
    let treeView: vscode.TreeView<vscode.TreeItem>;
    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [{ name: 'imx-rproc' }, { name: 'other-rproc' }],
        totalMemoryKb: 1024,
    };
    const targetHealth: TargetHealthCheck = {
        destination: `ssh://${target}`,
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'ok',
        },
        dependencies: [
            {
                name: 'Podman',
                status: 'ok',
                value: 'present',
            },
        ],
        processingDomainDriver: {
            name: 'ProcessingDomainDriver',
            status: 'ok',
            value: 'ready',
        },
    };

    beforeEach(() => {
        targetModel = new TargetModel();
        targetModel.setTargets(loaded([target]));
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(targetHealth));
        targetModel.setSelectedTargetDescription(loaded(targetDescription));
        view = new TargetTreeView(targetModel);
        treeView = vi.mocked(vscode.window.createTreeView).mock.results[0]
            .value;
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('context', () => {
        it('syncs contexts when the view is created', () => {
            const model = new TargetModel();
            model.setTargets(errored('Failed to load targets'));
            model.setSelected('my-target');

            const contextView = new TargetTreeView(model);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'topo.targetDataIssue',
                true,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                'topo.hasSelectedTarget',
                true,
            );
            contextView.dispose();
        });

        it('syncs target data issue context when target state changes', async () => {
            targetModel.setTargets(errored('Failed to load targets'));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                'topo.targetDataIssue',
                true,
            );

            vi.mocked(vscode.commands.executeCommand).mockClear();
            targetModel.setTargets(loaded([target]));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                'topo.targetDataIssue',
                false,
            );
        });

        it('syncs selected target context when selected target changes', async () => {
            targetModel.setSelected(undefined);

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                'topo.hasSelectedTarget',
                false,
            );

            vi.mocked(vscode.commands.executeCommand).mockClear();
            targetModel.setSelected(target);

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                'topo.hasSelectedTarget',
                true,
            );
        });
    });

    describe('getChildren', () => {
        it('returns Dependencies at the root', () => {
            const rootChildren = view.getChildren();

            expect(treeView.description).toBe(target);
            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0].label).toBe('Dependencies');
        });

        it('returns dependency items for Dependencies group', () => {
            const processingDomainDriverHealth = mock<IssueCheck>({
                name: 'rproc-driver',
                status: 'ok',
            });
            const dependencies = [
                mock<IssueCheck>({
                    name: 'Container Engine',
                    status: 'ok',
                }),
                mock<IssueCheck>({
                    name: 'Some Dependency',
                    status: 'ok',
                }),
            ];
            targetModel.setSelectedTargetHealth(
                loaded({
                    ...targetHealth,
                    dependencies,
                    processingDomainDriver: processingDomainDriverHealth,
                }),
            );
            const rootChildren = view.getChildren();

            const got = view.getChildren(rootChildren[0]);

            expect(got.map((item) => item.label)).toEqual([
                dependencies[0].name,
                processingDomainDriverHealth.name,
                dependencies[1].name,
            ]);
        });

        it('returns a health check item while selected target health is pending', () => {
            targetModel.setSelectedTargetHealth(unloaded(true));

            const rootChildren = view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toBeInstanceOf(LoadingTreeItem);
            expect(rootChildren[0]).toMatchObject({
                label: 'Checking target health',
                iconPath: { id: 'loading~spin' },
            });
        });

        it('returns no children when selected target health is unloaded', () => {
            targetModel.setSelectedTargetHealth(unloaded());

            expect(view.getChildren()).toEqual([]);
        });

        it('returns a connectivity item when selected target has a connectivity error', () => {
            const diagnostics = '"ssh" not found on remote target\'s $PATH';
            targetModel.setSelectedTargetHealth(
                loaded({
                    ...targetHealth,
                    connectivity: {
                        name: 'Connectivity',
                        status: 'error',
                        value: diagnostics,
                    },
                }),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren[0]).toMatchObject({
                label: 'Connectivity',
                description: diagnostics,
                contextValue: 'Dependency Error',
            });
        });

        it('updates the view description when the selected target changes', () => {
            const otherTarget = 'user@other.local';
            targetModel.setTargets(loaded([target, otherTarget]));
            targetModel.setSelected(otherTarget);
            targetModel.setSelectedTargetHealth(
                errored('ssh connection failed'),
            );

            const rootChildren = view.getChildren();

            expect(treeView.description).toBe(otherTarget);
            expect(rootChildren[0]).toMatchObject({
                label: 'Failed to check target health',
                description: 'ssh connection failed',
                contextValue: 'OpenableError',
            });
            expect(rootChildren[0]).toBeInstanceOf(ErrorTreeItem);
        });

        it('shows loading while failed selected target health is refreshing', () => {
            targetModel.setSelectedTargetHealth(
                loading(errored('topo health failed')),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren[0]).toMatchObject({
                label: 'Failed to check target health',
                description: 'topo health failed',
                iconPath: { id: 'loading~spin' },
            });
        });

        it('marks dependencies group fixable when visible target issues have executable fixes', async () => {
            targetModel.setSelectedTargetHealth(
                loaded({
                    ...targetHealth,
                    processingDomainDriver: {
                        name: 'ProcessingDomainDriver',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install processing domain driver',
                            command: 'topo install processing-domain-driver',
                        },
                    },
                }),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren[0].contextValue).toBe(
                'Dependencies HasFixableIssues',
            );
        });

        it('returns empty array when no target is selected', async () => {
            targetModel.setTargets(loaded([]));
            targetModel.setSelected(undefined);

            const rootChildren = view.getChildren();

            expect(rootChildren.length).toEqual(0);
            expect(treeView.description).toBeUndefined();
        });

        it('shows target data issues at the root', () => {
            const targets = errored('Failed to load targets');
            targetModel.setTargets(targets);

            const rootChildren = view.getChildren();

            expect(rootChildren).toStrictEqual([
                new TargetDataIssueTreeItem(targets),
            ]);
        });
    });

    describe('getTreeItem', () => {
        it('getTreeItem returns the element itself', () => {
            const item = new vscode.TreeItem('Target Health');

            const treeItem = view.getTreeItem(item);

            expect(treeItem).toBe(item);
        });
    });
});
