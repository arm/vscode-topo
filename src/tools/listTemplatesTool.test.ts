import * as vscode from 'vscode';
import { ListTemplatesTool } from './listTemplatesTool';
import { mock, MockProxy } from 'jest-mock-extended';
import { TopoCli } from '../topoCli';
import { TemplateDescription } from '../topoCliSchema';

describe('ListTemplatesTool', () => {
    let tool: ListTemplatesTool;
    let topoCli: MockProxy<TopoCli>;
    const token = new vscode.EventEmitter<void>()
        .event as unknown as vscode.CancellationToken;

    beforeEach(() => {
        topoCli = mock<TopoCli>();
        tool = new ListTemplatesTool(topoCli);
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
        expect(text).toContain('hello-world');
        expect(text).toContain('blinky');
        expect(text).toContain('https://example.com/hello.git');
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
});
