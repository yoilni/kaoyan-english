const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    await page.route('https://**/*',route=>route.abort());
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const base='http://127.0.0.1:8765/days/';
    await page.goto(base+'2026-10-19.html');
    await page.locator('.article .word[data-word="dedication"]').first().click();

    await page.goto(base+'2026-10-19-extra.html');
    const result=await page.evaluate(()=>{
      const targets=[...Object.keys(KAOYAN_NEW),...Object.keys(KAOYAN_REVIEW)];
      const body=[...document.querySelectorAll('.article .word')].map(x=>x.dataset.word);
      const day=JSON.parse(localStorage.kaoyan_progress_v1).days['2026-10-19'];
      return {new:Object.keys(KAOYAN_NEW).length,review:Object.keys(KAOYAN_REVIEW).length,
        missing:targets.filter(w=>!body.includes(w)),cards:document.querySelectorAll('.vocab-item').length,
        paragraphs:document.querySelectorAll('.article>p').length,translations:document.querySelectorAll('.translation-panel').length,
        overflow:document.documentElement.scrollWidth>innerWidth,retained:day.words.dedication.meaningClicks>0};
    });
    assert.deepEqual(result,{new:50,review:20,missing:[],cards:70,paragraphs:10,translations:10,overflow:false,retained:true});
    assert.equal(await page.locator('#newCount').textContent(),'新词已查看 0/50');
    const word=page.locator('.article .word[data-word="auditorium"]').first();
    await word.click();
    assert.equal(await page.locator('#newCount').textContent(),'新词已查看 1/50');
    for(const mastered of [true,false]){
      await word.dispatchEvent('pointerdown',{button:0,isPrimary:true,clientX:10,clientY:10});
      await page.waitForTimeout(650);
      await word.dispatchEvent('pointerup',{button:0});
      assert.equal((await word.getAttribute('class')).includes('mastered'),mastered);
    }
    await page.reload();
    assert.doesNotMatch(await page.locator('.article .word[data-word="auditorium"]').first().getAttribute('class'),/mastered/);
    await page.locator('.translation-toggle').first().click();
    assert.equal(await page.locator('.translation-panel').first().isVisible(),true);
    for(const details of await page.locator('details.card').all()){
      await details.evaluate(x=>x.open=true);
      await details.locator('.vocab-source-link').first().click();
      assert.equal(await page.locator('.return-to-vocab').count(),1);
      await page.locator('.return-to-vocab').click();
    }
    await page.goto(base+'2026-10-19.html');
    assert.equal(await page.locator('#newCount').textContent(),'新词已查看 1/50');
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_progress_v1).days['2026-10-19'].words.auditorium));

    // A later reading must link new supplementary words to their actual page.
    const fixture=`<!doctype html><html><head><meta charset="utf-8"></head><body><main><div class="card"><b id="newCount"></b><span id="reviewCount"></span></div><div class="article"><p>The narration remains intact.</p></div><details class="card"><summary>今日复习词（2）</summary><p>narration；intact</p></details></main><script>window.KAOYAN_NEW={};window.KAOYAN_REVIEW={narration:'解说',intact:'完整的'};window.KAOYAN_IPA={};window.KAOYAN_AUDIO={};window.KAOYAN_TRANSLATIONS=['解说保持完整。'];</script><script src="../app.js"></script><script src="../review-origin.js"></script></body></html>`;
    await page.route(base+'2026-10-20.html',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await page.goto(base+'2026-10-20.html');
    await page.waitForSelector('.review-origin-link',{state:'attached'});
    const narration=page.locator('.vocab-item').filter({has:page.locator('.vocab-source-link',{hasText:/^narration$/})});
    const intact=page.locator('.vocab-item').filter({has:page.locator('.vocab-source-link',{hasText:/^intact$/})});
    assert.match(await narration.locator('.review-origin-link').getAttribute('href'),/2026-10-19-extra\.html\?word=narration/);
    assert.match(await intact.locator('.review-origin-link').getAttribute('href'),/2026-10-04\.html\?word=intact/);
    await page.locator('details.card').evaluate(x=>x.open=true);
    await narration.locator('.review-origin-link').click();
    await page.waitForURL('**/2026-10-19-extra.html?word=narration&origin=review');
    await page.waitForFunction(()=>document.querySelector('.article .word[data-word="narration"]')?.classList.contains('trace-hit'));
    assert.deepEqual(errors,[]);
    console.log('PASS supplementary reading: mobile, retained same-day records, counters, long press/cancel, translation, trace/return and future first-source links');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
