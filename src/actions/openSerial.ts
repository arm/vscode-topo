import * as vscode from 'vscode';
import { SerialMonitorApiV2, SerialMonitorExtension } from '@eclipse-cdt-cloud/vscode-serial-monitor';
import { SubsystemTreeItem } from '../workloadPlacement/targetTreeDataProvider';
import { PACKAGE_NAME } from '../manifest';

const SERIAL_EXTENSION = 'eclipse-cdt.serial-monitor';
const SERIAL_OPTIONS = { baudRate: 115200 };

export class OpenSerial {

    public static readonly openSerialCommandType = `${PACKAGE_NAME}.openSerial`;
    protected serialCache = new Map<string, string>();

    constructor(private readonly context: vscode.ExtensionContext) { }

    public activate() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(OpenSerial.openSerialCommandType, this.openSerial.bind(this))
        );
    }

    public async openSerial(item: SubsystemTreeItem) {
        const api = await this.getSerialMonitor();
        if (!api) {
            return;
        }

        const ports = await api.listPorts();
        const serialNumbers = ports.map(port => port.serialNumber)
            .filter((value, index, array) => array.indexOf(value) === index)
            .filter(sn => !!sn);
        if (serialNumbers.length !== 1) {
            return;
        }

        const topoPorts = ports.filter(port => port.serialNumber === serialNumbers[0]);
        if (topoPorts.length !== 2) {
            return;
        }

        const hostPort = topoPorts.find(port => port.path?.endsWith('1'));
        const ambientPort = topoPorts.find(port => port.path?.endsWith('3'));
        const path = item.group === 'Host' ? hostPort?.path : ambientPort?.path;
        if (!path) {
            return;
        }

        let handle = this.serialCache.get(path);

        if (handle) {
            const success = await api.revealSerial(handle);
            if (success) {
                return;
            }

            this.serialCache.delete(path);
        }

        handle = await api.openSerial({ path }, SERIAL_OPTIONS, `${item.group} UART`);
        if (handle) {
            this.serialCache.set(path, handle);
        }
    }

    protected async getSerialMonitor(): Promise<SerialMonitorApiV2 | undefined> {
        const extension = vscode.extensions.getExtension<SerialMonitorExtension>(SERIAL_EXTENSION);
        if (!extension) {
            return undefined;
        }

        const activated = await extension.activate();
        return activated.getApi(2);
    }
}
