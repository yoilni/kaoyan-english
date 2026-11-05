const datePage=/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?\.html$/;
const dateKey=/^\d{4}-\d{2}-\d{2}$/;
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('en',{granularity:'sentence'}):null;
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

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

function readSource(html){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const article=doc.querySelector('.article');
 if(!article)return {sentences:[],meanings:{}};
 let meanings={};
 for(const script of doc.scripts){
  const match=script.textContent.match(/window\.KAOYAN_NEW\s*=\s*(\{[\s\S]*?\})\s*;/);
  if(match){try{meanings=JSON.parse(match[1]);break}catch{}}
 }
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
 return {sentences:[...article.querySelectorAll('p')].flatMap(sentences),meanings};
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

export function openSentenceReview(root,trigger){
 const dialog=document.createElement('dialog');
 dialog.className='sentence-review';
 dialog.setAttribute('aria-labelledby','sentenceReviewTitle');
 dialog.innerHTML=`<section class="sentence-review-inner">
  <header class="sentence-review-header">
   <h1 id="sentenceReviewTitle">原句复习</h1>
   <button class="btn" type="button" data-review-close>退出复习</button>
  </header>
  <p class="muted">从以往文章随机抽词。先回想词义，再点击查看中文；长按可标记或取消掌握。</p>
  <div class="card">
   <p class="muted sentence-review-status" role="status"></p>
   <p class="sentence-review-text" lang="en" aria-live="polite" hidden></p>
   <button class="btn primary" type="button" data-review-next hidden>下一个</button>
  </div>
 </section>`;
 const status=dialog.querySelector('.sentence-review-status');
 const text=dialog.querySelector('.sentence-review-text');
 const next=dialog.querySelector('[data-review-next]');
 const controller=new AbortController();
 const fetchLocal=async path=>{
  const response=await fetch(new URL(path,root),{cache:'no-cache',signal:controller.signal});
  if(!response.ok)throw new Error('无法读取原句');
  return response;
 };
 const cache=new Map();
 let deck=[],position=0,shown=0,overrides={};
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
    if(match)return {line,match,word,meaning};
   }
  }
  return null;
 }
 function render({line,match,word,meaning}){
  const target=document.createElement('button');
  target.type='button';
  target.className='word review';
  target.dataset.word=word;
  target.dataset.type='review';
  target.setAttribute('aria-expanded','false');
  try{
   const mastered=JSON.parse(localStorage.getItem('kaoyan_mastered_v1')||'[]');
   target.classList.toggle('mastered',mastered.includes(word));
  }catch{}
  const gloss=document.createElement('span');
  gloss.textContent='（'+meaning+'）';
  target.append(match[0],gloss);
  text.replaceChildren(line.slice(0,match.index),target,line.slice(match.index+match[0].length));
  text.hidden=false;
 }
 async function advance(){
  next.hidden=true;next.disabled=true;text.hidden=true;text.replaceChildren();
  status.textContent='正在找首学原句…';
  while(position<deck.length&&dialog.open){
   const card=await cardFor(...deck[position++]);
   if(!dialog.open)return;
   if(!card)continue;
   shown++;
   status.textContent='本轮第 '+shown+' 个词';
   render(card);next.textContent='下一个';next.disabled=false;next.hidden=false;
   return;
  }
  if(!dialog.open)return;
  const missing=deck.length-shown;
  status.textContent=shown?'本轮完成 · 已练 '+shown+' 个词'+(missing?'；'+missing+' 个词未能找到首学原句。':'。'):
   '暂时找不到可用的首学原句。';
  next.textContent=shown?'再练一轮':'重试';next.disabled=false;next.hidden=false;
 }
 async function start(){
  position=0;shown=0;cache.clear();
  status.textContent='正在找首学原句…';next.hidden=true;next.disabled=true;
  try{
   const [first,sourceOverrides]=await Promise.all(['data/word-origins.json','data/word-source-overrides.json'].map(path=>fetchLocal(path).then(r=>r.json())));
   if(!dialog.open)return;
   overrides=sourceOverrides;
   const today=todayKey();
   deck=shuffled(Object.entries(first).filter(([word,day])=>word&&typeof day==='string'&&dateKey.test(day)&&day<today));
   if(!deck.length){status.textContent='还没有可复习的历史词。';return;}
   await advance();
  }catch{
   if(!dialog.open)return;
   status.textContent='原句暂时无法加载，请重试。';
   next.textContent='重试';next.disabled=false;next.hidden=false;
  }
 }
 next.addEventListener('click',()=>next.textContent==='下一个'?advance():start());
 dialog.querySelector('[data-review-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  controller.abort();dialog.remove();
  trigger.focus({preventScroll:true});
 },{once:true});
 document.body.append(dialog);
 dialog.showModal();
 start();
}

