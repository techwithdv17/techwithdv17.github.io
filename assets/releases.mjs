export function releaseDownload(release) {
  try {
    if (!release || !['released','private_test'].includes(release.status) ||
        typeof release.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(release.version) ||
        !/^[a-f0-9]{64}$/.test(release.sha256 || '') ||
        !Number.isSafeInteger(release.downloadBytes) || release.downloadBytes <= 0) return null;
    const asset = new URL(release.downloadUrl);
    if (asset.protocol !== 'https:' || asset.hostname !== 'github.com' || asset.username || asset.password ||
        !/^\/techwithdv17\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/.test(asset.pathname) || asset.search || asset.hash) return null;
    const privateTest = release.status === 'private_test';
    if (privateTest && !asset.pathname.startsWith('/techwithdv17/stem-separator/releases/download/')) return null;
    const link = privateTest ? new URL('https://github.com/login') : asset;
    if (privateTest) link.searchParams.set('return_to', asset.pathname);
    return {href:link.href, privateTest, label:privateTest?'Download Neo test build ↗':'Download for Mac ↗'};
  } catch { return null; }
}
