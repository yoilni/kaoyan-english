(()=>{
const BUILTIN_IPA={"amplify":"/ˈæmplɪfaɪ/","breach":"/briːtʃ/","cascade":"/kæˈskeɪd/","centralized":"/ˈsentrəlaɪzd/","concentration":"/ˌkɑːnsənˈtreɪʃən/","contagion":"/kənˈteɪdʒən/","compromise":"/ˈkɑːmprəmaɪz/","confidential":"/ˌkɑːnfɪˈdenʃəl/","disruption":"/dɪsˈrʌpʃən/","emergency":"/ɪˈmɜːrdʒənsi/","fraud":"/frɔːd/","governance":"/ˈɡʌvərnəns/","hazard":"/ˈhæzərd/","inherent":"/ɪnˈhɪrənt/","interconnected":"/ˌɪntərkəˈnektɪd/","interrupt":"/ˌɪntəˈrʌpt/","malicious":"/məˈlɪʃəs/","mutual":"/ˈmjuːtʃuəl/","oversight":"/ˈoʊvərsaɪt/","protocol":"/ˈproʊtəkɔːl/","redundancy":"/rɪˈdʌndənsi/","safeguard":"/ˈseɪfɡɑːrd/","supervise":"/ˈsuːpərvaɪz/","systemic":"/sɪˈstemɪk/","transaction":"/trænˈzækʃən/","unauthorized":"/ʌnˈɔːθəraɪzd/","vulnerability":"/ˌvʌlnərəˈbɪləti/","withstand":"/wɪðˈstænd/","anomaly":"/əˈnɑːməli/","assurance":"/əˈʃʊrəns/","associate":"/əˈsoʊʃieɪt/","consecutive":"/kənˈsekjətɪv/","crisis":"/ˈkraɪsɪs/","decisive":"/dɪˈsaɪsɪv/","deficiency":"/dɪˈfɪʃənsi/","destabilize":"/diːˈsteɪbəlaɪz/","forensic":"/fəˈrenzɪk/","insurer":"/ɪnˈʃʊrər/","intermediary":"/ˌɪntərˈmiːdieri/","jurisdiction":"/ˌdʒʊrɪsˈdɪkʃən/","recovery":"/rɪˈkʌvəri/","reputation":"/ˌrepjəˈteɪʃən/","robust":"/roʊˈbʌst/","simultaneous":"/ˌsaɪməlˈteɪniəs/","suspend":"/səˈspend/","threat":"/θret/","trace":"/treɪs/","ultimate":"/ˈʌltɪmət/","violate":"/ˈvaɪəleɪt/","vigilance":"/ˈvɪdʒələns/","accountable":"/əˈkaʊntəbəl/","consensus":"/kənˈsensəs/","obligation":"/ˌɑːbləˈɡeɪʃən/","authority":"/əˈθɔːrəti/","confirm":"/kənˈfɜːrm/","agency":"/ˈeɪdʒənsi/","crucial":"/ˈkruːʃəl/","legitimate":"/lɪˈdʒɪtəmət/","verify":"/ˈverɪfaɪ/","resilience":"/rɪˈzɪliəns/","liquidity":"/lɪˈkwɪdəti/","uncertainty":"/ʌnˈsɜːrtənti/"};
const ipa={...BUILTIN_IPA,...(window.KAOYAN_IPA||{})};
const maps=[['new',window.KAOYAN_NEW||{}],['review',window.KAOYAN_REVIEW||{}]];
const audioCache=new Map();
const audioPending=new Map();
let currentAudio=null;
function tts(word){
  if(!('speechSynthesis' in window)) return false;
  try{if(currentAudio){currentAudio.pause();currentAudio=null;}}catch(e){}
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(word);
  u.lang='en-US';u.rate=.82;
  const voices=window.speechSynthesis.getVoices();
  const v=voices.find(x=>/^en-US/i.test(x.lang))||voices.find(x=>/^en/i.test(x.lang));
  if(v)u.voice=v;
  window.speechSynthesis.speak(u);
  return true;
}
async function resolveAudio(word){
  if(audioCache.has(word))return audioCache.get(word);
  if(audioPending.has(word))return audioPending.get(word);
  const job=(async()=>{
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),2500);
      const r=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{signal:ctrl.signal});
      clearTimeout(timer);
      if(!r.ok)throw new Error('dictionary');
      const data=await r.json();
      const ps=(data||[]).flatMap(x=>x.phonetics||[]);
      const us=ps.find(x=>x.audio&&(/-us/i.test(x.audio)||/[_-]us[_./-]/i.test(x.audio)));
      const any=ps.find(x=>x.audio);
      let src=(us||any)?.audio||'';
      if(src&&src.startsWith('//'))src='https:'+src;
      audioCache.set(word,src);
      return src;
    }catch(e){
      audioCache.set(word,'');
      return '';
    }finally{
      audioPending.delete(word);
    }
  })();
  audioPending.set(word,job);
  return job;
}
function warmAudio(){
  const words=[...new Set(maps.flatMap(([,map])=>Object.keys(map).map(w=>w.toLowerCase())))];
  let i=0;
  const next=()=>{
    if(i>=words.length)return;
    resolveAudio(words[i++]).finally(()=>setTimeout(next,40));
  };
  for(let n=0;n<3;n++)next();
}
function speak(word){
  const src=audioCache.get(word);
  if(src){
    try{
      window.speechSynthesis?.cancel();
      if(currentAudio)currentAudio.pause();
      const a=new Audio(src);
      currentAudio=a;
      a.preload='auto';
      a.onended=()=>{if(currentAudio===a)currentAudio=null;};
      a.onerror=()=>{if(currentAudio===a)currentAudio=null;tts(word);};
      const p=a.play();
      if(p&&typeof p.catch==='function')p.catch(()=>{if(currentAudio===a)currentAudio=null;tts(word);});
      return;
    }catch(e){tts(word);return;}
  }
  tts(word);
  if(!audioCache.has(word))resolveAudio(word);
}
function makePhonetic(word,label=word){
  const ph=document.createElement('button');
  ph.type='button';ph.className='phonetic';ph.dataset.speak=word;
  ph.setAttribute('aria-label',`播放 ${label} 的发音`);
  ph.title='真人词典音频已就绪时优先播放；否则立即使用 Chrome 美式发音';
  ph.textContent=(ipa[word]||'')+' 🔊';
  ph.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();speak(word)});
  return ph;
}
const article=document.querySelector('.article');
if(article){
  const all={};
  maps.forEach(([type,map])=>Object.entries(map).forEach(([w,zh])=>all[w.toLowerCase()]={type,zh}));
  const keys=Object.keys(all).sort((a,b)=>b.length-a.length);
  if(keys.length){
    const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('\\b('+keys.map(esc).join('|')+')\\b','gi');
    const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())if(!walker.currentNode.parentElement.closest('button,script,style'))nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.nodeValue;
      if(!re.test(text)){re.lastIndex=0;return;}
      re.lastIndex=0;
      const frag=document.createDocumentFragment();let last=0;
      text.replace(re,(match,_,offset)=>{
        frag.append(text.slice(last,offset));
        const key=match.toLowerCase(),d=all[key];
        const b=document.createElement('button');
        b.className='word'+(d.type==='review'?' review':'');b.dataset.word=key;b.dataset.type=d.type;b.append(document.createTextNode(match));
        const s=document.createElement('span');s.textContent=`（${d.zh}）`;b.append(s);frag.append(b);
        frag.append(makePhonetic(key,match));
        last=offset+match.length;return match;
      });
      frag.append(text.slice(last));node.replaceWith(frag);
    });
  }
}
function enhanceVocabList(details,map,type){
  if(!details||!map||!Object.keys(map).length)return;
  const old=details.querySelector('p');
  if(!old)return;
  const wrap=document.createElement('div');wrap.className='vocab-list';
  Object.entries(map).forEach(([word,zh])=>{
    const key=word.toLowerCase();
    const row=document.createElement('div');row.className='vocab-item';
    const head=document.createElement('span');head.className='vocab-head';
    const w=document.createElement('b');w.textContent=word;head.append(w,document.createTextNode(' '));head.append(makePhonetic(key,word));
    const meaning=document.createElement('span');meaning.className='vocab-meaning';meaning.textContent=' '+zh;
    row.append(head,meaning);wrap.append(row);
  });
  old.replaceWith(wrap);
}
const detailEls=[...document.querySelectorAll('details')];
const newDetails=detailEls.find(d=>/今日\s*50\s*个新词|今日新词/.test(d.querySelector('summary')?.textContent||''));
const reviewDetails=detailEls.find(d=>/今日复习词/.test(d.querySelector('summary')?.textContent||''));
enhanceVocabList(newDetails,window.KAOYAN_NEW||{},'new');
enhanceVocabList(reviewDetails,window.KAOYAN_REVIEW||{},'review');
const m=new Set(JSON.parse(localStorage.getItem('kaoyan_mastered')||'[]'));
const viewedNew=new Set(),viewedReview=new Set();
const totalNew=Object.keys(window.KAOYAN_NEW||{}).length,totalReview=Object.keys(window.KAOYAN_REVIEW||{}).length;
function updateCounters(){
  const n=document.getElementById('newCount'),r=document.getElementById('reviewCount');
  if(n)n.textContent=`新词已查看 ${viewedNew.size}/${totalNew}`;
  if(r)r.textContent=`复习词已查看 ${viewedReview.size}/${totalReview}`;
}
document.querySelectorAll('.word').forEach(e=>{
  if(m.has(e.dataset.word))e.classList.add('mastered');
  e.onclick=()=>{e.classList.toggle('open');if(e.classList.contains('open')){if(e.dataset.type==='new')viewedNew.add(e.dataset.word);if(e.dataset.type==='review')viewedReview.add(e.dataset.word);updateCounters();}};
  e.oncontextmenu=x=>{x.preventDefault();const w=e.dataset.word;m.has(w)?m.delete(w):m.add(w);document.querySelectorAll('.word').forEach(q=>{if(q.dataset.word===w)q.classList.toggle('mastered',m.has(w))});localStorage.setItem('kaoyan_mastered',JSON.stringify([...m]));};
});
updateCounters();
const info=document.getElementById('newCount')?.closest('.card');
if(info&&!document.getElementById('chromeTtsTest')){
  const btn=document.createElement('button');
  btn.type='button';btn.id='chromeTtsTest';btn.className='btn';btn.textContent='🔊 测试 Chrome 发音';btn.title='强制使用浏览器 Web Speech API，不调用真人词典音频';
  const status=document.createElement('span');status.id='chromeTtsStatus';status.className='muted';status.style.marginLeft='8px';
  btn.addEventListener('click',()=>{
    if(tts('systemic')){status.textContent='正在用浏览器语音朗读：systemic';setTimeout(()=>{status.textContent='';},3500);}
    else status.textContent='当前浏览器不支持 speechSynthesis';
  });
  info.append(document.createElement('br'),btn,status);
}
warmAudio();
document.getElementById('topBtn')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
})();