import {MODEL, SOURCES, SEGMENT, SAMPLE_RATE, MAX_SECONDS} from './config.mjs';
import {chunkStarts, transitionWindow, accumulate, normalizeStems, encodeWav, crc32} from './audio-core.mjs';

const status = (phase, percent, message, extra = {}) => postMessage({type:'progress', phase, percent, message, ...extra});
const hex = buffer => [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2,'0')).join('');

async function verify(buffer) {
  if (buffer.byteLength !== MODEL.bytes || hex(await crypto.subtle.digest('SHA-256', buffer)) !== MODEL.sha256) {
    throw new Error('The model download was incomplete or changed. Clear the downloaded model and try again.');
  }
  return buffer;
}

async function getModel(remember) {
  let cache;
  if (remember && typeof caches !== 'undefined') {
    try {
      cache = await caches.open(MODEL.cache);
      const saved = await cache.match(MODEL.url);
      if (saved) {
        status('model', 0, 'Checking the downloaded model…');
        try { return {buffer: await verify(await saved.arrayBuffer()), cached: true}; }
        catch { await cache.delete(MODEL.url); }
      }
    } catch { cache = null; }
  }
  status('download', 0, 'Downloading the model — 136 MB. Your song stays on this device.');
  const response = await fetch(MODEL.url, {credentials:'omit', referrerPolicy:'no-referrer'});
  if (!response.ok) throw new Error(`The model host could not provide the model (${response.status}). Try again later.`);
  const reader = response.body?.getReader();
  let buffer;
  if (reader) {
    const bytes = new Uint8Array(MODEL.bytes);
    let length = 0, lastUpdate = 0;
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) { await reader.cancel(); throw new Error('The model file size was unexpected.'); }
      bytes.set(value, length); length += value.length;
      if (performance.now() - lastUpdate > 200) {
        status('download', length / MODEL.bytes * 100, `Downloading model · ${Math.round(length/1e6)} of 136 MB`);
        lastUpdate = performance.now();
      }
    }
    if (length !== MODEL.bytes) throw new Error('The model download stopped early. Check your connection and try again.');
    buffer = bytes.buffer;
  } else buffer = await response.arrayBuffer();
  status('model', 100, 'Verifying the model…');
  await verify(buffer);
  let cached = false;
  if (cache) {
    try { await cache.put(MODEL.url, new Response(buffer, {headers:{'Content-Type':'application/octet-stream'}})); cached = true; }
    catch { /* A full browser cache must not prevent separation. */ }
  }
  return {buffer, cached};
}

self.onmessage = async ({data}) => {
  let session;
  try {
    const mix = data.channels.map(buffer => new Float32Array(buffer));
    const total = mix[0]?.length;
    if (mix.length !== 2 || mix[1].length !== total || !total || total > SAMPLE_RATE * MAX_SECONDS) throw new Error('Choose up to 5 minutes of mono or stereo audio.');
    const model = await getModel(data.remember);
    status('load', 0, 'Preparing the separator. This can take a moment…');
    const ort = await import(`${MODEL.runtime}ort.wasm.min.mjs`);
    // One thread works on GitHub Pages without special server headers. This
    // dedicated worker keeps the page and Cancel responsive during inference.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = MODEL.runtime;
    session = await ort.InferenceSession.create(model.buffer, {executionProviders:['wasm'], graphOptimizationLevel:'disabled', enableCpuMemArena:false, enableMemPattern:false, extra:{session:{disable_prepacking:'1'}}});
    model.buffer = null;
    const output = SOURCES.map(() => [new Float32Array(total), new Float32Array(total)]);
    const weight = new Float32Array(total), window = transitionWindow(), starts = chunkStarts(total);
    const chunk = new Float32Array(2 * SEGMENT), began = performance.now();
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i], count = Math.min(SEGMENT, total - start);
      chunk.fill(0);
      for (let c = 0; c < 2; c++) chunk.set(mix[c].subarray(start, start + count), c * SEGMENT);
      status('separate', i / starts.length * 100, `Separating section ${i+1} of ${starts.length}…`, {section:i+1, sections:starts.length});
      const input = new ort.Tensor('float32', chunk, [1,2,SEGMENT]);
      const result = await session.run({mix:input});
      const prediction = result.stems;
      if (!prediction || prediction.dims.join(',') !== `1,6,2,${SEGMENT}`) throw new Error('The model output does not match six stereo stems.');
      accumulate(output, weight, prediction.data, start, window);
      input.dispose(); Object.values(result).forEach(tensor => tensor.dispose());
      status('separate', (i+1) / starts.length * 100, `Separated ${i+1} of ${starts.length} sections.`, {elapsed:(performance.now()-began)/1000});
    }
    status('export', 0, 'Preparing your six WAV files…');
    await session.release(); session = null;
    const {peak, gain} = normalizeStems(output, weight);
    const files = [];
    for (let i = 0; i < SOURCES.length; i++) {
      const wav = encodeWav(output[i], gain);
      const peaks = Array.from({length:80}, (_, bin) => {
        let peak = 0;
        const from = Math.floor(bin * total / 80), to = Math.floor((bin+1) * total / 80);
        for (let c=0;c<2;c++) for(let f=from;f<to;f++) peak=Math.max(peak,Math.abs(output[i][c][f]*gain));
        return Math.min(1,peak);
      });
      files.push({name:`${SOURCES[i]}.wav`, blob:new Blob([wav],{type:'audio/wav'}), crc:crc32(wav), peaks});
      output[i] = null;
      status('export', (i+1)/6*100, `Prepared ${i+1} of 6 WAV files.`);
    }
    postMessage({type:'complete', files, frames:total, sampleRate:SAMPLE_RATE, gain, peak, cached:model.cached, seconds:(performance.now()-began)/1000});
  } catch (error) {
    postMessage({type:'error', message:error?.message || String(error)});
  } finally { if (session) await session.release().catch(()=>{}); }
};
