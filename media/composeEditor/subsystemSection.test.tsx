import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubsystemSection } from './subsystemSection';
import { ServiceCreationDescription } from '../../src/util/types';
import { TARGET_REMOTEPROC_RUNTIME } from '../../src/manifest';

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
                build: {
                    context: './project1',
                },
                containerName: 'container1',
                annotations: {},
                runtime: TARGET_REMOTEPROC_RUNTIME,
            },
            {
                name: 'project2',
                build: {
                    context: './project2',
                },
                containerName: 'container2',
                annotations: {},
                runtime: TARGET_REMOTEPROC_RUNTIME,
            },
        ];
    });

    it('renders correctly', () => {
        const { container } = renderComponent();
        expect(container).toMatchSnapshot();
    });

    it('renders no table if subsystemServices is empty', () => {
        services = [];
        renderComponent();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
});
