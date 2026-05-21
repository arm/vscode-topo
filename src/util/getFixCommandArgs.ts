export const getFixCommandArgs = (
    command: string | undefined,
): string[] | undefined => {
    if (!command) {
        return undefined;
    }

    return command.split(/\s+/);
};
