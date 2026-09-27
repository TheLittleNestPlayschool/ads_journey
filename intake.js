const API_BASE_URL='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
const ME_ENDPOINT='/ad_journey_me';
const CREATE_ENDPOINT='/ad_inquiry_create';
const SEARCH_ENDPOINT='/ad_inquiry_search';
const TOKEN_KEY='ads_intake_token';
const USER_KEY='ads_intake_user';
const token=localStorage.getItem(TOKEN_KEY);
if(!token)window.location.replace('intake_login.html');
const form=document.getElementById('inquiryForm');
const facebookName=document.getElementById('facebookName');
const facebookProfileUrl=document.getElementById('facebookProfileUrl');
const facebookUsername=document.getElementById('facebookUsername');
const franchiseId=document.getElementById('franchiseId');
const adId=document.getElementById('adId');
const firstMessageAt=document.getElementById('firstMessageAt');
const inquiryType=document.getElementById('inquiryType');
const initialNote=document.getElementById('initialNote');
const formMessage=document.getElementById('formMessage');
const duplicateStatus=document.getElementById('duplicateStatus');
const saveButton=document.getElementById('saveButton');
const clearButton=document.getElementById('clearButton');
const logoutButton=document.getElementById('logoutButton');
const userName=document.getElementById('userName');
let currentUser=null;
let duplicateTimer=null;
start();
async function start(){setDefaultTime();await validateLogin();}
async function validateLogin(){try{const response=await fetch(`${API_BASE_URL}${ME_ENDPOINT}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('AUTH_FAILED');const data=await response.json();currentUser=data.ad_user||data.user||data;localStorage.setItem(USER_KEY,JSON.stringify(currentUser));userName.textContent=currentUser.name||currentUser.email||'Admin';}catch(error){logout();}}
function setDefaultTime(){const now=new Date();const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);firstMessageAt.value=local.toISOString().slice(0,16);}
facebookProfileUrl.addEventListener('input',scheduleDuplicateCheck);
facebookUsername.addEventListener('input',scheduleDuplicateCheck);
clearButton.addEventListener('click',()=>{form.reset();setDefaultTime();showMessage('');duplicateStatus.textContent='No duplicate check run yet.';facebookName.focus();});
logoutButton.addEventListener('click',logout);
form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const username=facebookUsername.value.trim();const payload={facebook_name:facebookName.value.trim(),facebook_profile_url:normalizeFacebookUrl(facebookProfileUrl.value),facebook_username:username||null,franchise_id:franchiseId.value.trim(),ad_id:adId.value.trim()||null,first_message_at:new Date(firstMessageAt.value).getTime(),inquiry_type:inquiryType.value||null,initial_note:initialNote.value.trim()||null,status:'new',is_active:true,ad_user_id:currentUser?.id||null};setLoading(true);showMessage('');try{const response=await fetch(`${API_BASE_URL}${CREATE_ENDPOINT}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});const data=await response.json().catch(()=>({}));if(response.status===401){logout();return}if(!response.ok)throw new Error(data.message||data.error||'Unable to create inquiry.');const record=data.ad_inquiry||data.inquiry||data;showMessage(`Inquiry created${record?.id?` · #${record.id}`:''}.`,true);form.reset();setDefaultTime();duplicateStatus.textContent='No duplicate check run yet.';facebookName.focus();}catch(error){if(responseEndpointMissing(error))showMessage('The intake page is ready. Create the Xano ad_inquiry_create endpoint next.');else showMessage(error.message||'Unable to create inquiry.');}finally{setLoading(false);}});
function scheduleDuplicateCheck(){clearTimeout(duplicateTimer);duplicateTimer=setTimeout(checkDuplicate,500);}
async function checkDuplicate(){const username=facebookUsername.value.trim();const profileUrl=normalizeFacebookUrl(facebookProfileUrl.value);if(!username&&!profileUrl){duplicateStatus.textContent='No duplicate check run yet.';return}duplicateStatus.textContent='Checking…';try{const params=new URLSearchParams();if(username)params.set('facebook_username',username);if(profileUrl)params.set('facebook_profile_url',profileUrl);const response=await fetch(`${API_BASE_URL}${SEARCH_ENDPOINT}?${params.toString()}`,{headers:{Authorization:`Bearer ${token}`}});if(response.status===401){logout();return}if(!response.ok){duplicateStatus.textContent='Duplicate check will activate after the Xano search endpoint is created.';return}const data=await response.json();const records=Array.isArray(data)?data:(data.items||data.records||data.ad_inquiry||[]);const found=Array.isArray(records)?records[0]:records;if(found?.id){duplicateStatus.innerHTML=`<strong>Existing record found</strong><br>#${escapeHtml(String(found.id))} · ${escapeHtml(found.facebook_name||username||'Facebook inquiry')}<br>${escapeHtml(found.status||'active')}`;}else duplicateStatus.textContent='No existing record found.';}catch(error){duplicateStatus.textContent='Duplicate check unavailable.';}}
function normalizeFacebookUrl(value){const raw=(value||'').trim();if(!raw)return'';return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;}
function setLoading(loading){saveButton.disabled=loading;clearButton.disabled=loading;saveButton.textContent=loading?'Creating…':'Create Inquiry';}
function showMessage(message,success=false){formMessage.textContent=message;formMessage.classList.toggle('success',success);}
function logout(){localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);window.location.replace('intake_login.html');}
function responseEndpointMissing(error){return /404|not found|endpoint/i.test(error?.message||'');}
function escapeHtml(value){return value.replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
