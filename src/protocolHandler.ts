import * as vscode from 'vscode';
import { cloneProjectFromSource } from './util/projectClone';
import { logger } from './util/logger';
import { parseCloneSourceString } from './util/parseSourceCloneString';
import { isWrappedError } from './errors/wrappedError';
import { showAndLogError } from './util/showAndLogError';
import { TaskExecutor } from './util/taskExecutor';
import { parseQuery } from './util/parseQuery';

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
    constructor(private readonly taskExecutor: TaskExecutor) {}

    public async handleUri(uri: vscode.Uri): Promise<void> {
        logger.info(`ProtocolHandler.handleUri(${uri.toString()})`);
        const data = parseRequestData(uri);

        switch (uri.path) {
            case '/clone':
                try {
                    await handleCloneRequest(this.taskExecutor, uri, data);
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
    taskExecutor: TaskExecutor,
    uri: vscode.Uri,
    data: Record<string, string>,
): Promise<void> => {
    if (typeof data.source !== 'string') {
        logger.error(`Failed to open URI: ${uri.toString()}`);
        return;
    }
    const { source, ...cloneBuildArgs } = data;
    const cloneSource = parseCloneSourceString(source);
    if (cloneSource.type === 'dir') {
        const errMessage = `Clone source type 'dir' is not supported for URI-based cloning. Please use the command palette to clone from a local directory. URI: ${uri.toString()}`;
        vscode.window.showErrorMessage(errMessage);
        logger.error(errMessage);
        return;
    }

    const cloneStarted = await cloneProjectFromSource(
        taskExecutor,
        cloneSource,
        cloneBuildArgs,
    );
    if (!cloneStarted) {
        logger.info(`Clone cancelled for URI ${uri.toString()}`);
    }
};

const parseRequestData = (uri: vscode.Uri): Record<string, string> => {
    const { url: _redirectUrl, ...data } = parseQuery(uri.query);
    const { source } = data;
    if (source === undefined) {
        return data;
    }
    if (!source || !uri.fragment || source.includes('#')) {
        return { ...data, source };
    }
    return { ...data, source: `${source}#${uri.fragment}` };
};
