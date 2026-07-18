/* Daily Plate v1.7 - monthly History calendar and serving labels */
const V17_VERSION='1.9',V17_KJ_PER_KCAL=4.184;
let v17IngredientEnergySource='kcal',v17CalendarMonth=null,v17DeferredInstallPrompt=null;
const v17BaseToday=renderToday,v17BaseIngredients=renderIngredientLibrary,v17BaseOpenIngredient=openIngredientEditor,v17BaseSaveIngredient=saveIngredientEditor,v17BaseProfile=renderProfileScreen,v17BaseNutrition=dpNutrition;
function v17DateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function v17Round(v){return Math.round((Number(v)||0)*10)/10}
function v17Set(id,v){const e=document.getElementById(id);if(e)e.value=v>0?v17Round(v):''}
function v17SyncIngredientEnergy(source){v17IngredientEnergySource=source;if(source==='kj'){const j=Number(document.getElementById('ie-kj').value)||0;v17Set('ie-cal',j/V17_KJ_PER_KCAL)}else{const k=Number(document.getElementById('ie-cal').value)||0;v17Set('ie-kj',k*V17_KJ_PER_KCAL)}}
function v17HasLog(key){const d=STATE.logs&&STATE.logs[key];return !!(d&&MEALS.some(m=>(d[m.key]||[]).length))}
function v17ShiftMonth(delta){if(!v17CalendarMonth)v17CalendarMonth=new Date();v17CalendarMonth=new Date(v17CalendarMonth.getFullYear(),v17CalendarMonth.getMonth()+delta,1);renderLog()}
function v17SelectCalendarDate(key){if(key>tomorrowKey())return;viewingLogDate=key;v14EditDayAuthorized=false;logEditMode=false;v14LastLogDate=key;const d=keyToDate(key);v17CalendarMonth=new Date(d.getFullYear(),d.getMonth(),1);renderLog()}
function v17RenderCalendar(){
 const host=document.getElementById('day-strip');if(!host)return;
 const selected=viewingLogDate||todayKey(),selectedDate=keyToDate(selected);
 if(!v17CalendarMonth)v17CalendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);
 const y=v17CalendarMonth.getFullYear(),m=v17CalendarMonth.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7;
 const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 let cells='';for(let i=0;i<offset;i++)cells+='<div class="month-day blank" aria-hidden="true"></div>';
 for(let day=1;day<=days;day++){const d=new Date(y,m,day),key=v17DateKey(d),future=key>tomorrowKey(),today=key===todayKey(),tomorrow=key===tomorrowKey(),active=key===selected,logged=v17HasLog(key);cells+=`<button class="month-day${active?' active':''}${today?' today':''}${tomorrow?' tomorrow':''}${future?' disabled':''}" ${future?'disabled':''} onclick="v17SelectCalendarDate('${key}')" aria-label="${d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}"><span>${day}</span>${logged?'<i class="log-dot"></i>':''}</button>`}
 host.className='month-calendar-wrap';host.innerHTML=`<div class="month-nav"><button onclick="v17ShiftMonth(-1)" aria-label="Previous month">‹</button><strong>${first.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button onclick="v17ShiftMonth(1)" aria-label="Next month">›</button></div><div class="month-weekdays">${labels.map(x=>`<span>${x}</span>`).join('')}</div><div class="month-grid">${cells}</div>`;
}
renderLog=function(){
 const key=viewingLogDate||todayKey();if(v14LastLogDate!==key){v14EditDayAuthorized=false;logEditMode=false;v14LastLogDate=key}
 v13RefreshEntries();v17RenderCalendar();
 const d=keyToDate(key),isToday=key===todayKey(),isTomorrow=key===tomorrowKey();
 let title=fmtDateLong(key);if(isToday)title+=' (today)';else if(isTomorrow)title+=' (tomorrow)';else title+=' (closed)';
 const titleEl=document.getElementById('log-day-title');if(titleEl)titleEl.textContent=title;
 document.getElementById('log-daily-summary')?.remove();if(titleEl)titleEl.insertAdjacentHTML('afterend',`<div id="log-daily-summary" class="log-daily-summary">${v14LogSummary(key)}</div>`);
 const edit=document.getElementById('log-edit-btn');if(isToday){v14EditDayAuthorized=false;logEditMode=false;edit.style.display='none'}else{edit.style.display='';edit.classList.toggle('active',v14EditDayAuthorized);edit.innerHTML=v14EditDayAuthorized?'Done Editing':'Edit Day'}
 v17RenderLogDay(key);
};
function v17RenderLogDay(key){
 const host=document.getElementById('log-day-detail'),day=getDayLog(key),isToday=key===todayKey(),editable=!isToday&&v14EditDayAuthorized;host.innerHTML='';
 MEALS.forEach(m=>{const entries=day[m.key]||[],card=document.createElement('div');card.className='card meal-card';card.innerHTML=`<div class="meal-head"><div class="left"><div class="meal-icon">${m.icon}</div><div><div class="meal-name">${m.name}</div><div class="meal-cals">${Math.round(entries.reduce((a,e)=>a+dpNutrition(e).cal,0))} kcal</div></div></div>${editable?`<button class="add-btn" onclick="openAddSheet('${m.key}','${key}')">+</button>`:''}</div><div class="entry-list">${entries.length?entries.map((raw,n)=>{const e=dpNutrition(raw);return `<div class="entry ${editable?'entry-editable':''}" ${editable?`onclick="v14OpenEdit('${key}','${m.key}',${n})"`:''}><div><div class="ename">${dpEscape(e.name)}</div><div class="emeta">${e.grams}${e.unit||'g'} · P${Math.round(e.p)} C${Math.round(e.c)} F${Math.round(e.f)}</div></div><div class="eright"><div class="ecal">${Math.round(e.cal)}</div>${editable?`<button class="edel" onclick="event.stopPropagation();v14Delete('${key}','${m.key}',${n})">✕</button>`:''}</div></div>`}).join(''):`<div class="empty-hint">${editable?'Tap + to add food':'Nothing logged'}</div>`}</div>`;host.appendChild(card)})
}
renderLogDayDetail=v17RenderLogDay;
function v17Progress(label,value,target,color,unit){const pct=target?Math.round(value/target*100):0,cap=Math.max(0,Math.min(100,pct));return `<div class="home-progress-row"><div class="home-progress-head"><span>${label}</span><b>${Math.round(value)}${unit} <small>/ ${Math.round(target)}${unit}</small></b></div><div class="home-progress-track"><i style="width:${cap}%;background:${color}"></i></div><div class="home-progress-pct">${pct}% of target</div></div>`}
renderHome=function(){if(!STATE.profile)return;v13RefreshEntries();const days=v14Days(30),logged=days.filter(x=>x.cal>0),avg=k=>logged.length?logged.reduce((a,x)=>a+x[k],0)/logged.length:0,t=v14Targets();document.getElementById('home-greeting').textContent='Hello, '+STATE.profile.name;document.getElementById('home-dashboard').innerHTML=`<div class="card overview-card"><h3>Calorie Count</h3><div class="overview-scroll" id="overview-scroll"><div class="overview-track">${days.map(x=>{const pct=t.cal?Math.min(120,x.cal/t.cal*100):0;return `<div class="overview-day"><div class="overview-cal">${x.cal?Math.round(x.cal):'—'}</div><div class="overview-bar-wrap"><i class="${pct>100?'over':''}" style="height:${Math.max(3,pct*.7)}px"></i></div><b>${x.d.toLocaleDateString(undefined,{weekday:'narrow'})}</b><small>${x.d.getDate()}</small></div>`}).join('')}</div></div></div><div class="card home-progress-card"><h3>Macros Target</h3><p class="home-progress-note">Based on ${logged.length} logged day${logged.length===1?'':'s'}</p>${v17Progress('Calories',avg('cal'),t.cal,'#E8643A',' kcal')}${v17Progress('Protein',avg('p'),t.p,'#7FA37E','g')}${v17Progress('Carbs',avg('c'),t.c,'#C9A227','g')}${v17Progress('Fat',avg('f'),t.f,'#2F6F8F','g')}</div>`;requestAnimationFrame(()=>{const s=document.getElementById('overview-scroll');if(s)s.scrollLeft=s.scrollWidth})};
renderToday=function(){v17BaseToday();const q=document.getElementById('dp-today-extra');if(q)q.innerHTML='';document.querySelectorAll('#screen-today .macro-pill').forEach(x=>x.classList.add('macro-capsule'))};
renderIngredientLibrary=function(){v17BaseIngredients();document.querySelectorAll('#ingredient-library .fav-btn').forEach(x=>x.remove())};
openIngredientEditor=function(id){v17BaseOpenIngredient(id);v17IngredientEnergySource='kcal';const ing=id?findIngredient(id):null,k=Number(document.getElementById('ie-cal').value)||0;v17Set('ie-kj',k*V17_KJ_PER_KCAL);document.getElementById('ie-serving-label').value=ing?.servingLabel||''};
saveIngredientEditor=function(){
 if(v17IngredientEnergySource==='kj'){const j=Number(document.getElementById('ie-kj').value)||0;document.getElementById('ie-cal').value=j?j/V17_KJ_PER_KCAL:0}
 const id=activeEditingIngredientId,label=document.getElementById('ie-serving-label').value.trim();v17BaseSaveIngredient();
 const saved=id?findIngredient(id):STATE.customIngredients[STATE.customIngredients.length-1];if(saved){saved.servingLabel=label;saved.fiber=0;saved.sodium=0;if(label){saved.uw=Number(saved.defaultServing)||100;saved.unit=label}else{delete saved.uw;delete saved.unit}}
 STATE.customIngredients.forEach(i=>{i.fiber=0;i.sodium=0});Object.values(STATE.logs||{}).forEach(day=>MEALS.forEach(m=>(day[m.key]||[]).forEach(e=>{delete e.fiber;delete e.sodium})));save();
};
dpNutrition=function(e){const n=v17BaseNutrition(e);if(n){delete n.fiber;delete n.sodium}return n};
const v17BaseOpenQty=openQtySheet;
openQtySheet=function(id){v17BaseOpenQty(id);const ing=findIngredient(id),label=ing?.servingLabel?.trim(),wrap=document.getElementById('qty-serving-label-info')||document.createElement('div');wrap.id='qty-serving-label-info';wrap.className='serving-label-info';wrap.innerHTML=label?`<b>Serving option</b><span>1 ${dpEscape(label)} = ${Math.round(ing.defaultServing||100)}${ing.isLiquid?'ml':'g'}</span><small>Use the count controls or manually enter g/ml.</small>`:'';const count=document.getElementById('qty-count-mode');if(label&&ing.defaultServing){ing.uw=ing.defaultServing;ing.unit=label;qtyMode='count';qtyCount=1;document.getElementById('qty-count-mode').style.display='';document.getElementById('qty-gram-mode').style.display='none';document.getElementById('qty-count-unit').textContent=label;document.getElementById('qty-count-grams-hint').textContent='= '+Math.round(ing.defaultServing)+(ing.isLiquid?'ml':'g')}if(wrap.parentNode==null)document.getElementById('qty-ing-name').parentElement.parentElement.insertBefore(wrap,count);wrap.style.display=label?'':'none';updateQtyPreview()};
renderProfileScreen=function(){v17BaseProfile();const h=document.getElementById('dp-profile-extra');if(h)h.innerHTML=`<div class="card"><h3>App information</h3><p><b>Daily Plate v${V17_VERSION}</b><br><span class="helper">Schema 5 · Local-first · Installable PWA</span></p></div>`};
function v17Migrate(){STATE.favourites=[];INGREDIENTS.forEach(i=>{delete i.fiber;delete i.sodium});STATE.customIngredients.forEach(i=>{i.fiber=0;i.sodium=0});Object.values(STATE.logs||{}).forEach(day=>MEALS.forEach(m=>(day[m.key]||[]).forEach(e=>{delete e.fiber;delete e.sodium})));save()}
function v17Init(){document.title='Daily Plate v1.9';v17Migrate();document.querySelectorAll('.fav-btn').forEach(x=>x.remove());if(STATE.profile){renderHome();renderToday();renderIngredientLibrary();renderProfileScreen();renderLog()}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();v17DeferredInstallPrompt=e});
window.addEventListener('load',()=>setTimeout(v17Init,250));
