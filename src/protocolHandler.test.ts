import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { WrappedError } from './errors/wrappedError';
import { ProjectCloner } from './operations/projectCloner';
import { ProtocolHandler } from './protocolHandler';
import { showAndLogError } from './util/showAndLog';

vi.mock('./util/showAndLog');

describe('ProtocolHandler', () => {
    let projectCloner: MockProxy<ProjectCloner>;
    let protocolHandler: ProtocolHandler;

    beforeEach(() => {
        vi.resetAllMocks();
        projectCloner = mock<ProjectCloner>();
        protocolHandler = new ProtocolHandler(projectCloner);
    });

    it('uses the shared clone operation for an explicit git source', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/project.git',
            ),
        );

        expect(projectCloner.clone).toHaveBeenCalledWith(
            {
                type: 'git',
                url: 'https://example.com/project.git',
            },
            {},
        );
    });

    it('passes a raw source and arbitrary parameters to the operation', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/project.git&model=some-huggingface-id',
            ),
        );

        expect(projectCloner.clone).toHaveBeenCalledWith(
            { value: 'https://example.com/project.git' },
            { model: 'some-huggingface-id' },
        );
    });

    it('does not clone when source is missing', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse('vscode://arm.topo/clone?model=test-model'),
        );

        expect(projectCloner.clone).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it('rejects directory sources', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/clone?source=dir:/tmp/project',
        );

        await protocolHandler.handleUri(uri);

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Clone source type 'dir' is not supported for URI-based cloning. Please use the command palette to clone from a local directory. URI: ${uri.toString()}`,
        );
        expect(projectCloner.clone).not.toHaveBeenCalled();
    });

    it('shows clone operation errors', async () => {
        const error = new WrappedError('CLONE', 'task failed');
        projectCloner.clone.mockRejectedValueOnce(error);

        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/project.git',
            ),
        );

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to clone project',
            error,
        );
    });

    it('shows an error for unrelated URI paths', async () => {
        const uri = vscode.Uri.parse(
            'vscode://arm.topo/open?source=git:https://example.com/project.git',
        );

        await protocolHandler.handleUri(uri);

        expect(projectCloner.clone).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid URI: ${uri.toString()}`,
        );
    });
});
