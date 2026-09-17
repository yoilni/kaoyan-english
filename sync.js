(()=>{
const SUPABASE_URL='https://ohqrbosdqihgbjslbvkt.supabase.co';
const SUPABASE_KEY='sb_publishable_06TFKhOUzSZy_JgHZD5lEg_vfaApiqc';
const MASTERED_KEY='kaoyan_mastered_v1';
const TOTAL=5500;
let sb=null,user=null;
const norm=w=>String(w||'').trim().toLowerCase();
function localSet(){try{return new Set(JSON.parse(localStorage.getItem(MASTERED_KEY)||'[]').map(norm).filter(Boolean))}catch{return new Set}}
function saveLocal(set){localStorage.setItem(MASTERED_KEY,JSON.stringify([...set].sort()));refresh(set)}
function refresh(set=localSet()){
 document.querySelectorAll('.word').forEach(el=>el.classList.toggle('mastered',set.has(norm(el.dataset.word||el.childNodes[0]?.textContent||el.textContent))));
 const n=set.size,p=Math.min(100,n/TOTAL*100);
 const d=document.getElementById('dashMastered'); if(d)d.textContent=String(n);
 const t=document.getElementById('masteredTotal'); if(t)t.textContent=`${n} / ${TOTAL}`;
 const pc=document.getElementById('masteredPercent'); if(pc)pc.textContent=`${p.toFixed(1)}%`;
 const b=document.getElementById('masteredBar'); if(b)b.style.width=`${p}%`;
}
async function loadLib(){if(window.supabase)return window.supabase;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=ok;s.onerror=no;document.head.appendChild(s)});return window.supabase}
async function mergeCloud(){if(!sb||!user)return;const local=localSet();const {data,error}=await sb.from('mastered_words').select('word');if(error)throw error;const cloud=new Set((data||[]).map(x=>norm(x.word)));const merged=new Set([...local,...cloud]);const missing=[...local].filter(w=>!cloud.has(w));if(missing.length){const {error:e}=await sb.from('mastered_words').upsert(missing.map(word=>({user_id:user.id,word})));if(e)throw e}saveLocal(merged);setStatus(`已同步 · ${merged.size} 个掌握词`)}
async function setCloud(word,on){if(!sb||!user)return;if(on){const {error}=await sb.from('mastered_words').upsert({user_id:user.id,word});if(error)throw error}else{const {error}=await sb.from('mastered_words').delete().eq('user_id',user.id).eq('word',word);if(error)throw error}}
function setStatus(x){const e=document.getElementById('syncStatus');if(e)e.textContent=x}
function installLongPress(){let timer=null,start=null;document.addEventListener('pointerdown',e=>{const w=e.target.closest?.('.word');if(!w)return;start=w;timer=setTimeout(async()=>{const word=norm(w.dataset.word||w.childNodes[0]?.textContent||w.textContent);if(!word)return;const set=localSet(),on=!set.has(word);on?set.add(word):set.delete(word);saveLocal(set);try{await setCloud(word,on);setStatus(user?'已同步':'已保存在本机，登录后同步')}catch{setStatus('本机已保存 · 云同步稍后重试')}start=null},650)});['pointerup','pointercancel','pointermove'].forEach(ev=>document.addEventListener(ev,()=>{clearTimeout(timer);timer=null}));}
function addUI(){const dash=document.getElementById('progressDashboard');if(!dash)return;const box=document.createElement('div');box.className='sync-panel';box.innerHTML=`<h3>☁️ 学习数据同步</h3><div class="mastered-progress"><b id="masteredTotal">0 / ${TOTAL}</b><span id="masteredPercent">0.0%</span><div class="progress-track"><i id="masteredBar"></i></div></div><p id="syncStatus" class="muted compact">正在检查登录状态…</p><div id="syncLoggedOut"><input id="syncEmail" type="email" autocomplete="email" placeholder="输入邮箱"><button class="btn primary" id="sendMagic" type="button">发送登录链接</button></div><div id="syncLoggedIn" hidden><span id="syncUser"></span><button class="btn" id="syncNow" type="button">立即同步</button><button class="btn" id="syncOut" type="button">退出登录</button></div>`;dash.appendChild(box);
 document.getElementById('sendMagic').onclick=async()=>{const email=document.getElementById('syncEmail').value.trim();if(!email)return setStatus('请先输入邮箱');setStatus('正在发送…');const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:'https://yoilni.github.io/kaoyan-english/'}});setStatus(error?`发送失败：${error.message}`:'登录链接已发送，请检查邮箱')};
 document.getElementById('syncNow').onclick=()=>mergeCloud().catch(e=>setStatus(`同步失败：${e.message}`));
 document.getElementById('syncOut').onclick=()=>sb.auth.signOut();
}
function authUI(){const a=document.getElementById('syncLoggedOut'),b=document.getElementById('syncLoggedIn'),u=document.getElementById('syncUser');if(!a)return;a.hidden=!!user;b.hidden=!user;if(user){u.textContent=user.email||'已登录';setStatus('正在同步…');mergeCloud().catch(e=>setStatus(`同步失败：${e.message}`))}else setStatus('未登录 · 掌握状态保存在本机')}
async function init(){refresh();installLongPress();addUI();try{const lib=await loadLib();sb=lib.createClient(SUPABASE_URL,SUPABASE_KEY);const {data}=await sb.auth.getSession();user=data.session?.user||null;authUI();sb.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setTimeout(authUI,0)})}catch(e){setStatus('云同步暂不可用，本机学习不受影响')}}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();