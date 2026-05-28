import { isWrappedError } from '../errors/wrappedError';
import { getErrorMessage } from './getErrorMessage';
import { logger } from './logger';
import * as vscode from 'vscode';

export const showAndLogError = (message: string, err: unknown) => {
    vscode.window.showErrorMessage(`${message}. ${getErrorMessage(err)}`);
    if (isWrappedError(err)) {
        logger.error(message);
        logger.error(getErrorMessage(err));
        for (const entry of err.logs) {
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
    } else {
        logger.error(message, err);
    }
};
