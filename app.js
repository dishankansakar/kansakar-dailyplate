/* ===================== Daily Plate — app logic ===================== */

const MEALS = [
  {key:'breakfast', name:'Breakfast', icon:'🥐'},
  {key:'lunch', name:'Lunch', icon:'🥗'},
  {key:'dinner', name:'Dinner', icon:'🍲'},
  {key:'snacks', name:'Snacks', icon:'🍎'},
];

let STATE = {
  profile: null,
  customIngredients: [],
  deletedBuiltins: [],
  logs: {}, // dateKey -> { breakfast:[{id,name,grams,cal,p,c,f,sugar}], lunch:[...], ... }
};

let activeMealKey = null;
let activeIngredientForQty = null;
let activeEditingIngredientId = null;
let viewingLogDate = null;
let logEditMode = false;
let editingLogDate = null; // null = today; set = past day being edited

/* ---------- persistence ---------- */
function save(){ localStorage.setItem('dp_state', JSON.stringify(STATE)); }
function load(){
  const raw = localStorage.getItem('dp_state');
  if(raw){ STATE = JSON.parse(raw); if(!STATE.customIngredients) STATE.customIngredients=[]; if(!STATE.deletedBuiltins) STATE.deletedBuiltins=[]; if(!STATE.logs) STATE.logs={}; }
}

/* ---------- date helpers (this is what makes the daily log "close" at midnight) ---------- */
function todayKey(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function keyToDate(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
function fmtDateLong(k){
  return keyToDate(k).toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'});
}
function getDayLog(key){
  if(!STATE.logs[key]) STATE.logs[key] = {breakfast:[],lunch:[],dinner:[],snacks:[]};
  return STATE.logs[key];
}

/* ---------- ingredient library (built-in + custom, minus deletions) ---------- */
function allIngredients(){
  const builtins = INGREDIENTS
    .map((ing,i)=>({...ing, id:'b'+i}))
    .filter(ing=>!STATE.deletedBuiltins.includes(ing.id));
  return [...STATE.customIngredients, ...builtins];
}
function findIngredient(id){ return allIngredients().find(i=>i.id===id); }

/* ---------- nutrition math ---------- */
function calcBMR(p){
  const base = 10*p.weight + 6.25*p.height - 5*p.age;
  return p.sex==='male' ? base+5 : base-161;
}
function calcTDEE(p){ return calcBMR(p)*parseFloat(p.activity); }
function calcCalorieTarget(p){
  if(p.customCalTarget) return p.customCalTarget;
  const tdee = calcTDEE(p);
  if(p.goal==='lose') return Math.round(tdee-500);
  if(p.goal==='gain') return Math.round(tdee+300);
  return Math.round(tdee);
}
function calcProteinTarget(p){
  if(p.proteinTarget) return p.proteinTarget;
  return Math.round(p.weight*1.6);
}
function calcBMI(p){ return p.weight/((p.height/100)**2); }

/* ---------- navigation ---------- */
function goTo(screenId){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}
function switchTab(screenId){
  goTo(screenId);
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===screenId));
  if(screenId==='screen-today') renderToday();
  if(screenId==='screen-log') renderLog();
  if(screenId==='screen-ingredients') renderIngredientLibrary();
  if(screenId==='screen-profile') renderProfileScreen();
}
function openSheet(id){ document.getElementById(id).classList.add('active'); }
function closeSheet(id){ document.getElementById(id).classList.remove('active'); }
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ---------- onboarding ---------- */
function completeSetup(){
  const name = document.getElementById('su-name').value.trim() || 'Friend';
  const age = parseFloat(document.getElementById('su-age').value);
  const sex = document.getElementById('su-sex').value;
  const height = parseFloat(document.getElementById('su-height').value);
  const weight = parseFloat(document.getElementById('su-weight').value);
  const activity = document.getElementById('su-activity').value;
  const goal = document.getElementById('su-goal').value;
  const proteinInput = parseFloat(document.getElementById('su-protein').value);

  if(!age||!height||!weight){ toast('Please fill in age, height and weight'); return; }

  STATE.profile = {
    name, age, sex, height, weight, activity, goal,
    proteinTarget: proteinInput || null,
    customCalTarget: null,
  };
  save();
  initMainApp();
}

