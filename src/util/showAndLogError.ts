import { getErrorMessage } from './getErrorMessage';
import { isTopoError } from '../errors/topoError';
import { logger } from './logger';
import * as vscode from 'vscode';

export const showAndLogError = (message: string, err: unknown) => {
    vscode.window.showErrorMessage(`${message}. ${getErrorMessage(err)}`);
    if (isTopoError(err) && err.logEntries.length > 0) {
        for (const entry of err.logEntries) {
            const logMessage = `[topo] ${entry.msg}`;
            switch (entry.level) {
                case 'ERROR':
                    logger.error(logMessage);
                    break;
                case 'WARN':
                    logger.warn(logMessage);
                    break;
                case 'DEBUG':
                    logger.debug(logMessage);
                    break;
                default:
                    logger.info(logMessage);
                    break;
            }
        }
    } else {
        logger.error(message, err);
    }
};
