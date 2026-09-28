/*   Ads Journey usage session tracking*/
(function(){
  const API_URL='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT/ad_usage_session';
  const APP_VERSION='1.0.0';
  const SCHEMA_VERSION=1;
  const token=localStorage.getItem('ads_journey_token');
  if(!token)return;

  const startedAt=Date.now();
  const sessionUuid=createUuid();
  const events=[];
  const sessionContext={entry_page:location.pathname||'/',referrer:document.referrer||'',selected_franchise_ids:[]};
  let eventSeq=0;
  let lastEventAt=startedAt;
  let activeDurationMs=0;
  let activeStartedAt=isActive()?startedAt:null;
  let sent=false;

  function createUuid(){
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
    if(window.crypto?.getRandomValues){const bytes=new Uint8Array(16);window.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0'));return`${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;}
    return`ads-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function isActive(){return document.visibilityState==='visible'&&document.hasFocus();}

  function syncActiveState(){
    const now=Date.now();
    if(isActive()){
      if(activeStartedAt===null)activeStartedAt=now;
    }else if(activeStartedAt!==null){
      activeDurationMs+=Math.max(0,now-activeStartedAt);
      activeStartedAt=null;
    }
  }

  function currentActiveDuration(now=Date.now()){
    return activeDurationMs+(activeStartedAt!==null?Math.max(0,now-activeStartedAt):0);
  }

  function normaliseEvent(type,details={}){
    const now=Date.now();
    lastEventAt=now;
    eventSeq+=1;
    const event={seq:eventSeq,at_ms:Math.max(0,now-startedAt),occurred_at:now,type:String(type||'event')};
    if(details.module)event.module=details.module;
    if(details.action)event.action=details.action;
    if(details.target)event.target=details.target;
    const data={...details};delete data.module;delete data.action;delete data.target;
    if(Object.keys(data).length)event.data=data;
    return event;
  }

  function trackUsageEvent(type,details={}){
    if(sent)return;
    events.push(normaliseEvent(type,details));
  }

  function updateUsageSessionContext(values={}){
    if(!values||typeof values!=='object'||Array.isArray(values))return;
    Object.assign(sessionContext,values);
  }

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

  function buildPayload(endReason,isComplete){
    const endedAt=Date.now();
    syncActiveState();
    return{
      session_uuid:sessionUuid,
      schema_version:SCHEMA_VERSION,
      started_at:startedAt,
      ended_at:endedAt,
      last_event_at:lastEventAt,
      total_duration_ms:Math.max(0,endedAt-startedAt),
      active_duration_ms:Math.max(0,currentActiveDuration(endedAt)),
      event_count:events.length,
      end_reason:endReason,
      is_complete:Boolean(isComplete),
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
      session_context:sessionContext,
      events:events
    };
  }

  async function endUsageSession(endReason='page_exit',options={}){
    if(sent)return false;
    trackUsageEvent('session_ended',{module:'app',action:'end',reason:endReason});
    const payload=buildPayload(endReason,options.isComplete!==false);
    sent=true;
    try{
      const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),keepalive:Boolean(options.keepalive)});
      if(!response.ok){sent=false;return false;}
      return true;
    }catch(error){sent=false;return false;}
  }

  document.addEventListener('visibilitychange',()=>{syncActiveState();trackUsageEvent(document.visibilityState==='hidden'?'app_hidden':'app_visible',{module:'app',action:document.visibilityState});});
  window.addEventListener('focus',()=>{syncActiveState();trackUsageEvent('app_focused',{module:'app',action:'focus'});});
  window.addEventListener('blur',()=>{syncActiveState();trackUsageEvent('app_blurred',{module:'app',action:'blur'});});
  window.addEventListener('online',()=>trackUsageEvent('connection_online',{module:'app',action:'online'}));
  window.addEventListener('offline',()=>trackUsageEvent('connection_offline',{module:'app',action:'offline'}));
  window.addEventListener('pagehide',()=>{endUsageSession('page_exit',{keepalive:true});},{once:true});

  window.trackUsageEvent=trackUsageEvent;
  window.updateUsageSessionContext=updateUsageSessionContext;
  window.endUsageSession=endUsageSession;
  window.getUsageSessionUuid=()=>sessionUuid;

  trackUsageEvent('session_started',{module:'app',action:'start',page:location.pathname||'/'});
})();