/* ---------- TODAY screen ---------- */
function renderToday(){
  if(!STATE.profile) return;
  const key = todayKey();
  const log = getDayLog(key);
  document.getElementById('today-date').textContent = fmtDateLong(key).toUpperCase();
  document.getElementById('today-greeting').textContent = 'Hello, '+STATE.profile.name;

  let totals = {cal:0,p:0,c:0,f:0};
  MEALS.forEach(m=>{
    (log[m.key]||[]).forEach(e=>{ totals.cal+=e.cal; totals.p+=e.p; totals.c+=e.c; totals.f+=e.f; });
  });

  const calTarget = calcCalorieTarget(STATE.profile);
  const proteinTarget = calcProteinTarget(STATE.profile);
  const carbTarget = Math.round((calTarget*0.45)/4);
  const fatTarget = Math.round((calTarget*0.27)/9);

  const remaining = Math.max(calTarget-totals.cal, 0);
  document.getElementById('cal-eaten-sub').textContent = Math.round(totals.cal);
  document.getElementById('cal-remaining-sub').textContent = Math.round(remaining) + ' remaining';
  document.getElementById('cal-target-sub').textContent = `of ${calTarget} target`;

  const circumference = 603;
  const pct = Math.min(totals.cal/calTarget,1);
  document.getElementById('ring-progress').setAttribute('stroke-dashoffset', circumference*(1-pct));
  const ring = document.getElementById('ring-progress');
  ring.setAttribute('stroke', totals.cal>calTarget ? '#E8643A' : '#E8643A');

  setPill('protein', totals.p, proteinTarget);
  setPill('carb', totals.c, carbTarget);
  setPill('fat', totals.f, fatTarget);

  renderMealsContainer(log, key);
}
function setPill(name, val, target){
  document.getElementById('pv-'+name).textContent = Math.round(val)+'g';
  document.getElementById('pb-'+name).style.width = Math.min((val/target)*100,100)+'%';
  document.getElementById('pt-'+name).textContent = 'of '+target+'g';
}

