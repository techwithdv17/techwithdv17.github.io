const colors = {vocals:'Vocals',drums:'Drums',bass:'Bass',guitar:'Guitar',piano:'Piano',other:'Other'};
for (const [i, row] of [...document.querySelectorAll('[data-wave]')].entries()) {
  const svg = row.querySelector('svg');
  let path = '';
  for (let n=0;n<94;n++) {
    const envelope=.24+.76*Math.pow(Math.sin(n*.17+i*.8),2);
    const height=2+19*envelope*Math.abs(Math.sin(n*1.37+i*2.2));
    path+=`M${n*3.2+2},${12-height/2}v${height} `;
  }
  const wave=document.createElementNS('http://www.w3.org/2000/svg','path');
  wave.setAttribute('d',path);wave.setAttribute('stroke','currentColor');wave.setAttribute('stroke-width','1.8');wave.setAttribute('stroke-linecap','round');svg.append(wave);
}
const explanations={vocals:'Vocals includes lead and backing voices, along with some vocal effects. Bleed from the accompaniment can remain.',drums:'Drums and percussion groups the rhythmic parts into one aligned stereo track.',bass:'Bass brings the low-end part into its own track. Separation quality depends on the recording.',guitar:'Guitar is estimated as a separate category. A guitar stem does not mean a guitar is present in every song.',piano:'Piano is an experimental category and can contain more bleed and artifacts than the other stems.',other:'Other instruments keeps the remaining accompaniment together, including strings, winds, keyboards, ambience, and effects.'};
for(const button of document.querySelectorAll('[data-stem]')) button.addEventListener('click',()=>{
  for(const item of document.querySelectorAll('[data-stem]'))item.setAttribute('aria-pressed',String(item===button));
  document.querySelector('#stem-description').textContent=explanations[button.dataset.stem];
});
try {
  const response=await fetch(new URL('../release.json',import.meta.url));
  if(!response.ok)throw new Error('Release metadata unavailable');
  const release=await response.json();
  for(const node of document.querySelectorAll('[data-current-version]'))node.textContent=release.version;
  const url=release.downloadUrl ? new URL(release.downloadUrl) : null;
  const ready=release.status==='released' && url?.protocol==='https:' && url.hostname==='github.com' && url.pathname.startsWith('/techwithdv17/') && url.pathname.includes('/releases/download/') && /^[a-f0-9]{64}$/.test(release.sha256||'') && Number.isSafeInteger(release.downloadBytes) && release.downloadBytes>0;
  if(ready){
    for(const button of document.querySelectorAll('[data-download]')){
      const link=document.createElement('a');link.className=button.className;link.href=url.href;link.textContent='Download for Mac ↗';button.replaceWith(link);
    }
    for(const note of document.querySelectorAll('[data-download-note]'))note.textContent=`Version ${release.version} · ${Math.round(release.downloadBytes/1000000)} MB download · Apple Silicon Mac`;
    for(const node of document.querySelectorAll('[data-download-status]'))node.textContent='Available for download';
    for(const node of document.querySelectorAll('[data-preparing-only]'))node.hidden=true;
    const checksum=document.querySelector('[data-checksum]');if(checksum){checksum.hidden=false;checksum.textContent=`SHA-256: ${release.sha256}`;}
  }
}catch(error){
  // A missing/invalid manifest leaves the static, disabled download intact.
  console.warn('The public release is not available.');
}
