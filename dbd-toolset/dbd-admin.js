// Public identity controls presentation only. The Edge Function separately verifies access.
const FogAdmin=(()=>{
  let generation=0,days=30;
  function sync(){
    const allowed=FogAccounts.isAdmin();
    $('#tab-admin').hidden=!allowed;
    if(!allowed){
      generation++;$('#t-admin').innerHTML='';
      if(!$('#t-admin').hidden)showTab('account');
    }
  }
  function draw(){
    if(!FogAccounts.isAdmin()){sync();return;}
    $('#t-admin').innerHTML=`<div class="card"><h2>Site analytics</h2><p class="sub">Google Analytics · property 560294101. Reports cover complete days through yesterday in your property's timezone. Unique visitors are estimates, not a count of registered accounts.</p><div class="row"><label>Report period<select id="admin-days">${[7,30,90].map(n=>`<option value="${n}" ${n===days?'selected':''}>Last ${n} complete days</option>`).join('')}</select></label><button class="btn" id="admin-refresh">Load report</button></div><p id="admin-status" role="status">Choose a period and load your report.</p><div id="admin-report"></div><p class="sub">Reports may lag behind visits, and consent choices or blockers can reduce counts. Regions are approximate. A visitor can appear in multiple daily or regional rows, so those rows should not be added to calculate unique visitors for the whole period.</p></div>`;
    $('#admin-days').onchange=e=>{days=Number(e.target.value)};
    $('#admin-refresh').onclick=load;
  }
  async function load(){
    const token=++generation;
    $('#admin-refresh').disabled=true;$('#admin-status').textContent='Loading Google Analytics…';$('#admin-report').innerHTML='';
    try{
      const report=await FogAccounts.analytics(days);
      if(token!==generation||!FogAccounts.isAdmin())return;
      const number=n=>Number(n||0).toLocaleString();
      const table=(headers,rows)=>`<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells=>`<tr>${cells.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      $('#admin-report').innerHTML=`<div class="stats">${[['Estimated unique visitors',report.totals.visitors],['Page views',report.totals.views],['Sessions',report.totals.sessions]].map(([label,n])=>`<div class="stat"><strong>${number(n)}</strong><br>${esc(label)}</div>`).join('')}</div><h3>Top countries and regions</h3>${report.locations.length?table(['Country','Region','Visitors'],report.locations.map(r=>[r.country,r.region,number(r.visitors)])):'<p>No location data yet.</p>'}<h3>Daily activity</h3>${report.daily.length?table(['Date','Visitors','Views','Sessions'],report.daily.map(r=>[r.date.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),number(r.visitors),number(r.views),number(r.sessions)])):'<p>No daily data yet.</p>'}`;
      $('#admin-status').textContent=`Updated ${new Date(report.generatedAt).toLocaleString()} · ${report.timezone}.${report.thresholded?' Google applied privacy thresholds to this report.':''} Reports may be cached for five minutes.`;
    }catch(error){if(token===generation)$('#admin-status').textContent=error.message}
    finally{if(token===generation)$('#admin-refresh').disabled=false}
  }
  return {sync,draw};
})();
window.FogAdmin=FogAdmin;
FogAdmin.sync();
