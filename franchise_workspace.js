/*   Stage 5 franchise workspace: compact groups and Xano-backed personal/shared editor*/
(()=>{'use strict';
const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT',token=localStorage.getItem('ads_journey_token');if(!token)return;
const $=id=>document.getElementById(id),column=document.querySelector('.journey-column[data-stage="enrollment"]');
if(!column||!$('franchiseWorkspace'))return;
const tabs={franchises:$('franchiseWorkspaceTab'),enrollment:$('enrollmentWorkspaceTab')};
const panels={franchises:$('franchiseWorkspace'),enrollment:$('enrollmentWorkspace')};
const overview=$('fwGroupOverview'),groupList=$('fwGroupList'),groupMessage=$('fwGroupMessage'),groupEditor=$('fwGroupEditor'),editorStatus=$('fwEditorStatus');
const authHeaders={Authorization:'Bearer '+token};
let groups=[],groupApiReady=false,canManageShared=false,activeGroupId=0,ownChange=false,busy=false,editingId=0,savingGroup=false,draftIds=new Set();
const user=(()=>{try{return JSON.parse(localStorage.getItem('ads_journey_user')||'{}')}catch(_){return {}}})();
const tabStorage='ads_journey_franchise_workspace_tab_'+(Number(user.id)||'default');
const idOf=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0;};
const franchiseIds=()=>new Set(franchises.map(f=>idOf(f.id)).filter(Boolean));
const selectedIds=()=>[...selectedFranchiseIds].filter(id=>franchiseIds().has(id)).sort((a,b)=>a-b);
const storedIds=raw=>[...new Set((Array.isArray(raw)?raw:[]).map(idOf).filter(Boolean))].sort((a,b)=>a-b);
const cleanIds=raw=>{const valid=franchiseIds();return storedIds(raw).filter(id=>valid.has(id));};
const sameIds=(one,two)=>JSON.stringify(cleanIds(one))===JSON.stringify(cleanIds(two));
const editable=g=>g&&(g.visibility==='shared'?canManageShared:idOf(g.owner_ad_user_id)===idOf(user.id));
const setGroupMessage=(message,error=false)=>{groupMessage.textContent=message;groupMessage.classList.toggle('error',Boolean(error));};
function matchingGroup(){
const chosen=selectedIds(),total=franchiseIds().size;
if(!chosen.length||chosen.length===total)return null;
const match=g=>sameIds(chosen,g.franchise_ids);
return groups.find(g=>g.id===activeGroupId&&match(g))||groups.find(match)||null;
}
function setTab(tab){
const view=tab==='enrollment'?'enrollment':'franchises';
for(const key of ['franchises','enrollment']){const on=view===key;tabs[key].setAttribute('aria-selected',String(on));panels[key].hidden=!on;}
localStorage.setItem(tabStorage,view);
}
function renderGroups(current){
groupList.replaceChildren();
if(!groupApiReady){const p=document.createElement('p');p.className='fw-muted';p.textContent='Unable to load saved groups. Try ↻ to refresh.';groupList.append(p);return;}
if(!groups.length){const p=document.createElement('p');p.className='fw-muted';p.textContent='No groups yet. Create your first group below.';groupList.append(p);return;}
const ordered=[...groups].sort((a,b)=>(a.visibility==='shared'?1:0)-(b.visibility==='shared'?1:0)||a.name.localeCompare(b.name));
for(const group of ordered){
const active=current?.id===group.id,btn=document.createElement('button');btn.type='button';btn.className='fw-group-item';btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));btn.disabled=busy;
const name=document.createElement('span');name.className='fw-group-name';name.textContent=group.name;
const meta=document.createElement('span');meta.className='fw-group-meta';
if(active){const mark=document.createElement('span');mark.className='fw-active-marker';mark.textContent='✓ Active';meta.append(mark);}
if(group.visibility==='shared'){const badge=document.createElement('span');badge.className='fw-sharing';badge.textContent='Shared';meta.append(badge);}
const count=document.createElement('span');count.className='fw-group-count';count.textContent=String(cleanIds(group.franchise_ids).length);meta.append(count);
btn.append(name,meta);btn.addEventListener('click',()=>{activeGroupId=group.id;applySelection(group.franchise_ids,'saved_group');});groupList.append(btn);
}
}
function renderSelections(){
const total=franchiseIds().size,chosen=selectedIds(),isAll=total>0&&chosen.length===total,current=matchingGroup();
$('fwAllCount').textContent=String(total);
$('fwAllFranchises').classList.toggle('active',isAll);
$('fwAllFranchises').setAttribute('aria-pressed',String(isAll));
$('fwAllFranchises').disabled=busy;
$('fwAllFranchises').querySelector('.fw-active-marker').hidden=!isAll;
$('fwSaveGroup').disabled=!groupApiReady||busy;
$('fwUpdateGroup').hidden=!groupApiReady||!current||!editable(current);
$('fwUpdateGroup').disabled=busy||!current||!editable(current);
if(!isAll&&!current){setGroupMessage(chosen.length+' of '+total+' locations selected · Custom selection');}
else if(groupMessage.dataset.custom==='true'){setGroupMessage('');}
groupMessage.dataset.custom=String(!isAll&&!current);
renderGroups(current);
if(!groupEditor.hidden)renderEditorFranchises();
}
function renderEditorFranchises(){
if(groupEditor.hidden)return;
const valid=franchiseIds(),selected=[...draftIds].filter(id=>valid.has(id));
$('fwCheckedCount').textContent=selected.length+' of '+valid.size+' selected';
const list=$('fwFranchiseList'),scroll=list.scrollTop,needle=$('fwSearch').value.trim().toLowerCase();list.replaceChildren();
const items=[...franchises].sort((a,b)=>franchiseName(a).localeCompare(franchiseName(b),undefined,{sensitivity:'base',numeric:true})).filter(f=>franchiseName(f).toLowerCase().includes(needle));
if(!items.length){const empty=document.createElement('div');empty.className='fw-no-results';empty.textContent='No matching franchises.';list.append(empty);return;}
for(const f of items){
const id=idOf(f.id),label=document.createElement('label');label.className='fw-franchise-row';label.classList.toggle('checked',draftIds.has(id));
const input=document.createElement('input');input.type='checkbox';input.checked=draftIds.has(id);input.disabled=savingGroup;
input.addEventListener('change',()=>{if(input.checked)draftIds.add(id);else draftIds.delete(id);label.classList.toggle('checked',input.checked);$('fwCheckedCount').textContent=cleanIds([...draftIds]).length+' of '+valid.size+' selected';editorStatus.textContent='';});
const name=document.createElement('span');name.textContent=franchiseName(f);label.append(input,name);list.append(label);
}
list.scrollTop=scroll;
}
async function applySelection(ids,source){
if(busy||!franchises.length)return;
busy=true;
ownChange=true;
try{selectedFranchiseIds=new Set(cleanIds(ids));saveSelection();renderFranchiseList();updateFilterLabel();syncUsageFranchiseSelection(source);}
finally{ownChange=false;}
renderSelections();
try{await loadBoard();}
finally{busy=false;renderSelections();}
}
function openEditor(group=null){
if(!groupApiReady||busy)return;
editingId=group?.id||0;draftIds=new Set(group?cleanIds(group.franchise_ids):[]);
$('fwEditorHeading').textContent=group?'Edit Group':'Create Group';
$('fwGroupName').value=group?.name||'';$('fwIsShared').checked=group?.visibility==='shared';
$('fwSharedChoice').hidden=!canManageShared;
$('fwConfirmSave').textContent=group?'Save Changes':'Save Group';
$('fwSearch').value='';editorStatus.textContent='';
overview.hidden=true;groupEditor.hidden=false;renderEditorFranchises();$('fwGroupName').focus();
}
function closeEditor(){
groupEditor.hidden=true;overview.hidden=false;editingId=0;draftIds=new Set();editorStatus.textContent='';renderSelections();
}
async function loadGroups(){
try{
const response=await fetch(API+'/ad_franchise_groups',{headers:authHeaders,cache:'no-store'});
if(!response.ok)throw Error('Group API unavailable');
const data=await response.json(),rows=Array.isArray(data.groups)?data.groups:(Array.isArray(data.items)?data.items:null);
if(!rows)throw Error('Invalid group response');
canManageShared=data.can_manage_shared===true;
groups=rows.map(g=>({id:idOf(g.id),name:String(g.name||'Unnamed group'),visibility:g.visibility==='shared'?'shared':'personal',franchise_ids:storedIds(g.franchise_ids),owner_ad_user_id:idOf(g.owner_ad_user_id||g.created_by_ad_user_id)})).filter(g=>g.id);
groupApiReady=true;setGroupMessage('');
}catch(_){groupApiReady=false;setGroupMessage('Could not load groups. Click ↻ to retry.',true);}
renderSelections();
}
tabs.franchises.addEventListener('click',()=>setTab('franchises'));
tabs.enrollment.addEventListener('click',()=>setTab('enrollment'));
$('fwAllFranchises').addEventListener('click',()=>{activeGroupId=0;applySelection([...franchiseIds()],'workspace_all');});
$('fwReloadGroups').addEventListener('click',loadGroups);
$('fwSaveGroup').addEventListener('click',()=>openEditor());
$('fwUpdateGroup').addEventListener('click',()=>openEditor(matchingGroup()));
$('fwSearch').addEventListener('input',renderEditorFranchises);
$('fwSelectAll').addEventListener('click',()=>{draftIds=franchiseIds();renderEditorFranchises();});
$('fwClearAll').addEventListener('click',()=>{draftIds.clear();renderEditorFranchises();});
$('fwCancelEditor').addEventListener('click',closeEditor);
groupEditor.addEventListener('submit',async event=>{
event.preventDefault();if(!groupApiReady||busy||savingGroup)return;
const name=$('fwGroupName').value.trim(),ids=cleanIds([...draftIds]);
if(!name||!ids.length){editorStatus.textContent='Enter a name and select at least one franchise.';return;}
const visibility=canManageShared&&$('fwIsShared').checked?'shared':'personal',save=$('fwConfirmSave');savingGroup=true;save.disabled=true;editorStatus.textContent='Saving group…';
try{
const res=await fetch(API+'/ad_franchise_group_save',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({id:editingId||0,name,visibility,franchise_ids:ids})});
const data=await res.json().catch(()=>({}));
if(!res.ok||data.error||data.success===false)throw Error(data.message||data.error||'Unable to save group');
const newId=idOf(data.group?.id||data.id||editingId);
await loadGroups();
if(!groupApiReady)throw Error('Group saved, but the group list did not refresh. Click ↻ to reload.');
activeGroupId=newId||groups.find(g=>g.name===name&&g.visibility===visibility)?.id||0;
closeEditor();setGroupMessage('Group saved.');await applySelection(ids,'saved_group');
}catch(error){editorStatus.textContent=String(error.message||'Unable to save group');}
finally{savingGroup=false;save.disabled=false;}
});
window.addEventListener('ads-journey-franchise-filter-changed',()=>{if(!ownChange)activeGroupId=0;renderSelections();});
window.addEventListener('journey-sync-refresh',()=>{if(franchises.length)renderSelections();});
setTab(localStorage.getItem(tabStorage)||'franchises');renderSelections();loadGroups();
})();