/* Daily Plate v2.2 - matching hero gradient and collapsible profile details */
const V22_VERSION='2.2';
let v22ProfileDetailsOpen=false;
let v22EditCard=null;
let v22EditBody=null;

function v22SetEditDetails(open){
  if(!v22EditCard||!v22EditBody)return;
  v22ProfileDetailsOpen=!!open;
  v22EditCard.classList.toggle('profile-edit-open',v22ProfileDetailsOpen);
  v22EditBody.hidden=!v22ProfileDetailsOpen;
  const trigger=v22EditCard.querySelector('.profile-edit-toggle');
  if(trigger)trigger.setAttribute('aria-expanded',String(v22ProfileDetailsOpen));
}
function v22ToggleEditDetails(){v22SetEditDetails(!v22ProfileDetailsOpen);}
function v22PrepareProfileCard(){
  const profile=document.getElementById('screen-profile');
  if(!profile)return;
  const heading=[...profile.querySelectorAll('.card h3')].find(x=>x.textContent.trim().toLowerCase()==='edit details');
  if(!heading)return;
  const card=heading.closest('.card');
  if(!card)return;
  if(card.dataset.collapsibleReady==='1'){v22EditCard=card;v22EditBody=card.querySelector('.profile-edit-body');v22SetEditDetails(v22ProfileDetailsOpen);return;}
  card.dataset.collapsibleReady='1';
  const children=[...card.childNodes];
  const body=document.createElement('div');body.className='profile-edit-body';body.hidden=true;
  children.forEach(node=>{if(node!==heading)body.appendChild(node)});
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='profile-edit-toggle';toggle.setAttribute('aria-expanded','false');toggle.onclick=v22ToggleEditDetails;
  toggle.innerHTML='<span>Edit Details</span><svg class="profile-edit-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  heading.remove();card.prepend(toggle);card.appendChild(body);v22EditCard=card;v22EditBody=body;v22SetEditDetails(false);
}
const v22BaseRenderProfile=renderProfileScreen;
renderProfileScreen=function(){v22BaseRenderProfile();v22PrepareProfileCard();};
const v22BaseSaveProfile=saveProfileEdits;
saveProfileEdits=function(){v22BaseSaveProfile();v22PrepareProfileCard();v22SetEditDetails(false);};
function v22Init(){
  document.title='Daily Plate v2.2';
  v22PrepareProfileCard();
  if(STATE.profile)renderProfileScreen();
  const h=document.getElementById('dp-profile-extra');
  if(h)h.innerHTML='<div class="card"><h3>App information</h3><p><b>Daily Plate v'+V22_VERSION+'</b><br><span class="helper">Schema 5 · Local-first · Installable PWA</span></p></div>';
}
window.addEventListener('load',()=>setTimeout(v22Init,420));
