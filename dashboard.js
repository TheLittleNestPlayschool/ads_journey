const API_BASE_URL='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
const ME_ENDPOINT='/ad_journey_me';
const FRANCHISE_ENDPOINT='/ad_franchises';
const TOKEN_KEY='ads_journey_token';
const USER_KEY='ads_journey_user';
const FILTER_KEY='ads_journey_franchise_filter';
const token=localStorage.getItem(TOKEN_KEY);
if(!token)window.location.replace('index.html');
const userName=document.getElementById('userName');
const logoutButton=document.getElementById('logoutButton');
const franchiseFilterButton=document.getElementById('franchiseFilterButton');
const franchiseFilterPanel=document.getElementById('franchiseFilterPanel');
const closeFranchiseFilter=document.getElementById('closeFranchiseFilter');
const franchiseSearch=document.getElementById('franchiseSearch');
const franchiseCheckboxList=document.getElementById('franchiseCheckboxList');
const selectAllFranchises=document.getElementById('selectAllFranchises');
const clearAllFranchises=document.getElementById('clearAllFranchises');
let franchises=[];
let selectedFranchiseIds=new Set();
start();
async function start(){await validateLogin();await loadFranchises();}
async function validateLogin(){try{const response=await fetch(`${API_BASE_URL}${ME_ENDPOINT}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('AUTH_FAILED');const data=await response.json();const user=data.ad_user||data.user||data;localStorage.setItem(USER_KEY,JSON.stringify(user));userName.textContent=user.name||user.email||'Admin';}catch(error){logout();}}
async function loadFranchises(){try{const response=await fetch(`${API_BASE_URL}${FRANCHISE_ENDPOINT}`,{headers:{Authorization:`Bearer ${token}`}});if(response.status===401){logout();return}if(!response.ok)throw new Error('Unable to load franchises.');const data=await response.json();franchises=Array.isArray(data)?data:(data.items||data.records||data.franchise||data.franchises||[]);restoreSelection();renderFranchiseList();updateFilterLabel();}catch(error){franchiseCheckboxList.innerHTML='<p class="filter-error">Unable to load franchise locations.</p>';}}
function restoreSelection(){const saved=JSON.parse(localStorage.getItem(FILTER_KEY)||'null');if(Array.isArray(saved)&&saved.length)selectedFranchiseIds=new Set(saved.map(Number));else selectedFranchiseIds=new Set(franchises.map(item=>Number(item.id)));}
function renderFranchiseList(search=''){const query=search.trim().toLowerCase();franchiseCheckboxList.innerHTML='';franchises.filter(item=>franchiseName(item).toLowerCase().includes(query)).forEach(item=>{const id=Number(item.id);const label=document.createElement('label');label.className='checkbox-item';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedFranchiseIds.has(id);checkbox.addEventListener('change',()=>{if(checkbox.checked)selectedFranchiseIds.add(id);else selectedFranchiseIds.delete(id);saveSelection();updateFilterLabel();});const span=document.createElement('span');span.textContent=franchiseName(item);label.append(checkbox,span);franchiseCheckboxList.appendChild(label);});}
function franchiseName(item){return item.location||item.name||item.franchise_name||item.branch_name||`Branch ${item.id}`;}
function saveSelection(){localStorage.setItem(FILTER_KEY,JSON.stringify([...selectedFranchiseIds]));}
function updateFilterLabel(){const total=franchises.length;const selected=selectedFranchiseIds.size;let text='Franchises: ';if(!total)text+='No Locations';else if(selected===total)text+=`All ${total}`;else if(selected===0)text+='None';else text+=`${selected} selected`;franchiseFilterButton.firstChild.textContent=`${text} `;}
function openFilter(){franchiseFilterPanel.hidden=false;franchiseSearch.focus();}
function closeFilter(){franchiseFilterPanel.hidden=true;franchiseSearch.value='';renderFranchiseList();}
franchiseFilterButton.addEventListener('click',()=>franchiseFilterPanel.hidden?openFilter():closeFilter());
closeFranchiseFilter.addEventListener('click',closeFilter);
franchiseSearch.addEventListener('input',()=>renderFranchiseList(franchiseSearch.value));
selectAllFranchises.addEventListener('click',()=>{selectedFranchiseIds=new Set(franchises.map(item=>Number(item.id)));saveSelection();renderFranchiseList(franchiseSearch.value);updateFilterLabel();});
clearAllFranchises.addEventListener('click',()=>{selectedFranchiseIds.clear();saveSelection();renderFranchiseList(franchiseSearch.value);updateFilterLabel();});
document.addEventListener('click',event=>{if(!franchiseFilterPanel.hidden&&!event.target.closest('.filter-wrap'))closeFilter();});
document.querySelectorAll('.date-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.date-tab').forEach(item=>item.classList.remove('active'));button.classList.add('active');}));
document.querySelectorAll('.tab-row').forEach(row=>row.querySelectorAll('.small-tab').forEach(button=>button.addEventListener('click',()=>{row.querySelectorAll('.small-tab').forEach(item=>item.classList.remove('active'));button.classList.add('active');})));
logoutButton.addEventListener('click',logout);
function logout(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);window.location.replace('index.html');}
