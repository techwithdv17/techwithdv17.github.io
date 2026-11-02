# Tech with DV portfolio

Buildless HTML, CSS, and JavaScript for `https://techwithdv17.github.io/`.
Publish this directory's contents in the public `techwithdv17.github.io`
repository and set GitHub Pages to deploy from `main`, `/ (root)`.

The home page's Apps section opens `/apps/stem-separator/web/`. Portfolio assets are local. The web beta
loads a pinned model from Hugging Face and ONNX Runtime from jsDelivr; no
analytics, external fonts, or music uploads are used. Private
evaluation downloads require GitHub sign-in with repository access.
The web app shows measured stem waveforms; the app details page uses an illustration.
Neither page includes a multitrack editor yet.

## Local preview

Run `python3 -m http.server 4173 --directory portfolio-site` from the app project,
or `python3 -m http.server 4173` inside this directory.

## Downloads

Put application binaries in GitHub Releases, not in Pages Git history.
The development repository stays private. The current `private_test` manifest
links to the verified v1.2.1 Apple Silicon archive in that private repository.
The button sends visitors through GitHub sign-in before the asset download;
only an account with repository access (currently techwithdv17) can download it.
This lets the owner test the package on a MacBook Neo before public distribution.
The Neo evaluation reported unresponsive desktop controls. The browser beta is
the primary entry point while that is investigated; Intel and Windows desktop
downloads are unavailable.

`release.json` is the single download manifest. Keep `status: "preparing"` and
the URL/hash/size fields null until a verified asset is ready. Then set:

- `status`: `private_test` for the owner's Neo evaluation, or `released` for a public release
- `version`: the actual packaged app version
- `downloadUrl`: the asset's HTTPS GitHub Releases download URL
- `sha256`: the asset's lowercase 64-character SHA-256 digest
- `downloadBytes`: the positive integer size of that exact asset

The page enables downloads only when all fields pass validation. It never
links to the automatic source ZIP as though it were an installer. The current
manifest enables only the private evaluation. A public release still requires
signing/notarization, component distribution requirements, and clean-machine
installation testing. See the app project's RELEASE_READINESS.md.

Run `node --test tests/release.test.mjs` to check download metadata validation
and the private sign-in redirect. Verify the actual published asset size and
SHA-256 against `release.json` before enabling any new version.

## Browser app

`/apps/stem-separator/web/` is the browser beta. All audio processing happens in a
same-origin module worker using single-threaded ONNX Runtime WASM. Static Pages
hosting needs no server process, API keys, special COOP/COEP headers, or paid
compute. Model downloads use a pinned version and checked SHA-256.

Run `node --test tests/*.test.mjs` for the full website checks. See
[WEB_READINESS.md](WEB_READINESS.md) for scope, actual validation, and limitations.
Never commit model binaries, audio fixtures, exports, or local dependencies.
