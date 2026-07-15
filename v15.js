/* Daily Plate v1.5 */
const V15_VERSION='1.5',V15_KJ_PER_KCAL=4.184;
let v15MealEnergyManual=false,v15IngredientEnergySource='kcal';
const v15BaseToday=renderToday,v15BaseIngredientLibrary=renderIngredientLibrary,v15BaseOpenIngredientEditor=openIngredientEditor,v15BaseSaveIngredientEditor=saveIngredientEditor,v15BaseOpenQtySheet=openQtySheet,v15BaseUpdateQtyPreview=updateQtyPreview,v15BaseConfirmAddEntry=confirmAddEntry,v15BaseDpNutrition=dpNutrition,v15BaseProfile=renderProfileScreen;
function v15RoundEnergy(v){return Math.round((Number(v)||0)*10)/10}
function v15SetValue(id,v){const e=document.getElementById(id);if(e)e.value=v>0?v15RoundEnergy(v):''}
function v15SyncIngredientEnergy(source){v15IngredientEnergySource=source;if(source==='kj'){const v=Number(document.getElementById('ie-kj').value)||0;v15SetValue('ie-cal',v/V15_KJ_PER_KCAL)}else{const v=Number(document.getElementById('ie-cal').value)||0;v15SetValue('ie-kj',v*V15_KJ_PER_KCAL)}}
function v15SyncMealEnergy(source){v15MealEnergyManual=true;if(source==='kj'){const v=Number(document.getElementById('qty-energy-kj').value)||0;v15SetValue('qty-energy-kcal',v/V15_KJ_PER_KCAL)}else{const v=Number(document.getElementById('qty-energy-kcal').value)||0;v15SetValue('qty-energy-kj',v*V15_KJ_PER_KCAL)}}
function v15CalculatedServingCalories(){const i=findIngredient(activeIngredientForQty);if(!i)return 0;const a=qtyMode==='count'&&i.uw?qtyCount*i.uw:Number(document.getElementById('qty-grams').value)||0;return i.cal*a/100}
function v15RefreshMealEnergy(){if(v15MealEnergyManual)return;const k=v15CalculatedServingCalories();v15SetValue('qty-energy-kcal',k);v15SetValue('qty-energy-kj',k*V15_KJ_PER_KCAL)}
renderToday=function(){v15BaseToday();const q=document.getElementById('dp-today-extra');if(q)q.innerHTML=''};
renderIngredientLibrary=function(){v15BaseIngredientLibrary();document.querySelectorAll('#ingredient-library .fav-btn').forEach(x=>x.remove())};
openIngredientEditor=function(id){v15BaseOpenIngredientEditor(id);v15IngredientEnergySource='kcal';const k=Number(document.getElementById('ie-cal').value)||0;v15SetValue('ie-kj',k*V15_KJ_PER_KCAL)};
saveIngredientEditor=function(){if(v15IngredientEnergySource==='kj'){const j=Number(document.getElementById('ie-kj').value)||0;document.getElementById('ie-cal').value=j?j/V15_KJ_PER_KCAL:0}v15BaseSaveIngredientEditor()};
openQtySheet=function(id){v15MealEnergyManual=false;v15BaseOpenQtySheet(id);v15RefreshMealEnergy()};
updateQtyPreview=function(){v15BaseUpdateQtyPreview();v15RefreshMealEnergy()};
dpNutrition=function(e){const n=v15BaseDpNutrition(e);return e&&e.energyOverride&&Number.isFinite(Number(e.calOverride))?{...n,cal:Number(e.calOverride),kj:Number(e.calOverride)*V15_KJ_PER_KCAL}:n};
confirmAddEntry=function(){if(!v15MealEnergyManual){v15BaseConfirmAddEntry();return}const kcal=Number(document.getElementById('qty-energy-kcal').value);if(!(kcal>=0)){toast('Enter a valid calorie or kJ value');return}const key=editingLogDate||todayKey(),meal=activeMealKey;v15BaseConfirmAddEntry();const a=STATE.logs[key]&&STATE.logs[key][meal],e=a&&a[a.length-1];if(e){e.energyOverride=true;e.calOverride=v15RoundEnergy(kcal);e.cal=v15RoundEnergy(kcal);e.kj=v15RoundEnergy(kcal*V15_KJ_PER_KCAL);e.updatedAt=new Date().toISOString();save();key===todayKey()?renderToday():renderLog();renderHome()}};
renderProfileScreen=function(){v15BaseProfile();const h=document.getElementById('dp-profile-extra');if(h)h.innerHTML=`<div class="card"><h3>App information</h3><p><b>Daily Plate v${V15_VERSION}</b><br><span class="helper">Schema 5 · Local-first · Sync-ready data model</span></p></div>`};
function v15Init(){document.title='Daily Plate v1.5';if(!Array.isArray(STATE.favourites)||STATE.favourites.length){STATE.favourites=[];save()}document.querySelectorAll('.fav-btn').forEach(x=>x.remove());if(STATE.profile){renderToday();renderIngredientLibrary();renderProfileScreen();renderHome()}}
window.addEventListener('load',()=>setTimeout(v15Init,220));
