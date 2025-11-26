import { Target } from '../workloadPlacement/target';

// The Docker context name is derived from the target's host to ensure a unique and consistent mapping
// between deployment targets and Docker contexts. This approach leverages the host's uniqueness,
// simplifying context management and avoiding naming collisions.
export const getDockerContextName = (target: Target) => {
    return target.host;
};
