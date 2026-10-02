import type { Health } from '../../models/health';
import { getHealthChecks } from '../../util/healthReport';
import { loaded, type Loaded } from '../../util/loadable';
import { HealthCheckGroupTreeItem } from './healthCheckGroupTreeItem';

export class HealthTreeItem extends HealthCheckGroupTreeItem {
    constructor(private readonly health: Loaded<Health>) {
        super(loaded(getHealthChecks(health.data), health.loading));
    }

    public getChildren(): HealthCheckGroupTreeItem[] {
        return this.health.data.capabilities.map(
            ({ name, checks }) =>
                new HealthCheckGroupTreeItem(
                    loaded(checks, this.loading),
                    name,
                ),
        );
    }
}
