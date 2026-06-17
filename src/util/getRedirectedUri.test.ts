import * as vscode from 'vscode';
import { getRedirectedUri } from './getRedirectedUri';

const requestUri = vscode.Uri.parse('vscode://arm.topo/clone?source=repo');

describe('getRedirectedUri', () => {
    it('returns undefined when no redirect url is provided', () => {
        expect(getRedirectedUri(requestUri, undefined)).toBeUndefined();
    });

    it('returns undefined when the url is not a vscode.dev redirect', () => {
        const redirectUrl =
            'vscode://arm.topo/clone?source=https%3A%2F%2Fexample.com%2Frepo.git';

        expect(getRedirectedUri(requestUri, redirectUrl)).toBeUndefined();
    });

    it('returns undefined when the vscode.dev redirect has no nested url', () => {
        const redirectUrl = 'https://vscode.dev/redirect?source=repo';

        expect(getRedirectedUri(requestUri, redirectUrl)).toBeUndefined();
    });

    it('returns undefined when the nested url does not match the request route', () => {
        const redirectedUri = 'vscode://arm.topo/open?source=repo';
        const redirectUrl = `https://vscode.dev/redirect?url=${encodeURIComponent(redirectedUri)}`;

        expect(getRedirectedUri(requestUri, redirectUrl)).toBeUndefined();
    });

    it('returns the nested uri from a matching vscode.dev redirect', () => {
        const redirectedUri =
            'vscode://arm.topo/clone?source=https%3A%2F%2Fexample.com%2Frepo.git%23main';
        const redirectUrl = `https://vscode.dev/redirect?url=${encodeURIComponent(redirectedUri)}`;

        const result = getRedirectedUri(requestUri, redirectUrl);

        expect(result).toMatchObject({
            scheme: 'vscode',
            authority: 'arm.topo',
            path: '/clone',
            query: 'source=https://example.com/repo.git',
            fragment: 'main',
        });
    });
});
