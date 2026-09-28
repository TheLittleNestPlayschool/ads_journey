/*   Ads Journey durable usage session tracking*/
(function(){
  const API_URL='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT/ad_usage_session';
  const APP_VERSION='1.0.0';
  const SCHEMA_VERSION=1;
  const DB_NAME='ads_journey_usage';
  const DB_VERSION=1;
  const STORE_NAME='sessions';
  const token=localStorage.getItem('ads_journey_token');
  if(!token)return;

  let db=null;
  let session=null;
  let persistTimer=null;
  let finalising=false;

  init().catch(()=>{});

  async function init(){
    db=await openDb();
    await recoverPendingSessions();
    session=createSession();
    addEvent('app_started',{module:'app',action:'start'});
    await persistCurrentSession();
    bindLifecycle();
    bindInteractionTracking();
    exposeApi();
    window.setTimeout(()=>addEvent('app_ready',{module:'app',action:'ready'}),0);
  }

  function createSession(){
    const now=Date.now();
    return{
      session_uuid:createUuid(),
      schema_version:SCHEMA_VERSION,
      started_at:now,
      ended_at:0,
      last_event_at:now,
      total_duration_ms:0,
      active_duration_ms:0,
      active_started_at:isActive()?now:null,
      event_count:0,
      end_reason:'',
      is_complete:false,
      app_version:APP_VERSION,
      device_type:getDeviceType(),
      platform:navigator.userAgentData?.platform||navigator.platform||'Unknown',
      browser:getBrowser(),
      screen_width:Number(window.screen?.width)||0,
      screen_height:Number(window.screen?.height)||0,
      viewport_width:Number(window.innerWidth)||0,
      viewport_height:Number(window.innerHeight)||0,
      language:navigator.language||'',
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',
      online_at_start:navigator.onLine,
      session_context:{entry_page:location.pathname||'/',referrer:document.referrer||'',selected_franchise_ids:[]},
      events:[],
      uploaded:false,
      upload_attempts:0
    };
  }

  function createUuid(){
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
    if(window.crypto?.getRandomValues){const bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0'));return`${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;}
    return`ads-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isActive(){return document.visibilityState==='visible'&&document.hasFocus();}

  function syncActiveState(now=Date.now()){
    if(!session)return;
    if(isActive()){
      if(session.active_started_at===null)session.active_started_at=now;
    }else if(session.active_started_at!==null){
      session.active_duration_ms+=Math.max(0,now-session.active_started_at);
      session.active_started_at=null;
    }
  }

  function getActiveDuration(now=Date.now()){
    if(!session)return 0;
    return session.active_duration_ms+(session.active_started_at!==null?Math.max(0,now-session.active_started_at):0);
  }

  function addEvent(type,details={}){
    if(!session||finalising)return;
    const now=Date.now();
    const event={seq:session.events.length+1,type:String(type||'event'),at_ms:Math.max(0,now-session.started_at),occurred_at:now};
    ['module','action','target','control','view'].forEach(key=>{if(details[key]!==undefined&&details[key]!==null&&details[key]!=='')event[key]=details[key];});
    const data={...details};['module','action','target','control','view'].forEach(key=>delete data[key]);
    if(Object.keys(data).length)event.data=sanitiseData(data);
    session.events.push(event);
    session.event_count=session.events.length;
    session.last_event_at=now;
    schedulePersist();
  }

  function sanitiseData(value,depth=0){
    if(depth>4)return null;
    if(value===null||value===undefined)return value;
    if(typeof value==='string')return value.slice(0,250);
    if(typeof value==='number'||typeof value==='boolean')return value;
    if(Array.isArray(value))return value.slice(0,50).map(item=>sanitiseData(item,depth+1));
    if(typeof value==='object'){
      const out={};
      Object.entries(value).slice(0,50).forEach(([key,val])=>{if(!/password|token|message|note|name|email|phone|address/i.test(key))out[key]=sanitiseData(val,depth+1);});
      return out;
    }
    return String(value).slice(0,250);
  }

  function updateContext(values={}){
    if(!session||!values||typeof values!=='object'||Array.isArray(values))return;
    Object.assign(session.session_context,sanitiseData(values));
    schedulePersist();
  }

  function schedulePersist(){
    if(persistTimer)window.clearTimeout(persistTimer);
    persistTimer=window.setTimeout(()=>{persistTimer=null;persistCurrentSession();},250);
  }

  async function persistCurrentSession(){
    if(!db||!session)return;
    const now=Date.now();
    syncActiveState(now);
    const copy={...session,total_duration_ms:Math.max(0,now-session.started_at),active_duration_ms:getActiveDuration(now)};
    await idbPut(copy);
  }

  async function finaliseSession(reason='pagehide',options={}){
    if(!session||finalising||session.is_complete)return false;
    finalising=true;
    const now=Date.now();
    syncActiveState(now);
    const event={seq:session.events.length+1,type:'session_ended',at_ms:Math.max(0,now-session.started_at),occurred_at:now,data:{reason}};
    session.events.push(event);
    session.event_count=session.events.length;
    session.last_event_at=now;
    session.ended_at=now;
    session.total_duration_ms=Math.max(0,now-session.started_at);
    session.active_duration_ms=getActiveDuration(now);
    session.active_started_at=null;
    session.end_reason=reason;
    session.is_complete=options.isComplete!==false;
    try{await idbPut(session);}catch(error){}
    const uploaded=await uploadSession(session,{keepalive:Boolean(options.keepalive)});
    if(uploaded){session.uploaded=true;try{await idbDelete(session.session_uuid);}catch(error){}}
    else{session.upload_attempts=(session.upload_attempts||0)+1;try{await idbPut(session);}catch(error){}}
    finalising=false;
    return uploaded;
  }

  async function recoverPendingSessions(){
    const rows=await idbGetAll();
    for(const row of rows){
      if(row.uploaded){await idbDelete(row.session_uuid);continue;}
      if(!row.is_complete){
        const endAt=row.last_event_at||row.started_at||Date.now();
        row.ended_at=endAt;
        row.total_duration_ms=Math.max(0,endAt-(row.started_at||endAt));
        row.active_duration_ms=Math.min(Number(row.active_duration_ms)||0,row.total_duration_ms);
        row.end_reason='unclean_exit';
        row.is_complete=false;
        row.events=Array.isArray(row.events)?row.events:[];
        row.events.push({seq:row.events.length+1,type:'session_ended',at_ms:row.total_duration_ms,occurred_at:endAt,data:{reason:'unclean_exit'}});
        row.event_count=row.events.length;
        row.last_event_at=endAt;
        await idbPut(row);
      }
      const uploaded=await uploadSession(row);
      if(uploaded)await idbDelete(row.session_uuid);
      else{row.upload_attempts=(row.upload_attempts||0)+1;await idbPut(row);}
    }
  }

  async function uploadSession(row,options={}){
    if(!navigator.onLine)return false;
    const payload={
      session_uuid:row.session_uuid,
      schema_version:row.schema_version,
      started_at:row.started_at,
      ended_at:row.ended_at||row.last_event_at||row.started_at,
      last_event_at:row.last_event_at||row.started_at,
      total_duration_ms:Number(row.total_duration_ms)||0,
      active_duration_ms:Number(row.active_duration_ms)||0,
      event_count:Array.isArray(row.events)?row.events.length:Number(row.event_count)||0,
      end_reason:row.end_reason||'unknown',
      is_complete:Boolean(row.is_complete),
      app_version:row.app_version||APP_VERSION,
      device_type:row.device_type||'unknown',
      platform:row.platform||'Unknown',
      browser:row.browser||'Unknown',
      screen_width:Number(row.screen_width)||0,
      screen_height:Number(row.screen_height)||0,
      viewport_width:Number(row.viewport_width)||0,
      viewport_height:Number(row.viewport_height)||0,
      language:row.language||'',
      timezone:row.timezone||'',
      online_at_start:Boolean(row.online_at_start),
      session_context:row.session_context||{},
      events:Array.isArray(row.events)?row.events:[]
    };
    try{
      const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),keepalive:Boolean(options.keepalive)});
      return response.ok;
    }catch(error){return false;}
  }

  function bindLifecycle(){
    document.addEventListener('visibilitychange',()=>{syncActiveState();addEvent(document.visibilityState==='hidden'?'visibility_hidden':'visibility_visible',{module:'app',action:document.visibilityState});});
    window.addEventListener('focus',()=>{syncActiveState();addEvent('window_focus',{module:'app',action:'focus'});});
    window.addEventListener('blur',()=>{syncActiveState();addEvent('window_blur',{module:'app',action:'blur'});});
    window.addEventListener('online',()=>{addEvent('connection_online',{module:'app',action:'online'});recoverPendingSessions().catch(()=>{});});
    window.addEventListener('offline',()=>addEvent('connection_offline',{module:'app',action:'offline'}));
    window.addEventListener('error',event=>addEvent('js_error',{module:'app',action:'error',filename:event.filename||'',line:event.lineno||0,column:event.colno||0,error_name:event.error?.name||'',error_message:String(event.message||'').slice(0,250)}));
    window.addEventListener('unhandledrejection',event=>{const reason=event.reason;addEvent('unhandled_rejection',{module:'app',action:'error',error_name:reason?.name||'',error_message:String(reason?.message||reason||'').slice(0,250)});});
    window.addEventListener('pagehide',()=>{finaliseSession('pagehide',{keepalive:true});},{once:true});
    window.addEventListener('beforeunload',()=>{persistCurrentSession();});
  }

  function bindInteractionTracking(){
    document.addEventListener('click',event=>{
      const el=event.target?.closest?.('button,a,[role="button"],input,select,textarea,.work-row');
      if(!el)return;
      addEvent('click',{module:getModule(el),action:'click',target:el.tagName.toLowerCase(),control:getControl(el),target_id:el.id||null,class_name:classString(el),role:el.getAttribute('role')||null});
    },true);
    document.addEventListener('change',event=>{
      const el=event.target;
      if(!el||!['INPUT','SELECT','TEXTAREA'].includes(el.tagName))return;
      const data={field_name:el.name||null,input_type:(el.type||el.tagName).toLowerCase()};
      if(el.type==='checkbox'||el.type==='radio')data.checked=Boolean(el.checked);
      else if(el.tagName==='SELECT')data.selected_count=el.multiple?Array.from(el.selectedOptions).length:(el.selectedIndex>=0?1:0);
      else data.character_count=String(el.value||'').length;
      addEvent('input_change',{module:getModule(el),action:'change',target:el.tagName.toLowerCase(),control:getControl(el),...data});
    },true);
  }

  function getModule(el){
    if(el.closest('#journeyPanel'))return'journey_panel';
    if(el.closest('#journeySearchModal'))return'journey_search';
    if(el.closest('#adminActivityModal'))return'admin_activity';
    if(el.closest('#locationPerformanceModal'))return'location_performance';
    if(el.closest('#marketingPerformanceModal'))return'marketing_performance';
    if(el.closest('.filter-panel'))return'franchise_filter';
    if(el.closest('.journey-board'))return'journey_board';
    if(el.closest('.topbar'))return'topbar';
    return'dashboard';
  }

  function getControl(el){
    return el.dataset?.action||el.id||el.name||el.getAttribute('aria-label')||el.classList?.[0]||el.tagName.toLowerCase();
  }

  function classString(el){return Array.from(el.classList||[]).slice(0,6).join(' ')||null;}

  function getBrowser(){
    const ua=navigator.userAgent||'';
    if(/Edg\//.test(ua))return'Edge';
    if(/OPR\//.test(ua))return'Opera';
    if(/Chrome\//.test(ua)&&!/Edg\//.test(ua))return'Chrome';
    if(/Firefox\//.test(ua))return'Firefox';
    if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))return'Safari';
    return'Unknown';
  }

  function getDeviceType(){
    const ua=navigator.userAgent||'';
    if(/iPad|Tablet|Android(?!.*Mobile)/i.test(ua))return'tablet';
    if(/Mobi|iPhone|Android/i.test(ua))return'mobile';
    return'desktop';
  }

  function exposeApi(){
    window.trackUsageEvent=(type,details={})=>addEvent(type,details);
    window.updateUsageSessionContext=values=>updateContext(values);
    window.endUsageSession=(reason='manual_end',options={})=>finaliseSession(reason,options);
    window.getUsageSessionUuid=()=>session?.session_uuid||null;
    window.markUsageLoginValidated=()=>addEvent('login_validated',{module:'app',action:'login_validated'});
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(STORE_NAME))database.createObjectStore(STORE_NAME,{keyPath:'session_uuid'});};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }

  function idbPut(value){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(value);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
  function idbDelete(key){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).delete(key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
  function idbGetAll(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readonly');const request=tx.objectStore(STORE_NAME).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);});}
})();