import * as vscode from 'vscode';
import { mock, MockProxy } from 'vitest-mock-extended';
import { WrappedError } from './errors/wrappedError';
import { ProtocolHandler } from './protocolHandler';
import { ProjectCloneWorkflow } from './workflows/projectCloneWorkflow';
import { showAndLogError } from './util/showAndLog';

vi.mock('./util/showAndLog');

describe('ProtocolHandler', () => {
    let cloneWorkflow: MockProxy<ProjectCloneWorkflow>;
    let protocolHandler: ProtocolHandler;

    beforeEach(() => {
        vi.resetAllMocks();
        cloneWorkflow = mock<ProjectCloneWorkflow>();
        protocolHandler = new ProtocolHandler(cloneWorkflow);
    });

    it('uses the shared clone workflow for an explicit git source', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=git:https://example.com/project.git',
            ),
        );

        expect(cloneWorkflow.clone).toHaveBeenCalledWith(
            {
                type: 'git',
                url: 'https://example.com/project.git',
            },
            {},
        );
    });

    it('passes a raw source and arbitrary parameters to the workflow', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse(
                'vscode://arm.topo/clone?source=https://example.com/project.git&model=some-huggingface-id',
            ),
        );

        expect(cloneWorkflow.clone).toHaveBeenCalledWith(
            { value: 'https://example.com/project.git' },
            { model: 'some-huggingface-id' },
        );
    });

    it('does not clone when source is missing', async () => {
        await protocolHandler.handleUri(
            vscode.Uri.parse('vscode://arm.topo/clone?model=test-model'),
        );

        expect(cloneWorkflow.clone).not.toHaveBeenCalled();
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
        expect(cloneWorkflow.clone).not.toHaveBeenCalled();
    });

    it('shows clone workflow errors', async () => {
        const error = new WrappedError('CLONE', 'task failed');
        cloneWorkflow.clone.mockRejectedValueOnce(error);

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

        expect(cloneWorkflow.clone).not.toHaveBeenCalled();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            `Invalid URI: ${uri.toString()}`,
        );
    });
});
