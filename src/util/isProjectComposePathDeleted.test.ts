import * as vscode from 'vscode';
import { ProjectMetadata } from './project';
import { isProjectComposePathDeleted } from './isProjectComposePathDeleted';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/workspace/demo'),
    composeFileUri: vscode.Uri.file('/workspace/demo/compose.yaml'),
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

describe('isProjectComposePathDeleted', () => {
    it('returns true when the compose file is deleted', () => {
        expect(
            isProjectComposePathDeleted(
                [project],
                '/workspace/demo/compose.yaml',
            ),
        ).toBe(true);
    });

    it('returns true when the project directory is deleted', () => {
        expect(isProjectComposePathDeleted([project], '/workspace/demo')).toBe(
            true,
        );
    });

    it('returns true when an ancestor above the project is deleted', () => {
        expect(isProjectComposePathDeleted([project], '/workspace')).toBe(true);
    });

    it('returns false when an unrelated sibling is deleted', () => {
        expect(isProjectComposePathDeleted([project], '/workspace/other')).toBe(
            false,
        );
    });

    it('returns false when a similarly prefixed path is deleted', () => {
        expect(isProjectComposePathDeleted([project], '/workspace/dem')).toBe(
            false,
        );
    });

    it('returns false when a project descendant is deleted', () => {
        expect(
            isProjectComposePathDeleted([project], '/workspace/demo/nested'),
        ).toBe(false);
    });

    it('checks every project', () => {
        const otherProject: ProjectMetadata = {
            ...project,
            name: 'other',
            uri: vscode.Uri.file('/other-workspace/other'),
            composeFileUri: vscode.Uri.file(
                '/other-workspace/other/compose.yaml',
            ),
        };

        expect(
            isProjectComposePathDeleted(
                [project, otherProject],
                '/other-workspace',
            ),
        ).toBe(true);
    });

    it('returns false when there are no projects', () => {
        expect(isProjectComposePathDeleted([], '/workspace')).toBe(false);
    });
});
