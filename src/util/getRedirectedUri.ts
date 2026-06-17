import * as vscode from 'vscode';
import { parseQuery } from './parseQuery';

export const getRedirectedUri = (
    requestUri: vscode.Uri,
    redirectUrl: string | undefined,
): vscode.Uri | undefined => {
    if (typeof redirectUrl !== 'string') {
        return undefined;
    }

    const redirectPageUri = vscode.Uri.parse(redirectUrl);
    if (
        redirectPageUri.scheme !== 'https' ||
        redirectPageUri.authority !== 'vscode.dev' ||
        redirectPageUri.path !== '/redirect'
    ) {
        return undefined;
    }

    const redirectedUrl = parseQuery(redirectPageUri.query).url;
    if (typeof redirectedUrl !== 'string') {
        return undefined;
    }

    const redirectedUri = vscode.Uri.parse(redirectedUrl);
    if (
        redirectedUri.scheme !== requestUri.scheme ||
        redirectedUri.authority !== requestUri.authority ||
        redirectedUri.path !== requestUri.path
    ) {
        return undefined;
    }

    return redirectedUri;
};
