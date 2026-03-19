import * as vscode from 'vscode';
import { ProjectClone } from './projectClone';
import { logger } from './util/logger';
import { getWorkspacePath } from './util/getWorkspacePath';
import { parseCloneSourceString } from './util/parseSourceCloneString';
import { isTopoError } from './errors/topoError';
import { showAndLogError } from './util/showAndLogError';

const getCloneDestinationPath = async (): Promise<string | undefined> => {
    const workspacePath = getWorkspacePath();
    if (workspacePath) {
        return workspacePath;
    }

    const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Destination Folder',
    });

    return selectedFolder?.[0]?.fsPath;
};

/**
 * VS Code URI handler for Topo deep links.
 *
 * Currently supports cloning via:
 * - `vscode://arm.topo/clone?source=<clone-source>&<option>=<value>...`
 *
 * `source` is required and uses the same format as `topo clone` (e.g. `git:https://...`, `template:...`, or a bare git URL).
 * Additional query parameters are forwarded to `topo clone` as `key=value` arguments.
 */
export class ProtocolHandler implements vscode.UriHandler {
    constructor(private readonly projectClone: ProjectClone) {}

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.window.registerUriHandler(this));
    }

    public async handleUri(uri: vscode.Uri): Promise<void> {
        logger.info(`ProtocolHandler.handleUri(${uri.toString()})`);
        const data = this.parseQuery(uri.query);

        switch (uri.path) {
            case '/clone':
                try {
                    await this.handleCloneRequest(uri, data);
                } catch (error: unknown) {
                    if (!isTopoError(error) || error.code !== 'CLONE') {
                        throw error;
                    }
                    showAndLogError('Failed to clone project', error);
                }
                break;
            default: {
                const errMessage = `Invalid URI: ${uri.toString()}`;
                vscode.window.showErrorMessage(errMessage);
                logger.error(errMessage);
            }
        }
    }

    private async handleCloneRequest(
        uri: vscode.Uri,
        data: Record<string, string>,
    ): Promise<void> {
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

        const workspacePath = await getCloneDestinationPath();
        if (!workspacePath) {
            logger.info(
                `Clone cancelled: no destination folder selected for URI ${uri.toString()}`,
            );
            return;
        }

        await this.projectClone.cloneProjectFromSource(
            workspacePath,
            cloneSource,
            cloneBuildArgs,
        );
    }

    private parseQuery(query: string): Record<string, string> {
        // Some protocol URIs may be copied from rendered HTML/Markdown where '&' is entity-escaped.
        // Normalize those forms back to '&' so URLSearchParams can split query parameters correctly.
        const normalizedQuery = query.replace(/&(amp|#38|#x26);/gi, '&');
        const params = new URLSearchParams(normalizedQuery);
        const parsed: Record<string, string> = Object.fromEntries(
            params.entries(),
        );
        return parsed;
    }
}
