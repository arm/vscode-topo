import { isWrappedError, type WrappedErrorLog } from '../errors/wrappedError';
import { getErrorMessage } from './getErrorMessage';
import { logger } from './logger';
import * as vscode from 'vscode';

const logEntries = (entries: WrappedErrorLog[]) => {
    for (const entry of entries) {
        switch (entry.level) {
            case 'Error':
                logger.error(entry.msg);
                break;
            case 'Warning':
                logger.warn(entry.msg);
                break;
            case 'Info':
                logger.info(entry.msg);
                break;
            case 'Debug':
                logger.debug(entry.msg);
                break;
        }
    }
};

export const logError = (message: string, err: unknown) => {
    if (isWrappedError(err)) {
        logger.error(message);
        logger.error(getErrorMessage(err));
        logEntries(err.logs);
    } else {
        logger.error(message, err);
    }
};

export const logWarning = (message: string, err: unknown) => {
    if (isWrappedError(err)) {
        logger.warn(message);
        logger.warn(getErrorMessage(err));
        logEntries(err.logs);
    } else {
        logger.warn(message, err);
    }
};

export const showAndLogError = (message: string, err: unknown) => {
    vscode.window.showErrorMessage(`${message}. ${getErrorMessage(err)}`);
    logError(message, err);
};

export const showAndLogWarning = (message: string, err: unknown) => {
    vscode.window.showWarningMessage(`${message}. ${getErrorMessage(err)}`);
    logWarning(message, err);
};
