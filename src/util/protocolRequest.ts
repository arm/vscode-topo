import * as vscode from 'vscode';
import { PACKAGE_NAME, REGISTRY_NAME } from '../manifest';

const isExtensionProtocolUri = (uri: vscode.Uri): boolean => {
    const protocolScheme = 'vscode';
    const protocolAuthority = `${REGISTRY_NAME}.${PACKAGE_NAME}`;
    return (
        uri.scheme.toLowerCase() === protocolScheme &&
        uri.authority.toLowerCase() === protocolAuthority
    );
};

export const parseQuery = (query: string): Record<string, string> => {
    // Some protocol URIs may be copied from rendered HTML/Markdown where '&' is entity-escaped.
    // Normalize those forms back to '&' so URLSearchParams can split query parameters correctly.
    const normalizedQuery = query.replace(/&(amp|#38|#x26);/gi, '&');
    const params = new URLSearchParams(normalizedQuery);
    const parsed: Record<string, string> = Object.fromEntries(params.entries());
    return parsed;
};

export const parseRequestData = (uri: vscode.Uri): Record<string, string> => {
    const queryData = parseQuery(uri.query);
    const cleanedQueryData = filterProtocolUrlParam(queryData);
    return cleanedQueryData;
};

const filterProtocolUrlParam = (
    queryData: Record<string, string>,
): Record<string, string> => {
    const { url } = queryData;
    if (!url) {
        return queryData;
    }
    const parsedUrl = vscode.Uri.parse(url);
    if (!isExtensionProtocolUri(parsedUrl)) {
        return queryData;
    }
    const { url: _protocolUrl, ...rest } = queryData;
    return rest;
};
