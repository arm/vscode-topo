export const parseQuery = (query: string): Record<string, string> => {
    // Some protocol URIs may be copied from rendered HTML/Markdown where '&' is entity-escaped.
    // Normalize those forms back to '&' so URLSearchParams can split query parameters correctly.
    const normalizedQuery = query.replace(/&(amp|#38|#x26);/gi, '&');
    const params = new URLSearchParams(normalizedQuery);
    const parsed: Record<string, string> = Object.fromEntries(params.entries());
    return parsed;
};
