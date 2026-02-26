import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubsystemSection } from './subsystemSection';
import { ServiceCreationDescription } from '../../src/util/types';
import { BOARD_REMOTEPROC_RUNTIME } from '../../src/manifest';

describe('SubsystemSection', () => {
    let services: ServiceCreationDescription[];

    const renderComponent = () => {
        return render(
            <SubsystemSection title="Host" subsystemServices={services} />,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        services = [
            {
                name: 'project1',
                errors: [],
                build: {
                    context: './project1',
                },
                containerName: 'container1',
                annotations: {},
                runtime: BOARD_REMOTEPROC_RUNTIME,
            },
            {
                name: 'project2',
                errors: [],
                build: {
                    context: './project2',
                },
                containerName: 'container2',
                annotations: {},
                runtime: BOARD_REMOTEPROC_RUNTIME,
            },
        ];
    });

    it('renders correctly', () => {
        const { container } = renderComponent();
        expect(container).toMatchSnapshot();
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
    });
});
