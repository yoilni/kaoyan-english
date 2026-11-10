const datePage=/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?\.html$/;
const dateKey=/^\d{4}-\d{2}-\d{2}$/;
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'sentence'}):null;
const masteredKey='kaoyan_mastered_v1';
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function masteredWords(){
 try{
  const words=JSON.parse(localStorage.getItem(masteredKey)||'[]');
  return new Set(words.map(word=>String(word).trim().toLowerCase()));
 }catch{return new Set();}
}

function todayKey(){
 const parts=new Intl.DateTimeFormat('en',{
  timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date());
 const {year,month,day}=Object.fromEntries(parts.map(({type,value})=>[type,value]));
 return year+'-'+month+'-'+day;
}

function sentences(paragraph){
 const text=paragraph.textContent.replace(/\{([^{}]+)\}|\[([^\[\]]+)\]/g,(_,a,b)=>a??b).replace(/\s+/g,' ').trim();
 // Keep common abbreviations together without changing the displayed sentence.
 const mask=text.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|e\.g|i\.e)\./gi,m=>m.replace(/\./g,'\uE000'));
 if(segmenter)return [...segmenter.segment(mask)].map(({index,segment})=>text.slice(index,index+segment.length).trim());
 return mask.split(/(?<=[.!?])\s+/).map(s=>s.replace(/\uE000/g,'.'));
}

