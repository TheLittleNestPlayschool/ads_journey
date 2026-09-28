(()=>{
  function applyFranchiseCard(row,journey){
    if(!row||!journey)return;
    const franchiseId=Number(journey.franchise_id)||0;
    row.dataset.franchiseId=String(franchiseId);
    if(!franchiseId)return;
    row.classList.add('franchise-accent');
    const hue=(franchiseId*47)%360;
    row.style.setProperty('--franchise-accent',`hsl(${hue} 30% 58%)`);
  }
  window.addEventListener('journey-card-added',event=>applyFranchiseCard(event.detail?.row,event.detail?.journey));
})();