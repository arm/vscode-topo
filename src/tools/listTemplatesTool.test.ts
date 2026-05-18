import * as vscode from 'vscode';
import { ListTemplatesTool } from './listTemplatesTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import { TemplateDescription } from '../topoCliSchema';
import { TargetStore } from '../target/targetStore';
import { ProjectClone } from '../projectClone';
import { Deploy } from '../actions/deploy';

describe('ListTemplatesTool', () => {
    let tool: ListTemplatesTool;
    let topoCli: MockProxy<TopoCli>;
    let targetStore: MockProxy<TargetStore>;
    let projectClone: MockProxy<ProjectClone>;
    let deploy: MockProxy<Deploy>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        targetStore = mock<TargetStore>();
        projectClone = mock<ProjectClone>();
        deploy = mock<Deploy>();
        tool = new ListTemplatesTool(
            topoCli,
            targetStore,
            projectClone,
            deploy,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns formatted template list', async () => {
        const templates: TemplateDescription[] = [
            {
                name: 'hello-world',
                description: 'A simple hello world project',
                features: ['arm64'],
                url: 'https://example.com/hello.git',
                ref: 'main',
                compatibility: 'supported',
            },
            {
                name: 'blinky',
                description: 'LED blink demo',
                features: null,
                url: 'https://example.com/blinky.git',
                ref: 'v1.0',
            },
        ];
        topoCli.listTemplates.mockReturnValue(templates);

        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        expect(topoCli.listTemplates).toHaveBeenCalledWith(undefined);
        expect(result.content).toHaveLength(1);
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Available Topo examples/templates');
        expect(text).toContain('hello-world');
        expect(text).toContain('blinky');
        expect(text).toContain('templateName: "hello-world"');
        expect(text).toContain('call this same examples/templates tool');
        expect(text).toContain('topo_clone');
        expect(text).toContain('topoClone');
        expect(text).toContain('Do not run `git clone`');
        expect(text).toContain('deploy: true');
        expect(text).toContain('Do not run `topo deploy`');
        expect(text).not.toContain('https://example.com/hello.git');
        expect(text).not.toContain('https://example.com/blinky.git');
    });

    it('clones a listed template through the Topo clone implementation', async () => {
        topoCli.listTemplates.mockReturnValue([
            {
                name: 'hello-world',
                description: 'A simple hello world project',
                features: null,
                url: 'https://example.com/hello.git',
                ref: 'main',
            },
        ]);
        projectClone.cloneProjectFromSource.mockResolvedValue(true);

        const result = await tool.invoke(
            {
                input: {
                    templateName: 'Hello-World',
                    projectName: 'hello-imx93',
                },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                templateName: string;
                projectName: string;
            }>,
            token,
        );

        expect(projectClone.cloneProjectFromSource).toHaveBeenCalledWith(
            {
                type: 'git',
                url: 'https://example.com/hello.git',
            },
            { projectName: 'hello-imx93', runPostCloneAction: false },
        );
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Successfully cloned template "hello-world"');
        expect(text).toContain('Topo clone tool');
    });

    it('reports available templates when clone templateName is unknown', async () => {
        topoCli.listTemplates.mockReturnValue([
            {
                name: 'hello-world',
                description: 'A simple hello world project',
                features: null,
                url: 'https://example.com/hello.git',
                ref: 'main',
            },
        ]);

        const result = await tool.invoke(
            {
                input: { templateName: 'missing' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                templateName: string;
            }>,
            token,
        );

        expect(projectClone.cloneProjectFromSource).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Template "missing" not found');
        expect(text).toContain('hello-world');
    });

    it('deploys through the Topo deploy implementation with explicit compose file path', async () => {
        deploy.deploy.mockResolvedValue(undefined);

        const result = await tool.invoke(
            {
                input: {
                    deploy: true,
                    composeFilePath: '/workspace/compose.yaml',
                },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                deploy: boolean;
                composeFilePath: string;
            }>,
            token,
        );

        expect(deploy.deploy).toHaveBeenCalledWith('/workspace/compose.yaml');
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Deployment started');
        expect(text).toContain('Topo deploy tool');
    });

    it('searches workspace for compose file when deploying without explicit path', async () => {
        const composeUri = vscode.Uri.file('/workspace/compose.yaml');
        jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([
            composeUri,
        ]);
        deploy.deploy.mockResolvedValue(undefined);

        await tool.invoke(
            {
                input: { deploy: true },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                deploy: boolean;
            }>,
            token,
        );

        expect(deploy.deploy).toHaveBeenCalledWith(composeUri.fsPath);
    });

    it('returns error when deploying and no compose file is found', async () => {
        jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);

        const result = await tool.invoke(
            {
                input: { deploy: true },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                deploy: boolean;
            }>,
            token,
        );

        expect(deploy.deploy).not.toHaveBeenCalled();
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('No compose file found');
    });

    it('passes target to listTemplates when provided', async () => {
        topoCli.listTemplates.mockReturnValue([]);

        await tool.invoke(
            {
                input: { target: 'user@host' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                target: string;
            }>,
            token,
        );

        expect(topoCli.listTemplates).toHaveBeenCalledWith('user@host');
        expect(targetStore.getSelectedTarget).not.toHaveBeenCalled();
    });

    it('uses the selected target when no target is provided', async () => {
        targetStore.getSelectedTarget.mockResolvedValue('imx93');
        topoCli.listTemplates.mockReturnValue([]);

        await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        expect(topoCli.listTemplates).toHaveBeenCalledWith('imx93');
    });

    it('returns message when no templates available', async () => {
        topoCli.listTemplates.mockReturnValue([]);

        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toBe('No templates available.');
    });

    it('prepareInvocation returns progress message', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: {},
            } as vscode.LanguageModelToolInvocationPrepareOptions<object>,
            token,
        );

        expect(prepared).toEqual({
            invocationMessage: 'Listing available Topo templates…',
        });
    });

    it('prepareInvocation returns clone confirmation when templateName is provided', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { templateName: 'hello-world' },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                templateName: string;
            }>,
            token,
        );

        expect(prepared?.invocationMessage).toContain('hello-world');
        expect(prepared?.confirmationMessages?.title).toBe(
            'Clone Topo Template',
        );
    });

    it('prepareInvocation returns deploy confirmation when deploy is requested', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { deploy: true },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                deploy: boolean;
            }>,
            token,
        );

        expect(prepared?.invocationMessage).toContain('compose.yaml');
        expect(prepared?.confirmationMessages?.title).toBe(
            'Deploy Topo Project',
        );
    });
});