function renderMealsContainer(log, dayKey, editable=true){
  const isToday = dayKey === todayKey();
  // Today screen always uses meals-container; log screen uses log-day-detail
  const container = document.getElementById(isToday ? 'meals-container' : 'log-day-detail');
  container.innerHTML = '';
  MEALS.forEach(m=>{
    const entries = log[m.key]||[];
    const mealCal = entries.reduce((a,e)=>a+e.cal,0);
    const card = document.createElement('div');
    card.className = 'card meal-card';
    card.innerHTML = `
      <div class="meal-head">
        <div class="left">
          <div class="meal-icon">${m.icon}</div>
          <div><div class="meal-name">${m.name}</div><div class="meal-cals">${Math.round(mealCal)} kcal</div></div>
        </div>
        ${editable ? `<button class="add-btn" onclick="openAddSheet('${m.key}','${isToday?'':dayKey}')">+</button>` : ''}
      </div>
      <div class="entry-list">
        ${entries.length===0 ? `<div class="empty-hint">${editable?'Tap + to add food':'Nothing logged'}</div>` : entries.map((e,idx)=>`
          <div class="entry">
            <div>
              <div class="ename">${e.name}</div>
              <div class="emeta">${e.grams}${e.unit||'g'} · P${Math.round(e.p)} C${Math.round(e.c)} F${Math.round(e.f)}</div>
            </div>
            <div class="eright">
              <div class="ecal">${Math.round(e.cal)}</div>
              ${editable ? `<button class="edel" onclick="deleteEntry('${dayKey}','${m.key}',${idx})">✕</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });
}

function deleteEntry(dayKey, mealKey, idx){
  STATE.logs[dayKey][mealKey].splice(idx,1);
  save();
  if(dayKey===todayKey()) renderToday(); else renderLogDayDetail(dayKey);
}

/* ---------- Add-to-meal flow ---------- */

// Returns top-N ingredient names for a given meal slot, ranked by how often logged
function getFrequentItems(mealKey, n=5){
  const counts = {};
  Object.values(STATE.logs).forEach(dayLog => {
    (dayLog[mealKey] || []).forEach(entry => {
      // Normalise: strip "×N" suffix added for countable items so they group correctly
      const base = entry.name.replace(/\s×\d+(\.\d+)?$/, '').trim();
      counts[base] = (counts[base] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function openAddSheet(mealKey, targetDate){
  activeMealKey = mealKey;
  editingLogDate = targetDate || null;
  const meal = MEALS.find(m=>m.key===mealKey);
  document.getElementById('add-sheet-title').textContent = 'Add to '+meal.name;
  document.getElementById('add-search').value='';

  // Render frequent items for this specific meal slot
  const freq = getFrequentItems(mealKey, 5);
  const freqSection = document.getElementById('freq-section');
  const freqList = document.getElementById('freq-list');
  const freqDivider = document.getElementById('freq-divider');

  if(freq.length > 0){
    freqSection.style.display = '';
    freqList.innerHTML = freq.map(({name, count}) => {
      // Try to find a matching ingredient for calorie display
      const ing = allIngredients().find(i => i.name === name);
      const calHint = ing ? `${ing.cal} kcal/100g` : '';
      return `
        <div class="freq-chip" onclick="openQtySheetByName('${name.replace(/'/g,"\\'")}')">
          <div class="freq-name">${name}</div>
          <div class="freq-meta">${calHint}<span class="freq-count">${count}×</span></div>
        </div>
      `;
    }).join('');
    freqDivider.style.display = '';
  } else {
    freqSection.style.display = 'none';
    freqDivider.style.display = 'none';
  }

  renderAddSearch();
  openSheet('sheet-add');
}

function renderAddSearch(){
  const q = document.getElementById('add-search').value.toLowerCase();
  const freqSection = document.getElementById('freq-section');
  const freqDivider = document.getElementById('freq-divider');

  // Hide frequent section while actively searching
  if(q){
    freqSection.style.display = 'none';
    freqDivider.style.display = 'none';
  } else {
    const freq = getFrequentItems(activeMealKey, 5);
    freqSection.style.display = freq.length ? '' : 'none';
    freqDivider.style.display = freq.length ? '' : 'none';
  }

  const list = allIngredients().filter(i=>i.name.toLowerCase().includes(q)).slice(0,60);
  const el = document.getElementById('add-search-results');
  el.innerHTML = list.map(i=>`
    <div class="ing-row" onclick="openQtySheet('${i.id}')">
      <div><div class="iname">${i.name}</div><div class="icat">${i.cat}</div></div>
      <div class="ical">${i.cal} kcal</div>
    </div>
  `).join('') || `<div class="empty-hint">No matches — add it in the Ingredients tab</div>`;
}

// Open qty sheet by ingredient name (used by frequent chips)
function openQtySheetByName(name){
  const ing = allIngredients().find(i => i.name === name);
  if(ing){ openQtySheet(ing.id); return; }
  // If ingredient was deleted or custom, fall back to showing grams mode with a placeholder
  toast('Ingredient not found in database');
}
let qtyMode = 'count'; // 'count' or 'grams'
let qtyCount = 1;

function openQtySheet(ingId){
  activeIngredientForQty = ingId;
  const ing = findIngredient(ingId);
  document.getElementById('qty-ing-name').textContent = ing.name;
  const unit = ing.isLiquid ? 'ml' : 'g';

  if(ing.uw && !ing.isLiquid){
    // Countable solid ingredient — start in count mode
    qtyMode = 'count';
    qtyCount = 1;
    document.getElementById('qty-count-mode').style.display = '';
    document.getElementById('qty-gram-mode').style.display = 'none';
    document.getElementById('qty-count-unit').textContent = ing.unit;
    document.getElementById('qty-count-grams-hint').textContent = '= '+Math.round(ing.uw)+'g';
    document.getElementById('qty-gram-switch-wrap').innerHTML =
      `<button class="switch-mode-btn" onclick="switchQtyMode('grams')">Enter grams instead →</button>`;
  } else {
    // Weight/volume-based — show counter with correct unit
    qtyMode = 'grams';
    document.getElementById('qty-count-mode').style.display = 'none';
    document.getElementById('qty-gram-mode').style.display = '';
    document.getElementById('qty-gram-switch-wrap').innerHTML = '';
    document.getElementById('qty-gram-unit').textContent = unit;
    const defaultAmt = ing.defaultServing || (ing.isLiquid ? 240 : 100);
    document.getElementById('qty-grams').value = defaultAmt;
  }
  updateQtyPreview();
  closeSheet('sheet-add');
  openSheet('sheet-qty');
}

function switchQtyMode(mode){
  const ing = findIngredient(activeIngredientForQty);
  const unit = ing.isLiquid ? 'ml' : 'g';
  qtyMode = mode;
  if(mode === 'grams'){
    document.getElementById('qty-count-mode').style.display = 'none';
    document.getElementById('qty-gram-mode').style.display = '';
    const val = ing.uw ? Math.round(qtyCount * ing.uw) : (ing.defaultServing || (ing.isLiquid ? 240 : 100));
    document.getElementById('qty-grams').value = val;
    document.getElementById('qty-gram-unit').textContent = unit;
    document.getElementById('qty-gram-switch-wrap').innerHTML =
      ing.uw ? `<button class="switch-mode-btn" onclick="switchQtyMode('count')">← Back to ${ing.unit} count</button>` : '';
  } else {
    document.getElementById('qty-count-mode').style.display = '';
    document.getElementById('qty-gram-mode').style.display = 'none';
  }
  updateQtyPreview();
}

function changeCount(delta){
  qtyCount = Math.max(1, qtyCount + delta);
  document.getElementById('qty-count-num').textContent = qtyCount;
  updateQtyPreview();
}

function changeGrams(delta){
  const ing = findIngredient(activeIngredientForQty);
  const step = ing && ing.isLiquid ? 50 : 25;
  const input = document.getElementById('qty-grams');
  const cur = parseFloat(input.value) || 0;
  const minVal = ing && ing.isLiquid ? 50 : 25;
  input.value = Math.max(minVal, cur + (delta * step));
  updateQtyPreview();
}

function updateQtyPreview(){
  const ing = findIngredient(activeIngredientForQty);
  let g;
  if(qtyMode === 'count' && ing.uw){
    g = qtyCount * ing.uw;
    document.getElementById('qty-count-grams-hint').textContent = '= '+Math.round(g)+'g';
  } else {
    g = parseFloat(document.getElementById('qty-grams').value)||0;
  }
  const f = g/100;
  // For liquids: nutritional math is identical (100ml ≈ 100g for all tracked beverages)
  document.getElementById('qp-cal').textContent = Math.round(ing.cal*f);
  document.getElementById('qp-protein').textContent = Math.round(ing.p*f)+'g';
  document.getElementById('qp-carb').textContent = Math.round(ing.c*f)+'g';
  document.getElementById('qp-fat').textContent = Math.round(ing.f*f)+'g';
}

function confirmAddEntry(){
  const ing = findIngredient(activeIngredientForQty);
  let g;
  if(qtyMode === 'count' && ing.uw){
    g = qtyCount * ing.uw;
  } else {
    g = parseFloat(document.getElementById('qty-grams').value)||0;
  }
  if(g<=0){ toast('Enter a valid amount'); return; }
  const f = g/100;
  const unit = ing.isLiquid ? 'ml' : 'g';
  let label = ing.name;
  if(qtyMode === 'count' && ing.uw){ label = ing.name + ' ×'+ qtyCount; }
  const entry = {
    name: label, grams: Math.round(g), unit,
    cal: ing.cal*f, p: ing.p*f, c: ing.c*f, f: ing.f*f, sugar:(ing.sugar||0)*f
  };
  const key = editingLogDate || todayKey();
  getDayLog(key)[activeMealKey].push(entry);
  save();
  closeSheet('sheet-qty');
  toast('Added to '+MEALS.find(m=>m.key===activeMealKey).name);
  if(editingLogDate){ renderLogDayDetail(editingLogDate); } else { renderToday(); }
}

/* ---------- LOG / history screen ---------- */
function tomorrowKey(){
  const d = new Date(); d.setDate(d.getDate()+1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function isFutureDay(k){ return k > todayKey(); }
function isPastDay(k){ return k < todayKey(); }

function renderLog(){
  const strip = document.getElementById('day-strip');
  strip.innerHTML='';
  const today = new Date();
  const keys = [];
  // 13 days back → today → tomorrow (+1 day ahead only)
  for(let i=13;i>=-1;i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    keys.push(k);
  }
  if(!viewingLogDate) viewingLogDate = todayKey();
  // If somehow beyond 1-day future, reset to today
  if(viewingLogDate > tomorrowKey()) viewingLogDate = todayKey();

  keys.forEach(k=>{
    const d = keyToDate(k);
    const isToday = k === todayKey();
    const isTomorrow = k === tomorrowKey();
    let cls = 'day-chip';
    if(k === viewingLogDate) cls += ' active';
    if(isToday) cls += ' today';
    if(isTomorrow) cls += ' tomorrow-chip';
    const chip = document.createElement('div');
    chip.className = cls;
    chip.innerHTML = `<div class="d">${d.getDate()}</div><div>${isTomorrow ? 'tmrw' : d.toLocaleDateString(undefined,{month:'short'})}</div>`;
    chip.onclick = ()=>{
      viewingLogDate = k;
      // Auto-enter edit mode for tomorrow so user can plan ahead immediately
      logEditMode = isFutureDay(k);
      renderLog();
      // Scroll chip into view
      chip.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    };
    strip.appendChild(chip);
  });

  // Scroll to end (today/tomorrow) on first render
  strip.scrollLeft = strip.scrollWidth;

  const isToday = viewingLogDate === todayKey();
  const isTomorrow = viewingLogDate === tomorrowKey();
  const isPast = isPastDay(viewingLogDate);

  let dayLabel = fmtDateLong(viewingLogDate);
  if(isToday) dayLabel += ' (today)';
  else if(isTomorrow) dayLabel += ' (tomorrow)';
  else dayLabel += ' (closed)';
  document.getElementById('log-day-title').textContent = dayLabel;

  // Edit button: hide for today (always editable there), show for past and tomorrow
  const editBtn = document.getElementById('log-edit-btn');
  editBtn.style.display = isToday ? 'none' : '';
  editBtn.classList.toggle('active', logEditMode);

  // For tomorrow: label it "Plan ahead" instead of "Edit day"
  if(isTomorrow){
    editBtn.innerHTML = logEditMode
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Done`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg> Plan ahead`;
  } else {
    editBtn.innerHTML = logEditMode
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Done editing`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit day`;
  }

  renderLogDayDetail(viewingLogDate);
  renderWeekBar();
}

function toggleLogEdit(){
  logEditMode = !logEditMode;
  renderLog();
}
function renderLogDayDetail(dayKey){
  const log = getDayLog(dayKey);
  // Today and tomorrow are always editable in log view; past days need edit mode
  const editable = dayKey >= todayKey() ? true : logEditMode;
  renderMealsContainer(log, dayKey, editable);
}
function renderWeekBar(){
  const wb = document.getElementById('weekbar');
  wb.innerHTML='';
  const today = new Date();
  const target = STATE.profile ? calcCalorieTarget(STATE.profile) : 2000;
  let maxCal = target;
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const log = STATE.logs[k] || {breakfast:[],lunch:[],dinner:[],snacks:[]};
    let cal=0; MEALS.forEach(m=>(log[m.key]||[]).forEach(e=>cal+=e.cal));
    days.push({k,d,cal});
    if(cal>maxCal) maxCal=cal;
  }
  days.forEach(day=>{
    const isToday = day.k===todayKey();
    const hasCal = day.cal > 0;
    const h = hasCal ? Math.max((day.cal/maxCal)*76, 6) : 3;
    const overTarget = day.cal > target;
    const calLabel = hasCal ? (day.cal >= 1000 ? (day.cal/1000).toFixed(1)+'k' : Math.round(day.cal)+'') : '';
    const col = document.createElement('div');
    col.className = 'col';
    col.innerHTML = `
      <div class="bar-cal-label" style="opacity:${hasCal?1:0}">${calLabel}</div>
      <div class="bar ${overTarget?'over-target':''}" style="height:${h}px;opacity:${isToday?1:0.6}"></div>
      <div class="lbl ${isToday?'lbl-today':''}">${day.d.toLocaleDateString(undefined,{weekday:'narrow'})}</div>
    `;
    col.onclick = ()=>{ viewingLogDate=day.k; logEditMode=false; switchTab('screen-log'); };
    wb.appendChild(col);
  });
}

/* ---------- Ingredients screen ---------- */
function renderIngredientLibrary(){
  const q = (document.getElementById('ing-search').value||'').toLowerCase();
  const list = allIngredients().filter(i=>i.name.toLowerCase().includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,200);
  const el = document.getElementById('ingredient-library');
  el.innerHTML = list.map(i=>`
    <div class="ing-row" onclick="openIngredientEditor('${i.id}')">
      <div><div class="iname">${i.name}</div><div class="icat">${i.cat}${i.id.startsWith('custom')?' · custom':''}</div></div>
      <div class="ical">${i.cal} kcal</div>
    </div>
  `).join('');
}
let isLiquidToggleOn = false;

function toggleIsLiquid(){
  isLiquidToggleOn = !isLiquidToggleOn;
  const el = document.getElementById('ie-liquid-toggle');
  el.classList.toggle('on', isLiquidToggleOn);
  document.getElementById('ie-serving-unit-hint').textContent =
    isLiquidToggleOn ? 'Default ml pre-filled when adding to a meal' : 'Pre-fills when you add this to a meal';
}

function openIngredientEditor(id){
  activeEditingIngredientId = id;
  const isNew = !id;
  document.getElementById('ie-title').textContent = isNew? 'New ingredient' : 'Edit ingredient';
  document.getElementById('ie-delete-btn').style.display = isNew? 'none':'inline-flex';
  const ing = isNew ? {name:'',cat:'',cal:'',p:'',c:'',f:'',sugar:'',fiber:'',sodium:'',defaultServing:100,isLiquid:false} : findIngredient(id);
  document.getElementById('ie-name').value = ing.name;
  document.getElementById('ie-cat').value = ing.cat;
  document.getElementById('ie-cal').value = ing.cal;
  document.getElementById('ie-protein').value = ing.p;
  document.getElementById('ie-carb').value = ing.c;
  document.getElementById('ie-fat').value = ing.f;
  document.getElementById('ie-sugar').value = ing.sugar;
  document.getElementById('ie-fiber').value = ing.fiber;
  document.getElementById('ie-sodium').value = ing.sodium;
  document.getElementById('ie-default-serving').value = ing.defaultServing || (ing.uw ? Math.round(ing.uw) : (ing.isLiquid ? 240 : 100));
  isLiquidToggleOn = !!(ing.isLiquid);
  document.getElementById('ie-liquid-toggle').classList.toggle('on', isLiquidToggleOn);
  document.getElementById('ie-serving-unit-hint').textContent =
    isLiquidToggleOn ? 'Default ml pre-filled when adding to a meal' : 'Pre-fills when you add this to a meal';
  openSheet('sheet-ing-edit');
}
function saveIngredientEditor(){
  const name = document.getElementById('ie-name').value.trim();
  if(!name){ toast('Name is required'); return; }
  const data = {
    name,
    cat: document.getElementById('ie-cat').value.trim()||'Custom',
    cal: parseFloat(document.getElementById('ie-cal').value)||0,
    p: parseFloat(document.getElementById('ie-protein').value)||0,
    c: parseFloat(document.getElementById('ie-carb').value)||0,
    f: parseFloat(document.getElementById('ie-fat').value)||0,
    sugar: parseFloat(document.getElementById('ie-sugar').value)||0,
    fiber: parseFloat(document.getElementById('ie-fiber').value)||0,
    sodium: parseFloat(document.getElementById('ie-sodium').value)||0,
    defaultServing: parseFloat(document.getElementById('ie-default-serving').value)||100,
    isLiquid: isLiquidToggleOn,
  };
  if(activeEditingIngredientId && activeEditingIngredientId.startsWith('custom')){
    const idx = STATE.customIngredients.findIndex(i=>i.id===activeEditingIngredientId);
    STATE.customIngredients[idx] = {...data, id:activeEditingIngredientId};
  } else if(activeEditingIngredientId && activeEditingIngredientId.startsWith('b')){
    // editing a built-in: soft-delete the built-in, add an edited custom copy
    STATE.deletedBuiltins.push(activeEditingIngredientId);
    STATE.customIngredients.push({...data, id:'custom'+Date.now()});
  } else {
    STATE.customIngredients.push({...data, id:'custom'+Date.now()});
  }
  save();
  closeSheet('sheet-ing-edit');
  toast('Ingredient saved');
  renderIngredientLibrary();
}
function deleteIngredientEditor(){
  if(!activeEditingIngredientId) return;
  if(activeEditingIngredientId.startsWith('custom')){
    STATE.customIngredients = STATE.customIngredients.filter(i=>i.id!==activeEditingIngredientId);
  } else {
    STATE.deletedBuiltins.push(activeEditingIngredientId);
  }
  save();
  closeSheet('sheet-ing-edit');
  toast('Ingredient deleted');
  renderIngredientLibrary();
}

/* ---------- Profile screen ---------- */
function renderProfileScreen(){
  const p = STATE.profile;
  document.getElementById('profile-name').textContent = p.name+"'s profile";
  document.getElementById('pf-bmi').textContent = calcBMI(p).toFixed(1);
  document.getElementById('pf-bmr').textContent = Math.round(calcBMR(p));
  document.getElementById('pf-tdee').textContent = Math.round(calcTDEE(p));
  document.getElementById('pf-target').textContent = calcCalorieTarget(p);

  document.getElementById('pf-edit-name').value = p.name;
  document.getElementById('pf-edit-age').value = p.age;
  document.getElementById('pf-edit-sex').value = p.sex;
  document.getElementById('pf-edit-height').value = p.height;
  document.getElementById('pf-edit-weight').value = p.weight;
  document.getElementById('pf-edit-activity').value = p.activity;
  document.getElementById('pf-edit-goal').value = p.goal;
  document.getElementById('pf-edit-caltarget').value = p.customCalTarget || '';
  document.getElementById('pf-edit-protein').value = p.proteinTarget || '';
}
function saveProfileEdits(){
  STATE.profile = {
    name: document.getElementById('pf-edit-name').value.trim()||'Friend',
    age: parseFloat(document.getElementById('pf-edit-age').value),
    sex: document.getElementById('pf-edit-sex').value,
    height: parseFloat(document.getElementById('pf-edit-height').value),
    weight: parseFloat(document.getElementById('pf-edit-weight').value),
    activity: document.getElementById('pf-edit-activity').value,
    goal: document.getElementById('pf-edit-goal').value,
    customCalTarget: parseFloat(document.getElementById('pf-edit-caltarget').value)||null,
    proteinTarget: parseFloat(document.getElementById('pf-edit-protein').value)||null,
  };
  save();
  toast('Profile updated');
  renderProfileScreen();
}
function exportData(){
  const blob = new Blob([JSON.stringify(STATE,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='daily-plate-backup.json'; a.click();
  URL.revokeObjectURL(url);
}

function importData(event){
  const file = event.target.files[0];
  if(!file){ return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      // Validate it looks like a Daily Plate backup
      if(!imported.profile && !imported.logs){
        toast('Invalid backup file'); return;
      }
      const hasExistingLogs = Object.keys(STATE.logs||{}).length > 0;
      const hasExistingCustom = (STATE.customIngredients||[]).length > 0;
      const warnMsg = (hasExistingLogs || hasExistingCustom)
        ? 'This will replace your current logs and ingredients. Are you sure?'
        : 'Import this backup? Your profile and data will be restored.';

      if(!confirm(warnMsg)){ event.target.value=''; return; }

      // Restore: merge intelligently
      if(imported.profile) STATE.profile = imported.profile;
      if(imported.logs) STATE.logs = imported.logs;
      if(imported.customIngredients) STATE.customIngredients = imported.customIngredients;
      if(imported.deletedBuiltins) STATE.deletedBuiltins = imported.deletedBuiltins;

      save();
      event.target.value = '';
      toast('✓ Data imported successfully');
      renderProfileScreen();
      renderToday();
    } catch(err){
      toast('Could not read file — check it is a valid backup');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

/* ---------- clock / midnight rollover watcher ---------- */
let lastSeenDay = todayKey();
function tickClock(){
  const now = new Date();
  document.getElementById('today-clock').textContent = now.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  const k = todayKey();
  if(k!==lastSeenDay){
    lastSeenDay = k;
    toast("New day — yesterday's log is closed");
    if(document.getElementById('screen-today').classList.contains('active')) renderToday();
  }
}

/* ---------- init ---------- */
function initMainApp(){
  document.getElementById('tabbar').style.display='flex';
  goTo('screen-today');
  renderToday();
  setInterval(tickClock, 1000*15);
  tickClock();
}

window.addEventListener('load', ()=>{
  load();
  if(STATE.profile){ initMainApp(); } else { goTo('screen-welcome'); }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    // Auto-reload page when a new SW version takes over — ensures users always
    // get fresh app files after a Netlify deploy without clearing cache manually.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  // Fix: shrink sheets when keyboard appears so results stay visible
  function handleViewportResize(){
    const activeSheet = document.querySelector('.sheet-backdrop.active .sheet');
    if(!activeSheet) return;
    const vv = window.visualViewport;
    if(!vv) return;
    // Leave a little padding above keyboard
    activeSheet.style.maxHeight = Math.floor(vv.height * 0.94) + 'px';
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
  }

  // When search input gains focus, scroll results into view after keyboard settles
  document.getElementById('add-search').addEventListener('focus', ()=>{
    setTimeout(()=>{
      document.getElementById('add-search').scrollIntoView({behavior:'smooth', block:'start'});
    }, 350);
  });
});
