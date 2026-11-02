import {MODEL, MAX_SECONDS, MAX_FILE_BYTES, SAMPLE_RATE, SOURCES} from './config.mjs';
import {zipBlob, safeTitle, encodeWav} from './audio-core.mjs';

const $ = id => document.getElementById(id);
const fileInput = $('audio-file'), preview = $('song-preview');
const supported = !!(window.Worker && window.WebAssembly && (window.AudioContext || window.webkitAudioContext) && window.isSecureContext);
let file = null, fileReady = false, confirmed = false, busy = false;
let sourceUrl = null, worker = null, generation = 0, urls = [], timer = null, started = 0;
const formatTime = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

function status(message, error = false) {
  $('status').textContent = message; $('status').classList.toggle('error', error);
}
function refresh() {
  for (const id of ['choose-file','change-file','try-demo','range','remember-model','clear-cache']) $(id).disabled = busy || !supported;
  fileInput.disabled = busy || !supported;
  $('confirm-song').disabled = busy || !fileReady;
  $('confirm-song').textContent = confirmed ? 'Song confirmed ✓' : 'Use this song';
  $('confirm-song').classList.toggle('confirmed', confirmed);
  $('separate').disabled = busy || !fileReady || !confirmed;
  $('cancel').hidden = !busy;
  $('run-hint').hidden = busy;
  $('run-hint').textContent = confirmed ? 'The first run downloads the model. Processing stays on this device.' : 'Listen and confirm your song to begin.';
}
function clearResults() {
  for (const audio of $('stem-results').querySelectorAll('audio')) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  $('stem-results').replaceChildren(); urls.forEach(URL.revokeObjectURL); urls = [];
  $('stem-results').hidden = $('export-actions').hidden = true;
  $('empty-results').hidden = false;
  $('results-meta').textContent = 'One shared starting point. Ready for your next idea.';
}
function stopWorker() {
  worker?.terminate(); worker = null; clearInterval(timer); timer = null;
  busy = false; refresh();
}
function resetPreview() {
  preview.pause(); preview.removeAttribute('src'); preview.load();
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = null; preview.onloadedmetadata = preview.onerror = null;
}
function chooseFile(next) {
  if (!supported || busy || !next) return;
  generation++; file = null; fileReady = confirmed = false;
  clearResults(); resetPreview(); $('error-details').hidden = true;
  $('progress-area').hidden = true;
  $('song-details').hidden = true; $('drop-zone').hidden = false;
  if (!next.size || next.size > MAX_FILE_BYTES) { status('Choose an audio file smaller than 100 MB.', true); refresh(); return; }
  file = next;
  $('song-name').textContent = next.name;
  $('song-meta').textContent = `${(next.size/1e6).toFixed(1)} MB · Checking audio…`;
  $('song-details').hidden = false; $('drop-zone').hidden = true;
  status('Loading your song for preview…');
  const current = generation;
  preview.onloadedmetadata = () => {
    if (current !== generation) return;
    if (!Number.isFinite(preview.duration) || preview.duration <= 0 || preview.duration > MAX_SECONDS + .01) {
      status('This beta accepts songs up to 5 minutes. Choose a shorter song or an edited clip.', true);
      $('song-meta').textContent = Number.isFinite(preview.duration) ? `${formatTime(preview.duration)} · exceeds the 5-minute beta limit` : 'Audio duration unavailable';
      fileReady = false;
    } else {
      fileReady = true;
      $('song-meta').textContent = `${formatTime(preview.duration)} · ${(next.size/1e6).toFixed(1)} MB · Local file`;
      status('Preview ready. Listen, then choose Use this song.');
    }
    refresh();
  };
  preview.onerror = () => {
    if (current !== generation) return;
    fileReady = confirmed = false;
    status('This browser couldn’t read that audio. Try a WAV, MP3, or M4A file.', true); refresh();
  };
  sourceUrl = URL.createObjectURL(next); preview.src = sourceUrl; preview.load(); refresh();
}
async function decodeSong(selected, range, token) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const context = new Audio({sampleRate:SAMPLE_RATE});
  try {
    const audio = await context.decodeAudioData(await selected.arrayBuffer());
    if (token !== generation) return null;
    if (audio.sampleRate !== SAMPLE_RATE) throw new Error('This browser could not resample the song to 44.1 kHz. Try a current Chrome or Edge browser.');
    if (audio.numberOfChannels > 2 || audio.duration > MAX_SECONDS + .05) throw new Error('Choose up to 5 minutes of mono or stereo audio.');
    const frames = Math.min(audio.length, range === '30' ? 30*SAMPLE_RATE : audio.length);
    return [audio.getChannelData(0).slice(0,frames).buffer,
      audio.getChannelData(audio.numberOfChannels > 1 ? 1 : 0).slice(0,frames).buffer];
  } finally { await context.close().catch(()=>{}); }
}
function failure(error) {
  const message = error?.message || String(error);
  status('Separation couldn’t finish. Try the first 30 seconds, close other heavy tabs, or retry the model download.', true);
  $('error-message').textContent = message;
  $('error-details').hidden = false; $('error-details').open = true;
  $('progress-label').textContent = 'Stopped';
  stopWorker();
}
function showResults(result) {
  if (result.files?.length !== 6 || !SOURCES.every(source => result.files.some(f=>f.name === `${source}.wav` && f.blob instanceof Blob))) throw new Error('The separator did not return all six WAV files.');
  clearResults();
  const order = ['vocals','drums','bass','guitar','piano','other'];
  for (const name of order) {
    const track = result.files.find(f=>f.name === `${name}.wav`);
    const row = document.createElement('article'); row.className = `stem-output ${name}`;
    const top = document.createElement('div'); top.className = 'stem-top';
    const title = document.createElement('strong'); title.textContent = name === 'other' ? 'Other' : name[0].toUpperCase()+name.slice(1);
    const waveform = document.createElementNS('http://www.w3.org/2000/svg','svg');
    waveform.setAttribute('viewBox','0 0 304 30'); waveform.setAttribute('aria-hidden','true');
    const path = document.createElementNS(waveform.namespaceURI,'path');
    path.setAttribute('d',(track.peaks||[]).map((v,i)=>`M${i*3.8+2},${15-Math.sqrt(v)*13}v${Math.sqrt(v)*26}`).join(' '));
    path.setAttribute('stroke','currentColor'); path.setAttribute('stroke-width','2'); path.setAttribute('stroke-linecap','round'); waveform.append(path);
    const url = URL.createObjectURL(track.blob); urls.push(url);
    const download = document.createElement('a'); download.className = 'plain-button'; download.href = url;
    download.download = `${safeTitle(file.name)}-${track.name}`; download.textContent = 'WAV ↓'; download.setAttribute('aria-label',`Download ${title.textContent} WAV`);
    const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = url; audio.setAttribute('aria-label',`Play ${title.textContent} stem`);
    audio.addEventListener('play',()=>{ preview.pause(); for (const other of $('stem-results').querySelectorAll('audio')) if(other!==audio) other.pause(); });
    top.append(title,waveform,download); row.append(top,audio); $('stem-results').append(row);
  }
  const zip = URL.createObjectURL(zipBlob(result.files)); urls.push(zip);
  $('download-zip').href = zip; $('download-zip').download = `${safeTitle(file.name)}-stems.zip`;
  $('empty-results').hidden = true; $('stem-results').hidden = $('export-actions').hidden = false;
  $('results-meta').textContent = `${formatTime(result.frames/result.sampleRate)} · Six aligned tracks · Finished in ${formatTime((performance.now()-started)/1000)}`;
  $('export-note').textContent = result.gain < 1 ? `A shared gain adjustment (${result.gain.toFixed(3)}×) keeps every track below clipping and preserves their relative levels.` : 'Relative track levels are preserved. Import every WAV at time zero in your editor.';
  $('cache-status').textContent = result.cached ? 'The verified model is stored in this browser for next time.' : 'The model was used for this run without persistent storage.';
  status('Done — your six stems are ready. Listen here or download them.');
  $('progress-label').textContent = 'Six stems ready'; $('progress').value = 100;
}
async function separate() {
  if (busy || !fileReady || !confirmed) return;
  const token = ++generation, selected = file, range = $('range').value;
  busy = true; preview.pause(); clearResults(); refresh();
  $('error-details').hidden = true; $('progress-area').hidden = false;
  $('progress').value = 0; $('progress-label').textContent = 'Reading audio'; $('elapsed').textContent = '0:00';
  status('Preparing the audio on your device…'); started = performance.now();
  timer = setInterval(()=>$('elapsed').textContent=formatTime((performance.now()-started)/1000),1000);
  try {
    const channels = await decodeSong(selected, range, token);
    if (token !== generation || !channels) return;
    worker = new Worker(new URL('./separator-worker.mjs',import.meta.url),{type:'module',name:'local-stem-separator'});
    worker.onmessage = ({data}) => {
      if (token !== generation) return;
      if (data.type === 'progress') {
        status(data.message); $('progress-label').textContent = ({download:'Model download',model:'Checking model',load:'Loading model',separate:'Separating audio',export:'Creating WAV files'})[data.phase] || 'Working';
        $('progress').value = data.percent;
        if (data.phase === 'separate' && data.elapsed && data.percent > 0 && data.percent < 100) {
          const remaining = data.elapsed * (100/data.percent - 1);
          $('progress-label').textContent = `About ${formatTime(remaining)} remaining`;
        }
      } else if (data.type === 'complete') {
        try { showResults(data); stopWorker(); } catch (error) { failure(error); }
      } else if (data.type === 'error') failure(new Error(data.message));
    };
    worker.onerror = event => { if(token===generation) failure(new Error(event.message || 'The browser worker stopped. It may have run out of memory.')); };
    worker.postMessage({channels, remember:$('remember-model').checked},channels);
  } catch (error) { if(token===generation) failure(error); }
}
function cancel() {
  if (!busy) return;
  generation++; stopWorker();
  $('progress').value = 0; $('progress-label').textContent = 'Cancelled';
  status('Cancelled. Your song is still selected; you can try again.');
}

