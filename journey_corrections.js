/*   Correction controls for manually recorded Messenger messages and original inquiry time*/
(()=>{
  const panel=document.getElementById('journeyPanel'),list=document.querySelector('#journeyPanel .journey-conversation-list');
  if(!panel||!list)return;
  const API='https://x58r-xped-p4y6.n7e.xano.io/api:0Ddhs4dT';
  const token=()=>localStorage.getItem('ads_journey_token')||'';
  const header=document.createElement('div');header.className='journey-original-inquiry-correction';header.hidden=true;
  header.innerHTML='<span id="journeyOriginalInquiryValue"></span><button type="button" id="journeyEditOriginalInquiry" title="Correct the original inquiry time">Edit</button>';
  document.getElementById('journeyLocation').insertAdjacentElement('afterend',header);
  const originalLabel=header.querySelector('#journeyOriginalInquiryValue');
  const overlay=document.createElement('div');overlay.className='journey-change-overlay journey-record-correction-overlay';overlay.hidden=true;
  overlay.innerHTML=[
    '<form class="journey-record-correction-dialog" id="journeyRecordCorrectionForm" role="dialog" aria-modal="true" aria-labelledby="journeyRecordCorrectionTitle">',
    '<span class="journey-change-kicker">ADS JOURNEY · CORRECT RECORD</span><h3 id="journeyRecordCorrectionTitle">Correct record</h3>',
    '<p class="journey-record-correction-help" id="journeyRecordCorrectionHelp"></p>',
    '<label class="journey-record-correction-message">Sender<select id="journeyRecordCorrectDirection"><option value="inbound">Parent</option><option value="outbound">Playschool</option></select></label>',
    '<label class="journey-record-correction-message">Message<textarea id="journeyRecordCorrectText" maxlength="3000" rows="5"></textarea></label>',
    '<label>Date (Philippine time)<input id="journeyRecordCorrectDate" type="date" required></label>',
    '<label>Time (Philippine time)<div class="journey-record-correction-clock">',
    '<input id="journeyRecordCorrectHour" type="number" min="1" max="12" step="1" aria-label="Hour" required><span>:</span>',
    '<input id="journeyRecordCorrectMinute" type="number" min="0" max="59" step="1" aria-label="Minute" required>',
    '<select id="journeyRecordCorrectPeriod" aria-label="AM or PM"><option>AM</option><option>PM</option></select></div></label>',
    '<p class="journey-record-correction-error" id="journeyRecordCorrectionError" role="alert"></p>',
    '<div class="journey-record-correction-actions"><button id="journeyRecordCorrectionDelete" type="button" class="journey-record-correction-delete">Delete</button>',
    '<span class="journey-record-correction-spacer"></span><button id="journeyRecordCorrectionCancel" type="button">Cancel</button>',
    '<button id="journeyRecordCorrectionSave" type="submit" class="journey-record-correction-save">Save Correction</button></div></form>'
  ].join('');
  document.body.appendChild(overlay);
  const field=id=>overlay.querySelector('#'+id),form=field('journeyRecordCorrectionForm'),error=field('journeyRecordCorrectionError');
  const date=field('journeyRecordCorrectDate'),hour=field('journeyRecordCorrectHour'),minute=field('journeyRecordCorrectMinute'),period=field('journeyRecordCorrectPeriod');
  const del=field('journeyRecordCorrectionDelete'),save=field('journeyRecordCorrectionSave');
  let active=null,originalInquiryAt=0,originalInquiryId=0,pending=false,deleteArmed=false,lastPanelId=0;
  const currentJourney=()=>Number(panel.dataset.journeyId)||0;
  const currentInquiry=()=>Number(panel.dataset.inquiryId)||0;
  const hasControl=()=>panel.dataset.lockOwned==='true';
  const pretty=at=>new Date(Number(at)).toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  async function request(endpoint,body=null){
    const response=await fetch(API+'/'+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||body&&result.success!==true){
      if(response.status===404)throw Error('The correction endpoint has not been created in Xano yet.');
      throw Error(result.message||result.error||'Unable to save the correction (HTTP '+response.status+').');
    }
    return result;
  }
  function ensureControl(){
    if(hasControl())return true;
    const status=document.getElementById('journeyLockStatus');if(status)status.textContent='Take Control to correct this record.';
    return false;
  }
  function setClock(at){
    const iso=new Date(Number(at)+8*3600000).toISOString();
    date.value=iso.slice(0,10);const h=Number(iso.slice(11,13));
    hour.value=String(h%12||12);minute.value=String(Number(iso.slice(14,16)));period.value=h>=12?'PM':'AM';
  }
  function getClock(){
    const parts=date.value.split('-').map(Number),h=Number(hour.value),m=Number(minute.value);
    if(parts.length!==3||!parts.every(Number.isInteger)||h<1||h>12||!hour.value||m<0||m>59||!minute.value)throw Error('Enter a valid date and time.');
    const hh=h%12+(period.value==='PM'?12:0);
    const at=Date.UTC(parts[0],parts[1]-1,parts[2],hh,m)-8*3600000;
    if(new Date(at+8*3600000).toISOString().slice(0,16)!==date.value+'T'+String(hh).padStart(2,'0')+':'+String(m).padStart(2,'0'))throw Error('Enter a valid Philippine date and time.');
    if(at>Date.now()+60000)throw Error('The recorded time cannot be in the future.');
    return at;
  }
  function close(){if(pending)return;overlay.hidden=true;active=null;deleteArmed=false;error.textContent='';del.textContent='Delete';}
  function begin(kind,message=null){
    if(!ensureControl())return;
    const inquiryId=currentInquiry(),journeyId=currentJourney();
    if(!inquiryId||!journeyId||kind==='message'&&!message?.id)return;
    active={kind,inquiryId,journeyId,messageId:Number(message?.id)||0};
    error.textContent='';deleteArmed=false;del.textContent='Delete';
    field('journeyRecordCorrectionTitle').textContent=kind==='inquiry'?'Correct Original Inquiry Time':'Correct Recorded Message';
    field('journeyRecordCorrectionHelp').textContent=kind==='inquiry'?'Correct the date and time of the first Messenger inquiry.':'Fix the sender, text, or time copied into Ads Journey. This will not change the actual Messenger conversation.';
    overlay.querySelectorAll('.journey-record-correction-message').forEach(el=>el.hidden=kind!=='message');
    field('journeyRecordCorrectDirection').value=String(message?.direction||'').startsWith('out')?'outbound':'inbound';
    field('journeyRecordCorrectText').value=message?.message_text||'';
    del.hidden=kind!=='message';
    setClock(kind==='inquiry'?originalInquiryAt:(Number(message?.message_timestamp)||Number(message?.created_at)||Date.now()));
    overlay.hidden=false;
    (kind==='message'?field('journeyRecordCorrectText'):date).focus();
  }
  async function refreshOriginalTime(){
    const journeyId=currentJourney(),inquiryId=currentInquiry();
    if(!journeyId||!inquiryId)return;
    try{
      const data=await request('ad_journey_detail?journey_id='+encodeURIComponent(journeyId));
      if(currentJourney()!==journeyId||currentInquiry()!==inquiryId)return;
      originalInquiryAt=Number(data.inquiry?.first_message_at)||0;originalInquiryId=Number(data.inquiry?.id)||inquiryId;
      originalLabel.textContent=originalInquiryAt?'Original inquiry · '+pretty(originalInquiryAt):'Original inquiry time unavailable';
      header.hidden=false;
    }catch(e){header.hidden=true;}
  }
  async function openMessage(id){
    if(!ensureControl())return;
    const inquiryId=currentInquiry(),journeyId=currentJourney();
    try{
      const data=await request('ad_messenger_conversation?ad_inquiry_id='+encodeURIComponent(inquiryId));
      if(currentInquiry()!==inquiryId||currentJourney()!==journeyId)return;
      const arr=Array.isArray(data.messages)?data.messages:(data.messages?.items||data.messages?.records||[]);
      const message=arr.find(item=>Number(item.id)===id);
      if(!message)throw Error('The message could not be found. Refresh the conversation.');
      if(String(message.message_id||'').trim())throw Error('Messages received directly from Meta cannot be corrected here.');
      begin('message',message);
    }catch(e){window.alert(e.message||'Unable to load message.');}
  }
  function addMessageActions(){
    list.querySelectorAll('.journey-message-row[data-conversation-message-id][data-record-correctable="true"]').forEach(row=>{
      const bubble=row.querySelector('.journey-message-bubble');
      if(!bubble||bubble.querySelector('.journey-record-correct-button'))return;
      const button=document.createElement('button');button.type='button';button.className='journey-record-correct-button';button.textContent='⋯';
      button.title='Correct or delete this recorded message';button.setAttribute('aria-label','Correct or delete recorded message');
      button.addEventListener('click',()=>openMessage(Number(row.dataset.conversationMessageId)));
      bubble.prepend(button);
    });
  }
  async function submitCorrection(action){
    const info=active;if(!info||pending)return;
    if(!hasControl()||currentJourney()!==info.journeyId||currentInquiry()!==info.inquiryId){error.textContent='Control of this journey has changed. Take Control before correcting records.';return;}
    let at=0,message='';
    try{if(action!=='delete'){at=getClock();if(info.kind==='message'){message=field('journeyRecordCorrectText').value.trim();if(!message)throw Error('Message cannot be blank. Use Delete instead.');}}}
    catch(e){error.textContent=e.message;return;}
    pending=true;save.disabled=true;del.disabled=true;error.textContent='';
    try{
      if(info.kind==='inquiry'){
        await request('ad_inquiry_time_correct',{ad_journey_id:info.journeyId,ad_inquiry_id:info.inquiryId,first_message_at:at});
        originalInquiryAt=at;originalLabel.textContent='Original inquiry · '+pretty(at);
      }else{
        const body={ad_journey_id:info.journeyId,ad_inquiry_id:info.inquiryId,message_id:info.messageId,action};
        if(action==='update')Object.assign(body,{message_text:message,direction:field('journeyRecordCorrectDirection').value,message_timestamp:at});
        await request('ad_messenger_message_correct',body);
      }
      overlay.hidden=true;active=null;
      if(info.kind==='message')window.dispatchEvent(new Event('journey-conversation-corrected'));
      if(info.kind==='inquiry'&&typeof window.loadBoard==='function')await window.loadBoard();
    }catch(e){error.textContent=e.message||'Correction failed.';}
    finally{pending=false;save.disabled=false;del.disabled=false;}
  }
  document.getElementById('journeyEditOriginalInquiry').addEventListener('click',()=>{if(originalInquiryAt&&originalInquiryId===currentInquiry())begin('inquiry');});
  field('journeyRecordCorrectionCancel').addEventListener('click',close);
  form.addEventListener('submit',e=>{e.preventDefault();submitCorrection('update');});
  del.addEventListener('click',()=>{
    if(!active||pending)return;
    if(!deleteArmed){deleteArmed=true;del.textContent='Confirm Delete';error.textContent='Click Confirm Delete again to remove this copied message from Ads Journey.';return;}
    submitCorrection('delete');
  });
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  new MutationObserver(addMessageActions).observe(list,{childList:true});
  const onPanelChange=()=>{
    const journeyId=currentJourney();
    if(!panel.classList.contains('open')||!journeyId){lastPanelId=0;header.hidden=true;close();return;}
    if(journeyId!==lastPanelId){lastPanelId=journeyId;header.hidden=true;originalInquiryAt=0;originalInquiryId=0;refreshOriginalTime();}
  };
  new MutationObserver(onPanelChange).observe(panel,{attributes:true,attributeFilter:['class','data-journey-id','data-inquiry-id']});
  onPanelChange();addMessageActions();
})();