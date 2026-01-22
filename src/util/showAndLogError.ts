import { getErrorMessage } from './getErrorMessage';
import { logger } from './logger';
import * as vscode from 'vscode';

export const showAndLogError = (message: string, err: unknown) => {
    vscode.window.showErrorMessage(`${message}. ${getErrorMessage(err)}`);
    logger.error(message, err);
};