function readLegacyParagraphs(scripts){
 for(const script of scripts){
  const match=script.textContent.match(/\bconst\s+P\s*=\s*(\[[\s\S]*?\])\s*;/);
  if(!match)continue;
  // Older articles render paragraphs from literal arrays. Read the text without executing scripts.
  try{return JSON.parse(match[1]).map(row=>row[1]).filter(text=>typeof text==='string')}
  catch{
   return [...match[1].matchAll(/\[\s*'[^'\\]*'\s*,\s*`([^`\\]*)`/g)]
    .map(row=>row[1]).filter(text=>!text.includes('$'+'{'));
  }
 }
 return [];
}

function readMap(scripts,key){
 const assignment=new RegExp('\\bwindow\\.KAOYAN_'+key+'\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*;');
 for(const script of scripts){
  const match=script.textContent.match(assignment);
  if(match){try{return JSON.parse(match[1])}catch{}}
 }
 return {};
}

function readSource(html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const article=doc.querySelector('.article');
 if(!article)return null;
 const meanings=readMap(doc.scripts,'NEW');
 for(const node of article.querySelectorAll('.word')){
  const word=(node.dataset.word||node.firstChild?.textContent||'').trim().toLowerCase();
  const gloss=(node.dataset.meaning||node.querySelector('span')?.textContent||'').trim().replace(/^[（(]|[）)]$/g,'');
  if(word&&gloss&&!Object.hasOwn(meanings,word))meanings[word]=gloss;
 }
 article.querySelectorAll('details,.study,.translation-wrap,.translation-panel,.review-context,.word span,.aid,.gloss,.phonetic,script,style').forEach(node=>node.remove());
 if(!article.querySelector('p')){
  for(const line of readLegacyParagraphs(doc.scripts)){
   const p=doc.createElement('p');
   p.textContent=line;
   article.append(p);
  }
 }
 return {sentences:[...article.querySelectorAll('p')].flatMap(sentences),meanings,
  ipa:readMap(doc.scripts,'IPA'),audio:readMap(doc.scripts,'AUDIO')};
}

function targetPatterns(word){
 const exact=escaped(word).replace(/[- ]+/g,'(?:[-‐‑–]|\\s+)');
 const patterns=[new RegExp('\\b'+exact+'\\b','i')];
 if(/^[a-z]+$/.test(word)){
  const forms=[word+'s',word+'es',word+'ed',word+'ing'];
  if(word.endsWith('e'))forms.push(word+'d',word.slice(0,-1)+'ing');
  if(/[^aeiou]y$/.test(word))forms.push(word.slice(0,-1)+'ies',word.slice(0,-1)+'ied');
  if(/[^aeiou][aeiou][bdgmnprt]$/.test(word))forms.push(word+word.at(-1)+'ed',word+word.at(-1)+'ing');
  patterns.push(new RegExp('\\b(?:'+forms.join('|')+')\\b','i'));
 }
 return patterns;
}

function shuffled(entries){
 const deck=[...entries];
 for(let i=deck.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [deck[i],deck[j]]=[deck[j],deck[i]];
 }
 return deck;
}

export function openSentenceReview(root,trigger,{makePhonetic,stopPronunciation=()=>{}}={}){
 const dialog=document.createElement('dialog');
 dialog.className='sentence-review';
 dialog.setAttribute('aria-labelledby','sentenceReviewTitle');
 dialog.innerHTML=`<section class="sentence-review-inner">
  <header class="sentence-review-header">
   <h1 id="sentenceReviewTitle">原句复习</h1>
   <button class="btn" type="button" data-review-close>退出复习</button>
  </header>
  <p class="muted">从以往文章随机抽取未标绿的词。点击单词查看中文；${makePhonetic?'点击音标听发音；':''}长按可标记或取消掌握。</p>
  <div class="card">
   <p class="muted sentence-review-status" role="status"></p>
   <p class="sentence-review-text" lang="en" aria-live="polite" hidden></p>
   <div class="muted" role="status" data-review-audio-status></div>
   <div class="sentence-review-actions">
    <button class="btn" type="button" data-review-prev hidden disabled>上一个</button>
    <button class="btn primary" type="button" data-review-next hidden disabled>下一个</button>
   </div>
  </div>
 </section>`;
 const status=dialog.querySelector('.sentence-review-status');
 const text=dialog.querySelector('.sentence-review-text');
 const audioStatus=dialog.querySelector('[data-review-audio-status]');
 const previous=dialog.querySelector('[data-review-prev]');
 const next=dialog.querySelector('[data-review-next]');
 const controller=new AbortController();
 const fetchLocal=async path=>{
  const response=await fetch(new URL(path,root),{cache:'no-cache',signal:controller.signal});
  if(!response.ok)throw new Error('无法读取原句');
  return response;
 };
 const cache=new Map();
 let deck=[],position=0,cards=[],current=-1,missing=0,overrides={},legacyIpa;
 async function cardFor(word,origin){
  const override=overrides[word];
  const file=typeof override==='string'&&datePage.test(override)?override:origin+'.html';
  if(!cache.has(file)){
   cache.set(file,fetchLocal('days/'+file).then(r=>r.text()).then(readSource).catch(()=>null));
  }
  const source=await cache.get(file);
  if(!source)return null;
  const meaning=source.meanings[word];
  if(typeof meaning!=='string'||!meaning.trim())return null;
  for(const pattern of targetPatterns(word)){
   for(const line of source.sentences){
    const match=pattern.exec(line);
    if(!match)continue;
    let phonetic=source.ipa[word];
    if(makePhonetic&&!phonetic){
     legacyIpa??=fetchLocal('data/sentence-review-ipa.json').then(r=>r.json()).catch(()=>({}));
     phonetic=(await legacyIpa)?.[word];
    }
    return {line,match,word,meaning,phonetic,backupAudio:source.audio[word]};
   }
  }
  return null;
 }
 function render({line,match,word,meaning,phonetic,backupAudio}){
  const target=document.createElement('button');
  target.type='button';
  target.className='word review';
  target.dataset.word=word;
  target.dataset.type='review';
  target.setAttribute('aria-expanded','false');
  target.classList.toggle('mastered',masteredWords().has(word));
  const gloss=document.createElement('span');
  gloss.textContent='（'+meaning+'）';
  target.append(match[0],gloss);
  const parts=[line.slice(0,match.index),target];
  if(makePhonetic){
   const pronunciation=makePhonetic(word,word,{
    phonetic,backupAudio,track:false,report:message=>{audioStatus.textContent=message}
   });
   pronunciation.lang='zh-CN';
   parts.push(pronunciation);
  }
  text.replaceChildren(...parts,line.slice(match.index+match[0].length));
  text.hidden=false;
 }
 function resetPronunciation(){
  stopPronunciation();audioStatus.textContent='';
 }
 function showLoading(){
  resetPronunciation();
  previous.hidden=next.hidden=true;
  previous.disabled=next.disabled=true;
  text.hidden=true;text.replaceChildren();
  status.textContent='正在找首学原句…';
 }
 function eligibleCard(index,step){
  const mastered=masteredWords();
  for(let i=index;i>=0&&i<cards.length;i+=step){
   if(!mastered.has(cards[i].word))return i;
  }
  return -1;
 }
 function refreshPrevious(){
  previous.disabled=previous.hidden||eligibleCard(current-1,-1)<0;
 }
 function showActions(label){
  previous.hidden=cards.length===0;refreshPrevious();
  next.textContent=label;next.disabled=false;next.hidden=false;
 }
 function showCard(index){
  const previousFocused=document.activeElement===previous;
  resetPronunciation();
  current=index;
  status.textContent='本轮第 '+(current+1)+' 个词';
  render(cards[current]);
  showActions('下一个');
  if(previousFocused&&previous.disabled)next.focus({preventScroll:true});
 }
 async function advance(){
  const cached=eligibleCard(current+1,1);
  if(cached>=0){showCard(cached);return;}
  showLoading();
  while(position<deck.length&&dialog.open){
   const [word,origin]=deck[position++];
   if(masteredWords().has(word))continue;
   const card=await cardFor(word,origin);
   if(!dialog.open)return;
   if(masteredWords().has(word))continue;
   if(!card){missing++;continue;}
   cards.push(card);
   showCard(cards.length-1);
   return;
  }
  if(!dialog.open)return;
  const shown=cards.length;
  current=shown;
  status.textContent=shown?'本轮完成 · 已练 '+shown+' 个词'+(missing?'；'+missing+' 个词未能找到首学原句。':'。'):
   (missing?'暂时找不到可用的首学原句。':'本轮没有未掌握的历史词。');
  showActions(shown?'再练一轮':'重试');
 }
 async function start(){
  deck=[];position=0;cards=[];current=-1;missing=0;cache.clear();
  showLoading();
  try{
   const [first,sourceOverrides]=await Promise.all(['data/word-origins.json','data/word-source-overrides.json'].map(path=>fetchLocal(path).then(r=>r.json())));
   if(!dialog.open)return;
   overrides=sourceOverrides;
   const today=todayKey();
   const historical=Object.entries(first).filter(([word,day])=>word&&typeof day==='string'&&dateKey.test(day)&&day<today);
   const mastered=masteredWords();
   deck=shuffled(historical.filter(([word])=>!mastered.has(word)));
   if(!deck.length){
    status.textContent=historical.length?'历史词都已标绿。取消标绿后可再次复习。':'还没有可复习的历史词。';
    if(historical.length)showActions('重新检查');
    return;
   }
   await advance();
  }catch{
   if(!dialog.open)return;
   status.textContent='原句暂时无法加载，请重试。';
   showActions('重试');
  }
 }
 previous.addEventListener('click',()=>{
  const index=eligibleCard(current-1,-1);
  if(index>=0)showCard(index);else refreshPrevious();
 });
 window.addEventListener('kaoyan:mastered-changed',refreshPrevious,{signal:controller.signal});
 window.addEventListener('storage',event=>{
  if(event.key===masteredKey||event.key===null)refreshPrevious();
 },{signal:controller.signal});
 next.addEventListener('click',()=>{
  if(next.disabled)return;
  if(current>=0&&current<cards.length)advance();
  else start();
 });
 dialog.querySelector('[data-review-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  controller.abort();stopPronunciation();dialog.remove();
  trigger.focus({preventScroll:true});
 },{once:true});
 document.body.append(dialog);
 dialog.showModal();
 start();
}

