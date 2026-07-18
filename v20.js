/* Daily Plate v2.0 - average calories and swipeable macro targets */
const V20_VERSION='2.1';
let v20MacroSlide=0;

function v20RingColour(percent,totalLogged){
  if(totalLogged===0)return '#A7AEA9';
  if(percent>=100)return '#31D158';
  if(percent>=80)return '#FFD60A';
  return '#FF3B30';
}
function v20MacroStats(days,key,target){
  const logged=days.filter(x=>x.cal>0);
  const met=logged.filter(x=>(Number(x[key])||0)>=target).length;
  const percent=logged.length?Math.round(met/logged.length*100):0;
  return {met,total:logged.length,percent,colour:v20RingColour(percent,logged.length)};
}
function v20MacroSlideMarkup(name,stats,index){
  return `<section class="macro-swipe-slide" data-slide="${index}" aria-label="${name} target"><div class="macro-target-name">${name}</div><div class="macro-target-ring" style="--macro-percent:${Math.min(100,stats.percent)};--macro-colour:${stats.colour}"><div><strong>${stats.percent}%</strong></div></div><div class="macro-target-days"><b>${stats.met} of ${stats.total} days</b><span>Target met</span></div></section>`;
}
function v20GoToMacro(index){
  const viewport=document.getElementById('macro-swipe-viewport');
  if(!viewport)return;
  v20MacroSlide=Math.max(0,Math.min(2,index));
  viewport.scrollTo({left:viewport.clientWidth*v20MacroSlide,behavior:'smooth'});
  v20UpdateDots(v20MacroSlide);
}
function v20UpdateDots(index){
  document.querySelectorAll('.macro-page-dot').forEach((dot,i)=>dot.classList.toggle('active',i===index));
}
function v20MacroScrolled(){
  const viewport=document.getElementById('macro-swipe-viewport');
  if(!viewport||!viewport.clientWidth)return;
  v20MacroSlide=Math.max(0,Math.min(2,Math.round(viewport.scrollLeft/viewport.clientWidth)));
  v20UpdateDots(v20MacroSlide);
}
function renderHome(){
  if(!STATE.profile)return;
  v13RefreshEntries();
  const days=v14Days(30),logged=days.filter(x=>x.cal>0),averageCalories=logged.length?logged.reduce((sum,x)=>sum+x.cal,0)/logged.length:0,targets=v14Targets();
  const protein=v20MacroStats(days,'p',targets.p),carbs=v20MacroStats(days,'c',targets.c),fat=v20MacroStats(days,'f',targets.f);
  document.getElementById('home-greeting').textContent='Hello, '+STATE.profile.name;
  document.getElementById('home-dashboard').innerHTML=`<div class="card overview-card"><h3>Calorie Count</h3><div class="overview-scroll" id="overview-scroll"><div class="overview-track">${days.map(x=>{const pct=targets.cal?Math.min(120,x.cal/targets.cal*100):0;return `<div class="overview-day"><div class="overview-cal">${x.cal?Math.round(x.cal):'—'}</div><div class="overview-bar-wrap"><i class="${pct>100?'over':''}" style="height:${Math.max(3,pct*.7)}px"></i></div><b>${x.d.toLocaleDateString(undefined,{weekday:'narrow'})}</b><small>${x.d.getDate()}</small></div>`}).join('')}</div></div></div><div class="home-target-pair"><div class="card home-half-card calorie-average-card"><h3>30 Day Average</h3><div class="average-calorie-value"><svg class="average-fire-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 2.2c.5 3.2-1 4.6-2.3 6-1.1 1.2-2.1 2.4-1.8 4.4.1.7.5 1.4 1.2 1.9-.1-1.6.7-2.8 1.8-3.9.2 2.5 2.6 3.3 2.6 6 0 2.2-1.7 4-4.2 4-3.1 0-5.4-2.2-5.4-5.2 0-3.9 2.8-6 5.1-8.3 1.3-1.3 2.4-2.7 3-4.9Z" fill="currentColor"/><path d="M15.2 9.2c2.1 1.9 3.5 4 3.5 6.5 0 3.4-2.7 6.1-6.4 6.1 1.8-.9 2.8-2.6 2.8-4.6 0-2.1-1.2-3.3-2.1-4.4.9-.9 1.7-2 2.2-3.6Z" fill="currentColor" opacity=".72"/></svg><strong>${Math.round(averageCalories)}</strong><span>kcal</span></div></div><div class="card home-half-card macro-targets-card"><h3>Macro Targets</h3><div class="macro-swipe-viewport" id="macro-swipe-viewport" onscroll="v20MacroScrolled()"><div class="macro-swipe-track">${v20MacroSlideMarkup('Protein',protein,0)}${v20MacroSlideMarkup('Carbs',carbs,1)}${v20MacroSlideMarkup('Fat',fat,2)}</div></div><div class="macro-page-dots" aria-label="Macro slides"><button class="macro-page-dot active" onclick="v20GoToMacro(0)" aria-label="Protein"></button><button class="macro-page-dot" onclick="v20GoToMacro(1)" aria-label="Carbs"></button><button class="macro-page-dot" onclick="v20GoToMacro(2)" aria-label="Fat"></button></div></div></div>`;
  requestAnimationFrame(()=>{const overview=document.getElementById('overview-scroll');if(overview)overview.scrollLeft=overview.scrollWidth;const macro=document.getElementById('macro-swipe-viewport');if(macro)macro.scrollLeft=macro.clientWidth*v20MacroSlide;});
}
const v20BaseProfile=renderProfileScreen;
renderProfileScreen=function(){
  v20BaseProfile();
  const h=document.getElementById('dp-profile-extra');
  if(h)h.innerHTML=`<div class="card"><h3>App information</h3><p><b>Daily Plate v${V20_VERSION}</b><br><span class="helper">Schema 5 · Local-first · Installable PWA</span></p></div>`;
};
function v20Init(){document.title='Daily Plate v2.1';if(STATE.profile){renderHome();renderProfileScreen();}}
window.addEventListener('load',()=>setTimeout(v20Init,360));
