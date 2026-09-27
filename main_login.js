const LOGIN_ENDPOINT='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT/ad_journey_login';
const TOKEN_KEY='ads_journey_token';
const USER_KEY='ads_journey_user';
const form=document.getElementById('loginForm');
const emailInput=document.getElementById('email');
const passwordInput=document.getElementById('password');
const loginButton=document.getElementById('loginButton');
const loginMessage=document.getElementById('loginMessage');
const togglePassword=document.getElementById('togglePassword');
if(localStorage.getItem(TOKEN_KEY))window.location.replace('dashboard.html');
togglePassword.addEventListener('click',()=>{const show=passwordInput.type==='password';passwordInput.type=show?'text':'password';togglePassword.textContent=show?'Hide':'Show';togglePassword.setAttribute('aria-label',show?'Hide password':'Show password')});
form.addEventListener('submit',async e=>{e.preventDefault();const email=emailInput.value.trim();const password=passwordInput.value;if(!email||!password){showMessage('Enter your email and password.');return}setLoading(true);showMessage('');try{const response=await fetch(LOGIN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'LOGIN_FAILED');const authToken=data.authToken||data.auth_token||data.token;if(!authToken)throw new Error('TOKEN_MISSING');localStorage.setItem(TOKEN_KEY,authToken);if(data.user)localStorage.setItem(USER_KEY,JSON.stringify(data.user));showMessage('Signed in. Opening Ads Journey.',true);window.location.replace('dashboard.html')}catch(error){showMessage(error.message==='LOGIN_FAILED'?'Incorrect email or password.':error.message||'Unable to sign in.')}finally{setLoading(false)}});
function setLoading(loading){loginButton.disabled=loading;loginButton.textContent=loading?'Signing In…':'Sign In'}
function showMessage(message,success=false){loginMessage.textContent=message;loginMessage.classList.toggle('success',success)}
