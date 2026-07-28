export const DOWNLOAD_TARGETS = [
    'win32-x64',
    'win32-arm64',
    'linux-x64',
    'linux-arm64',
    'darwin-x64',
    'darwin-arm64',
] as const;

export type DownloadTarget = (typeof DOWNLOAD_TARGETS)[number];

const ARTIFACT_BASE_URL = 'https://artifacts.tools.arm.com/topo';

const ASSET_MAPPING: Record<DownloadTarget, string> = {
    'linux-x64': 'linux/topo_linux_amd64.tar.gz',
    'linux-arm64': 'linux/topo_linux_arm64.tar.gz',
    'darwin-x64': 'macos/topo_darwin_amd64.tar.gz',
    'darwin-arm64': 'macos/topo_darwin_arm64.tar.gz',
    'win32-x64': 'windows/topo_windows_amd64.zip',
    'win32-arm64': 'windows/topo_windows_arm64.zip',
};

export const getArtifactUrl = (
    version: string,
    target: DownloadTarget,
): string => `${ARTIFACT_BASE_URL}/v${version}/${ASSET_MAPPING[target]}`;

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export const isSha256 = (value: unknown): value is string =>
    typeof value === 'string' && SHA256_PATTERN.test(value);
