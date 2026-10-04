const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try{const p=await b.newPage();await p.route('https://**/*',r=>r.abort());await p.addInitScript(()=>{
 window.audioCalls=[];window.ttsCalls=[];window.audioMode='success';window.testAudios=[];
 window.Audio=class{constructor(src){this.src=src;audioCalls.push(src);testAudios.push(this)}pause(){}play(){if(audioMode==='fail')return Promise.reject(Error('unavailable'));if(audioMode==='pending')return new Promise(()=>{});queueMicrotask(()=>this.onplaying?.());return Promise.resolve()}};
 speechSynthesis.speak=u=>ttsCalls.push(u.text);speechSynthesis.cancel=()=>{};
 });
 await p.goto('http://127.0.0.1:8765/days/2026-10-02.html');assert.equal(await p.evaluate(()=>audioCalls.length+ttsCalls.length),0);
 await p.locator('.phonetic').first().click();assert.match(await p.evaluate(()=>audioCalls[0]),/^https:\/\/dict.youdao.com\/dictvoice\?/);assert.match(await p.locator('#audioSourceStatus').textContent(),/有道/);
 await p.evaluate(()=>audioMode='fail');await p.locator('.phonetic').nth(1).click();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>ttsCalls.length),1);assert.match(await p.locator('#audioSourceStatus').textContent(),/浏览器语音/);
 await p.evaluate(()=>audioMode='pending');await p.locator('.phonetic').first().click();await p.evaluate(()=>window.oldError=testAudios.at(-1).onerror);await p.evaluate(()=>audioMode='success');await p.locator('.phonetic').nth(1).click();await p.evaluate(()=>oldError());assert.equal(await p.evaluate(()=>ttsCalls.length),1);
 await p.locator('#chromeTtsTest').click();assert.equal(await p.evaluate(()=>ttsCalls.length),2);
 await p.goto('http://127.0.0.1:8765/days/2026-09-20.html');await p.locator('#newGrid .vcard button').nth(1).click();assert.match(await p.evaluate(()=>audioCalls[0]),/^https:\/\/dict.youdao.com\//);
 console.log('PASS Youdao priority, no autoplay, TTS fallback, stale request cancellation, forced TTS and legacy cards');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
