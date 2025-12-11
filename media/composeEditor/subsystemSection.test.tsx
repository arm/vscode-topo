import { render, screen } from '@testing-library/react';
import * as manifest from '../../src/manifest';
import '@testing-library/jest-dom';
import { SubsystemSection } from './subsystemSection';
import { ServiceCreationDescription } from '../../src/util/types';

describe('SubsystemSection', () => {

    let services: ServiceCreationDescription[];

    const renderComponent = () => {
        return render(
            <SubsystemSection
                title="Host"
                subsystemServices={services}
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
