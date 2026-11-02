# Stem Separator Web beta

This prototype uses the visitor's browser CPU. It has no inference API, upload
endpoint, account, analytics, or paid service. GitHub Pages serves the interface;
Hugging Face serves the pinned public ONNX model, and jsDelivr serves the pinned
ONNX Runtime Web package. Songs and output audio stay on the visitor's device.

## Scope

- Browser-native local-file preview and explicit song confirmation.
- A generated eight-second demo that runs through the same preview and model.
- Six estimated stems: vocals, drums, bass, guitar, piano, and other.
- Full-song or first-30-second separation; beta limit 5 minutes / 100 MB.
- One background worker, immediate worker termination on Cancel, retry without
  reselecting the song, and cleanup of owned object URLs when replacing results.
- Positive overlap windows preserve boundary samples. All stems get the same
  gain adjustment if needed, then export as aligned stereo 44.1 kHz PCM24 WAVs.
- Individual playback/downloads, real amplitude waveforms, and a stored ZIP with
  CRC32 checksums. A ZIP contains the exact same WAV bytes as individual files.
- Optional verified model caching and a control to remove only this app's cache.
- Internet is needed to load the app/runtime/model. Complete offline startup is
  not implemented. URL downloading, mixing, and formations remain future work.

## Model/runtime

Model: https://huggingface.co/StemSplitio/htdemucs-6s-onnx
Revision: 49df9b6989cf2150840ea65b0bef77a2e471b678
File: htdemucs_6s_fp16weights.onnx
Bytes: 136428532
SHA-256: 7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869
Runtime: onnxruntime-web 1.31.1, WASM, one CPU thread, same-origin module worker.

The conversion's publisher labels the model MIT. The website links directly to
its public artifact and does not commit or rehost weights. Credits identify the
original Demucs research, conversion project, and ONNX Runtime licenses.

## Verification

`node --test tests/*.test.mjs`: 15 checks pass, including stereo overlap-add
reconstruction at first/last samples, exact-segment scheduling, shared gain,
invalid model output rejection, PCM24 layout, and exact ZIP entries/CRC/offsets.

Local browser UI: file selection, metadata, preview loading, confirmation,
start, error recovery, and cancellation respond. An 8-second synthetic stereo
fixture is used; no user music is sent to any remote service.

Initial ONNX session creation in the in-app browser failed with std::bad_alloc,
including an attempt with graph optimizations, arena and memory patterns off.
Disabling prepacking as well allowed the desktop Chrome test to pass: an
8-second synthetic stereo file completed in 43 seconds including setup. Its
six distinct PCM24 stereo WAVs are aligned at 352,800 frames; samples are finite
and below clipping. ZIP integrity passes, and the individual vocals download
matches its ZIP entry byte for byte. Native browser preview and drums playback
both reached readyState 4 and played.

The final generated eight-second demo also completed and its six WAVs passed
the same structural and ZIP checks. That run took 2 minutes 59 seconds including
download/setup. The difference from the initial 43-second fixture run shows
that timings vary substantially with system and browser conditions.

A 35-second stereo fixture with the first-30-second option completed five model
sections in 7 minutes 41 seconds using the cached model. All six exported WAVs
contain exactly 1,323,000 frames (30 seconds), stereo 44.1 kHz PCM24, with finite
samples below clipping. ZIP integrity passes. Cancellation releases the worker
and allows retry without selecting the file again; changing the source clears
previous results and confirmation.

The final session configuration disables graph optimization, CPU memory arena,
memory patterns, and prepacking. Re-enabling either basic or all graph
optimization caused allocation failure on this machine, so those attempts were
reverted. Inference can create significant memory pressure and OS swap even
though the model download is only 136 MB.

The responsive layout fits a 390-pixel viewport without horizontal overflow.
Desktop Chrome is the browser with successful end-to-end inference evidence.
The in-app browser has not passed the final conservative configuration.

The default is the first 30 seconds because CPU processing can be much slower
than real time. Do not claim a full-song speed or universal hardware support.
Neo, Intel Mac, and Windows hardware testing remains pending.

The portfolio presents this as an experimental browser beta, with the measured
timings visible before use. It defaults to a 30-second clip and provides a
shorter demo. Full-song performance and perceptual separation quality have not
been validated by these synthetic audio checks. Passing structural export
checks does not establish music quality or compatibility with every computer.

## Free API alternative (researched November 1, 2026)

Hugging Face ZeroGPU currently permits up to two free Spaces for verified personal
accounts older than 30 days. Visitors have shared queues and daily GPU quotas
(2 minutes anonymous, 5 minutes free signed-in); these are GPU minutes, not song
length. The owner reports no eligible existing account, so own free ZeroGPU
hosting cannot be enabled immediately. No paid API or paid fallback is authorized.

An API version would upload the song and run the existing Python engine remotely.
It needs an explicit upload action, limits/queue/cancellation, bounded temporary
file retention, and quota errors. Never put a private paid API key in Pages JS.
Do not silently substitute a cloud upload for local browser processing.

Sources:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://github.com/StemSplit/demucs-onnx/blob/main/docs/browser.md
- https://onnxruntime.ai/docs/tutorials/web/deploy.html
- https://huggingface.co/docs/hub/en/spaces-zerogpu
