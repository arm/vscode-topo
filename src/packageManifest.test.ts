import fs from 'node:fs';
import path from 'node:path';

interface PackageManifest {
    activationEvents?: string[];
    contributes?: {
        languageModelTools?: Array<{
            name: string;
            displayName?: string;
            toolReferenceName?: string;
            modelDescription?: string;
            tags?: string[];
        }>;
    };
}

function loadManifest(): PackageManifest {
    return JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
    ) as PackageManifest;
}

describe('package manifest', () => {
    it('activates the extension when any contributed language model tool is invoked', () => {
        const manifest = loadManifest();
        const activationEvents = new Set(manifest.activationEvents ?? []);
        const languageModelTools =
            manifest.contributes?.languageModelTools ?? [];

        for (const tool of languageModelTools) {
            expect(activationEvents).toContain(
                `onLanguageModelTool:${tool.name}`,
            );
        }
    });

    it('contributes an examples-specific language model tool alias', () => {
        const manifest = loadManifest();
        const languageModelTools =
            manifest.contributes?.languageModelTools ?? [];
        const examplesTool = languageModelTools.find(
            (tool) => tool.name === 'topo_listExamples',
        );

        expect(examplesTool).toMatchObject({
            displayName: 'List Topo Examples',
            toolReferenceName: 'topoListExamples',
        });
        expect(examplesTool?.modelDescription).toContain('example programs');
        expect(examplesTool?.tags).toContain('examples');
    });

    it('contributes a project-clone language model tool alias', () => {
        const manifest = loadManifest();
        const languageModelTools =
            manifest.contributes?.languageModelTools ?? [];
        const cloneTool = languageModelTools.find(
            (tool) => tool.name === 'topo_clone',
        );
        const cloneProjectTool = languageModelTools.find(
            (tool) => tool.name === 'topo_cloneProject',
        );

        expect(cloneTool).toMatchObject({
            displayName: 'Topo Clone',
            toolReferenceName: 'topoClone',
        });
        expect(cloneTool?.modelDescription).toContain(
            'This is the exact Topo clone operation for chat',
        );
        expect(cloneTool?.modelDescription).toContain(
            'instead of running `topo clone`, `git clone`',
        );
        expect(cloneTool?.tags).toContain('clone');
        expect(cloneProjectTool).toMatchObject({
            displayName: 'Clone Topo Project',
            toolReferenceName: 'topoCloneProject',
        });
        expect(cloneProjectTool?.modelDescription).toContain(
            'instead of running `topo clone`, `git clone`',
        );
        expect(cloneProjectTool?.tags).toContain('clone');
    });

    it('tells agents to clone listed examples by template name through clone tools', () => {
        const manifest = loadManifest();
        const languageModelTools =
            manifest.contributes?.languageModelTools ?? [];
        const listToolNames = ['topo_listTemplates', 'topo_listExamples'];

        for (const toolName of listToolNames) {
            const tool = languageModelTools.find(
                (candidate) => candidate.name === toolName,
            );
            expect(tool?.modelDescription).toContain('topo_clone');
            expect(tool?.modelDescription).toContain('topoClone');
            expect(tool?.modelDescription).toContain('templateName');
            expect(tool?.modelDescription?.toLowerCase()).toContain(
                'do not run git clone',
            );
        }
    });

    it('tells chat agents to prefer extension tools over direct topo commands', () => {
        const manifest = loadManifest();
        const languageModelTools =
            manifest.contributes?.languageModelTools ?? [];

        for (const tool of languageModelTools) {
            expect(tool.modelDescription).toContain(
                'In chat, use this tool instead of running',
            );
        }
    });
});
