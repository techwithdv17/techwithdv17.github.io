import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseDownload} from '../assets/releases.mjs';

const asset='/techwithdv17/stem-separator/releases/download/v1.2.1-neo-test/Stem-Separator-1.2.1-Apple-Silicon-evaluation.zip';
const release={status:'private_test',version:'1.2.1',downloadUrl:`https://github.com${asset}`,sha256:'a'.repeat(64),downloadBytes:243734561};
test('Neo test download signs in before redirecting to the private asset',()=>{
  const result=releaseDownload(release);
  const url=new URL(result.href);
  assert.equal(url.origin,'https://github.com');
  assert.equal(url.pathname,'/login');
  assert.equal(url.searchParams.get('return_to'),asset);
  assert.equal(result.privateTest,true);
});
test('preparing, incomplete, unrelated-owner and credential URLs stay disabled',()=>{
  for(const change of [{status:'preparing'},{sha256:null},{downloadBytes:0},{version:'unknown'},
    {downloadUrl:'https://example.com/app.zip'}, {downloadUrl:`https://name:secret@github.com${asset}`},
    {downloadUrl:'https://github.com/someone/app/releases/download/v1/app.zip'},
    {downloadUrl:'https://github.com/techwithdv17/other-private/releases/download/v1/app.zip'}]) {
    assert.equal(releaseDownload({...release,...change}),null);
  }
});
test('a verified public release uses its asset directly',()=>{
  const result=releaseDownload({...release,status:'released'});
  assert.equal(result.href,release.downloadUrl);
  assert.equal(result.privateTest,false);
});
