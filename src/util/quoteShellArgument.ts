export const quoteShellArgument = (value: string): string => {
    return `'${value.replace(/'/g, `'\\''`)}'`;
};
