import * as vscode from 'vscode';
import { ProjectMetadata } from './project';
import { isProjectAncestorDeleted } from './isProjectAncestorDeleted';

const project: ProjectMetadata = {
    name: 'demo',
    uri: vscode.Uri.file('/workspace/demo'),
    composeFileUri: vscode.Uri.file('/workspace/demo/compose.yaml'),
    workspaceIndex: 0,
    workspaceName: 'workspace',
};

describe('isProjectAncestorDeleted', () => {
    it.each([
        ['/workspace/demo', 'the project directory'],
        ['/workspace', 'an ancestor above the project'],
    ])('returns true when deleting %s (%s)', (deletedPath) => {
        expect(isProjectAncestorDeleted([project], deletedPath)).toBe(true);
    });

    it.each([
        ['/workspace/demo/compose.yaml', 'the compose file itself'],
        ['/workspace/other', 'an unrelated sibling'],
        ['/workspace/dem', 'a similarly prefixed path'],
        ['/workspace/demo/nested', 'a project descendant'],
    ])('returns false when deleting %s (%s)', (deletedPath) => {
        expect(isProjectAncestorDeleted([project], deletedPath)).toBe(false);
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
            isProjectAncestorDeleted(
                [project, otherProject],
                '/other-workspace',
            ),
        ).toBe(true);
    });

    it('returns false when there are no projects', () => {
        expect(isProjectAncestorDeleted([], '/workspace')).toBe(false);
    });
});
