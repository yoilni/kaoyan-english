// Run with: node tests/interaction.cjs (Playwright required; local server on 8765).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8765';
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
 const context = await browser.newContext({hasTouch:true,viewport:{width:390,height:844}});
 await context.route('https://**/*',r=>r.abort());
 const page = await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function hold(el,ms=600){await el.dispatchEvent('pointerdown',{pointerId:1,isPrimary:true,button:0,clientX:10,clientY:10});await page.waitForTimeout(ms);await el.dispatchEvent('pointerup',{pointerId:1,isPrimary:true,button:0});}
 for(const day of ['2026-08-19','2026-09-16','2026-09-20','2026-09-23','2026-10-02']){
  await page.goto(`${base}/days/${day}.html`);await page.waitForTimeout(200);
  const el=page.locator('.article .word').first();const word=await el.getAttribute('data-word');
  await hold(el);assert.match(await el.getAttribute('class'),/mastered/);
  assert.equal(await page.evaluate(w=>JSON.parse(localStorage.kaoyan_mastered_pending_v1)[w],word),true);
  await page.reload();await hold(page.locator('.article .word').first(),1600);
  assert.doesNotMatch(await page.locator('.article .word').first().getAttribute('class'),/mastered/);
  await page.reload();assert.doesNotMatch(await page.locator('.article .word').first().getAttribute('class'),/mastered/);
  assert.equal(await page.evaluate(w=>JSON.parse(localStorage.kaoyan_mastered_pending_v1)[w],word),false);
  // Duplicate execution must not bind a second long-press handler.
  await page.addScriptTag({url:base+'/sync.js'});await hold(page.locator('.article .word').first());
  assert.match(await page.locator('.article .word').first().getAttribute('class'),/mastered/);
  await hold(page.locator('.article .word').first());
  assert.doesNotMatch(await page.locator('.article .word').first().getAttribute('class'),/mastered/);
  console.log('PASS long press / cancel / reload / duplicate script:',day);
 }
 // First click after a completed hold must not open the definition.
 await page.waitForTimeout(950);await page.locator('.article .word').first().click();
 assert.match(await page.locator('.article .word').first().getAttribute('class'),/open/);
 assert.ok(await page.locator('.translation-toggle').count());
 await page.locator('.translation-toggle').first().click();
 assert.equal(await page.locator('.translation-panel').first().isVisible(),true);
 await page.evaluate(()=>window.scrollTo(0,1000));await page.waitForTimeout(100);
 assert.equal(await page.locator('#backToTop').evaluate(e=>e.style.pointerEvents),'auto');
 assert.equal(await page.evaluate(()=>window.traceWordToArticle(document.querySelector('.article .word').dataset.word,document.querySelector('.article .word'))),true);
 assert.equal(await page.locator('.return-to-vocab').count(),1);
 assert.deepEqual(errors,[]);
 // Exercise real HTTP ordering with a mock Supabase service, without touching personal records.
 await context.unroute('https://**/*');
 const remote=new Set(['cloud-only']);let calls=[];let failWrites=true;
 await context.route('https://**/*',async r=>{
  const req=r.request(),url=new URL(req.url()),method=req.method();
  if(url.pathname==='/auth/v1/user')return r.fulfill({json:{id:'test-user',email:'test@example.invalid'}});
  if(url.pathname==='/rest/v1/mastered_words'){
   calls.push(method);
   if(method==='GET')return r.fulfill({json:[...remote].map(word=>({word}))});
   if(failWrites)return r.fulfill({status:503,json:{message:'offline'}});
   await new Promise(resolve=>setTimeout(resolve,700));
   if(method==='POST')remote.add(req.postDataJSON().word);
   if(method==='DELETE')remote.delete(url.searchParams.get('word').slice(3));
   return r.fulfill({status:204});
  }
  return r.abort();
 });
 await page.evaluate(()=>{localStorage.setItem('kaoyan_mastered_pending_v1',JSON.stringify({'offline-word':true,'cloud-only':false}));localStorage.setItem('kaoyan_supabase_session_v1',JSON.stringify({access_token:'test',user:{id:'test-user'}}))});
 await page.goto(base+'/index.html');await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_mastered_pending_v1)['offline-word']));
 failWrites=false;await page.locator('#syncNow').click();await page.waitForTimeout(1800);
 assert.ok(remote.has('offline-word'));assert.ok(!remote.has('cloud-only'));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.kaoyan_mastered_pending_v1)),{});
 await page.goto(base+'/days/2026-10-02.html');await page.waitForTimeout(200);
 const word=await page.locator('.article .word').first().getAttribute('data-word');
 await hold(page.locator('.article .word').first());await hold(page.locator('.article .word').first());
 await page.waitForTimeout(1800);assert.ok(!remote.has(word));
 assert.ok(!await page.evaluate(w=>JSON.parse(localStorage.kaoyan_mastered_v1).includes(w),word));
 console.log('PASS offline queue / retry / upload before download / rapid reversal');
 await context.close();
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
