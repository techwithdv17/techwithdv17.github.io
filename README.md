# Tech with DV portfolio

Buildless HTML, CSS, and JavaScript for `https://techwithdv17.github.io/`.
Publish this directory's contents in the public `techwithdv17.github.io`
repository and set GitHub Pages to deploy from `main`, `/ (root)`.

The home page's Apps section links to `/apps/stem-separator/`. All site assets
are local; no analytics, external fonts, accounts, or music uploads are used.
The waveforms illustrate outputs and are not a working editor.

## Local preview

Run `python3 -m http.server 4173 --directory portfolio-site` from the app project,
or `python3 -m http.server 4173` inside this directory.

## Downloads

Put application binaries in a public GitHub Release, not in Pages Git history.
The private development repository stays private. Release hosting must be
public for visitors without repository access to download an asset.

`release.json` is the single download manifest. Keep `status: "preparing"` and
the URL/hash/size fields null until a verified public asset is ready. Then set:

- `status`: `released`
- `version`: the actual packaged app version
- `downloadUrl`: the asset's HTTPS GitHub Releases download URL
- `sha256`: the asset's lowercase 64-character SHA-256 digest
- `downloadBytes`: the positive integer size of that exact asset

The page enables downloads only when all fields pass validation. It never
links to the automatic source ZIP as though it were an installer. The current
manifest intentionally has no downloadable binary while signing/notarization,
component distribution requirements, and clean-machine installation testing
remain open. See the app project's RELEASE_READINESS.md.
