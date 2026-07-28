import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import * as manifest from '../src/manifest.ts';
import {
    DOWNLOAD_TARGETS,
    type DownloadTarget,
    getArtifactUrl,
} from './topoArtifacts.ts';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const getChecksum = async (
    version: string,
    target: DownloadTarget,
): Promise<[DownloadTarget, string]> => {
    const url = getArtifactUrl(version, target);
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
        throw new Error(
            `Topo ${version} does not exist for ${target}: ${response.status} ${response.statusText}`,
        );
    }

    const checksum = response.headers.get('x-checksum-sha256');
    if (checksum === null) {
        throw new Error(`Artifactory returned no SHA-256 for ${target}`);
    }

    return [target, checksum.toLowerCase()];
};

const main = async (): Promise<void> => {
    const parsedArgs = yargs(process.argv.slice(2))
        .usage('$0 <version>')
        .command(
            '$0 <version>',
            'Updates the bundled Topo CLI version and checksums',
            (command) =>
                command.positional('version', {
                    description: 'Topo CLI version in major.minor.patch format',
                    type: 'string',
                    demandOption: true,
                }),
        )
        .check((args) => {
            if (
                typeof args.version !== 'string' ||
                !VERSION_PATTERN.test(args.version)
            ) {
                throw new Error('Version must use major.minor.patch format');
            }
            return true;
        })
        .help()
        .alias('h', 'help')
        .version(false)
        .strict()
        .parseSync();
    const version = parsedArgs.version as string;

    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`Couldn't find package.json at ${pkgPath}`);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<
        string,
        unknown
    >;
    const section = pkg[manifest.TOPO_CLI];
    if (
        typeof section !== 'object' ||
        section === null ||
        Array.isArray(section)
    ) {
        throw new Error(
            `package.json must have a top-level "${manifest.TOPO_CLI}" object`,
        );
    }

    console.log(`→ Checking Topo ${version}`);
    const checksumEntries: [DownloadTarget, string][] = [];
    for (const target of DOWNLOAD_TARGETS) {
        checksumEntries.push(await getChecksum(version, target));
    }

    const topo = section as Record<string, unknown>;
    topo.version = version;
    topo.sha256 = Object.fromEntries(checksumEntries);
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 4)}\n`);
    console.log(`✓ Updated Topo to ${version} in package.json`);
};

void main().catch((err: unknown) => {
    const errorMsg = err instanceof Error ? err.message : err;
    console.error('✖ Error bumping Topo:', errorMsg);
    process.exit(1);
});
