(()=>{
  function applyActivityRow(row){
    if(!row||row.dataset.franchiseAccentApplied==='true')return;
    const location=row.querySelector('strong')?.textContent.trim();
    if(!location)return;
    const franchise=franchises.find(item=>franchiseName(item)===location);
    const franchiseId=Number(franchise?.id)||0;
    if(!franchiseId)return;
    row.dataset.franchiseId=String(franchiseId);
    row.dataset.franchiseAccentApplied='true';
    row.classList.add('franchise-activity-row');
    row.style.setProperty('--franchise-accent',franchiseAccent(franchiseId));
  }
  function applyAll(){document.querySelectorAll('#adminActivityModal .activity-row').forEach(applyActivityRow);}
  const list=document.querySelector('#adminActivityModal .activity-list');
  if(list)new MutationObserver(applyAll).observe(list,{childList:true,subtree:true});
  applyAll();
})();