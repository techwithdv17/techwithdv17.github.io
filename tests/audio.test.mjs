import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkStarts,transitionWindow,accumulate,normalizeStems,encodeWav,crc32,zipBlob,safeTitle} from '../apps/stem-separator/web/audio-core.mjs';

// An identity separator must reconstruct every channel and endpoint across
// short inputs, exact segments, and overlapping chunks without gain drift.
for (const frames of [1,7,8,9,17,31]) test(`overlap-add preserves all ${frames} samples and stereo alignment`,()=>{
  const segment=8, stride=6, window=transitionWindow(segment,2);
  const input=[Float32Array.from({length:frames},(_,i)=>(i+1)/40),Float32Array.from({length:frames},(_,i)=>-(i+1)/50)];
  const stems=[[new Float32Array(frames),new Float32Array(frames)]];
  const weight=new Float32Array(frames);
  for(const start of chunkStarts(frames,segment,stride)) {
    const prediction=new Float32Array(2*segment);
    for(let c=0;c<2;c++)prediction.set(input[c].subarray(start,start+segment),c*segment);
    accumulate(stems,weight,prediction,start,window,segment);
  }
  normalizeStems(stems,weight);
  for(let c=0;c<2;c++)for(let i=0;i<frames;i++)assert.ok(Math.abs(stems[0][c][i]-input[c][i])<1e-6);
});
test('one exact segment does not run a redundant inference',()=>assert.deepEqual(chunkStarts(8,8,6),[0]));
test('gain is shared across quiet and loud stems',()=>{
  const stems=[[Float32Array.of(2),Float32Array.of(-2)],[Float32Array.of(.2),Float32Array.of(-.2)]];
  const result=normalizeStems(stems,Float32Array.of(1));
  assert.equal(result.gain,.495); assert.equal(stems[1][0][0],Math.fround(.2));
});
test('invalid model samples and missing output coverage fail instead of exporting',()=>{
  assert.throws(()=>accumulate([[new Float32Array(1),new Float32Array(1)]],new Float32Array(1),Float32Array.of(NaN,0),0,Float32Array.of(1),1));
  assert.throws(()=>normalizeStems([[Float32Array.of(0),Float32Array.of(0)]],Float32Array.of(0)));
});
test('PCM24 export has a standard header, exact length and channel order',()=>{
  const wav=encodeWav([Float32Array.of(-1,.5),Float32Array.of(1,-.5)]), view=new DataView(wav.buffer);
  assert.equal(new TextDecoder().decode(wav.subarray(0,4)),'RIFF');
  assert.equal(view.getUint16(22,true),2);assert.equal(view.getUint32(24,true),44100);assert.equal(view.getUint16(34,true),24);
  assert.equal(view.getUint32(40,true),12);assert.equal(wav.length,56);
  const pcm=offset=>{let n=wav[offset]|wav[offset+1]<<8|wav[offset+2]<<16;return n&0x800000?n-0x1000000:n;};
  assert.equal(pcm(44),-8388608);assert.equal(pcm(47),8388607);assert.equal(pcm(50),4194304);assert.equal(pcm(53),-4194304);
});
test('ZIP records contain exact WAV bytes with valid CRC and directory offsets',async()=>{
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const data=encodeWav([Float32Array.of(.3),Float32Array.of(-.3)]);
  const zip=new Uint8Array(await zipBlob([{name:'vocals.wav',blob:new Blob([data]),crc:crc32(data)}]).arrayBuffer());
  const view=new DataView(zip.buffer), header=30+'vocals.wav'.length;
  assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(14,true),crc32(data));
  assert.deepEqual(zip.slice(header,header+data.length),data);
  const central=header+data.length;assert.equal(view.getUint32(central,true),0x02014b50);
  assert.equal(view.getUint32(central+42,true),0);assert.equal(view.getUint32(zip.length-6,true),central);
});
test('export names cannot contain paths or unsafe filesystem characters',()=>{
  assert.equal(safeTitle('../mix: take?.mp3'),'.._mix_ take_');assert.equal(safeTitle('.mp3'),'song');
});
