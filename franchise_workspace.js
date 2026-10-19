/*   Stage 5 franchise workspace: quick filtering and Xano-backed personal/shared groups*/
(()=>{'use strict';
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT',token=localStorage.getItem('ads_journey_token');if(!token)return;
const $=id=>document.getElementById(id),column=document.querySelector('.journey-column[data-stage="enrollment"]');
if(!column||!$('franchiseWorkspace'))return;
const tabs={franchises:$('franchiseWorkspaceTab'),enrollment:$('enrollmentWorkspaceTab')};
const panels={franchises:$('franchiseWorkspace'),enrollment:$('enrollmentWorkspace')};
const groupList=$('fwGroupList'),groupMessage=$('fwGroupMessage'),groupEditor=$('fwGroupEditor'),editorStatus=$('fwEditorStatus');
const authHeaders={Authorization:'Bearer '+token};
let groups=[],groupApiReady=false,canManageShared=false,activeGroupId=0,ownChange=false,busy=false,editingId=0;
const user=(()=>{try{return JSON.parse(localStorage.getItem('ads_journey_user')||'{}')}catch(_){return {}}})();
const tabStorage='ads_journey_franchise_workspace_tab_'+(Number(user.id)||'default');
const idOf=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0;};
const franchiseIds=()=>new Set(franchises.map(f=>idOf(f.id)).filter(Boolean));
const selectedIds=()=>[...selectedFranchiseIds].filter(id=>franchiseIds().has(id)).sort((a,b)=>a-b);
const cleanIds=raw=>{const valid=franchiseIds();return [...new Set((Array.isArray(raw)?raw:[]).map(idOf).filter(id=>valid.has(id)))].sort((a,b)=>a-b)};
const sameIds=(one,two)=>JSON.stringify(cleanIds(one))===JSON.stringify(cleanIds(two));
const selectedGroup=()=>groups.find(g=>g.id===activeGroupId)||null;
const editable=g=>g&&(g.visibility==='shared'?canManageShared:idOf(g.owner_ad_user_id||g.created_by_ad_user_id)===idOf(user.id));
const setGroupMessage=(message,error=false)=>{groupMessage.textContent=message;groupMessage.classList.toggle('error',Boolean(error));};
function setTab(tab){
const view=tab==='enrollment'?'enrollment':'franchises';
for(const key of ['franchises','enrollment']){const on=view===key;tabs[key].setAttribute('aria-selected',String(on));panels[key].hidden=!on;}
localStorage.setItem(tabStorage,view);
}
function renderGroups(){
groupList.replaceChildren();
if(!groupApiReady){const text=document.createElement('p');text.className='fw-muted';text.textContent='Saved groups will appear when their Xano endpoints are connected.';groupList.append(text);return;}
if(!groups.length){const text=document.createElement('p');text.className='fw-muted';text.textContent='No groups yet. Select locations, then save your first group.';groupList.append(text);return;}
for(const group of [...groups].sort((a,b)=>(a.visibility==='shared'?1:0)-(b.visibility==='shared'?1:0)||a.name.localeCompare(b.name))){
const btn=document.createElement('button');btn.type='button';btn.className='fw-group-item';
const isActive=activeGroupId===group.id&&sameIds(selectedIds(),group.franchise_ids);
btn.classList.toggle('active',isActive);
const name=document.createElement('span');name.textContent=group.name;
const meta=document.createElement('div');meta.className='fw-group-meta';
if(group.visibility==='shared'){const badge=document.createElement('span');badge.className='fw-sharing';badge.textContent='Shared';meta.append(badge);}
const count=document.createElement('span');count.className='fw-group-count';count.textContent=String(cleanIds(group.franchise_ids).length);meta.append(count);
btn.append(name,meta);btn.addEventListener('click',()=>{activeGroupId=group.id;applySelection(group.franchise_ids,'saved_group');});groupList.append(btn);
}
}
function renderSelections(){
const total=franchiseIds().size,chosen=selectedIds(),group=selectedGroup();
const isAll=total>0&&chosen.length===total,matchingGroup=group&&sameIds(chosen,group.franchise_ids);
$('fwActiveSelection').textContent=isAll?'All Franchises':matchingGroup?group.name:group?'Custom selection · '+group.name:'Custom selection';
$('fwActiveCount').textContent=chosen.length+' of '+total+' franchises selected';
$('fwCheckedCount').textContent=String(chosen.length)+' selected';$('fwAllCount').textContent=String(total);
$('fwAllFranchises').classList.toggle('active',isAll);
$('fwSaveGroup').disabled=!groupApiReady||busy||chosen.length===0;
$('fwUpdateGroup').hidden=!groupApiReady||!group||!editable(group);
$('fwUpdateGroup').disabled=!groupApiReady||busy||!group||!editable(group);
renderGroups();
const list=$('fwFranchiseList'),needle=$('fwSearch').value.trim().toLowerCase();list.replaceChildren();
const items=[...franchises].sort((a,b)=>franchiseName(a).localeCompare(franchiseName(b),undefined,{sensitivity:'base',numeric:true})).filter(f=>franchiseName(f).toLowerCase().includes(needle));
if(!items.length){const empty=document.createElement('div');empty.className='fw-no-results';empty.textContent='No matching franchises.';list.append(empty);return;}
for(const f of items){
const id=idOf(f.id),label=document.createElement('label');label.className='fw-franchise-row';label.classList.toggle('checked',selectedFranchiseIds.has(id));
const input=document.createElement('input');input.type='checkbox';input.checked=selectedFranchiseIds.has(id);input.disabled=busy;
input.addEventListener('change',()=>{const next=new Set(selectedFranchiseIds);if(input.checked)next.add(id);else next.delete(id);applySelection([...next],'workspace_checkbox',id,input.checked);});
const name=document.createElement('span');name.textContent=franchiseName(f);label.append(input,name);list.append(label);
}
}
async function applySelection(ids,source,id=null,checked=null){
if(busy||!franchises.length)return;
ownChange=true;selectedFranchiseIds=new Set(cleanIds(ids));saveSelection();renderFranchiseList();updateFilterLabel();syncUsageFranchiseSelection(source,id,checked);ownChange=false;
busy=true;renderSelections();
try{await loadBoard();}finally{busy=false;renderSelections();}
}
function openEditor(group=null){
if(!groupApiReady)return;editingId=group?.id||0;
$('fwGroupName').value=group?.name||'';$('fwIsShared').checked=group?.visibility==='shared';
$('fwSharedChoice').hidden=!canManageShared;
$('fwConfirmSave').textContent=group?'Save Changes':'Save Group';
editorStatus.textContent='';groupEditor.hidden=false;$('fwGroupName').focus();
}
async function loadGroups(){
try{
const response=await fetch(API+'/ad_franchise_groups',{headers:authHeaders,cache:'no-store'});
if(!response.ok)throw Error('Group API unavailable');
const data=await response.json();
const rows=Array.isArray(data.groups)?data.groups:(Array.isArray(data.items)?data.items:null);
if(!rows)throw Error('Invalid group response');
canManageShared=data.can_manage_shared===true;
groups=rows.map(g=>({id:idOf(g.id),name:String(g.name||'Unnamed group'),visibility:g.visibility==='shared'?'shared':'personal',franchise_ids:cleanIds(g.franchise_ids),owner_ad_user_id:idOf(g.owner_ad_user_id||g.created_by_ad_user_id)})).filter(g=>g.id);
groupApiReady=true;setGroupMessage('');
}catch(_){groupApiReady=false;groups=[];activeGroupId=0;setGroupMessage('Saved groups require the Xano group endpoints. Individual franchise selection works now.');}
renderSelections();
}
tabs.franchises.addEventListener('click',()=>setTab('franchises'));
tabs.enrollment.addEventListener('click',()=>setTab('enrollment'));
$('fwAllFranchises').addEventListener('click',()=>{activeGroupId=0;applySelection([...franchiseIds()],'workspace_all');});
$('fwSearch').addEventListener('input',renderSelections);
$('fwReloadGroups').addEventListener('click',loadGroups);
$('fwSaveGroup').addEventListener('click',()=>openEditor());
$('fwUpdateGroup').addEventListener('click',()=>openEditor(selectedGroup()));
$('fwCancelEditor').addEventListener('click',()=>{groupEditor.hidden=true;editingId=0;});
groupEditor.addEventListener('submit',async event=>{
event.preventDefault();if(!groupApiReady||busy)return;
const name=$('fwGroupName').value.trim(),ids=selectedIds();
if(!name||!ids.length){editorStatus.textContent='Choose a name and at least one franchise.';return;}
const visibility=canManageShared&&$('fwIsShared').checked?'shared':'personal',save=$('fwConfirmSave');save.disabled=true;editorStatus.textContent='Saving group…';
try{
const res=await fetch(API+'/ad_franchise_group_save',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({id:editingId||0,name,visibility,franchise_ids:ids})});
const data=await res.json().catch(()=>({}));
if(!res.ok||data.error||data.success===false)throw Error(data.message||data.error||'Unable to save group');
const newId=idOf(data.group?.id||data.id||editingId);
await loadGroups();
activeGroupId=newId||groups.find(g=>g.name===name&&g.visibility===visibility)?.id||0;
groupEditor.hidden=true;editingId=0;setGroupMessage('Group saved.');renderSelections();
}catch(error){editorStatus.textContent=String(error.message||'Unable to save group');}
finally{save.disabled=false;}
});
window.addEventListener('ads-journey-franchise-filter-changed',()=>{if(!ownChange)activeGroupId=0;renderSelections();});
window.addEventListener('journey-sync-refresh',()=>{if(franchises.length)renderSelections();});
setTab(localStorage.getItem(tabStorage)||'franchises');
renderSelections();
loadGroups();
})();