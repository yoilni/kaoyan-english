const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>route.abort());
  // 00:30 on Nov 5 in Beijing, still Nov 4 in UTC.
  await page.clock.setFixedTime(new Date('2026-11-04T16:30:00Z'));
  await page.addInitScript(()=>{Math.random=()=>0;});
  const base='http://127.0.0.1:8765';
  const first={composure:'2026-08-19',auditorium:'2026-10-19',ledger:'2026-09-24',unavailable:'2026-09-01',floodplain:'2026-11-05'};
  let failIndex=true;
  await page.route('**/data/word-origins.json',r=>failIndex?r.abort():r.fulfill({json:first}));
  await page.route('**/data/word-source-overrides.json',r=>r.fulfill({json:{auditorium:'2026-10-19-extra.html'}}));
  await page.route('**/days/2026-08-19.html',r=>r.fulfill({
   contentType:'text/html',
   body:'<div class="article"><p>Look at the door. Dr. Adams kept his <button class="word" data-word="composure">composure<span>（镇定）</span></button> when the bell <span class="aid">（铃）</span> rang. Leave the room.</p><details><summary>Do not show the note</summary><p>The composure explanation.</p></details></div>'
  }));
  await page.route('**/days/2026-10-19-extra.html',r=>r.fulfill({
   contentType:'text/html',
   body:'<div class="article"><p>A queue forms. It reaches the auditorium by noon. The foyer stays quiet.</p></div><script>window.KAOYAN_NEW={"auditorium":"礼堂"};</script>'
  }));
  await page.route('**/days/2026-09-01.html',r=>r.fulfill({status:404}));
  await page.route('**/days/2026-09-24.html',r=>r.fulfill({
   contentType:'text/html',
   body:"<div class='article' id='article'></div><script>window.KAOYAN_NEW={\"ledger\":\"账本\"}; const P=[['A',`Keep the records. These {ledgers} record ownership. Read them carefully.`,`译文。`]];</script>"
  }));
  let wrongSource=false;await page.route('**/days/2026-10-19.html',r=>{wrongSource=true;return r.abort();});

  await page.goto(base+'/index.html');
  const entry=page.getByRole('button',{name:'原句复习',exact:true});
  await entry.click();
  const dialog=page.getByRole('dialog',{name:'原句复习'});
  await dialog.getByText('原句暂时无法加载，请重试。',{exact:true}).waitFor();
  failIndex=false;
  await dialog.getByRole('button',{name:'重试',exact:true}).click();
  const sentence=dialog.locator('.sentence-review-text');
  const word=sentence.locator('button.word');
  await word.waitFor();
  assert.equal(await word.getAttribute('data-word'),'auditorium','shuffle spans dates and honors supplementary origin');
  assert.equal(await sentence.innerText(),'It reaches the auditorium by noon.');
  assert.equal(await word.getAttribute('aria-expanded'),'false');
  await word.click();
  assert.equal(await word.getAttribute('aria-expanded'),'true');
  assert.match(await sentence.innerText(),/礼堂/);
  assert.equal(await dialog.evaluate(d=>Math.round(d.getBoundingClientRect().height)),844);
  assert.equal(await dialog.evaluate(d=>d.scrollWidth>d.clientWidth),false);
  const next=dialog.getByRole('button',{name:'下一个',exact:true});
  await next.click();
  await sentence.getByRole('button',{name:'ledgers',exact:true}).waitFor();
  assert.equal(await sentence.innerText(),'These ledgers record ownership.');
  assert.equal(await word.getAttribute('data-word'),'ledger');
  await next.click();
  await sentence.getByRole('button',{name:'composure',exact:true}).waitFor();
  assert.equal(await sentence.innerText(),'Dr. Adams kept his composure when the bell rang.');
  assert.equal(await word.getAttribute('aria-expanded'),'false','no definition leaks across cards');
  const hold=async()=>{
   await word.dispatchEvent('pointerdown',{button:0,isPrimary:true,pointerId:1,clientX:10,clientY:10});
   await page.waitForTimeout(650);
   await word.dispatchEvent('pointerup',{button:0,isPrimary:true,pointerId:1});
  };
  await hold();
  assert.match(await word.getAttribute('class'),/mastered/);
  assert.equal(await word.getAttribute('aria-expanded'),'false');
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_mastered_v1).includes('composure')));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_mastered_pending_v1).composure),true);
  await next.click();
  await dialog.getByText('本轮完成 · 已练 3 个词；1 个词未能找到首学原句。',{exact:true}).waitFor();
  assert.equal(wrongSource,false);
  await page.keyboard.press('Escape');
  await page.locator('.sentence-review').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.activeElement?.id==='startSentenceReview');

  await page.goto(base+'/days/2026-11-05.html');
  const counter=page.locator('#reviewCount');
  assert.equal(await counter.textContent(),'复习词已查看 0/20');
  await entry.click();
  await word.waitFor();await word.click();
  assert.equal(await counter.textContent(),'复习词已查看 0/20','history recall does not inflate article counts');
  await next.click();await sentence.getByRole('button',{name:'ledgers',exact:true}).waitFor();
  await next.click();await sentence.getByRole('button',{name:'composure',exact:true}).waitFor();
  assert.match(await word.getAttribute('class'),/mastered/,'mastery follows the word across pages and rounds');
  await hold();
  assert.doesNotMatch(await word.getAttribute('class'),/mastered/);
  assert.ok(await page.evaluate(()=>!JSON.parse(localStorage.kaoyan_mastered_v1).includes('composure')));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_mastered_pending_v1).composure),false);
  assert.deepEqual(errors,[]);
  console.log('PASS historical sentence review: whole archive, Beijing day cutoff, shuffle, no repeats, exact source and gloss, retry, shared mastery and unchanged article counters');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