$('try-demo').addEventListener('click',()=>{
  if(busy)return;
  const frames=8*SAMPLE_RATE;
  const stereo=[new Float32Array(frames),new Float32Array(frames)];
  for(let i=0;i<frames;i++){
    const t=i/SAMPLE_RATE, beat=t%0.5;
    const melody=.13*Math.sin(2*Math.PI*220*t)+.075*Math.sin(2*Math.PI*330*t);
    const drum=.17*Math.exp(-beat*35)*Math.sin(2*Math.PI*80*beat);
    const envelope=Math.min(1,t*10,(8-t)*10);
    stereo[0][i]=(melody+drum)*envelope;
    stereo[1][i]=(.13*Math.sin(2*Math.PI*220*t+.15)+.075*Math.sin(2*Math.PI*330*t)+drum)*envelope;
  }
  chooseFile(new File([encodeWav(stereo)],'Stem Separator demo.wav',{type:'audio/wav'}));
});
$('choose-file').addEventListener('click',()=>fileInput.click());
$('change-file').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',()=>{chooseFile(fileInput.files[0]);fileInput.value='';});
$('confirm-song').addEventListener('click',()=>{ if(!busy&&fileReady){confirmed=true;status('Song confirmed. Ready to separate.');refresh();} });
$('separate').addEventListener('click',separate); $('cancel').addEventListener('click',cancel);
preview.addEventListener('play',()=>{for(const audio of $('stem-results').querySelectorAll('audio'))audio.pause();});
for (const type of ['dragenter','dragover']) $('drop-zone').addEventListener(type,event=>{event.preventDefault();if(!busy)$('drop-zone').classList.add('drag-over');});
$('drop-zone').addEventListener('dragleave',()=>$('drop-zone').classList.remove('drag-over'));
$('drop-zone').addEventListener('drop',event=>{event.preventDefault();$('drop-zone').classList.remove('drag-over');chooseFile(event.dataTransfer.files[0]);});
$('clear-cache').addEventListener('click',async()=>{
  if(busy)return;
  try { await caches.delete(MODEL.cache); $('cache-status').textContent='The downloaded model has been cleared. It will download again next time.'; }
  catch { $('cache-status').textContent='This browser does not allow model cache management.'; }
});
try { $('remember-model').checked = localStorage.getItem('stem-web-remember') !== 'false'; } catch {}
$('remember-model').addEventListener('change',async()=>{
  const remember = $('remember-model').checked;
  try { localStorage.setItem('stem-web-remember',String(remember)); if(!remember)await caches.delete(MODEL.cache); } catch {}
});
for(const id of ['choose-file','separate','confirm-song']) $(id).addEventListener('click',()=>$('error-details').hidden=true);
refresh();
if (!supported) {
  status('This browser cannot run local separation. Open the HTTPS site in a current desktop Chrome or Edge browser.',true);
}
