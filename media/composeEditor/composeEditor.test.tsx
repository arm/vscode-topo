import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComposeEditor } from './composeEditor';
import { TemplateDescription, ProjectDescription, ConfigMetadata } from '../../src/util/types';
import * as manifest from '../../src/manifest';

describe('ComposeEditor', () => {
    const project: ProjectDescription = {
        name: 'example-solution',
        services: {
            service1: {
                build: {
                    context: './service1',
                },
                containerName: 'service1-container',
            }
        }
    };
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

    const templates: TemplateDescription[] = [
        {
            id: 'project1',
            url: 'u1',
            subsystem: 'Host',
            ports: []
        },
        {
            id: 'project2',
            url: 'u2',
            subsystem: 'Ambient',
            ports: []
        },
    ];

    let messageHandler: { postMessage: jest.Mock };
    let quickPicker: {
    showQuickPick: jest.Mock,
    createQuickPick: jest.Mock,
  };

    beforeEach(() => {
        messageHandler = { postMessage: jest.fn() };
        quickPicker = {
            showQuickPick: jest.fn().mockResolvedValue('project1'),
            createQuickPick: jest.fn().mockResolvedValue('test'),
        };
    });

    function renderComposeEditor(customProps = {}) {
        return render(
            <ComposeEditor
                yamlText={''}
                messageHandler={messageHandler}
                project={project}
                templates={templates}
                quickPicker={quickPicker}
                configMetadata={configMetadata}
                {...customProps}
            />
        );
    }

    it('renders correctly with initial compose file content', () => {
        renderComposeEditor();
        expect(screen.getByText('Ambient')).toBeInTheDocument();
        expect(screen.getByText('Deploy')).toBeInTheDocument();
    });

    it('shows "Deploying..." when isDeploying is true', () => {
        renderComposeEditor();
        const deployButton = screen.getByRole('button', { name: /Deploy/i });
        fireEvent.click(deployButton);
        expect(screen.getByRole('button', { name: /Deploying.../i })).toBeDisabled();
    });

    it('calls messageHandler.postMessage with type deploy when Deploy is clicked', () => {
        renderComposeEditor();
        const deployButton = screen.getByRole('button', { name: /Deploy/i });
        fireEvent.click(deployButton);
        expect(messageHandler.postMessage).toHaveBeenCalledWith({ type: 'deploy' });
    });

    it('enables Deploy button when there are no errors and not deploying', () => {
        renderComposeEditor();
        const deployButton = screen.getByRole('button', { name: /Deploy/i });
        expect(deployButton).toBeEnabled();
    });

    it('renders all subsystem sections', () => {
        renderComposeEditor();
        expect(screen.getByText('Host')).toBeInTheDocument();
    });

    it('removes event listener on unmount', () => {
        const removeEventListener = jest.spyOn(window, 'removeEventListener');
        const { unmount } = renderComposeEditor();
        unmount();
        expect(removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
        removeEventListener.mockRestore();
    });

    it('sets isDeploying to false when deploy-complete message is received', async () => {
        renderComposeEditor();
        const deployButton = screen.getByRole('button', { name: /Deploy/i });
        // Start deployment
        fireEvent.click(deployButton);
        expect(deployButton).toBeDisabled();
        // Simulate receiving the deploy-complete message
        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', { data: { type: 'deploy-complete' } }));
        });
        await waitFor(() => {
            // Button should be enabled again
            expect(screen.getByRole('button', { name: /Deploy/i })).toBeEnabled();
        });
    });
});
