import * as vscode from 'vscode';
import { CloneTemplateTool } from './cloneTemplateTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import { ProjectClone } from '../projectClone';
import { TargetStore } from '../target/targetStore';
import { TemplateDescription } from '../topoCliSchema';

describe('CloneTemplateTool', () => {
    let tool: CloneTemplateTool;
    let topoCli: MockProxy<TopoCli>;
    let projectClone: MockProxy<ProjectClone>;
    let targetStore: MockProxy<TargetStore>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    const templates: TemplateDescription[] = [
        {
            name: 'hello-world',
            description: 'A simple hello world project',
            features: null,
            url: 'https://example.com/hello.git',
            ref: 'main',
        },
    ];

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        projectClone = mock<ProjectClone>();
        targetStore = mock<TargetStore>();
        tool = new CloneTemplateTool(topoCli, projectClone, targetStore);
    });

    it('clones from gitUrl directly', async () => {
        projectClone.cloneProjectFromSource.mockResolvedValue(true);

        const result = await tool.invoke(
            {
                input: { gitUrl: 'https://example.com/repo.git' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                gitUrl: string;
            }>,
            token,
        );

        expect(projectClone.cloneProjectFromSource).toHaveBeenCalledWith({
            type: 'git',
            url: 'https://example.com/repo.git',
        });
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Successfully cloned');
    });

    it('reports when git clone is cancelled', async () => {
        projectClone.cloneProjectFromSource.mockResolvedValue(false);

        const result = await tool.invoke(
            {
                input: { gitUrl: 'https://example.com/repo.git' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                gitUrl: string;
            }>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('cancelled or failed');
    });

    it('clones from template name', async () => {
        targetStore.getSelectedTarget.mockResolvedValue(undefined);
        topoCli.listTemplates.mockReturnValue(templates);
        projectClone.cloneProjectFromSource.mockResolvedValue(true);

        const result = await tool.invoke(
            {
                input: { templateName: 'hello-world' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                templateName: string;
            }>,
            token,
        );

        expect(projectClone.cloneProjectFromSource).toHaveBeenCalledWith({
            type: 'git',
            url: 'https://example.com/hello.git',
        });
        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('Successfully cloned template');
    });

    it('matches template name case-insensitively', async () => {
        targetStore.getSelectedTarget.mockResolvedValue(undefined);
        topoCli.listTemplates.mockReturnValue(templates);
        projectClone.cloneProjectFromSource.mockResolvedValue(true);

        await tool.invoke(
            {
                input: { templateName: 'Hello-World' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                templateName: string;
            }>,
            token,
        );

        expect(projectClone.cloneProjectFromSource).toHaveBeenCalledWith({
            type: 'git',
            url: 'https://example.com/hello.git',
        });
    });

    it('returns error when template not found', async () => {
        targetStore.getSelectedTarget.mockResolvedValue(undefined);
        topoCli.listTemplates.mockReturnValue(templates);

        const result = await tool.invoke(
            {
                input: { templateName: 'nonexistent' },
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<{
                templateName: string;
            }>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('not found');
        expect(text).toContain('hello-world');
    });

    it('returns error when neither templateName nor gitUrl provided', async () => {
        const result = await tool.invoke(
            {
                input: {},
                toolInvocationToken: undefined,
            } as vscode.LanguageModelToolInvocationOptions<object>,
            token,
        );

        const text = (result.content[0] as vscode.LanguageModelTextPart).value;
        expect(text).toContain('provide either');
    });

    it('prepareInvocation returns confirmation for template', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { templateName: 'hello-world' },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                templateName: string;
            }>,
            token,
        );

        expect(prepared?.confirmationMessages?.title).toBe(
            'Clone Topo Project',
        );
        expect(prepared?.invocationMessage).toContain('hello-world');
    });

    it('prepareInvocation returns confirmation for gitUrl', async () => {
        const prepared = await tool.prepareInvocation(
            {
                input: { gitUrl: 'https://example.com/repo.git' },
            } as vscode.LanguageModelToolInvocationPrepareOptions<{
                gitUrl: string;
            }>,
            token,
        );

        expect(prepared?.invocationMessage).toContain(
            'https://example.com/repo.git',
        );
    });
});
