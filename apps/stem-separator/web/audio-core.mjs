import {SEGMENT, STRIDE, OVERLAP, SAMPLE_RATE} from './config.mjs';

export function chunkStarts(frames, segment = SEGMENT, stride = STRIDE) {
  if (!Number.isSafeInteger(frames) || frames < 1) throw new Error('The song has no audio samples.');
  const starts = [0];
  while (starts.at(-1) + segment < frames) starts.push(starts.at(-1) + stride);
  return starts;
}

export function transitionWindow(segment = SEGMENT, overlap = OVERLAP) {
  // Positive endpoints preserve the very first/last sample after normalization.
  const window = new Float32Array(segment).fill(1);
  for (let i = 0; i < overlap; i++) window[i] = window[segment - i - 1] = (i + 1) / (overlap + 1);
  return window;
}

export function accumulate(output, weight, prediction, start, window, segment = SEGMENT) {
  const count = Math.min(segment, weight.length - start);
  if (prediction.length !== output.length * 2 * segment) throw new Error('The model returned an unexpected audio shape.');
  for (let s = 0; s < output.length; s++) {
    for (let c = 0; c < 2; c++) {
      const base = (s * 2 + c) * segment;
      for (let i = 0; i < count; i++) {
        const value = prediction[base + i];
        if (!Number.isFinite(value)) throw new Error('The model returned invalid audio. Try another file.');
        output[s][c][start + i] += value * window[i];
      }
    }
  }
  for (let i = 0; i < count; i++) weight[start + i] += window[i];
}

export function normalizeStems(stems, weight) {
  let peak = 0;
  for (const stereo of stems) for (const channel of stereo) for (let i = 0; i < channel.length; i++) {
    if (!(weight[i] > 0)) throw new Error('A section of the song was not processed.');
    channel[i] /= weight[i];
    if (!Number.isFinite(channel[i])) throw new Error('The separator returned invalid audio.');
    peak = Math.max(peak, Math.abs(channel[i]));
  }
  return {peak, gain: peak > 0.99 ? 0.99 / peak : 1};
}

function ascii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

export function encodeWav(stereo, gain = 1, sampleRate = SAMPLE_RATE) {
  if (stereo.length !== 2 || stereo[0].length !== stereo[1].length) throw new Error('Expected aligned stereo audio.');
  const frames = stereo[0].length;
  const bytes = new Uint8Array(44 + frames * 6);
  const view = new DataView(bytes.buffer);
  ascii(view, 0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(view, 8, 'WAVE');
  ascii(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 6, true);
  view.setUint16(32, 6, true); view.setUint16(34, 24, true); ascii(view, 36, 'data');
  view.setUint32(40, frames * 6, true);
  for (let i = 0, offset = 44; i < frames; i++) for (let c = 0; c < 2; c++, offset += 3) {
    const scaled = stereo[c][i] * gain;
    if (!Number.isFinite(scaled)) throw new Error('Cannot export invalid audio.');
    const value = Math.max(-1, Math.min(1, scaled));
    const pcm = Math.round(value * (value < 0 ? 8388608 : 8388607));
    view.setUint8(offset, pcm & 255); view.setUint8(offset + 1, (pcm >> 8) & 255); view.setUint8(offset + 2, (pcm >> 16) & 255);
  }
  return bytes;
}

const crcTable = Uint32Array.from({length:256}, (_, i) => {
  for (let k = 0; k < 8; k++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function zipBlob(files) {
  const pieces = [], directory = [];
  let offset = 0, directorySize = 0;
  for (const file of files) {
    if (!/^[a-z]+\.wav$/.test(file.name) || file.blob.size > 0xffffffff) throw new Error('Invalid export file.');
    const name = new TextEncoder().encode(file.name);
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(12, 33, true);
    view.setUint32(14, file.crc, true); view.setUint32(18, file.blob.size, true); view.setUint32(22, file.blob.size, true);
    view.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 33, true);
    c.setUint32(16, file.crc, true); c.setUint32(20, file.blob.size, true); c.setUint32(24, file.blob.size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    pieces.push(header, file.blob); directory.push(central);
    offset += header.length + file.blob.size; directorySize += central.length;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
  view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  return new Blob([...pieces, ...directory, end], {type:'application/zip'});
}

export function safeTitle(name) {
  return name.replace(/\.[^.]+$/, '').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 100) || 'song';
}
