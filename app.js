const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];

const FEED_JSON = './data/rfi.json';
const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.82';
const PRIMARY_MODEL = 'Qwen3-1.7B-q4f16_1-MLC';
const FALLBACK_MODEL = 'Qwen3-0.6B-q4f16_1-MLC';
const STORE_KEY = 'french-zero-v1';

const defaultState = {
  lessons: {}, vocab: [], corrections: [], practiceDays: [], liveTurns: [],
  expectedSpeaker: 'them', examTask: 't2', currentEpisodeId: null
};
let state = loadState();
let episodes = [];
let currentEpisode = null;
let aiEngine = null;
let aiLoading = false;
let aiModel = null;

function loadState(){
  try { return {...defaultState, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}')}; }
  catch { return structuredClone(defaultState); }
}
function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); refreshProgress(); }
function markPractice(){ const d = new Date().toISOString().slice(0,10); if(!state.practiceDays.includes(d)){state.practiceDays.push(d);saveState();} }
function esc(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stripHtml(s=''){ const div=document.createElement('div'); div.innerHTML=s; return div.textContent || div.innerText || ''; }
function lessonKey(){ return currentEpisode?.id || currentEpisode?.guid || currentEpisode?.link || currentEpisode?.title || 'unknown'; }
function getLesson(){ const k=lessonKey(); state.lessons[k] ||= {}; return state.lessons[k]; }
function setOutput(el, text){ el.textContent=text; el.classList.remove('empty'); }
function todayLabel(date){ try{return new Intl.DateTimeFormat('en-CA',{dateStyle:'medium'}).format(new Date(date));}catch{return date||'';} }

// Navigation
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
function go(name){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  $$('.bottom-nav [data-go]').forEach(b=>b.classList.toggle('active',b.dataset.go===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='rfi' && !episodes.length) loadRfi();
  if(name==='progress') refreshProgress();
}

// PWA
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

// AI
async function ensureAI(){
  if(aiEngine) return aiEngine;
  if(aiLoading) throw new Error('AI is still loading.');
  if(!('gpu' in navigator)) throw new Error('This browser does not expose WebGPU. Use Safari on current iOS or a recent desktop browser.');
  aiLoading=true; setAiStatus('Loading AI…','warn'); $('#ai-progress-wrap').classList.remove('hidden');
  try{
    const webllm = await import(WEBLLM_URL);
    const onProgress = p => {
      const n = Math.max(0,Math.min(1,Number(p.progress||0)));
      $('#ai-progress-bar').style.width=`${Math.round(n*100)}%`;
      $('#ai-progress-text').textContent=p.text || `Downloading local AI ${Math.round(n*100)}%`;
    };
    for(const model of [PRIMARY_MODEL,FALLBACK_MODEL]){
      try{
        aiEngine = await webllm.CreateMLCEngine(model,{initProgressCallback:onProgress});
        aiModel=model; setAiStatus(model.includes('1.7B')?'AI ready · 1.7B':'AI ready · Lite','good');
        $('#ai-progress-text').textContent='Ready. The model now runs locally in this browser.';
        return aiEngine;
      }catch(err){ console.warn('Model failed',model,err); aiEngine=null; }
    }
    throw new Error('The local AI could not fit in this browser. The rest of the app still works.');
  } finally { aiLoading=false; }
}
function setAiStatus(text,kind='neutral'){ const el=$('#ai-pill'); el.textContent=text; el.className=`pill ${kind}`; }
$('#wake-ai').addEventListener('click',async()=>{ const b=$('#wake-ai'); b.disabled=true; try{await ensureAI();}catch(e){alert(e.message);setAiStatus('AI unavailable','warn');}finally{b.disabled=false;} });

const tutorSystem = `You are French Zero, a strict but encouraging French tutor specialized in TCF Canada and TEF Canada, targeting B2.
Rules:
- Explain important grammar briefly in English, but keep French examples in French.
- Prefer natural reusable B1-B2 structures over rare C1/C2 vocabulary.
- Never invent facts about an RFI story beyond the text/topic supplied.
- When correcting, preserve the learner's intended meaning.
- For a correction: show "YOU SAID", "CORRECTED", brief "WHY", then a more natural "B2 VERSION", then 1-3 reusable PATTERNS.
- For speaking/exam evaluation, be realistic, not flattering. Focus on grammar, fluency, connectors, vocabulary, argument development, examples, counterargument, conclusion.
- During a simulation, do not correct until the learner explicitly finishes.
- For live conversation cues, give only: a one-line English meaning of the last other-person turn, then the FIRST FIVE FRENCH WORDS of a natural reply plus a short clue. Do not give the entire reply unless asked.
- Avoid markdown tables. Keep output compact and readable on a phone.`;

async function askAI(task, userText, button=null){
  if(button) button.disabled=true;
  try{
    const engine=await ensureAI();
    const response=await engine.chat.completions.create({
      messages:[{role:'system',content:tutorSystem},{role:'user',content:`TASK: ${task}\n\n${userText}`}],
      temperature:0.45, top_p:0.9, max_tokens:700
    });
    markPractice();
    return response.choices?.[0]?.message?.content?.trim() || 'No response generated.';
  }catch(e){
    console.error(e);
    return fallbackTutor(task,userText,e);
  }finally{ if(button) button.disabled=false; }
}
function fallbackTutor(task,text,err){
  const topic=(currentEpisode?.title||'ce sujet').split('/')[0].trim();
  if(task.includes('exam question')) return `Selon vous, quel impact ${topic.toLowerCase()} peut-il avoir sur la société ? Donnez votre opinion, des arguments, un exemple et une conclusion.`;
  if(task.includes('live cue')) return `AI local unavailable. Use a reusable opener: « Je comprends. Pour ma part… »\nClue: acknowledge → opinion → follow-up question.`;
  if(task.includes('structures')) return `AI local unavailable. Practice these reusable B2 structures:\n\n• À mon avis, …\n• Il me semble que …\n• En raison de + nom…\n• D'une part…, d'autre part…\n• Cependant, il faut également considérer que…\n• En conclusion, je dirais que…`;
  return `Local AI is unavailable in this browser, so I cannot give reliable free-form correction here. Your answer is saved. You can still continue the lesson and use the built-in reusable structures.\n\nTechnical note: ${err?.message||'model unavailable'}`;
}
function rememberCorrection(type,text){
  if(!text || text.startsWith('Local AI is unavailable')) return;
  state.corrections.unshift({date:new Date().toISOString(),type,text}); state.corrections=state.corrections.slice(0,40); saveState();
}

// RFI
async function loadRfi(){
  const status=$('#rfi-status'); status.textContent='Loading RFI episodes…';
  try{
    const r=await fetch(`${FEED_JSON}?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('feed unavailable');
    const data=await r.json(); episodes=data.episodes||[];
    if(!episodes.length) throw new Error('No episodes cached yet. Run the GitHub Action once.');
    status.classList.add('hidden'); renderEpisodes();
  }catch(e){ status.textContent=`RFI list is not populated yet: ${e.message}`; }
}
function renderEpisodes(){
  const list=$('#episode-list'); list.innerHTML='';
  episodes.slice(0,20).forEach((ep,i)=>{
    const d=document.createElement('article'); d.className='episode';
    d.innerHTML=`<div class="meta">${esc(todayLabel(ep.pubDate))}${i===0?' · LATEST':''}</div><h3>${esc(ep.title)}</h3><div class="meta">${esc(ep.duration||'~10 min')}</div>`;
    d.addEventListener('click',()=>openEpisode(ep)); list.appendChild(d);
  });
}
function openEpisode(ep){
  currentEpisode=ep; state.currentEpisodeId=ep.id; saveState();
  $('#episode-list').classList.add('hidden'); $('#rfi-status').classList.add('hidden'); $('#lesson').classList.remove('hidden');
  $('#lesson-title').textContent=ep.title; $('#lesson-date').textContent=todayLabel(ep.pubDate);
  const official = ep.officialUrl || ep.link || 'https://francaisfacile.rfi.fr/fr/podcasts/journal-en-francais-facile/';
  $('#listen-on-rfi').href=official;
  $('#open-rfi').href=official;
  const l=getLesson(); $('#listen-notes').value=l.listenNotes||''; $('#read-text').value=l.readText||''; $('#write-answer').value=l.writeAnswer||''; $('#speak-answer').value=l.speakAnswer||''; $('#lesson-exam-answer').value=l.examAnswer||'';
  showStage('listen'); markPractice();
}
$('#back-episodes').addEventListener('click',()=>{ $('#lesson').classList.add('hidden');$('#episode-list').classList.remove('hidden'); });
$('#refresh-rfi').addEventListener('click',loadRfi);
$$('#stage-tabs [data-stage]').forEach(b=>b.addEventListener('click',()=>showStage(b.dataset.stage)));
$$('[data-next-stage]').forEach(b=>b.addEventListener('click',()=>showStage(b.dataset.nextStage)));
function showStage(name){
  $$('.stage').forEach(s=>s.classList.toggle('active',s.id===`stage-${name}`));
  $$('#stage-tabs [data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===name));
  $('#stage-tabs').scrollIntoView({block:'nearest'});
}
$('#save-listen').addEventListener('click',()=>{getLesson().listenNotes=$('#listen-notes').value;saveState();markPractice();});
$('#save-read').addEventListener('click',()=>{getLesson().readText=$('#read-text').value;saveState();markPractice();});

function lessonContext(){
  const study=$('#read-text').value.trim();
  const listen=$('#listen-notes').value.trim();
  return `SOURCE: RFI — Journal en français facile (external source; French Zero is not affiliated with RFI)
EPISODE TITLE: ${currentEpisode?.title||''}
LEARNER LISTENING NOTES: ${listen||'(none)'}
LEARNER STUDY TEXT/NOTES: ${study||'(none)'}
IMPORTANT: Do not invent or reproduce the RFI article/transcript. Base teaching only on the title and learner-supplied notes/text.`;
}
$('#generate-build').addEventListener('click',async e=>{
  const out=await askAI('Extract 5 high-value B1-B2 French structures from this RFI topic. For each: meaning in simple English, grammar pattern, two French variations, then one short drill prompt. Do not claim details not present.',lessonContext(),e.currentTarget);
  setOutput($('#build-output'),out); getLesson().buildOutput=out; saveState();
});
$('#correct-writing').addEventListener('click',async e=>{
  const ans=$('#write-answer').value.trim(); if(!ans)return alert('Write your summary first.'); getLesson().writeAnswer=ans;saveState();
  const out=await askAI('Correct this written French for TCF/TEF B2. Be line-by-line where useful. Also say whether the summary is understandable and give a concise B2 rewrite.',`${lessonContext()}\n\nLEARNER WRITING:\n${ans}`,e.currentTarget);
  setOutput($('#write-output'),out); rememberCorrection('RFI writing',out);
});
$('#clear-speak').addEventListener('click',()=>$('#speak-answer').value='');
$('#correct-speaking').addEventListener('click',async e=>{
  const ans=$('#speak-answer').value.trim();if(!ans)return alert('Speak or type your answer first.');getLesson().speakAnswer=ans;saveState();
  const out=await askAI('The learner has FINISHED speaking. Correct the transcript line by line, then give feedback on grammar, fluency wording, connectors and vocabulary, and a natural B2 version.',`${lessonContext()}\n\nSPEECH TRANSCRIPT:\n${ans}`,e.currentTarget);
  setOutput($('#speak-output'),out);rememberCorrection('RFI speaking',out);
});
$('#generate-exam').addEventListener('click',async e=>{
  const out=await askAI('Generate ONE realistic TCF Canada Tâche 3 or TEF oral opinion question inspired by this topic. The question must be general enough to answer without knowing the news story. Output only the French question.',lessonContext(),e.currentTarget);
  setOutput($('#lesson-exam-question'),out);getLesson().examQuestion=out;saveState();
});
$('#finish-lesson-exam').addEventListener('click',async e=>{
  const ans=$('#lesson-exam-answer').value.trim();if(!ans)return alert('Give your answer first.');getLesson().examAnswer=ans;saveState();
  const q=$('#lesson-exam-question').textContent;
  const out=await askAI('The learner explicitly FINISHED the exam answer. Give realistic TCF/TEF B2 feedback: line-by-line corrections, grammar, fluency, connectors, vocabulary, argument development, example/counterargument/conclusion, approximate performance, then a more natural B2 version.',`QUESTION:\n${q}\n\nANSWER TRANSCRIPT:\n${ans}`,e.currentTarget);
  setOutput($('#lesson-exam-output'),out);rememberCorrection('RFI exam',out);getLesson().completed=true;saveState();
});

// Speech recognition
$$('[data-speech-target]').forEach(button=>button.addEventListener('click',()=>toggleSpeech(button)));
function toggleSpeech(button){
  if(button._recognizer){ try{button._recognizer.stop();}catch{} return; }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return alert('Speech recognition is not available in this browser. You can type the transcript instead.');
  const targetId=button.dataset.speechTarget;
  const target=document.getElementById(targetId);
  const rec=new SR(); button._recognizer=rec;
  rec.lang='fr-FR'; rec.continuous=true; rec.interimResults=true;
  const base=target.value.trim(); let finalText='';
  button.dataset.idleLabel=button.dataset.idleLabel||button.textContent;
  button.textContent='■ Stop'; button.classList.add('danger');
  rec.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=t+' '; else interim+=t;
    }
    target.value=[base,finalText.trim(),interim.trim()].filter(Boolean).join(' ');
  };
  const cleanup=()=>{
    button._recognizer=null; button.textContent=button.dataset.idleLabel; button.classList.remove('danger'); markPractice();
  };
  rec.onend=cleanup; rec.onerror=cleanup;
  try{rec.start();}catch(e){cleanup();alert('Microphone could not start. Check Safari microphone permission.');}
}

// Live coach
function updateExpected(){ $('#expected-speaker').textContent=`Waiting for ${state.expectedSpeaker==='them'?'THEM':'ME'}`; $$('#starter button').forEach(b=>b.classList.toggle('active',b.dataset.starter===state.expectedSpeaker)); }
$('#starter').addEventListener('click',e=>{const b=e.target.closest('[data-starter]');if(!b)return;state.expectedSpeaker=b.dataset.starter;saveState();updateExpected();});
$('#reverse-speaker').addEventListener('click',()=>{state.expectedSpeaker=state.expectedSpeaker==='them'?'me':'them';saveState();updateExpected();});
$('#fix-last-speaker').addEventListener('click',()=>{const t=state.liveTurns.at(-1);if(!t)return;t.speaker=t.speaker==='them'?'me':'them';saveState();renderTurns();});
$('#clear-live').addEventListener('click',()=>{if(!confirm('Clear this live conversation?'))return;state.liveTurns=[];saveState();renderTurns();});
$('#add-live-turn').addEventListener('click',()=>{const text=$('#live-input').value.trim();if(!text)return;state.liveTurns.push({speaker:state.expectedSpeaker,text});state.expectedSpeaker=state.expectedSpeaker==='them'?'me':'them';$('#live-input').value='';saveState();renderTurns();updateExpected();markPractice();});
function renderTurns(){const box=$('#live-turns');box.innerHTML='';state.liveTurns.forEach(t=>{const d=document.createElement('div');d.className=`turn ${t.speaker}`;d.innerHTML=`<small>${t.speaker==='them'?'THEM':'ME'}</small>${esc(t.text)}`;box.appendChild(d);});box.scrollTop=box.scrollHeight;}
function liveTranscript(){return state.liveTurns.map(t=>`${t.speaker==='them'?'THEM':'ME'}: ${t.text}`).join('\n');}
$('#live-cue').addEventListener('click',async e=>{const out=await askAI('live cue. It is the learner\'s conversation assistant. Based on the transcript, give a brief English meaning of the latest THEM turn, then ONLY the first five French words of what the learner could say next, plus a tiny clue. No correction.',`EXPECTED NEXT SPEAKER: ${state.expectedSpeaker}\nTRANSCRIPT:\n${liveTranscript()||'(empty)'}`,e.currentTarget);setOutput($('#live-cue-output'),out);});
$('#finish-live').addEventListener('click',async e=>{if(!state.liveTurns.length)return alert('Add the conversation first.');const out=await askAI('The learner says the live conversation is FINISHED. Correct only the learner (ME) turns line by line. Show what they said, corrected version, brief important mistake, then useful patterns to reuse.',liveTranscript(),e.currentTarget);setOutput($('#live-correction'),out);rememberCorrection('Live conversation',out);});

// Standalone exam
$('#exam-task').addEventListener('click',e=>{const b=e.target.closest('[data-task]');if(!b)return;state.examTask=b.dataset.task;saveState();$$('#exam-task button').forEach(x=>x.classList.toggle('active',x===b));});
$('#new-exam-topic').addEventListener('click',async e=>{
  const task=state.examTask;
  const instruction=task==='t2'?'Generate ONE realistic TCF Canada Tâche 2 situation. The learner must ask the examiner questions to obtain information. Include only the situation and role, no model questions or answers.':'Generate ONE realistic TCF Canada Tâche 3 opinion question suitable for about 4 minutes. Output only the question in French.';
  const out=await askAI(instruction,'Choose a common contemporary everyday topic. Do not reuse any context from the previous answer.',e.currentTarget);setOutput($('#exam-question'),out);$('#exam-answer').value='';$('#exam-output').textContent='No corrections until you press “I’m finished”.';$('#exam-output').classList.add('empty');
});
$('#finish-exam').addEventListener('click',async e=>{
  const ans=$('#exam-answer').value.trim();if(!ans)return alert('Give your answer/conversation transcript first.');const q=$('#exam-question').textContent;
  const task=state.examTask==='t2'?'TCF Tâche 2':'TCF Tâche 3';
  const out=await askAI(`The learner explicitly FINISHED a ${task} simulation. Correct sentence by sentence/line by line. Show what was said, corrected version, and brief important mistakes. Then give a realistic approximate TCF/B2 assessment. For Tâche 3 also assess connectors, vocabulary, argument development, examples, counterargument and conclusion, then show a more natural B2 version.`,`TASK: ${task}\nPROMPT: ${q}\nLEARNER TRANSCRIPT:\n${ans}`,e.currentTarget);
  setOutput($('#exam-output'),out);rememberCorrection(task,out);markPractice();
});

// Progress
function refreshProgress(){
  $('#stat-lessons').textContent=Object.values(state.lessons).filter(x=>x.completed).length;
  $('#stat-vocab').textContent=state.vocab.length;$('#stat-mistakes').textContent=state.corrections.length;$('#stat-streak').textContent=state.practiceDays.length;
  $('#vocab-store').value=state.vocab.join('\n');
  const h=$('#mistake-history');h.innerHTML=''; if(!state.corrections.length)h.innerHTML='<p class="muted">No saved corrections yet.</p>';
  state.corrections.slice(0,12).forEach(c=>{const d=document.createElement('div');d.className='history-item';d.textContent=`${todayLabel(c.date)} · ${c.type}\n\n${c.text}`;h.appendChild(d);});
}
$('#save-vocab').addEventListener('click',()=>{state.vocab=$('#vocab-store').value.split('\n').map(x=>x.trim()).filter(Boolean);saveState();});
$('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`french-zero-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('#reset-data').addEventListener('click',()=>{if(!confirm('Delete all French Zero data stored on this device?'))return;localStorage.removeItem(STORE_KEY);state=structuredClone(defaultState);renderTurns();updateExpected();refreshProgress();});

renderTurns();updateExpected();refreshProgress();
