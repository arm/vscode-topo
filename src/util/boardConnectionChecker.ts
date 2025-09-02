
import net from 'net';
import { BOARD_HOSTNAME } from '../manifest';
import { logger } from './logger';

export class BoardConnectionChecker {

    /**
    * Checks if the SSH port of the board is open.
    * @returns {Promise<boolean>} - Returns true if the port is open, false otherwise.
    */
    public async isBoardSshPortOpen(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const response = await new Promise<{ status: number }>((resolve, reject) => {
                const socket = new net.Socket();
    
                // Handle abort signal
                const onAbort = () => {
                    socket.destroy();
                    reject(new Error('Aborted'));
                };
                controller.signal.addEventListener('abort', onAbort);
    
                socket.setTimeout(2000, () => {
                    socket.destroy();
                    reject(new Error('Timeout'));
                });
    
                socket.connect(22, BOARD_HOSTNAME, () => {
                    socket.end();
                    controller.signal.removeEventListener('abort', onAbort);
                    resolve({ status: 200 });
                });
    
                socket.on('error', (err) => {
                    controller.signal.removeEventListener('abort', onAbort);
                    reject(err);
                });
            });
            clearTimeout(timeout);
            return response.status === 200;
        } catch (err) {
            logger.error('Error checking board SSH port:');
            logger.error(err);
            return false;
        }
    }
}
