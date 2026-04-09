import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as manifest from '../../src/manifest';
import '@testing-library/jest-dom';
import { SubsystemSection } from './subsystemSection';
import { ConfigMetadata, ServiceCreationDescription, TemplateDescription } from '../../src/util/types';

describe('SubsystemSection', () => {

    let services: ServiceCreationDescription[];
    const board = "NXP i.MX 93";
    const templates: TemplateDescription[] = [
        {
            id: 'p',
            url: 'u',
            subsystem: 'Host',
            ports: [],
        }];
    const configMetadata: ConfigMetadata = {
        boards: [
            {
                id: "NXP i.MX 93",
                subsystems: [
                    {
                        id: "Ambient",
                        runtime: manifest.BOARD_AMBIENT_RUNTIME,
                        annotations: {
                            "remoteproc.mcu": "imx-rproc"
                        }
                    }
                ]
            }
        ]
    };
    let quickPicker: {
    showQuickPick: jest.Mock,
    createQuickPick: jest.Mock,
  };
    const addService = jest.fn();
    const removeService = jest.fn();

    const renderComponent = () => {
        return render(
            <SubsystemSection
                title="Host"
                subsystemServices={services}
                templates={templates}
                configMetadata={configMetadata}
                board={board}
                quickPicker={quickPicker}
                addService={addService}
                removeService={removeService}
            />
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        services = [
            {
                name: 'project1',
                errors: [],
                build: {
                    context: './project1'
                },
                containerName: 'container1',
                annotations: {},
                runtime: manifest.BOARD_AMBIENT_RUNTIME
            },
            {
                name: 'project2',
                errors: [],
                build: {
                    context: './project2'
                },
                containerName: 'container2',
                annotations: {},
                runtime: manifest.BOARD_AMBIENT_RUNTIME
            }
        ];
        quickPicker = {
            showQuickPick: jest.fn().mockResolvedValue('project1'),
            createQuickPick: jest.fn().mockResolvedValue('test'),
        };
    });

    it('renders correctly', () => {
        const { container } = renderComponent();
        expect(container).toMatchSnapshot();
    });

    it('adds a new service when Add Service clicked', async () => {
        renderComponent();
        const addButton = screen.getByRole('button', { name: /Add Service/i });
        fireEvent.click(addButton);
        await waitFor(() => expect(addService).toHaveBeenCalled());
    });

    it('calls removeService when Remove button is clicked', () => {
        renderComponent();
        const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
        fireEvent.click(removeButtons[0]);
        expect(removeService).toHaveBeenCalledWith('project1');
    });

    it('disables Add Service button if quickPicker.showQuickPick returns undefined', async () => {
        quickPicker.showQuickPick.mockResolvedValue(undefined);
        renderComponent();
        const addButton = screen.getByRole('button', { name: /Add Service/i });
        fireEvent.click(addButton);
        await waitFor(() => {
            expect(addService).not.toHaveBeenCalled();
        });
    });

    it('shows warning icon if service has errors', () => {
        services[0].errors = ['Some error'];
        renderComponent();
        expect(screen.getByTitle('Some error')).toBeInTheDocument();
        expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('renders no table if subsystemServices is empty', () => {
        services = [];
        renderComponent();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Service/i })).toBeInTheDocument();
    });

    it('does not call addService if createQuickPick returns undefined', async () => {
        quickPicker.createQuickPick.mockResolvedValue(undefined);
        renderComponent();
        const addButton = screen.getByRole('button', { name: /Add Service/i });
        fireEvent.click(addButton);
        await waitFor(() => {
            expect(addService).not.toHaveBeenCalled();
        });
    });
});
