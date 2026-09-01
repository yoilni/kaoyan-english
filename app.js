(()=>{
const BUILTIN_IPA={"amplify":"/ˈæmplɪfaɪ/","breach":"/briːtʃ/","cascade":"/kæˈskeɪd/","centralized":"/ˈsentrəlaɪzd/","concentration":"/ˌkɑːnsənˈtreɪʃən/","contagion":"/kənˈteɪdʒən/","compromise":"/ˈkɑːmprəmaɪz/","confidential":"/ˌkɑːnfɪˈdenʃəl/","disruption":"/dɪsˈrʌpʃən/","emergency":"/ɪˈmɜːrdʒənsi/","fraud":"/frɔːd/","governance":"/ˈɡʌvərnəns/","hazard":"/ˈhæzərd/","inherent":"/ɪnˈhɪrənt/","interconnected":"/ˌɪntərkəˈnektɪd/","interrupt":"/ˌɪntəˈrʌpt/","malicious":"/məˈlɪʃəs/","mutual":"/ˈmjuːtʃuəl/","oversight":"/ˈoʊvərsaɪt/","protocol":"/ˈproʊtəkɔːl/","redundancy":"/rɪˈdʌndənsi/","safeguard":"/ˈseɪfɡɑːrd/","supervise":"/ˈsuːpərvaɪz/","systemic":"/sɪˈstemɪk/","transaction":"/trænˈzækʃən/","unauthorized":"/ʌnˈɔːθəraɪzd/","vulnerability":"/ˌvʌlnərəˈbɪləti/","withstand":"/wɪðˈstænd/","anomaly":"/əˈnɑːməli/","assurance":"/əˈʃʊrəns/","associate":"/əˈsoʊʃieɪt/","consecutive":"/kənˈsekjətɪv/","crisis":"/ˈkraɪsɪs/","decisive":"/dɪˈsaɪsɪv/","deficiency":"/dɪˈfɪʃənsi/","destabilize":"/diːˈsteɪbəlaɪz/","forensic":"/fəˈrenzɪk/","insurer":"/ɪnˈʃʊrər/","intermediary":"/ˌɪntərˈmiːdieri/","jurisdiction":"/ˌdʒʊrɪsˈdɪkʃən/","recovery":"/rɪˈkʌvəri/","reputation":"/ˌrepjəˈteɪʃən/","robust":"/roʊˈbʌst/","simultaneous":"/ˌsaɪməlˈteɪniəs/","suspend":"/səˈspend/","threat":"/θret/","trace":"/treɪs/","ultimate":"/ˈʌltɪmət/","violate":"/ˈvaɪəleɪt/","vigilance":"/ˈvɪdʒələns/","accountable":"/əˈkaʊntəbəl/","consensus":"/kənˈsensəs/","obligation":"/ˌɑːbləˈɡeɪʃən/","authority":"/əˈθɔːrəti/","confirm":"/kənˈfɜːrm/","agency":"/ˈeɪdʒənsi/","crucial":"/ˈkruːʃəl/","legitimate":"/lɪˈdʒɪtəmət/","verify":"/ˈverɪfaɪ/","resilience":"/rɪˈzɪliəns/","liquidity":"/lɪˈkwɪdəti/","uncertainty":"/ʌnˈsɜːrtənti/"};
const ipa={...BUILTIN_IPA,...(window.KAOYAN_IPA||{})};
const maps=[['new',window.KAOYAN_NEW||{}],['review',window.KAOYAN_REVIEW||{}]];
const audioMap=Object.fromEntries(Object.entries(window.KAOYAN_AUDIO||{}).map(([k,v])=>[k.toLowerCase(),v]));
let activeUtterance=null;
let activeAudio=null;
function stopAudio(){
  try{if(activeAudio){activeAudio.pause();activeAudio.currentTime=0;activeAudio=null;}}catch(e){}
}
function tts(word){
  if(!('speechSynthesis' in window)) return false;
  try{
    stopAudio();
    const synth=window.speechSynthesis;
    synth.cancel();
    const u=new SpeechSynthesisUtterance(word);
    activeUtterance=u;
    u.lang='en-US';
    u.rate=.82;
    u.pitch=1;
    u.volume=1;
    const voices=synth.getVoices();
    const v=voices.find(x=>/^en-US/i.test(x.lang))||voices.find(x=>/^en/i.test(x.lang));
    if(v)u.voice=v;
    u.onend=u.onerror=()=>{if(activeUtterance===u)activeUtterance=null;};
    synth.speak(u);
    return true;
  }catch(e){return false;}
}
function speak(word){
  const key=word.toLowerCase();
  const src=audioMap[key];
  if(!src)return tts(key);
  try{
    window.speechSynthesis?.cancel();
    stopAudio();
    const a=new Audio(src);
    activeAudio=a;
    a.preload='auto';
    const fallback=()=>{
      if(activeAudio===a)activeAudio=null;
      try{a.pause();}catch(e){}
      tts(key);
    };
    a.onerror=fallback;
    a.onended=()=>{if(activeAudio===a)activeAudio=null;};
    const p=a.play();
    if(p&&typeof p.catch==='function')p.catch(fallback);
    return true;
  }catch(e){return tts(key);}
}
function makePhonetic(word,label=word){
  const ph=document.createElement('button');
  ph.type='button';ph.className='phonetic';ph.dataset.speak=word;
  ph.setAttribute('aria-label',`播放 ${label} 的发音`);
  ph.title=audioMap[word.toLowerCase()]?'真人美式发音；播放失败时自动使用 Chrome 美式发音':'暂无预缓存真人音频，使用 Chrome 美式发音';
  ph.textContent=(ipa[word]||'')+' 🔊';
  ph.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    speak(word);
  },{passive:false});
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
  btn.type='button';btn.id='chromeTtsTest';btn.className='btn';btn.textContent='🔊 测试 Chrome 发音';btn.title='强制使用浏览器 Web Speech API，不使用预缓存真人音频';
  const status=document.createElement('span');status.id='chromeTtsStatus';status.className='muted';status.style.marginLeft='8px';
  btn.addEventListener('click',()=>{
    if(tts('systemic')){status.textContent='正在用浏览器语音朗读：systemic';setTimeout(()=>{status.textContent='';},3500);}
    else status.textContent='当前浏览器不支持 speechSynthesis';
  });
  info.append(document.createElement('br'),btn,status);
}
if('speechSynthesis' in window){
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged',()=>window.speechSynthesis.getVoices(),{once:true});
}
document.getElementById('topBtn')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
})();