import * as vscode from 'vscode';

export const parseQuery = (query: string): Record<string, string> => {
    // Some protocol URIs may be copied from rendered HTML/Markdown where '&' is entity-escaped.
    // Normalize those forms back to '&' so URLSearchParams can split query parameters correctly.
    const normalizedQuery = query.replace(/&(amp|#38|#x26);/gi, '&');
    const params = new URLSearchParams(normalizedQuery);
    const parsed: Record<string, string> = Object.fromEntries(params.entries());
    return parsed;
};

export const parseRequestData = (uri: vscode.Uri): Record<string, string> => {
    const parsed = parseQuery(uri.query);
    const data = filterProtocolUrlParam(parsed, uri);
    const { source } = data;
    if (source === undefined) {
        return data;
    }
    if (!uri.fragment || source.includes('#')) {
        return { ...data, source };
    }
    const [sourceFragment, ...fragmentQueryParts] = uri.fragment.split('&');
    const fragmentData = parseQuery(fragmentQueryParts.join('&'));
    return { ...data, ...fragmentData, source: `${source}#${sourceFragment}` };
};

const filterProtocolUrlParam = (
    data: Record<string, string>,
    uri: vscode.Uri,
): Record<string, string> => {
    const { url } = data;
    if (!url) {
        return data;
    }
    const parsedUrl = vscode.Uri.parse(url);
    if (
        parsedUrl.scheme.toLowerCase() !== uri.scheme.toLowerCase() ||
        parsedUrl.authority.toLowerCase() !== uri.authority.toLowerCase()
    ) {
        return data;
    }
    const { url: _protocolUrl, ...rest } = data;
    return rest;
};
