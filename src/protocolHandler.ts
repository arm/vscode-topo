import * as vscode from 'vscode';
import { logger } from './util/logger';
import { parseCloneSource } from './util/cloneSource';
import { isWrappedError } from './errors/wrappedError';
import { showAndLogError } from './util/showAndLog';
import { parseRequestData } from './util/protocolRequest';
import { ProjectCloner } from './operations/projectCloner';

/**
 * VS Code URI handler for Topo deep links.
 *
 * Currently supports cloning via:
 * - `vscode://arm.topo/clone?source=<clone-source>&<option>=<value>...`
 *
 * `source` is required and uses the same format as `topo clone` (e.g. `git:https://...` or a bare git URL).
 * Additional query parameters are forwarded to `topo clone` as `key=value` arguments.
 */
export class ProtocolHandler implements vscode.UriHandler {
    constructor(private readonly projectCloner: ProjectCloner) {}

    public async handleUri(uri: vscode.Uri): Promise<void> {
        logger.info(`ProtocolHandler.handleUri(${uri.toString()})`);
        const data = parseRequestData(uri);

        switch (uri.path) {
            case '/clone':
                try {
                    await handleCloneRequest(this.projectCloner, uri, data);
                } catch (error: unknown) {
                    if (isWrappedError(error, ['CLONE', 'CLI'])) {
                        return showAndLogError(
                            'Failed to clone project',
                            error,
                        );
                    }
                    throw error;
                }
                break;
            default: {
                const errMessage = `Invalid URI: ${uri.toString()}`;
                vscode.window.showErrorMessage(errMessage);
                logger.error(errMessage);
            }
        }
    }
}

const handleCloneRequest = async (
    projectCloner: ProjectCloner,
    uri: vscode.Uri,
    data: Record<string, string>,
): Promise<void> => {
    if (typeof data.source !== 'string') {
        logger.error(`Failed to open URI: ${uri.toString()}`);
        return;
    }
    const { source, ...cloneParameters } = data;
    const cloneSource = parseCloneSource(source);
    if (cloneSource.type === 'dir') {
        const errMessage = `Clone source type 'dir' is not supported for URI-based cloning. Please use the command palette to clone from a local directory. URI: ${uri.toString()}`;
        vscode.window.showErrorMessage(errMessage);
        logger.error(errMessage);
        return;
    }

    await projectCloner.clone(cloneSource, cloneParameters);
};
