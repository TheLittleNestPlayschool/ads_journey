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
const backFranchiseFilter=document.getElementById('backFranchiseFilter');
const franchiseSearch=document.getElementById('franchiseSearch');
const franchiseCheckboxList=document.getElementById('franchiseCheckboxList');
const selectAllFranchises=document.getElementById('selectAllFranchises');
const clearAllFranchises=document.getElementById('clearAllFranchises');
const dashboardModalBackdrop=document.getElementById('dashboardModalBackdrop');
let franchises=[];
let selectedFranchiseIds=new Set();
start();
async function start(){await validateLogin();await loadFranchises();setupDashboardModals();}
async function validateLogin(){try{const response=await fetch(`${API_BASE_URL}${ME_ENDPOINT}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('AUTH_FAILED');const data=await response.json();const user=data.ad_user||data.user||data;localStorage.setItem(USER_KEY,JSON.stringify(user));userName.textContent=user.name||user.email||'Admin';}catch(error){logout();}}
async function loadFranchises(){try{const response=await fetch(`${API_BASE_URL}${FRANCHISE_ENDPOINT}`,{headers:{Authorization:`Bearer ${token}`}});if(response.status===401){logout();return}if(!response.ok)throw new Error('Unable to load franchises.');const data=await response.json();franchises=Array.isArray(data)?data:(data.items||data.records||data.franchise||data.franchises||[]);restoreSelection();renderFranchiseList();updateFilterLabel();applyFranchiseFilter();}catch(error){franchiseCheckboxList.innerHTML='<p class="filter-error">Unable to load franchise locations.</p>';}}
function restoreSelection(){const saved=JSON.parse(localStorage.getItem(FILTER_KEY)||'null');if(Array.isArray(saved)&&saved.length)selectedFranchiseIds=new Set(saved.map(Number));else selectedFranchiseIds=new Set(franchises.map(item=>Number(item.id)));}
function renderFranchiseList(search=''){const query=search.trim().toLowerCase();franchiseCheckboxList.innerHTML='';franchises.filter(item=>franchiseName(item).toLowerCase().includes(query)).forEach(item=>{const id=Number(item.id);const label=document.createElement('label');label.className='checkbox-item';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedFranchiseIds.has(id);checkbox.addEventListener('change',()=>{if(checkbox.checked)selectedFranchiseIds.add(id);else selectedFranchiseIds.delete(id);saveSelection();updateFilterLabel();applyFranchiseFilter();});const span=document.createElement('span');span.textContent=franchiseName(item);label.append(checkbox,span);franchiseCheckboxList.appendChild(label);});}
function franchiseName(item){return item.location||item.name||item.franchise_name||item.branch_name||`Branch ${item.id}`;}
function selectedFranchiseNames(){return new Set(franchises.filter(item=>selectedFranchiseIds.has(Number(item.id))).map(franchiseName));}
function saveSelection(){localStorage.setItem(FILTER_KEY,JSON.stringify([...selectedFranchiseIds]));}
function updateFilterLabel(){const total=franchises.length;const selected=selectedFranchiseIds.size;let text='Franchises: ';if(!total)text+='No Locations';else if(selected===total)text+=`All ${total}`;else if(selected===0)text+='None';else text+=`${selected} selected`;franchiseFilterButton.firstChild.textContent=`${text} `;}
function applyFranchiseFilter(){const names=selectedFranchiseNames();document.querySelectorAll('.journey-card[data-franchise]').forEach(card=>{card.hidden=!names.has(card.dataset.franchise);});document.querySelectorAll('.journey-column').forEach(column=>{const visible=[...column.querySelectorAll('.journey-card')].filter(card=>!card.hidden).length;column.querySelector('.column-count').textContent=visible;});const visibleCards=[...document.querySelectorAll('.journey-card')].filter(card=>!card.hidden);const attention=[...document.querySelectorAll('.attention-column .journey-card')].filter(card=>!card.hidden).length;const waiting=[...document.querySelectorAll('[data-stage="waiting"] .journey-card')].filter(card=>!card.hidden).length;const summary=document.querySelectorAll('.summary-value');if(summary[0])summary[0].textContent=visibleCards.length;if(summary[1])summary[1].textContent=attention;if(summary[2])summary[2].textContent=waiting;if(summary[3])summary[3].textContent='0';filterPopupRows(names);}
function filterPopupRows(names){document.querySelectorAll('#adminActivityModal .activity-row').forEach(row=>{const location=row.querySelector('strong')?.textContent.trim();row.hidden=location?!names.has(location):false;});document.querySelectorAll('#locationPerformanceModal tbody tr').forEach(row=>{const location=row.cells[0]?.textContent.trim();row.hidden=location?!names.has(location):false;});}
function openFilter(){franchiseFilterPanel.hidden=false;franchiseSearch.focus();}
function closeFilter(){franchiseFilterPanel.hidden=true;franchiseSearch.value='';renderFranchiseList();}
franchiseFilterButton.addEventListener('click',()=>franchiseFilterPanel.hidden?openFilter():closeFilter());
closeFranchiseFilter.addEventListener('click',closeFilter);
backFranchiseFilter.addEventListener('click',closeFilter);
franchiseSearch.addEventListener('input',()=>renderFranchiseList(franchiseSearch.value));
selectAllFranchises.addEventListener('click',()=>{selectedFranchiseIds=new Set(franchises.map(item=>Number(item.id)));saveSelection();renderFranchiseList(franchiseSearch.value);updateFilterLabel();applyFranchiseFilter();});
clearAllFranchises.addEventListener('click',()=>{selectedFranchiseIds.clear();saveSelection();renderFranchiseList(franchiseSearch.value);updateFilterLabel();applyFranchiseFilter();});
document.addEventListener('click',event=>{if(!franchiseFilterPanel.hidden&&!event.target.closest('.filter-wrap'))closeFilter();});
function setupDashboardModals(){const map={adminActivityButton:'adminActivityModal',locationPerformanceButton:'locationPerformanceModal',marketingPerformanceButton:'marketingPerformanceModal'};Object.entries(map).forEach(([buttonId,modalId])=>document.getElementById(buttonId)?.addEventListener('click',()=>openDashboardModal(modalId)));document.querySelectorAll('.modal-close').forEach(button=>button.addEventListener('click',closeDashboardModals));dashboardModalBackdrop.addEventListener('click',closeDashboardModals);document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDashboardModals();});}
function openDashboardModal(id){closeFilter();document.querySelectorAll('.dashboard-modal').forEach(modal=>modal.hidden=true);const modal=document.getElementById(id);if(!modal)return;modal.hidden=false;dashboardModalBackdrop.hidden=false;}
function closeDashboardModals(){document.querySelectorAll('.dashboard-modal').forEach(modal=>modal.hidden=true);dashboardModalBackdrop.hidden=true;}
logoutButton.addEventListener('click',logout);
function logout(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);window.location.replace('index.html');}
const journeyStyle=document.createElement('link');journeyStyle.rel='stylesheet';journeyStyle.href='journey_panel.css';document.head.appendChild(journeyStyle);
const journeyScript=document.createElement('script');journeyScript.src='journey_panel.js';document.body.appendChild(journeyScript);
const inquiryStyle=document.createElement('link');inquiryStyle.rel='stylesheet';inquiryStyle.href='inquiry_modal.css';document.head.appendChild(inquiryStyle);
const inquiryScript=document.createElement('script');inquiryScript.src='inquiry_modal.js';document.body.appendChild(inquiryScript);