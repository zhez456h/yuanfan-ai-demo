const STORAGE_KEY = 'yuanfan_static_workspace_v1';
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  route: location.hash.startsWith('#/') ? location.hash.slice(2) : (saved.route || 'dashboard'),
  collapsed: Boolean(saved.collapsed),
  moreOpen: Boolean(saved.moreOpen),
  mailConnected: saved.mailConnected ?? false,
  completedTasks: saved.completedTasks || {},
  automations: saved.automations || { followup:true, inbox:true, customerRisk:true, quotation:false, dailyBrief:true, tradeSync:false },
  orgName: saved.orgName || 'Amazing Trade',
  userName: saved.userName || '者着',
  preferredTone: saved.preferredTone || '简洁、专业、先给结论',
  pendingSkill: 'default',
  activeWorkflow: '',
  workflowValues: {},
  liveTask: saved.liveTask || null,
  backendOnline: false,
  aiProvider: 'local',
  aiModel: '',
  backendDashboard: null,
  backendFiles: [],
  backendFileShares: [],
  backendFolders: [],
  backendMailAccounts: [],
  backendMailMessages: [],
  mailSenderEmail: '',
  backendConnectAccounts: [],
  backendOutreachJobs: [],
  selectedMailId: saved.selectedMailId||'',
  mailFolder: saved.mailFolder||'收件箱',
  driveTab: saved.driveTab||'我的文件',
  selectedQuoteId: saved.selectedQuoteId||'',
  opportunityView: saved.opportunityView||'kanban',
  backendAutomations: [],
  automationRuns: [],
  backendConversations: [],
  backendAiJobs: [],
  backendAgents: [],
  backendMembers: [],
  apiTokens: [],
  workspaceSettings: {},
  authUser: null
};
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const AUTH_TOKEN_KEY='yuanfan_static_no_auth';
const backendRecords={companies:[],people:[],products:[],tasks:[],opportunities:[],quotations:[],samples:[],orders:[]};
const tableUi={};
const API_BASE = window.YUANFAN_API_BASE || (
  location.protocol.startsWith('http')
    ? (location.port === '8766'
      ? '/api'
      : ((location.hostname === '127.0.0.1' || location.hostname === 'localhost')
        ? `${location.protocol}//${location.hostname}:8766/api`
        : '/api'))
    : 'http://127.0.0.1:8766/api'
);
async function api(path, options={}){
  const headers = {...(options.headers||{})};
  const token=localStorage.getItem(AUTH_TOKEN_KEY);
  if(token)headers.Authorization=`Bearer ${token}`;
  if(options.body && !(options.body instanceof FormData)) headers['Content-Type']='application/json';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response = await fetch(`${API_BASE}${path}`, {...options, headers, signal:controller.signal});
    const type=response.headers.get('content-type')||'';
    const data=type.includes('application/json')?await response.json():await response.text();
    if(!response.ok){const error=new Error(data?.detail||`接口请求失败（${response.status}）`);error.status=response.status;throw error}
    return data;
  }catch(error){
    if(error.name==='AbortError')throw new Error('后端响应超时，请检查服务状态');
    throw error;
  }finally{clearTimeout(timeout)}
}
const main = document.querySelector('#main');
const shell = document.querySelector('#app-shell');
const sidebar = document.querySelector('#sidebar');
const moreNav = document.querySelector('#more-nav');
const toast = document.querySelector('#toast');
const modalLayer = document.querySelector('#modal-layer');
const modalContent = document.querySelector('#modal-content');
const commandLayer = document.querySelector('#command-layer');
const commandInput = document.querySelector('#command-input');
const globalFile = document.querySelector('#global-file');
let previousFocus=null;
const modalHistory=[];
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function markdownInline(value){
  return esc(value)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/__([^_]+)__/g,'<strong>$1</strong>');
}
function renderAiResult(markdown){
  const lines=String(markdown||'').replace(/\r/g,'').split('\n');
  const output=[];let paragraph=[];let listType='';let listItems=[];let tableRows=[];
  const flushParagraph=()=>{if(paragraph.length){output.push(`<p>${markdownInline(paragraph.join(' '))}</p>`);paragraph=[]}};
  const flushList=()=>{if(listItems.length){output.push(`<${listType}>${listItems.map(item=>`<li>${markdownInline(item)}</li>`).join('')}</${listType}>`);listItems=[];listType=''}};
  const flushTable=()=>{if(tableRows.length){let [head,...body]=tableRows;const actionColumn=head.findIndex(cell=>/首轮动作/.test(cell));if(actionColumn>=0){head=head.filter((_,index)=>index!==actionColumn);body=body.map(row=>row.filter((_,index)=>index!==actionColumn))}const columnCount=head.length;const normalizedBody=body.map(row=>{let cells=[...row];if(cells.length>columnCount){const urlIndex=cells.findIndex(cell=>/^https?:\/\//.test(cell));if(urlIndex>1)cells=[cells[0],cells.slice(1,urlIndex).join(' / '),...cells.slice(urlIndex)]}return [...cells.slice(0,columnCount),...Array(Math.max(0,columnCount-cells.length)).fill('')]});output.push(`<div class="ai-table-wrap"><table><thead><tr>${head.map(cell=>`<th>${markdownInline(cell)}</th>`).join('')}</tr></thead><tbody>${normalizedBody.map(row=>`<tr>${row.map(cell=>`<td>${markdownInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);tableRows=[]}};
  for(const rawLine of lines){
    const line=rawLine.trim();
    const heading=line.match(/^(#{1,4})\s+(.+)$/);
    const unordered=line.match(/^[-*]\s+(.+)$/);
    const ordered=line.match(/^\d+[.)]\s+(.+)$/);
    const table=line.startsWith('|')&&line.endsWith('|');
    if(heading){flushParagraph();flushList();flushTable();output.push(`<h${heading[1].length}>${markdownInline(heading[2])}</h${heading[1].length}>`);continue}
    if(table){flushParagraph();flushList();const cells=line.slice(1,-1).split('|').map(cell=>cell.trim());if(!cells.every(cell=>/^:?-{3,}:?$/.test(cell)))tableRows.push(cells);continue}
    flushTable();
    if(unordered||ordered){flushParagraph();const nextType=unordered?'ul':'ol';if(listType&&listType!==nextType)flushList();listType=nextType;listItems.push((unordered||ordered)[1]);continue}
    if(!line||/^---+$/.test(line)){flushParagraph();flushList();continue}
    flushList();paragraph.push(line);
  }
  flushParagraph();flushList();flushTable();
  return output.join('')||'<p>任务已完成，但没有可展示的文本结果。</p>';
}
function taskDelivery(result,skill){
  const text=String(skill==='lead_generation'?cleanLeadResultForUser(result):result||'').trim();
  const marker=/^##\s*(?:完整分析|完整报告|详细报告)\s*$/mi;
  const parts=text.split(marker);
  let summary=parts.length>1?parts.shift().replace(/^##\s*(?:结论速览|核心结论|执行摘要)\s*$/mi,'').trim():'';
  let detail=parts.length>1?parts.join('\n').trim():text;
  if(!summary){
    const useful=text.replace(/^#{1,4}\s+.*$/gm,'').split('\n').map(x=>x.trim()).filter(x=>x&&x!=='---');
    summary=useful.slice(0,4).map(x=>x.replace(/^[-*]\s+/, '')).join('\n');
  }
  if(!detail)detail=text;
  const titles={company_research:'客户判断结果',lead_generation:'客户名单',opportunity_coach:'跟进动作',contact_discovery:'联系方式结果',trade_analysis:'进口记录判断',quotation:'报价草稿',email_copilot:'邮件草稿'};
  return {title:titles[skill]||'任务结论速览',summary,detail};
}
function cleanLeadResultForUser(markdown){
  const lines=String(markdown||'').replace(/\r/g,'').split('\n');
  const output=[];let hiddenSection=false;
  for(const raw of lines){
    const line=raw.trim();
    if(/^###\s+(系统已自动完成|系统处理说明)\s*$/.test(line)){hiddenSection=true;continue}
    if(hiddenSection&&/^###\s+/.test(line))hiddenSection=false;
    if(hiddenSection||/^(?:[-*]\s*)?公开检索审计：/.test(line)||/系统已自动完成：|系统会自动完成官网|发送前只保留用户审核/.test(line))continue;
    output.push(raw);
  }
  return output.join('\n');
}
function skillLabel(skill){
  return WORKFLOW_SKILLS?.[skill]?.name || ({
    company_research:'客户背调',
    lead_generation:'找客户',
    email_copilot:'写开发信',
    contact_discovery:'挖掘联系方式',
    opportunity_coach:'推进商机',
    quotation:'生成报价',
    trade_analysis:'贸易记录判断',
    general_sales:'销售任务'
  })[skill] || skill || 'AI任务';
}
function aiTaskTitle(job){
  const prompt=String(job?.prompt||'').replace(/\s+/g,' ').trim();
  if(!prompt)return skillLabel(job?.skill);
  return prompt.replace(/^@[^\\n ]+\s*/,'').slice(0,72);
}
function aiTaskSummary(job){
  const delivery=taskDelivery(job?.result||'',job?.skill||'');
  const text=String(delivery.summary||job?.current_step||'').replace(/\s+/g,' ').trim();
  return text.slice(0,120)||'任务结果已保存，可点进去继续处理。';
}
function aiTaskMetrics(job){
  const leads=extractLeadCandidates(job?.result||'',job?.prompt||'');
  const emails=job?.skill==='email_copilot'?emailDraftTargets({skill:'email_copilot',status:'done',backendId:job.id,result:job.result,query:job.prompt}).length:0;
  return {leads,leadCount:leads.length,emailCount:emails};
}
function leadPublicEmail(lead){
  const match=String(lead?.contact||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]||'';
}
function firstUsableSentence(value,fallback='',limit=180){
  const cleaned=cleanLeadCell(value||fallback).replace(/^(官网公开联系方式|公开摘要|首轮动作|核验状态|优先级)[:：]/,'').trim();
  const sentence=(cleaned.match(/[^。；;.!?]+[。；;.!?]?/)||[cleaned])[0].trim();
  return sentence.slice(0,limit).replace(/[。；;]+$/,'');
}
function extractSectionBullets(text,heading){
  const lines=String(text||'').replace(/\r/g,'').split('\n');
  const items=[];let active=false;
  for(const raw of lines){
    const line=raw.trim();
    if(/^###\s+/.test(line)){active=line.includes(heading);continue}
    if(active&&/^[-*]\s+/.test(line))items.push(cleanLeadCell(line.replace(/^[-*]\s+/,'')));
    if(active&&/^\d+[.)]\s+/.test(line))items.push(cleanLeadCell(line.replace(/^\d+[.)]\s+/,'')));
  }
  return items.filter(Boolean).slice(0,3);
}
function leadResearchContext(lead){
  const nameKey=leadNameKey(lead?.name);
  const domain=String(lead?.domain||domainFromUrl(lead?.url)||'').toLowerCase();
  const jobs=(state.backendAiJobs||[]).filter(job=>job.skill==='company_research'&&job.status==='completed');
  const match=jobs.find(job=>{
    const text=`${job.prompt||''}\n${job.result||''}`.toLowerCase();
    return (domain&&text.includes(domain)) || (nameKey&&leadNameKey(text).includes(nameKey));
  });
  if(!match)return {facts:[],actions:[],unknowns:[],source:'客户名单公开摘要'};
  return {
    facts:extractSectionBullets(match.result,'关键事实'),
    actions:extractSectionBullets(match.result,'下一步动作'),
    unknowns:extractSectionBullets(match.result,'待确认'),
    source:'背调结果'
  };
}
function productPhraseForLead(lead){
  const text=`${state.liveTask?.query||''} ${lead?.summary||''} ${lead?.action||''}`.toLowerCase();
  if(/rug|rugs|地毯/.test(text))return 'commercial rugs and project carpets';
  if(/vinyl|pvc|lvt/.test(text))return 'vinyl flooring and project carpet options';
  if(/outdoor|户外|pet/.test(text))return 'outdoor rugs and recycled PET flooring options';
  if(/tile|tiles|瓷砖/.test(text))return 'flooring materials for commercial interiors';
  return 'commercial carpets and flooring materials';
}
function emailAngleForLead(lead,research,index){
  const text=`${lead?.name||''} ${lead?.summary||''} ${lead?.action||''} ${research.facts.join(' ')}`.toLowerCase();
  const angles=[
    {key:'project',label:'项目采购',test:/project|contract|工程|项目|hospital|school|office|mall|hotel|酒店|学校|医院|办公|商业/,subject:['project flooring options','your project flooring','spec question'],opener:'Your public profile points to commercial or project-based flooring work.',value:'We can match project use, budget range and loading needs before you spend time on a full quotation.',ask:'Would it be useful if I send a short product-match sheet first?'},
    {key:'distributor',label:'渠道补货',test:/distributor|wholesale|dealer|importer|分销|批发|进口/,subject:['carpet sourcing','new supply options','range question'],opener:'It looks like your team works as a distributor or sourcing channel.',value:'For that kind of channel, the first useful step is usually a compact range by price band, MOQ and carton/loading plan.',ask:'Should I send a short range list for your team to screen?'},
    {key:'retail',label:'零售选品',test:/retail|showroom|store|shop|零售|门店|家居/,subject:['retail range','rug selection','range fit'],opener:'Your public pages suggest a retail or showroom-facing business.',value:'We can group the range by style, size mix and margin-friendly price points instead of sending a broad catalog.',ask:'Would a narrowed selection be more useful than the full catalog?'},
    {key:'durability',label:'耐用场景',test:/stain|耐污|wear|heavy|traffic|durable|阻燃|易维护|high-traffic/,subject:['durable carpet options','high-traffic flooring','maintenance angle'],opener:'I noticed the public information emphasizes durability or easy maintenance.',value:'That usually matters most in hotel corridors, offices and public areas where replacement cost is painful.',ask:'May I send options focused on stain resistance and high-traffic use?'},
    {key:'verification',label:'采购入口核验',test:/contact|quote|inquiry|采购|联系人|核验|确认|官网未公开|表单/,subject:['right contact','supplier question','procurement route'],opener:'I could not confirm the exact purchasing contact from public information.',value:'Rather than send a broad pitch, I wanted to first check the right route for flooring supplier review.',ask:'Who is the best person to speak with about commercial carpet or flooring sourcing?'}
  ];
  return angles.find(angle=>angle.test.test(text))||angles[index%angles.length];
}
function subjectForAngle(angle,company,index){
  const subjects=angle.subject||['quick question'];
  const subject=subjects[index%subjects.length];
  if(index%4===0&&company&&company.length<28)return `${subject} for ${company}`;
  return subject;
}
function targetedEmailDraft(lead,index){
  const nameParts=String(lead?.name||`客户 ${index+1}`).split('/').map(part=>part.trim()).filter(Boolean);
  const company=nameParts.length>1?nameParts[nameParts.length-1]:nameParts[0];
  const research=leadResearchContext(lead);
  const angle=emailAngleForLead(lead,research,index);
  const summary=firstUsableSentence(research.facts[0]||lead?.summary,'public information about commercial flooring demand',190);
  const action=firstUsableSentence(research.actions[0]||lead?.action,'confirm the right purchasing or project contact',150);
  const unknown=firstUsableSentence(research.unknowns[0]||lead?.verify,'the exact purchasing route still needs confirmation',130);
  const product=productPhraseForLead(lead);
  const email=leadPublicEmail(lead);
  const greeting=/info@|sales@|contact@|admin@|office@/i.test(email)?'Hello':`Hello ${company} team`;
  const proofLines=[
    `We supply ${product} for hotels, offices, retail and public-space projects.`,
    `We can prepare a small, relevant selection instead of a general catalog.`,
    `We can also include size mix, MOQ and loading notes so your team can screen quickly.`
  ];
  const proof=proofLines[(index+angle.key.length)%proofLines.length];
  return {
    key:`${company}|${email||lead?.domain||index}`,
    company,
    email,
    recipientName:company,
    subject:subjectForAngle(angle,company,index),
    body:`${greeting},\n\n${angle.opener} The useful signal I found was: ${summary}.\n\n${proof} ${angle.value}\n\nBefore I send anything detailed, I want to avoid sending the wrong material. ${angle.ask}\n\nIf you are not the right person, could you point me to whoever handles supplier review or project procurement? ${action ? `I will keep the first step simple: ${action}.` : ''}\n\nBest regards,\nZhe`,
    note:email?'官网公开邮箱，可加入发送队列':'官网暂未公开邮箱，只能保存为线索，不能直接发送',
    angle:angle.label,
    basis:`${research.source}：${summary}；待核验：${unknown}`
  };
}
function recoverEmailTargets(task){
  const savedTargets=Array.isArray(task?.emailTargets)?task.emailTargets:[];
  const jobs=state.backendAiJobs||[];
  const emailJob=jobs.find(job=>job.id===task?.backendId)||jobs.find(job=>job.skill==='email_copilot'&&job.status==='completed'&&/开发信/.test(job.prompt||''));
  const promptRows=String(emailJob?.prompt||'').split('\n').map(line=>line.match(/^\s*\d+[.)]\s+(.+?)（([^）]+)）：(.+?)；切入点：(.+)$/)).filter(Boolean).map(match=>({name:match[1].trim(),domain:match[2].trim(),url:/^https?:\/\//.test(match[2].trim())?match[2].trim():`https://${match[2].trim()}`,summary:match[3].trim(),action:match[4].trim(),contact:''}));
  const resultRows=String(task?.result||emailJob?.result||'').match(/^###\s*\d+[.)]\s*(.+?)（([^）]+)）/gm)||[];
  const parsedResultRows=resultRows.map(line=>{const match=line.match(/^###\s*\d+[.)]\s*(.+?)（([^）]+)）/);return match?{name:match[1].trim(),domain:match[2].trim(),url:/^https?:\/\//.test(match[2].trim())?match[2].trim():`https://${match[2].trim()}`,summary:'',action:'确认采购联系人和项目需求',contact:''}:null}).filter(Boolean);
  const source=promptRows.length?promptRows:parsedResultRows;
  const leadJobs=jobs.filter(job=>job.skill==='lead_generation'&&job.status==='completed');
  const relatedLeadJobs=leadJobs.filter(job=>source.some(item=>String(job.result||'').includes(item.domain)));
  const candidatePools=(relatedLeadJobs.length?relatedLeadJobs:leadJobs).map(job=>({job,leads:extractLeadCandidates(job.result,job.prompt)})).sort((a,b)=>b.leads.length-a.leads.length);
  const leadJob=candidatePools[0]?.job;
  const leadCandidates=candidatePools[0]?.leads||[];
  const leadMap=Object.fromEntries(leadCandidates.map(lead=>[String(lead.domain||lead.url||lead.name).toLowerCase(),lead]));
  const enriched=source.map(item=>{const match=leadMap[item.domain.toLowerCase()]||leadMap[item.url.toLowerCase()];return match?{...item,...match,name:item.name||match.name,domain:item.domain||match.domain,url:item.url||match.url,summary:item.summary||match.summary,action:item.action||match.action}:item});
  // 旧任务曾把“选中的客户”截成前几家，并把这份截断结果保存到了本地。
  // 只要能从关联的找客户任务恢复出更完整的名单，就以名单为准，避免页面继续显示旧的 4 家。
  const selectedCustomers=/选中客户/.test(String(task?.query||''));
  if(selectedCustomers&&leadCandidates.length>Math.max(enriched.length,savedTargets.length))return leadCandidates;
  return savedTargets.length?savedTargets:enriched;
}
function emailDraftTargets(task){
  const source=recoverEmailTargets(task);
  return source.map((lead,index)=>targetedEmailDraft(lead,index)).filter(item=>item.company).slice(0,30);
}
function syncEmailSelectionState(){
  const selectAll=document.querySelector('[data-email-select-all]');
  const checks=Array.from(document.querySelectorAll('[data-email-index]'));
  if(!selectAll||!checks.length)return;
  const selected=checks.filter(input=>input.checked).length;
  selectAll.checked=selected===checks.length;
  selectAll.indeterminate=selected>0&&selected<checks.length;
  selectAll.setAttribute('aria-label',selectAll.checked?'取消全选开发信':'全选开发信');
}
function renderEmailDraftRow(draft,index,queuedKeys,sentKeys){
  const queued=queuedKeys.has(draft.key);
  const sent=sentKeys.has(draft.key);
  const locked=sent||queued;
  const status=sent?'✓ 已发送':queued?'⏳ 已入队':draft.email?'✓ 可发送':'⚠ 仅草稿';
  const selector=locked?'<span class="email-sent-mark" aria-label="该邮件已发送">✓</span>':`<input type="checkbox" data-email-index="${index}" aria-label="选择开发信 ${esc(draft.company)}">`;
  const rowClass=`email-draft-row ${locked?'queued':''} ${draft.email?'sendable':'draft-only'}`;
  return `<article class="${rowClass}"><div class="email-draft-side"><div class="email-draft-row-head"><label>${selector}<b>${esc(draft.company)}</b></label><span class="status ${draft.email?'green':'amber'}">${status}</span></div><div class="email-chip-row"><span class="email-chip">${draft.email?'官方邮箱':'缺邮箱'}</span><span class="email-chip">${esc(draft.angle||'客户核验')}</span></div><dl class="email-draft-facts"><div><dt>收件对象</dt><dd>${esc(draft.email||'未找到官网公开邮箱')}</dd></div><div><dt>个性化依据</dt><dd>${esc(draft.basis||'客户名单公开摘要')}</dd></div><div><dt>发送规则</dt><dd>${esc(draft.note)}</dd></div></dl></div><div class="email-draft-editor"><label class="field">邮件主题<input data-email-subject="${index}" value="${esc(draft.subject)}" ${locked?'disabled':''}></label><label class="field">邮件正文<textarea data-email-body="${index}" ${locked?'disabled':''}>${esc(draft.body)}</textarea></label></div></article>`;
}
function renderEmailDraftGroup(title,description,items,queuedKeys,sentKeys,open=false){
  if(!items.length)return '';
  return `<details class="email-draft-group" ${open?'open':''}><summary><span><b>${title}</b><small>${description}</small></span><em>${items.length} 封</em></summary><div class="email-draft-group-list">${items.map(item=>renderEmailDraftRow(item.draft,item.index,queuedKeys,sentKeys)).join('')}</div></details>`;
}
function renderEmailDraftPanel(task){
  if(task.skill!=='email_copilot'||task.status!=='done')return '';
  const drafts=emailDraftTargets(task);
  if(!drafts.length)return '';
  const queuedKeys=new Set(task.queuedEmailKeys||[]);
  const sentKeys=new Set((state.backendMailMessages||[]).filter(item=>item.direction==='outbound'&&item.status==='sent').flatMap(item=>{const recipients=Array.isArray(item.recipients)?item.recipients:[];return recipients.map(email=>`${item.sender_name||''}|${email}`)}));
  const withEmail=drafts.map((draft,index)=>({draft,index})).filter(item=>item.draft.email);
  const withoutEmail=drafts.map((draft,index)=>({draft,index})).filter(item=>!item.draft.email);
  const openWithEmail=withEmail.some(item=>!queuedKeys.has(item.draft.key)&&!sentKeys.has(item.draft.key));
  const openWithoutEmail=!openWithEmail&&withoutEmail.length>0;
  return `<section class="email-draft-panel"><div class="email-draft-head"><div><span class="section-label">批量开发信审核台</span><h3>已生成 ${drafts.length} 封差异化开发信</h3><p>每封都按客户背调信号生成不同切入点。先审核，再勾选发送；无官网公开邮箱的不会误发。</p></div><div class="email-draft-actions"><div class="email-stats" aria-label="开发信统计"><span><b>${drafts.length}</b>总数</span><span><b>${withEmail.length}</b>可发送</span><span><b>${withoutEmail.length}</b>需补邮箱</span></div><label class="email-select-all"><input type="checkbox" data-email-select-all aria-label="全选开发信"><span>全选可发送</span></label><button class="btn dark" data-action="send-selected-lead-emails" title="确认后直接通过已连接的 Gmail 发送">✉ 发送已勾选</button></div></div><div class="email-draft-list">${renderEmailDraftGroup('已找到官网公开邮箱','可勾选发送；建议先快速核验主题和切入点。',withEmail,queuedKeys,sentKeys,openWithEmail)}${renderEmailDraftGroup('未找到官网公开邮箱','只保留草稿和依据；补邮箱后再发送。',withoutEmail,queuedKeys,sentKeys,openWithoutEmail)}</div></section>`;
}
function taskSuggestions(skill){
  const suggestions={
    company_research:[['找官网联系方式','抓官网公开邮箱、电话、WhatsApp、表单和社交入口，后续验证。'],['写开发信','按这个客户背景写一封英文首封开发信。'],['放入观察','把该客户标记为观察并列出再看的条件。']],
    lead_generation:[['打开客户名单','请展示完整客户名单。'],['背调前3家','对前 3 家客户逐一判断是否值得开发。'],['生成首封开发信','为前 5 家客户生成简短英文开发信。']],
    contact_discovery:[['写核验邮件','根据官网公开联系方式，写一封英文核验邮件：确认是否为采购/项目负责人入口；不要正式推销，不承诺价格和交期。','email_copilot'],['写WhatsApp话术','根据官网公开电话，写一段简短英文 WhatsApp 核验话术：确认是否负责 commercial carpet/flooring procurement。','email_copilot'],['生成开发信','在联系方式核验通过后，生成一封简短英文首封开发信草稿。','email_copilot']],
    opportunity_coach:[['今天做什么','只列今天最该推进的 3 个动作。'],['写跟进信','为最该推进的客户写一封跟进邮件。']],
    quotation:[['生成报价草稿','按当前信息生成一份待人工确认的报价草稿。'],['缺什么参数','只列报价前还缺哪些参数。']]
  };
  return suggestions[skill]||[['生成一页摘要','把结论压缩成管理层一页摘要。'],['生成执行计划','根据结果给出今天可以执行的三个动作。']];
}

function splitMarkdownRow(line){
  return String(line||'').trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
}
function cleanLeadCell(value){
  return String(value||'').replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\s+/g,' ').trim();
}
function inferLeadCountry(query){
  const text=String(query||'');
  const rules=[['沙特','沙特阿拉伯'],['Saudi','沙特阿拉伯'],['德国','德国'],['法国','法国'],['荷兰','荷兰'],['迪拜','阿联酋'],['阿联酋','阿联酋'],['美国','美国'],['英国','英国'],['波兰','波兰']];
  return rules.find(([key])=>text.toLowerCase().includes(key.toLowerCase()))?.[1]||'待核验';
}
function domainFromUrl(url){
  try{return new URL(url).hostname.replace(/^www\./,'')}catch(error){return ''}
}
function leadNameKey(value){
  const stop=new Set(['commercial','flooring','solutions','solution','saudi','arabia','ksa','carpet','carpets','tile','tiles','rugs','rug','official','website','supplier','suppliers','distributor','retailer','importer','home']);
  return String(value||'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\u4e00-\u9fff]+/g,' ').split(/\s+/).filter(token=>token&&token.length>1&&!stop.has(token)).slice(0,6).join(' ');
}
function leadDedupeKey(name,url){
  const domain=domainFromUrl(url);
  return domain || leadNameKey(name);
}
function extractLeadCandidates(result,query=''){
  const lines=String(result||'').replace(/\r/g,'').split('\n');
  const leads=[];let header=null;const seenKeys=new Set();const seenNames=new Set();
  for(const line of lines){
    const trimmed=line.trim();
    if(!(trimmed.startsWith('|')&&trimmed.endsWith('|'))){header=null;continue}
    const cells=splitMarkdownRow(trimmed);
    if(cells.every(cell=>/^:?-{3,}:?$/.test(cell)))continue;
    const joined=cells.join(' ');
    if(/候选|官网|来源|优先级|首轮/.test(joined)&&!/https?:\/\//.test(joined)){header=cells;continue}
    if(!header||!cells.some(cell=>/^https?:\/\//.test(cell)))continue;
    const urlIndex=cells.findIndex(cell=>/^https?:\/\//.test(cell));
    const nameIndex=Math.max(1, header.findIndex(cell=>/候选|主体|客户|公司|名称/.test(cell)));
    const nameParts=cells.slice(nameIndex, urlIndex).filter(Boolean);
    const name=cleanLeadCell(nameParts.join(' / ')||cells[nameIndex]||domainFromUrl(cells[urlIndex]));
    const contactIndex=header.findIndex(cell=>/联系方式|联系|邮箱|电话/.test(cell));
    const summaryIndex=header.findIndex(cell=>/摘要|简介|公开摘要/.test(cell));
    const verifyIndex=header.findIndex(cell=>/核验|状态/.test(cell));
    const priorityIndex=header.findIndex(cell=>/优先/.test(cell));
    const actionIndex=header.findIndex(cell=>/动作|下一步|首轮/.test(cell));
    const rawContact=cleanLeadCell(contactIndex>=0?cells[contactIndex]:'');
    const contactLike=/@|邮箱|电话|WhatsApp|表单|社交|地址|官网未公开|mailto:|wa\.me|contact|quote|inquiry|\+\d/i.test(rawContact);
    const contact=contactLike?rawContact:'官网未公开';
    const summary=cleanLeadCell((summaryIndex>=0&&contactLike)?cells[summaryIndex]:(rawContact||cells[urlIndex+1]||''));
    const verify=cleanLeadCell(verifyIndex>=0?cells[verifyIndex]:(cells[urlIndex+2]||'待核验'));
    const priority=cleanLeadCell(priorityIndex>=0?cells[priorityIndex]:(cells[urlIndex+3]||'待评估'));
    const action=cleanLeadCell(actionIndex>=0?cells[actionIndex]:(cells[urlIndex+4]||'先核验官网、业务角色和采购联系人'));
    const dedupeKey=leadDedupeKey(name,cells[urlIndex]);
    const nameKey=leadNameKey(name);
    if(!name||seenKeys.has(dedupeKey)||(nameKey&&seenNames.has(nameKey)))continue;
    seenKeys.add(dedupeKey);
    if(nameKey)seenNames.add(nameKey);
    leads.push({
      name,
      url:cells[urlIndex],
      domain:domainFromUrl(cells[urlIndex]),
      country:inferLeadCountry(query),
      role:/distributor|分销/i.test(`${name} ${summary}`)?'分销商':(/retail|零售/i.test(`${name} ${summary}`)?'零售商':'待核验客户'),
      contact,
      summary,
      verify,
      priority,
      action
    });
  }
  return leads.slice(0,12);
}
function leadPayload(lead){
  return {
    name:lead.name,
    country:lead.country,
    role:lead.role,
    status:'待核验',
    domain:lead.domain,
    source:'AI找客户',
    owner:state.userName,
    description:`来源：${lead.url}\n官网公开联系方式：${lead.contact||'官网未公开'}\n公开摘要：${lead.summary||'待补充'}\n核验状态：${lead.verify||'待核验'}\n优先级：${lead.priority||'待评估'}`
  };
}
function leadVerificationLabel(value){
  const text=String(value||'');
  if(/官网访问失败|来源页面不是网页|官网跳转地址不可访问|官网抓取失败|仅保留搜索来源|仅搜索摘要|地图商户已核验，官网未提供/.test(text))return text;
  if(/官网主体与业务匹配|官网主体已核验，采购角色待核验/.test(text))return '官网与业务已核验';
  if(/官网已抽样核验|官网已核验|官网已确认/.test(text))return '官网已确认';
  if(/官网未公开|未发现官网公开联系方式/.test(text))return '官网已核验 · 未发现公开联系方式';
  if(/Hunter|第三方/.test(text))return '官网已检查 · 第三方邮箱';
  if(/历史公开来源|已检查官网/.test(text))return text;
  return text||'来源页面未完成核验';
}
function leadContactItems(value,context=''){
  const items=String(value||'').split(/[；;]+/).map(item=>item.trim()).filter(item=>item&&!/官网未公开/.test(item));
  const addItem=item=>{if(item&&!items.some(existing=>existing.includes(item)||item.includes(existing)))items.push(item)};
  const source=String(context||'');
  const emails=source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig)||[];
  emails.forEach(email=>addItem(`邮箱：${email}`));
  const phones=source.match(/(?:\+?[\d(][\d\s().-]{6,}\d)/g)||[];
  phones.filter(phone=>phone.replace(/\D/g,'').length>=7).forEach(phone=>addItem(`电话：${phone.trim()}`));
  const social=source.match(/https?:\/\/(?:www\.)?(?:linkedin\.com|wa\.me|api\.whatsapp\.com)\/[^\s；;]+/ig)||[];
  social.forEach(url=>addItem(/wa\.me|whatsapp/i.test(url)?`WhatsApp：${url}`:`社交链接：${url}`));
  return items.slice(0,12);
}
function renderLeadContactChips(value,context=''){
  const items=leadContactItems(value,context);
  if(!items.length)return '<span class="lead-contact-empty">官网未公开联系方式</span>';
  return items.map(item=>{
    const hunterMeta=item.match(/Hunter邮箱：[^（]+（Hunter发现(个人|通用)邮箱，置信度(\d+)）/);
    const clean=hunterMeta?`第三方邮箱 · ${hunterMeta[1]}邮箱 · 置信度${hunterMeta[2]}`:item.replace(/Hunter邮箱：/g,'邮箱：').replace(/（Hunter发现(个人|通用)邮箱，置信度(\d+)）/g,' · $1邮箱 · 置信度$2');
    const urlMatch=item.match(/https?:\/\/[^\s]+/);
    const emailMatch=item.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const target=urlMatch?.[0]?.replace(/[),.；;]+$/,'')||(emailMatch?`mailto:${emailMatch[0]}`:'');
    const text=target&&(urlMatch||emailMatch)?clean.replace((urlMatch||emailMatch)[0],'').trim():clean;
    return `<span class="lead-contact-chip"><span>${esc(text)}</span>${target?`<a href="${esc(target)}" ${target.startsWith('http')?'target="_blank" rel="noopener"':''}>${esc((urlMatch?.[0]||emailMatch?.[0]||'').replace(/^https?:\/\//,''))}</a>`:''}</span>`;
  }).join('');
}
function renderLeadImportPanel(task){
  if(task.skill!=='lead_generation'||task.status!=='done')return '';
  const leads=extractLeadCandidates(task.result,task.query);
  if(!leads.length)return '';
  return `<section class="lead-import-panel"><div class="lead-import-head"><div><span class="section-label">客户结果</span><h3>客户名单和联系方式</h3><p>每家公司已合并官网、公开邮箱、电话、WhatsApp、表单、社交链接和地址；勾选客户后可直接生成对应开发信。</p></div><div class="lead-import-actions"><button class="btn" data-action="select-priority-leads">重选高优先级</button><button class="btn dark" data-action="auto-process-leads">${ico('spark')}一键生成开发信</button><button class="btn" data-action="import-all-leads">${ico('plus')}保存全部到客户库</button><button class="btn" data-route="companies">查看客户库</button><button class="btn" data-action="import-selected-leads">导入勾选客户</button></div></div><div class="lead-import-table"><div class="lead-list-summary"><label class="lead-select-all"><input type="checkbox" data-lead-select-all aria-label="全选当前客户名单"><span>全选当前客户</span></label><span>共 ${leads.length} 家 · 联系方式已合并展示</span></div><div class="lead-card-grid">${leads.map((lead,index)=>{const checked=false;return `<article class="lead-card"><div class="lead-card-check"><input type="checkbox" data-lead-index="${index}" aria-label="选择 ${esc(lead.name)}" ${checked?'checked':''}></div><div class="lead-card-body"><div class="lead-card-title"><div><b>${esc(lead.name)}</b><small>${esc(lead.summary||'公开资料待补充')}</small></div><span class="status ${/高/.test(lead.priority)?'green':'amber'}">${esc(lead.priority)}</span></div><div class="lead-card-meta"><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(lead.domain||lead.url)}</a><span>${esc(leadVerificationLabel(lead.verify))}</span></div><div class="lead-contact-list">${renderLeadContactChips(lead.contact,lead.summary)}</div></div></article>`}).join('')}</div></div></section>`;
}
function renderLeadImportPanel(task){
  if(task.skill!=='lead_generation'||task.status!=='done')return '';
  const leads=extractLeadCandidates(task.result,task.query);
  if(!leads.length)return '';
  const rows=leads.map((lead,index)=>{const verification=leadVerificationLabel(lead.verify);const verificationTone=/官网未提供|待复核|未找到|待确认/.test(verification)?'is-review':'is-verified';return `<div class="lead-import-row"><div class="lead-row-check"><input type="checkbox" data-lead-index="${index}" aria-label="选择 ${esc(lead.name)}"></div><div class="lead-row-company"><b>${esc(lead.name)}</b><div class="lead-row-tags"><span class="lead-row-tag status-tag ${verificationTone}"><i></i><strong>核验状态</strong>：${esc(verification)}</span><span class="lead-row-tag priority-tag ${/高/.test(lead.priority)?'is-high':''}"><strong>是否值得跟进</strong>：${esc(lead.priority)}</span></div><small>${esc(lead.summary||'公开资料待补充')}</small></div><div class="lead-row-site"><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(lead.domain||lead.url)}</a><small>${esc(lead.url)}</small></div><div class="lead-row-contact">${renderLeadContactChips(lead.contact,lead.summary)}</div></div>`}).join('');
  return `<section class="lead-import-panel"><div class="lead-import-head"><div><span class="section-label">客户结果</span><h3>客户名单和联系方式</h3><p>真实公开网页线索已去重；核验状态和优先级已放在候选客户下方，方便快速判断。</p></div><div class="lead-import-actions"><button class="btn" data-action="select-priority-leads">重选高优先级</button><button class="btn dark" data-action="auto-process-leads">${ico('spark')}一键生成开发信</button><button class="btn" data-action="import-all-leads">${ico('plus')}保存全部到客户库</button><button class="btn" data-route="companies">查看客户库</button><button class="btn" data-action="import-selected-leads">导入勾选客户</button></div></div><div class="lead-import-table"><div class="lead-list-summary"><label class="lead-select-all"><input type="checkbox" data-lead-select-all aria-label="全选当前客户名单"><span>全选当前客户</span></label><span>共 ${leads.length} 家 · 联系方式已合并展示</span></div><div class="lead-import-row head"><div>全选</div><div>候选客户</div><div>官网</div><div>官网公开联系方式</div></div>${rows}</div></section>`;
}

function renderLeadQualityPanel(task){
  if(task.skill!=='lead_generation')return '';
  const leads=extractLeadCandidates(task.result,task.query);
  const requested=(String(task.query||'').match(/(?:输出数量|采集|找|寻找)[：:\s\S]{0,16}?(\d{1,2})\s*(?:条|家|个)?/)||[])[1]||'—';
  const verified=leads.filter(lead=>/官网主体与业务|官网已抽样核验|官网已确认/.test(lead.verify||'')).length;
  const withContact=leads.filter(lead=>leadPublicEmail(lead)||/电话|表单|WhatsApp/i.test(lead.contact||'')).length;
  const thirdParty=leads.filter(lead=>/Hunter|第三方/.test(lead.contact||'')).length;
  const auditLine=String(task.result||'').split('\n').find(line=>line.startsWith('公开检索审计：'))||'';
  return `<section class="lead-quality-panel"><div class="lead-quality-head"><div><span class="section-label">标准流程 · 结果审计</span><h3>${task.status==='done'?'本次结果审计':'正在按标准流程执行'}</h3><p>指定数量按目标检索；每条线索的官网、地图或来源页面情况直接写在“核验状态”中。</p></div><a class="text-button" href="销售线索标准流程.md" target="_blank" rel="noopener">查看流程标准 →</a></div><div class="lead-quality-steps"><span class="done">1. 定义产品/市场/角色</span><span class="${task.progress>=25?'done':''}">2. 多组公开检索</span><span class="${task.progress>=40?'done':''}">3. 初筛去重</span><span class="${task.progress>=72?'done':''}">4. 官网页面核验</span><span class="${task.progress>=91?'done':''}">5. 最终去重/联系方式/交付</span></div>${task.status==='done'?`<div class="lead-quality-stats"><div><b>${leads.length}</b><small>实际交付 / 目标 ${esc(requested)}</small></div><div><b>${verified}</b><small>官网业务已核验</small></div><div><b>${withContact}</b><small>有公开联系方式</small></div><div><b>${thirdParty}</b><small>第三方邮箱待确认</small></div></div>${auditLine?`<p class="lead-quality-note">${esc(auditLine)}</p>`:''}<p class="lead-quality-note">系统已完成公开检索、去重、来源核验和联系方式采集；发送前只需审核邮件、勾选对象并确认发送。</p>`:''}</section>`;
}
function renderLeadQualityPanel(){return ''}
function selectedLeadCandidates(){
  const leads=extractLeadCandidates(state.liveTask?.result,state.liveTask?.query);
  const checked=Array.from(document.querySelectorAll('[data-lead-index]:checked')).map(input=>Number(input.dataset.leadIndex)).filter(index=>Number.isFinite(index));
  return checked.map(index=>leads[index]).filter(Boolean);
}
function syncLeadSelectionState(){
  const selectAll=document.querySelector('[data-lead-select-all]');
  const checks=Array.from(document.querySelectorAll('[data-lead-index]'));
  if(!selectAll||!checks.length)return;
  const selected=checks.filter(input=>input.checked).length;
  selectAll.checked=selected===checks.length;
  selectAll.indeterminate=selected>0&&selected<checks.length;
  selectAll.setAttribute('aria-label',selectAll.checked?'取消全选当前客户名单':'全选当前客户名单');
}
function isSafeStoredJob(job){
  const text=`${job?.prompt||''}\n${job?.result||''}`;
  if(/本地演示|历史公开来源|公开来源缓存|只复用|搜索中转页|未生成演示结果/i.test(text))return false;
  if(/(?:baidu\.com|baike\.baidu\.com|zhihu\.com|google\.com|census\.gov|naics\.com|gs1us\.org|dummies\.com|franchise\.org|eumdr\.com|allianceexperts\.com|simplydepo\.com)/i.test(text))return false;
  return true;
}
function recentLeadJobs(){
  return (state.backendAiJobs||[]).filter(job=>job.skill==='lead_generation'&&job.status==='completed'&&isSafeStoredJob(job)&&/公开检索审计：|官网抽样核验：|官网已核验网址：/.test(job.result||'')&&extractLeadCandidates(job.result,job.prompt).length).slice(0,3);
}
function renderRecentLeadPanel(){
  const jobs=recentLeadJobs();
  const latestJobs=(state.backendAiJobs||[]).filter(job=>job.status==='completed'&&job.skill!=='lead_generation'&&isSafeStoredJob(job)).slice(0,3);
  if(!jobs.length&&!latestJobs.length)return '';
  const latest=jobs[0];
  const leads=latest?extractLeadCandidates(latest.result,latest.prompt):[];
  const title=(latest?.prompt||'最近找客户任务').replace(/\s+/g,' ').slice(0,70);
  const leadBlock=latest?`<div class="recent-work-head"><div><span class="section-label">刚才的结果在这里</span><h3>最近客户名单 · ${leads.length} 条</h3><p>${esc(title)}</p></div><div class="recent-work-actions"><button class="btn dark" data-action="open-ai-job" data-job-id="${esc(latest.id)}">查看完整名单</button><button class="btn" data-action="continue-first-lead" data-job-id="${esc(latest.id)}">背调第 1 家</button></div></div><div class="recent-lead-strip">${leads.slice(0,5).map((lead,index)=>`<article><b>${index+1}. ${esc(lead.name)}</b><small>${esc(lead.domain||lead.url)}</small><div><button class="text-button" data-action="research-lead" data-job-id="${esc(latest.id)}" data-lead-index="${index}">查客户 →</button><button class="text-button" data-action="email-lead" data-job-id="${esc(latest.id)}" data-lead-index="${index}">写信 →</button></div></article>`).join('')}</div>`:'';
  const jobBlock=latestJobs.length?`<div class="recent-job-list"><h4>最近输出</h4>${latestJobs.map(job=>`<button data-action="open-ai-job" data-job-id="${esc(job.id)}"><span>${esc(WORKFLOW_SKILLS[job.skill]?.name||job.skill)}</span><b>${esc((job.prompt||'').replace(/\s+/g,' ').slice(0,58))}</b><small>${esc(shortDate(job.finished_at||job.updated_at))}</small></button>`).join('')}</div>`:'';
  return `<section class="recent-work-panel">${leadBlock}${jobBlock}</section>`;
}
const ico = name => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const fmt = new Intl.NumberFormat('zh-CN');

const companies = [
  ['American Oriental Rug','美国 · 德州','买家','重点跟进','americanorientalrug.com','3','AI背调','今天 00:42'],
  ['MBG Global','波兰 · 华沙','分销商','提案中','mbg-global.eu','4','广交会','昨天 16:20'],
  ['Homla Sp. z o.o.','波兰 · 波兹南','零售商','谈判中','homla.com','2','AI找客户','08/01 09:15'],
  ['Bauhaus AG','德国 · 曼海姆','连锁零售','调研中','bauhaus.info','6','行业名录','07/30 18:04'],
  ['Nordic Living AB','瑞典 · 马尔默','品牌商','新线索','nordicliving.se','1','官网询盘','07/28 11:32']
];
const people = [
  ['Stefano Russo','American Oriental Rug','stefano@aorug.com','采购联系人','决策影响者','已回复','今天 10:24'],
  ['Marta Kowalska','MBG Global','marta@mbg-global.eu','采购负责人','决策人','等待方案','昨天'],
  ['Anna Nowak','Homla Sp. z o.o.','anna@homla.com','品类经理','使用者','待跟进','5 天前'],
  ['Thomas Weber','Bauhaus AG','thomas@bauhaus.info','采购总监','决策人','已验证','07/30'],
  ['Elin Larsson','Nordic Living AB','elin@nordicliving.se','创始人','决策人','新线索','07/28']
];
const products = [
  ['Aurora 羊毛手织地毯','RUG-AUR-01','家居软装','$82.00','200 件','22 天','已上架'],
  ['Nordic 平织地毯','RUG-NOR-02','家居软装','$46.50','300 件','18 天','已上架'],
  ['Tibetan 高密羊毛地毯','RUG-TIB-07','精品系列','$156.00','80 件','32 天','待审核'],
  ['户外 PET 再生地毯','RUG-PET-12','户外系列','$39.80','500 件','15 天','已上架'],
  ['定制楼梯地毯','RUG-CUS-03','定制系列','$18.20/m','100 米','25 天','草稿']
];
const tasks = [
  ['回复 Stefano 的高意向询盘','待处理','高','客户跟进','今天 11:30','者着'],
  ['复核 MBG 商品方案付款条款','进行中','高','方案复核','今天 15:00','者着'],
  ['给 Homla 生成提案后跟进邮件','待处理','中','AI任务','今天 17:00','AI助理'],
  ['确认南京知晓样品测试安排','待处理','中','样品','明天 10:00','者着'],
  ['导入广交会客户名单','已完成','低','数据整理','昨天 18:00','AI助理']
];
const opportunities = {
  research:[['Bauhaus 新品采购','Bauhaus AG','¥320,000','8 月 18 日'],['Nordic 秋季系列','Nordic Living AB','¥185,000','8 月 22 日']],
  proposal:[['MBG 年度地毯方案','MBG Global','¥680,000','8 月 12 日'],['Stefano 首单','American Oriental Rug','¥210,000','8 月 15 日']],
  negotiation:[['Homla 秋冬系列','Homla','¥960,000','8 月 10 日']],
  won:[['Mondo 家居订单','Mondo Casa','¥420,000','7 月 28 日'],['CasaPlus 补货单','CasaPlus','¥280,000','7 月 25 日']]
};
const quotes = [
  {id:'QT-2026-0081',company:'MBG Global',date:'2026-08-03',amount:'$38,620.00',status:'待确认'},
  {id:'QT-2026-0080',company:'Homla Sp. z o.o.',date:'2026-08-01',amount:'$26,800.00',status:'已发送'},
  {id:'QT-2026-0079',company:'American Oriental Rug',date:'2026-07-30',amount:'$12,480.00',status:'草稿'}
];
const samples = [
  ['SP-0812','MBG Global','Aurora 手织地毯','3 件','待寄出','8 月 8 日','者着'],
  ['SP-0810','Homla','Nordic 平织地毯','2 件','运输中','8 月 7 日','者着'],
  ['SP-0808','American Oriental Rug','定制楼梯地毯','6 米','已签收','8 月 2 日','AI助理'],
  ['SP-0803','Nordic Living AB','户外 PET 地毯','4 件','已反馈','7 月 29 日','者着']
];
const orders = [
  ['SO-2026-031','Mondo Casa','$58,200','生产中','8 月 22 日','30%','者着'],
  ['SO-2026-029','CasaPlus','$39,600','待出运','8 月 9 日','70%','者着'],
  ['SO-2026-026','MBG Global','$21,800','待确认','8 月 18 日','0%','AI助理'],
  ['SO-2026-018','Nordic Home','$44,100','已完成','7 月 26 日','100%','者着']
];

const shortDate = value => value ? String(value).slice(0,10) : '—';
const money = (value, currency='USD') => `${currency==='CNY'?'¥':'$'}${Number(value||0).toLocaleString('zh-CN',{minimumFractionDigits:currency==='CNY'?0:2,maximumFractionDigits:2})}`;
const fileSize = value => {
  const size=Number(value||0);
  if(size>=1024*1024)return `${(size/1024/1024).toFixed(1)} MB`;
  if(size>=1024)return `${(size/1024).toFixed(1)} KB`;
  return `${size} B`;
};

async function loadBackend({silent=true}={}){
  try{
    const [data,health]=await Promise.all([api('/bootstrap'),api('/health')]);
    Object.keys(backendRecords).forEach(key=>{backendRecords[key]=data[key]||[]});
    const companyNames=Object.fromEntries(data.companies.map(item=>[item.id,item.name]));
    companies.splice(0,companies.length,...data.companies.map(item=>[item.name,[item.country,item.city].filter(Boolean).join(' · '),item.role||'—',item.status||'—',item.domain||'—',String(item.contact_count||0),item.source||'—',shortDate(item.updated_at)]));
    people.splice(0,people.length,...data.people.map(item=>[item.name,companyNames[item.company_id]||'—',item.email||'—',item.contact_type||item.title||'—',item.decision_role||'—',item.status||'—',item.last_contact||'—']));
    products.splice(0,products.length,...data.products.map(item=>[item.name,item.sku,item.category||'—',money(item.price,item.currency),item.moq||'—',item.lead_time||'—',item.status||'—']));
    tasks.splice(0,tasks.length,...data.tasks.map(item=>[item.title,item.status||'待处理',item.priority||'中',item.task_type||'普通任务',item.due_at||'—',item.owner||'—']));
    Object.keys(opportunities).forEach(key=>{opportunities[key]=[]});
    data.opportunities.forEach(item=>{
      const stage=opportunities[item.stage]?item.stage:'research';
      opportunities[stage].push([item.name,item.company_name||'—',money(item.amount,item.currency),shortDate(item.expected_close),item.id,item.version]);
    });
    quotes.splice(0,quotes.length,...data.quotations.map(item=>({id:item.quote_no,company:item.company_name,date:shortDate(item.created_at),amount:money(item.amount,item.currency),status:item.status})));
    samples.splice(0,samples.length,...data.samples.map(item=>[item.sample_no,item.company_name,item.product_name||'—',item.quantity||'—',item.status||'待寄出',shortDate(item.expected_at),item.owner||'—']));
    orders.splice(0,orders.length,...data.orders.map(item=>[item.order_no,item.company_name,money(item.amount,item.currency),item.status||'待确认',shortDate(item.ship_at),`${item.payment_progress||0}%`,item.owner||'—']));
    state.backendDashboard=data.dashboard;
    state.aiProvider=health.ai_provider_name||health.ai_provider||'local';
    state.aiModel=health.ai_model||'';
    state.backendFiles=data.files||[];
    state.backendFileShares=data.file_shares||[];
    state.backendFolders=data.folders||[];
    state.backendMailAccounts=data.mail_accounts||[];
    state.mailConnected=state.backendMailAccounts.length>0;
    try{
      const mailStatus=await api('/mail/google-smtp/status');
      state.mailSenderEmail=mailStatus?.from||state.backendMailAccounts[0]?.email||'';
      state.mailCanSend=Boolean(mailStatus?.configured);
      state.mailAccountStatus=mailStatus?.account_status||'not_connected';
    }catch(error){
      state.mailSenderEmail=state.backendMailAccounts[0]?.email||'';
      state.mailCanSend=false;
      state.mailAccountStatus='unknown';
    }
    state.backendMailMessages=state.mailConnected?await api('/mail/messages'):[];
    state.backendConnectAccounts=data.connect_accounts||[];
    state.backendOutreachJobs=data.outreach_jobs||[];
    state.backendAutomations=data.automations||[];
    state.automationRuns=data.automation_runs||[];
    state.backendConversations=data.conversations||[];
    state.backendAiJobs=data.recent_ai_jobs||[];
    if(state.liveTask?.skill==='email_copilot'&&state.liveTask.status==='done'){
      const recoveredTargets=recoverEmailTargets(state.liveTask);
      if(recoveredTargets.length&&(recoveredTargets.length>=(state.liveTask.emailTargets?.length||0)))state.liveTask.emailTargets=recoveredTargets;
    }
    state.backendAgents=data.agents||[];
    state.backendMembers=data.members||[];
    state.apiTokens=data.api_tokens||[];
    state.workspaceSettings=Object.fromEntries((data.settings||[]).map(item=>[item.setting_key,item.value]));
    state.backendAutomations.forEach(item=>{state.automations[item.automation_key]=Boolean(item.enabled)});
    state.authUser=data.user||null;
    const profile=state.workspaceSettings.profile;
    const organization=state.workspaceSettings.organization;
    if(profile){state.userName=profile.userName||state.userName;state.preferredTone=profile.preferredTone||state.preferredTone}
    if(organization?.name)state.orgName=organization.name;
    state.backendOnline=true;
    updateUserChrome();
    save();
    render();
    // 刷新页面或重新打开任务时，自动恢复真实后端任务轮询，避免停在旧进度。
    if(state.liveTask?.backendId&&['running','queued'].includes(state.liveTask.status)&&!window.taskPollTimer){
      window.taskPollTimer=setTimeout(()=>pollAiTask(state.liveTask.backendId),0);
    }
    if(!silent)showToast('后端数据已同步');
    return data;
  }catch(error){
    state.backendOnline=false;
    if(error.status===401)openLogin('登录已过期，请重新登录');
    if(!silent)showToast(`后端暂不可用：${error.message}`);
    return null;
  }
}

function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function updateUserChrome(){
  const user=state.authUser||{name:state.userName,email:'demo@yuanfan.local',role:'owner'};
  const initial=(user.name||'用').slice(0,1).toUpperCase();
  document.querySelector('#user-avatar').textContent=initial;
  document.querySelector('#user-display-name').textContent=user.name||state.userName;
  document.querySelector('#user-workspace-label').textContent=user.role==='owner'?'所有者工作区':'成员工作区';
  document.querySelector('#menu-user-name').textContent=user.name||state.userName;
  document.querySelector('#menu-user-email').textContent=user.email||'未登录';
  const loggedIn=Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
  document.querySelector('#logout-action').hidden=!loggedIn;
  document.querySelector('#auth-action').textContent=loggedIn?'账户与安全':'登录工作区';
}
function openLogin(subtitle='使用工作区账户登录，令牌只保存在当前浏览器。'){
  openModal('登录工作区',subtitle,`<div class="settings-panel"><div class="form-section"><label class="field">邮箱<input id="login-email" type="email" value="demo@yuanfan.local" autocomplete="username"></label><label class="field">密码<input id="login-password" type="password" value="yuanfan-demo" autocomplete="current-password"></label><p style="font-size:11px;color:var(--muted)">本地演示账号已填好；正式部署可替换为组织成员账号。</p><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="submit-login">登录</button></div></div></div>`,false);
}
function openAccountSecurity(){
  if(!localStorage.getItem(AUTH_TOKEN_KEY)){openLogin();return}
  openModal('账户与安全','修改当前账户密码；正式部署后请立即替换演示密码。',`<div class="settings-panel"><div class="form-section"><p><b>${esc(state.authUser?.name||state.userName)}</b> · ${esc(state.authUser?.email||'')}</p><label class="field">当前密码<input id="current-password" type="password" autocomplete="current-password"></label><label class="field">新密码（至少 10 位）<input id="new-password" type="password" autocomplete="new-password"></label><label class="field">确认新密码<input id="confirm-password" type="password" autocomplete="new-password"></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="change-password">更新密码</button></div></div></div>`,false);
}
async function changePassword(){
  const current_password=document.querySelector('#current-password')?.value||'';const new_password=document.querySelector('#new-password')?.value||'';const confirm=document.querySelector('#confirm-password')?.value||'';
  if(new_password!==confirm){showToast('两次输入的新密码不一致');return}
  try{await api('/auth/change-password',{method:'POST',body:JSON.stringify({current_password,new_password})});closeModal();showToast('密码已更新')}
  catch(error){showToast(`更新失败：${error.message}`)}
}
async function submitLogin(){
  const email=document.querySelector('#login-email')?.value.trim();
  const password=document.querySelector('#login-password')?.value||'';
  if(!email||!password){showToast('请输入邮箱和密码');return}
  try{
    const result=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    localStorage.setItem(AUTH_TOKEN_KEY,result.access_token);
    state.authUser=result.user;closeModal();await loadBackend();showToast('登录成功');
  }catch(error){showToast(`登录失败：${error.message}`)}
}
async function logout(){
  try{await api('/auth/logout',{method:'POST'})}catch(error){}
  localStorage.removeItem(AUTH_TOKEN_KEY);state.authUser=null;updateUserChrome();openLogin('已退出当前会话，你可以重新登录。');
}
function routeTo(route, push = true){
  state.route = route;
  save();
  if(push) history.replaceState(null, '', `#/${route}`);
  render();
  if(innerWidth < 861){sidebar.classList.remove('mobile-open');document.querySelector('#mobile-menu').setAttribute('aria-expanded','false')}
  main.focus({preventScroll:true});
}
function updateNav(){
  document.querySelectorAll('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === state.route));
  shell.classList.toggle('collapsed', state.collapsed);
  moreNav.classList.toggle('open', state.moreOpen);
  document.querySelector('#more-toggle').setAttribute('aria-expanded', String(state.moreOpen));
}
function pageTop(title, subtitle, actions=''){
  return `<div class="page-top"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
}
function composer(value=''){
  const modelLabel=state.aiProvider==='deepseek'?'DeepSeek':state.aiProvider==='local'?'本地':'AI';
  const modelTitle=state.aiModel?`${modelLabel} · ${state.aiModel}`:'本地执行器';
  return `<div class="composer-wrap"><div class="composer"><textarea id="chat-input" aria-label="给 AI 发送消息" placeholder="输入你的任务，或粘贴公司网址...">${esc(value)}</textarea><div class="composer-foot"><button class="mini-icon" data-action="upload" title="上传文件">${ico('upload')}</button><button class="mini-icon" data-action="insert-link" title="插入网址">${ico('link')}</button><button class="send-button" data-action="send-chat" aria-label="发送消息" ${value ? '' : 'disabled'}>${ico('send')}</button></div></div><button class="model-pill" data-action="model" title="${esc(modelTitle)}">${esc(modelLabel)}</button></div>`;
}

const WORKFLOW_SKILLS={
  lead_generation:{name:'找潜在买家',icon:'search',description:'输入产品和国家，生成去重后的优先开发客户名单。',fields:[['product','你卖什么产品','input','例如：商用地毯、手工羊毛地毯',true],['market','想开发哪个国家/地区','input','例如：沙特、德国、法国',true],['customerType','想找哪类客户','select',['进口商、分销商、零售商','品牌方','电商卖家','工程/酒店采购'],false],['scale','客户规模','select',['小型、中型','中型、大型','不限'],false],['sources','优先查哪里','chips',['官网与搜索','社交媒体','贸易记录','B2B 平台'],false],['quantity','输出数量','select',['10','20','30'],false]]},
  opportunity_coach:{name:'跟进已沟通客户',icon:'deal',description:'客户问过价或聊过之后，判断下一步该催单、补资料、寄样还是暂停。',fields:[['scope','要跟进哪些客户','select',['当前全部活跃商机','提案中商机','谈判中商机','我负责的商机'],false],['goal','这次想推进什么','select',['促成下一次沟通','确认报价与规格','推进样品','确认付款条款'],false],['deadline','行动时限','select',['今天完成','48 小时内','本周完成'],false]]},
  company_research:{name:'查客户靠不靠谱',icon:'spark',description:'输入公司名或官网，判断这家公司是否真实、匹配、值得开发。',fields:[['target','公司名称或官网','input','例如：https://example.com',true],['depth','查询深度','select',['标准：主体、业务、风险与建议','深入：增加渠道、供应链与匹配度','快速：合作前基础核验'],false],['materials','参考资料','chips',['官网','已上传文件','工作区资料'],false]]},
  contact_discovery:{name:'找官网联系方式',icon:'person',description:'输入公司官网，尽量完整抓取邮箱、电话、WhatsApp、表单和社交入口。',fields:[['target','目标公司或官网','input','最好粘贴官网，例如：https://example.com',true],['category','目标品类','input','例如：商用地毯、地面材料',false],['roles','优先角色','chips',['采购','项目经理','供应链','老板/总经理'],false]]},
  trade_analysis:{name:'查进口记录（需数据）',icon:'quote',description:'需要海关/贸易数据源；没接入前只分析你提供的记录和公开线索。',fields:[['target','目标公司或官网','input','请输入名称或网址',true],['product','产品或 HS 编码','input','选填，例如：地毯 / 5702',false],['period','观察周期','select',['近 12 个月','近 24 个月','近 36 个月'],false]]},
  quotation:{name:'做报价单',icon:'quote',description:'输入产品、数量、贸易条款，生成可人工确认的报价草稿。',fields:[['customer','客户与目的地','input','例如：德国柏林的零售商',true],['product','产品 / 规格 / 数量 / 包装','input','例如：160×230cm，300 件，卷装',true],['incoterm','贸易术语','select',['FOB 上海','EXW 工厂','CIF 目的港','DAP','DDP'],false],['payment','付款偏好','select',['T/T 30% 定金，70% 发货前','样品付款后安排','待确认'],false]]},
  email_copilot:{name:'写开发/跟进信',icon:'mail',description:'把客户背景变成英文开发信、催复信或报价跟进信。',fields:[['context','邮件或客户背景','input','粘贴往来要点或客户需求',true],['goal','本次目标','select',['推进询盘','报价跟进','样品确认','催复','处理异议'],false],['tone','语气','select',['简洁专业','友好推进','坚定谈判'],false]]},
  general_sales:{name:'配产品方案',icon:'product',description:'根据客户市场和预算，组合产品、卖点、MOQ、交期和样品策略。',fields:[['market','目标市场 / 客户类型','input','例如：法国中端家居零售商',true],['scenario','应用场景与预算','input','例如：客厅地毯，零售价 €199–299',true],['focus','方案重点','select',['性价比与交期','设计与差异化','装柜与物流效率'],false]]}
};
const PRIMARY_WORKFLOW_SKILLS=['lead_generation','company_research','contact_discovery','email_copilot','quotation'];
const WORKFLOW_CENTER_ORDER=['lead_generation','company_research','contact_discovery','email_copilot','quotation','general_sales','opportunity_coach','trade_analysis'];
const SECONDARY_WORKFLOW_HINTS={opportunity_coach:'已有客户后再用',trade_analysis:'需数据源/上传记录'};

function workflowField([key,label,type,options,required]){
  const current=state.workflowValues[key]||'';
  const requiredMark=required?'<b class="required-mark">*</b>':'';
  if(type==='select')return `<label class="workflow-field">${label}${requiredMark}<select data-workflow-field="${key}" aria-label="${label}">${options.map(option=>`<option ${current===option?'selected':''}>${esc(option)}</option>`).join('')}</select></label>`;
  if(type==='chips'){
    const selected=current||options[0];
    return `<div class="workflow-field workflow-field-wide"><span>${label}${requiredMark}</span><div class="workflow-chips">${options.map(option=>`<button type="button" class="workflow-chip ${selected===option?'active':''}" data-action="workflow-choice" data-field="${key}" data-value="${esc(option)}">${esc(option)}</button>`).join('')}</div></div>`;
  }
  return `<label class="workflow-field">${label}${requiredMark}<input data-workflow-field="${key}" value="${esc(current)}" placeholder="${esc(options)}" aria-label="${label}"></label>`;
}

function workflowComposer(skill){
  const config=WORKFLOW_SKILLS[skill];
  if(!config)return composer();
  return `<div class="workflow-wrap"><div class="workflow-card"><div class="workflow-head"><div><span class="workflow-icon">${ico(config.icon)}</span><div><b>@${config.name}</b><small>${config.description}</small></div></div><button class="mini-icon" data-action="close-workflow" title="关闭技能" aria-label="关闭技能">×</button></div><div class="workflow-fields">${config.fields.map(workflowField).join('')}</div><div class="workflow-foot"><span>系统会组合专业任务并引用工作区资料；没有证据的信息会标为待核验。</span><div><button class="mini-icon" data-action="upload" title="上传文件">${ico('upload')}</button><button class="btn primary" data-action="submit-workflow" data-skill="${skill}">开始执行 ${ico('send')}</button></div></div></div></div>`;
}

function collectWorkflowValues(){
  const values={...state.workflowValues};
  document.querySelectorAll('[data-workflow-field]').forEach(field=>{values[field.dataset.workflowField]=field.value.trim()});
  (WORKFLOW_SKILLS[state.activeWorkflow]?.fields||[]).filter(field=>field[2]==='chips').forEach(field=>{if(!values[field[0]])values[field[0]]=field[3][0]});
  return values;
}

function buildWorkflowPrompt(skill,values){
  const v=(key,fallback='未提供')=>values[key]||fallback;
  const prompts={
    lead_generation:`@找潜在买家\n产品：${v('product')}\n目标市场：${v('market')}\n客户类型：${v('customerType')}；客户规模：${v('scale')}；优先数据源：${v('sources')}；输出数量：${v('quantity','10')}。\n请输出销售能直接用的客户清单，客户名单和公开联系方式必须在同一张表：#、候选主体/页面、官网或来源、公开联系方式（邮箱/电话/WhatsApp/表单/社交/地址）、公开摘要、核验状态、优先级。系统先按域名和公司名初筛去重，再自动完成官网核验、全部公开联系方式采集和最终去重，不要把系统工作变成用户待办；有邮箱的客户下一步直接进入针对性开发信生成。联系方式应尽量包含官网公开邮箱、电话、WhatsApp、Contact/Quote表单、LinkedIn/其他官方社交入口和公司地址；抓不到就写官网未公开。每行要短；没有可验证来源时不得编造公司。`,
    opportunity_coach:`@跟进已沟通客户\n范围：${v('scope')}；本次目标：${v('goal')}；行动时限：${v('deadline')}。\n请只挑最该推进的前 3 个，按“为什么排前、今天唯一动作、给客户的一句话、升级/放弃条件”输出。不要长报告，不要复杂评分表。`,
    company_research:`@查客户靠不靠谱\n目标公司：${v('target')}\n背调深度：${v('depth')}；资料范围：${v('materials')}。\n请用短格式判断是否值得开发：结论与优先级、3-6条关键事实、最多3个待确认、今天3个动作、一段首次核验话术。没有证据的信息标为“待核验”，不要风险矩阵和长篇背景。`,
    contact_discovery:`@找官网联系方式\n目标公司：${v('target')}；目标品类：${v('category')}；优先角色：${v('roles')}。\n尽量完整输出从目标公司官网抓到的公开邮箱、电话、WhatsApp、Contact/Quote表单、LinkedIn/其他官方社交入口、联系人页和公司地址。不要输出待核验联系人、可能职位、搜索建议；抓不到就明确写未找到官网公开联系方式。必须说明这些入口未经过人工通话/回信验证，地址和社交入口不等于可直接发送的邮箱。`,
    trade_analysis:`@查进口记录（需数据）\n目标公司：${v('target')}；产品/HS 编码：${v('product')}；观察周期：${v('period')}。\n请只分析已上传、已提供或可核验的贸易线索；如果没有海关/贸易数据源，请明确说明“当前没有真实贸易记录数据源，不能声称查到了进口记录”。在有数据时再做主体消歧、采购品类、来源国、频次、时间趋势、可能供应商和主体混淆风险，并严格区分“已证实 / 合理推断 / 待核验”。`,
    quotation:`@做报价单\n客户与目的地：${v('customer')}\n产品/规格/数量/包装：${v('product')}\n贸易术语：${v('incoterm')}；付款偏好：${v('payment')}。\n请先列缺失参数；资料足够时给报价草稿：产品、数量、币种、贸易术语、交期、MOQ、付款、有效期、不包含项。最终价格、运费和利润率标为人工确认。`,
    email_copilot:`@写开发/跟进信\n客户背景/往来上下文：${v('context')}\n本次目标：${v('goal')}；语气：${v('tone')}。\n请输出客户意图、不能承诺的点、英文主题、英文正文和中文备注。正文 120-180 英文词，默认只生成草稿，不发送。`,
    general_sales:`@配产品方案\n目标市场/客户类型：${v('market')}\n应用场景与预算：${v('scenario')}\n方案重点：${v('focus')}。\n请输出最小可执行产品方案：推荐主推款、备选款、为什么适合、还缺哪些参数、一段客户沟通话术。不要长篇解释。`
  };
  return prompts[skill]||'';
}

function activateWorkflow(skill){
  if(!WORKFLOW_SKILLS[skill])return;
  state.activeWorkflow=skill;state.workflowValues={};save();
  if(modalLayer.classList.contains('open'))closeModal(true);
  routeTo('new-task');
}

function chooseWorkflowValue(button){
  state.workflowValues[button.dataset.field]=button.dataset.value;save();render();
}

async function submitWorkflow(skill){
  const config=WORKFLOW_SKILLS[skill];
  const values=collectWorkflowValues();
  const missing=config.fields.filter(field=>field[4]&&!values[field[0]]).map(field=>field[1]);
  if(missing.length){showToast(`请先填写：${missing.join('、')}`);return}
  const query=buildWorkflowPrompt(skill,values);
  state.workflowValues={};state.activeWorkflow='';state.liveTask={query,progress:8,status:'running',result:''};save();routeTo('live-task');
  try{const job=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt:query,skill})});state.backendOnline=true;state.liveTask.backendId=job.id;state.liveTask.progress=job.progress||0;save();pollAiTask(job.id)}
  catch(error){state.backendOnline=false;showToast('真实检索服务不可用，未生成演示结果');runLocalTask(query)}
}

function renderOneClickLauncher(){
  return `<section class="one-click-panel"><div class="one-click-copy"><span class="section-label">一键开发</span><h2>客户名单 + 联系方式一次出</h2><p>填产品和市场，系统会把客户、官网公开邮箱、电话、WhatsApp、表单、社交入口、优先级和核验状态放在同一张表里。</p></div><div class="one-click-form"><label>产品<input id="one-product" value="商用地毯" placeholder="商用地毯、户外地毯、手工羊毛地毯"></label><label>目标市场<input id="one-market" value="沙特" placeholder="沙特、德国、法国"></label><label class="wide">客户类型<select id="one-type"><option>进口商、分销商、工程/酒店采购</option><option>零售商、家居卖场</option><option>品牌方、电商卖家</option><option>不限，系统自己判断</option></select></label><label>数量<select id="one-quantity"><option>10</option><option>20</option><option>30</option></select></label><button class="btn dark one-click-submit" data-action="start-one-click">${ico('spark')}开始</button></div></section>`;
}

async function startOneClickDevelopment(){
  const product=document.querySelector('#one-product')?.value.trim();
  const market=document.querySelector('#one-market')?.value.trim();
  const customerType=document.querySelector('#one-type')?.value.trim()||'进口商、分销商、工程/酒店采购';
  const quantity=Number(document.querySelector('#one-quantity')?.value||10);
  if(!product||!market){showToast('先填产品和目标市场');return}
  const query=`一键开发客户：${market} · ${product} · ${quantity}条`;
  state.liveTask={query,skill:'lead_generation',progress:8,status:'running',result:'',oneClick:true};
  save();routeTo('live-task');
  try{
    const job=await api('/one-click/development',{method:'POST',body:JSON.stringify({product,market,customer_type:customerType,quantity,goal:'找到能马上开始首轮开发的客户，并生成下一步动作'})});
    state.backendOnline=true;
    state.liveTask.backendId=job.id;
    state.liveTask.progress=job.progress||0;
    save();
    pollAiTask(job.id);
  }catch(error){
    state.backendOnline=false;
    showToast('真实检索服务不可用，未生成演示结果');
    const prompt=buildWorkflowPrompt('lead_generation',{product,market,customerType,scale:'不限',sources:'官网与搜索',quantity:String(quantity)});
    state.liveTask.query=prompt;
    save();
    runLocalTask(prompt);
  }
}

function renderNewTask(){
  return `<section class="chat-page one-click-home"><div class="chat-welcome simplified"><div class="chat-greeting"><small>${esc(state.userName)}，${new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '夜深了'}！</small><h1>直接开始开发客户</h1><p>客户名单和官网公开联系方式会一起出来，不用分开跑。</p></div>${renderOneClickLauncher()}<div class="simple-actions"><button class="quick-action" data-action="activate-workflow" data-skill="company_research">${ico('spark')}查单个客户</button><button class="quick-action" data-action="activate-workflow" data-skill="email_copilot">${ico('mail')}只写一封信</button><button class="quick-action muted" data-action="show-more-skills">${ico('chevron')}高级工具</button></div>${renderRecentLeadPanel()}</div>${state.activeWorkflow?workflowComposer(state.activeWorkflow):composer('帮我找沙特的商用地毯进口商，输出10条客户，并把官网公开联系方式一起列出来。')}</section>`;
}

function renderDashboard(){
  const dash=state.backendDashboard||{};
  const stageMap=Object.fromEntries((dash.stages||[]).map(item=>[item.stage,item]));
  const stageRows=[['research','调研中'],['proposal','提案中'],['negotiation','谈判中'],['won','赢单']].map(([key,label])=>{const item=stageMap[key]||{count:0,amount:0};return [label,item.count||0,money(item.amount||0,'CNY'),`${Math.min(100,Math.max(8,Number(item.count||0)*18))}%`]});
  const enabledAutomations=state.backendAutomations.filter(item=>item.enabled);
  return `<section class="dashboard"><div class="dashboard-top"><div><span class="section-label">远帆 AI / AI 工作台</span><h1>今天先处理这些事</h1></div><div><div class="dash-toolbar"><div class="search-control" data-action="command">${ico('search')}<input readonly placeholder="搜索客户、邮件、商机或 AI 会话"><kbd>⌘K</kbd></div><button class="btn" data-action="settings">设置偏好</button><button class="btn soft">本地工作区</button><button class="btn icon-button" data-action="refresh" title="刷新">↻</button></div></div></div>
  <div class="sample-banner"><b>${state.backendOnline?`后端已连接 · ${state.aiProvider==='deepseek'?'DeepSeek 已接入':'数据实时保存'}`:'离线演示模式'}</b><span>${state.backendOnline?`客户、任务、知识库和 AI 任务均已接入本地业务服务${state.aiModel?`，当前模型 ${esc(state.aiModel)}`:''}。`:'启动后端后，工作台会自动同步并持久化业务数据。'}</span></div>
  <div class="brief"><div class="brief-main"><div class="brief-kicker"><span>实时简报</span><span>读取当前工作区</span><span class="status green">已更新</span></div><h2>${new Date().getHours()<12?'早上好':new Date().getHours()<18?'下午好':'夜深了'}，<em>${esc(state.userName)}</em></h2><p>当前有 ${dash.pending_tasks||0} 条未完成任务、${dash.active_opportunities||0} 个活跃商机和 ${dash.unread_mail||0} 封待处理邮件。所有外发动作仍需人工确认。</p><div class="brief-checks"><span>任务数据已同步</span><span>商机阶段已汇总</span><span>自动化运行可审计</span></div></div><div class="brief-ai"><div class="brief-ai-title"><b>最近自动化运行</b><span>${state.automationRuns.length?'已保存到数据库':'暂无运行记录'}</span></div>${state.automationRuns.length?state.automationRuns.slice(0,3).map(run=>`<div class="run-item"><div><span>${esc(state.backendAutomations.find(item=>item.automation_key===run.automation_key)?.name||run.automation_key)}</span><b>${run.status==='completed'?'完成':esc(run.status)}</b></div><i style="--run:${run.status==='completed'?'100%':'35%'}"></i></div>`).join(''):`<div class="run-item"><div><span>可在“设置 → 自动任务”手动运行</span><b>待命</b></div><i style="--run:8%"></i></div>`}</div></div>
  <div class="metric-grid"><article class="card metric-card"><small>需要你接手</small><strong>${dash.pending_tasks??7}</strong><span>任务队列中的未完成事项</span></article><article class="card metric-card"><small>待处理邮件</small><strong>${dash.unread_mail??12}</strong><span>AI 已识别客户意图</span></article><article class="card metric-card"><small>活跃商机</small><strong>${dash.active_opportunities??23}</strong><span>管道金额 ${money(dash.pipeline_amount||3050000,'CNY')}</span></article><article class="card metric-card"><small>AI 后台任务</small><strong>${dash.ai_running??0}</strong><span>运行、排队与待确认</span></article></div>
  <div class="dash-grid"><div><section class="card"><div class="card-head"><div><h2>优先处理</h2><p>AI 按紧急程度、客户价值和是否需要你确认排序</p></div></div><div class="priority-list">
    ${[['01','回复 Stefano 的高意向询盘','客户询问 catalog 和 40HQ 装柜信息，AI 已匹配 6 个商品','确认回复','mail'],['02','复核 MBG Global 的商品方案','3 个 SKU 的卖点和交付节奏已整理，付款条款待确认','打开方案','quotations'],['03','Homla 商机停在提案阶段','最后联系在 5 天前，建议今天补一封跟进邮件','生成跟进','opportunities']].map(x=>`<article class="priority-item"><span class="priority-num">${x[0]}</span><div><h3>${x[1]}</h3><p>${x[2]}</p></div><button class="btn" data-route="${x[4]}">${x[3]}</button></article>`).join('')}
  </div></section><section class="card" style="margin-top:14px"><div class="card-head"><div><h2>今日动作</h2><p>行动队列</p></div><button class="text-button" data-route="tasks">查看全部 →</button></div><div class="action-list">${[['MAIL','把 Stefano 的 catalog 回复改成更短版本','等待 2h 14m','意向值 92'],['PLAN','检查 MBG 商品方案里的付款条款','3 个 SKU','今日截止'],['DEAL','给 Homla 生成提案后跟进邮件','停滞 5 天','高意向'],['TASK','确认南京知晓样品测试安排','样品任务','建议今日发出']].map(x=>`<article class="action-item"><span class="action-type">${x[0]}</span><div><h3>${x[1]}</h3><div class="action-meta"><span class="tag">${x[2]}</span><span class="tag">${x[3]}</span></div></div><button class="btn" data-route="new-task">处理</button></article>`).join('')}</div></section></div>
  <aside><section class="card"><div class="card-head"><div><h2>商机雷达</h2><p>数据库实时阶段</p></div><button class="text-button" data-route="opportunities">打开商机</button></div><div class="radar">${stageRows.map(x=>`<div class="radar-row"><span>${x[0]} · ${x[1]}</span><div class="radar-track"><i style="--w:${x[3]}"></i></div><b>${x[2]}</b></div>`).join('')}</div></section><section class="card" style="margin-top:14px"><div class="card-head"><div><h2>异常提醒</h2><p>基于当前工作区</p></div></div><div class="alert-list">${[[`${dash.pending_tasks||0} 条任务仍待处理`,'建议优先完成高优先级和今日截止任务',dash.pending_tasks||0],[`${dash.unread_mail||0} 封邮件等待处理`,state.mailConnected?'草稿外发仍需人工确认':'连接邮箱后可同步真实邮件',dash.unread_mail||0],[`${enabledAutomations.length} 条自动任务已启用`,'运行记录可在设置中审计',enabledAutomations.length]].map(x=>`<article class="alert"><div><h3>${x[0]}</h3><p>${x[1]}</p></div><strong>${x[2]}</strong></article>`).join('')}</div></section><section class="card" style="margin-top:14px"><div class="card-head"><div><h2>AI 运行状态</h2><p>真实运行记录</p></div><button class="text-button" data-action="settings-automation">管理</button></div><div class="alert-list">${enabledAutomations.slice(0,3).map(item=>`<article class="alert"><div><h3>${esc(item.name)}</h3><p>${item.last_run_at?`最近运行 ${shortDate(item.last_run_at)}`:`计划 ${esc(item.schedule)}`}</p></div><span class="status green">已启用</span></article>`).join('')||'<p class="lead">暂无已启用的自动任务</p>'}</div></section></aside></div></section>`;
}

function companyContactText(record){
  const description=String(record?.description||'');
  const match=description.match(/官网公开联系方式：([^\n]+)/);
  return (match?.[1]||'官网未公开').trim();
}
function renderCustomerLibrary(){
  const records=backendRecords.companies||[];
  const cards=records.map(record=>{
    const contact=companyContactText(record);
    const contactCount=leadContactItems(contact,record.description).length;
    const libraryStatus=/已|确认/.test(record.status||'')?record.status:'已保存';
    const searchText=[record.name,record.domain,record.country,record.city,record.role,record.status,record.source,record.description,contact].filter(Boolean).join(' ');
    const website=record.domain?(String(record.domain).startsWith('http')?record.domain:`https://${record.domain}`):'';
    return `<article class="customer-library-card" data-customer-card data-customer-search="${esc(searchText.toLowerCase())}"><div class="customer-card-identity"><span class="entity-logo">${esc(String(record.name||'客').slice(0,2).toUpperCase())}</span><div><h3>${esc(record.name||'未命名客户')}</h3><p>${esc([record.country,record.city,record.role].filter(Boolean).join(' · ')||'客户信息待补充')}</p><span class="status ${/已|确认/.test(libraryStatus)?'green':'amber'}">${esc(libraryStatus)}</span></div></div><div class="customer-card-site"><small>官网 / 来源</small>${website?`<a href="${esc(website)}" target="_blank" rel="noopener">${esc(record.domain)}</a>`:'<span class="customer-empty">暂未记录官网</span>'}<em>${esc(record.source||'AI找客户')}</em></div><div class="customer-card-contacts"><div class="customer-card-contact-head"><b>公开联系方式</b><span>${esc(contactCount)} 项</span></div><div class="lead-contact-list">${renderLeadContactChips(contact,record.description)}</div></div><div class="customer-card-actions"><button class="btn" data-action="edit-entity" data-type="companies" data-id="${esc(record.id||'')}">查看客户</button><small>${esc(record.owner||'')}</small></div></article>`;
  }).join('');
  return `<section class="page toolbar-page customer-library-page"><div class="toolbar-top"><div><h1>客户库</h1><p>集中管理已保存客户、官网和公开联系方式；可直接查看、背调或生成开发信。</p></div><span class="section-label">${records.length} 家客户</span><div class="toolbar-actions"><div class="search-control">${ico('search')}<input data-customer-library-search placeholder="搜索公司、官网、邮箱、电话"></div><button class="btn dark" data-route="new-task">${ico('plus')}找新客户</button></div></div><div class="customer-library-toolbar"><div><b>已保存客户</b><small>联系方式按邮箱、电话、表单、社交链接和地址整理</small></div><span>搜索结果会即时筛选</span></div><div class="customer-library-grid">${cards?`<div class="customer-library-columns"><span>客户</span><span>官网 / 来源</span><span>公开联系方式</span><span>操作</span></div>${cards}`:'<div class="customer-library-empty"><h3>客户库还是空的</h3><p>在客户名单结果中点击“保存全部到客户库”，以后就能在这里统一搜索。</p><button class="btn dark" data-route="new-task">去找客户</button></div>'}</div></section>`;
}
function renderEntityTable(type){
  const configs = {
    tasks:{title:'任务',subtitle:'集中处理跟进、审核和 AI 生成的待办。',tabs:['全部','我的','今日','逾期','已完成'],count:`共 ${tasks.length} 条任务`,button:'新建任务',headers:['任务','状态','优先级','类型','截止时间','负责人'],rows:tasks},
    products:{title:'商品',subtitle:'维护商品规格、价格、装柜量和交付能力，供 AI 生成方案。',tabs:['全部','已上架','草稿','待审核'],count:`共 ${products.length} 个商品`,button:'新增商品',headers:['商品名称','SKU','分类','FOB 价格','MOQ','交期','状态'],rows:products},
    companies:{title:'公司',subtitle:'管理客户主体、合作状态与最近活动。',tabs:['全部','我负责的','我参与的'],count:`共 ${companies.length} 家公司`,button:'新建公司',headers:['公司名称','国家/地区','合作角色','合作状态','主域名','联系人','来源','最近更新'],rows:companies},
    people:{title:'联系人',subtitle:'管理关键联系人、决策角色和触达状态。',tabs:['全部','我负责的','我参与的'],count:`共 ${people.length} 位联系人`,button:'新建联系人',headers:['联系人','所属公司','主邮箱','联系人类型','决策角色','联系状态','最近联系'],rows:people},
    samples:{title:'样品',subtitle:'跟踪寄样、签收、测试反馈和后续转化。',tabs:['全部','待寄出','运输中','已签收','已反馈'],count:`共 ${samples.length} 个样品任务`,button:'新建样品',headers:['样品单号','客户','商品','数量','物流状态','预计到达','负责人'],rows:samples},
    orders:{title:'订单',subtitle:'从确认到出运，跟踪交付、收款与异常。',tabs:['全部','待确认','生产中','待出运','已完成'],count:`共 ${orders.length} 个订单`,button:'新建订单',headers:['订单号','客户','金额','状态','预计出运','收款进度','负责人'],rows:orders}
  };
  const c = configs[type];
  const colCount = c.headers.length;
  const grid = `44px ${Array(colCount).fill('minmax(120px,1fr)').join(' ')} 72px`;
  return `<section class="page toolbar-page"><div class="toolbar-top"><h1>${c.title}</h1><div class="tabs">${c.tabs.map((t,i)=>`<button class="tab ${i===0?'active':''}" data-action="table-tab" data-type="${type}" data-filter="${esc(t)}">${t}</button>`).join('')}</div><span class="section-label">${c.count}</span><div class="toolbar-actions"><div class="search-control">${ico('search')}<input data-table-search="${type}" placeholder="搜索当前${c.title}"></div><button class="btn" data-action="sort-table" data-type="${type}">${ico('sort')}排序</button><button class="btn dark" data-action="create-entity" data-type="${type}">${ico('plus')}${c.button}</button></div></div><div class="table-wrap"><div class="data-table" style="min-width:${Math.max(1000,colCount*145+100)}px"><div class="table-row header" style="grid-template-columns:${grid}"><div><input type="checkbox" aria-label="全选"></div>${c.headers.map(h=>`<div>${h} ↕</div>`).join('')}<div>操作</div></div>${c.rows.map((row,ri)=>{const record=backendRecords[type]?.[ri];const id=record?.id||'';return `<div class="table-row" data-table-row data-record="${esc(row.join(' '))}" style="grid-template-columns:${grid}"><div><input type="checkbox" ${state.completedTasks[`${type}-${ri}`]?'checked':''} data-row-check="${type}-${ri}" data-resource="${type}" data-id="${esc(id)}"></div>${row.map((cell,ci)=>`<div>${ci===0?`<span class="entity"><span class="entity-logo">${esc(String(cell).slice(0,2).toUpperCase())}</span><span>${esc(cell)}</span></span>`:ci===row.length-1&&['已上架','已完成','已反馈','100%'].includes(cell)?`<span class="status green">${esc(cell)}</span>`:ci===row.length-1&&['草稿','待审核'].includes(cell)?`<span class="status amber">${esc(cell)}</span>`:esc(cell)}</div>`).join('')}<div><button class="mini-icon" data-action="edit-entity" data-type="${type}" data-id="${esc(id)}" title="编辑">✎</button></div></div>`}).join('')}<button class="add-row" data-action="create-entity" data-type="${type}">＋ 添加一行</button></div></div></section>`;
}

function renderTasks(){
  const jobs=(state.backendAiJobs||[]).filter(job=>job.status==='completed'||job.status==='running'||job.status==='queued').slice(0,60);
  const completedJobs=jobs.filter(job=>job.status==='completed');
  const leadTotal=completedJobs.reduce((sum,job)=>sum+aiTaskMetrics(job).leadCount,0);
  const jobCards=jobs.length?jobs.map(job=>{
    const metrics=aiTaskMetrics(job);
    const isDone=job.status==='completed';
    const statusText=isDone?'已完成':job.status==='running'?'执行中':'排队中';
    const statusClass=isDone?'green':'amber';
    const resultHint=metrics.leadCount?`${metrics.leadCount} 条客户线索`:metrics.emailCount?`${metrics.emailCount} 封开发信`:(isDone?'有执行结果':'等待结果');
    return `<article class="task-result-card" data-task-search="${esc(`${aiTaskTitle(job)} ${job.prompt||''} ${skillLabel(job.skill)}`)}"><div class="task-result-main"><span class="status ${statusClass}">${statusText}</span><h3>${esc(aiTaskTitle(job))}</h3><p>${esc(aiTaskSummary(job))}</p><div class="task-result-meta"><span>${esc(skillLabel(job.skill))}</span><span>${esc(resultHint)}</span><span>${esc(shortDate(job.finished_at||job.updated_at||job.created_at))}</span></div></div><div class="task-result-actions">${metrics.leadCount?`<button class="btn dark" data-action="resume-ai-job" data-job-id="${esc(job.id)}">导入/写信</button>`:`<button class="btn dark" data-action="resume-ai-job" data-job-id="${esc(job.id)}">继续处理</button>`}<button class="btn" data-action="open-ai-job" data-job-id="${esc(job.id)}">查看成果</button></div></article>`;
  }).join(''):`<div class="empty-state" style="min-height:180px"><div><h3>还没有 AI 成果任务</h3><p>从“新建任务”开始找客户、背调或写开发信，完成后会自动沉淀到这里。</p><button class="btn dark" data-route="new-task">去新建任务</button></div></div>`;
  return `<section class="page toolbar-page"><div class="toolbar-top"><div><h1>任务成果</h1><p>这里只放 AI 已经产出的东西：客户名单、背调报告、开发信草稿。点进去就能继续执行，不让成果浪费。</p></div><div class="toolbar-actions"><div class="search-control">${ico('search')}<input data-task-result-search placeholder="搜索客户名单、背调、开发信"></div><button class="btn dark" data-route="new-task">${ico('plus')}新建 AI 任务</button></div></div><section class="card task-results-section"><div class="card-head"><div><h2>AI 任务成果</h2><p>对标任由 AI 的核心任务流：历史结果可追溯、可复用、可继续下一步。</p></div><div class="email-stats"><span><b>${completedJobs.length}</b>已完成</span><span><b>${leadTotal}</b>客户线索</span><span><b>${jobs.length}</b>总任务</span></div></div><div class="task-result-list">${jobCards}</div></section></section>`;
}

function renderMailLegacy(){
  if(!state.mailConnected){
    return `<section class="mail-page"><div class="toolbar-top"><div><h1 style="font-size:20px;margin:0 0 5px">绑定我的发件邮箱</h1><p style="font-size:10px;color:var(--muted);margin:0">每个内测用户都要绑定自己的 Gmail，系统不会共用管理员邮箱。</p></div></div><div class="mail-content"><div class="card mail-connect"><div><div class="empty-visual" style="margin:0 0 14px;width:42px;height:42px;border-radius:9px">${ico('mail')}</div><h2>先绑定你自己的 Gmail</h2><p>绑定后，开发信会从你的邮箱发出；没有绑定时只能生成草稿，不能真实发送。</p><button class="btn dark" data-action="google-mail-setup">${ico('spark')}绑定我的 Gmail →</button><button class="btn" data-route="mail-setup-task" style="margin-left:6px">查看绑定教程</button></div><div><h2>${ico('spark')} 需要准备什么</h2><ul><li>你的 Gmail 邮箱地址</li><li>Google 账号已开启两步验证</li><li>Google 账号生成的 16 位“应用专用密码”</li></ul></div></div></div></section>`;
  }
  const fallback=[['','Stefano Russo','Re: Catalog and 40HQ loading','请发送最新目录和装柜信息，我们希望本周确认。','10:24'],['','Marta Kowalska','Payment terms for quotation','Could you confirm the 30/70 payment terms?','昨天'],['','Anna Nowak','Autumn collection follow-up','We are still reviewing the proposal internally.','5 天前'],['','Thomas Weber','New supplier registration','Please complete the attached supplier form.','7/30']];
  const mailItems=state.backendMailMessages.length?state.backendMailMessages.map(item=>[item.id,item.sender_name,item.subject,item.body_text,shortDate(item.created_at)]):fallback;
  const selected=state.backendMailMessages.find(item=>item.id===state.selectedMailId)||state.backendMailMessages[0];
  return `<section class="mail-page"><div class="toolbar-top"><h1>邮件</h1><div class="toolbar-actions"><div class="search-control">${ico('search')}<input data-mail-search placeholder="搜索邮件"></div><button class="btn" data-action="disconnect-mail">断开账户</button><button class="btn dark" data-action="compose-mail">${ico('plus')}写邮件</button></div></div><div class="mail-inbox"><aside class="mail-folders"><button class="folder active"><span>收件箱</span><b>${mailItems.length}</b></button><button class="folder"><span>已加星标</span><b>0</b></button><button class="folder"><span>已发送</span></button><button class="folder"><span>草稿</span></button><button class="folder"><span>待跟进</span><b>${mailItems.filter(x=>x[4]!=='queued').length}</b></button><button class="folder"><span>垃圾箱</span></button></aside><div class="mail-list"><div class="mail-search search-control">${ico('search')}<input data-mail-search placeholder="筛选当前邮箱"></div>${mailItems.map((m,i)=>`<article class="mail-item ${(selected?.id||mailItems[0]?.[0])===m[0]?'active':''}" data-action="select-mail" data-mail-id="${esc(m[0])}"><div class="mail-item-head"><b>${esc(m[1])}</b><small>${esc(m[4])}</small></div><h3>${esc(m[2])}</h3><p>${esc(m[3])}</p></article>`).join('')}</div><article class="mail-reader"><div class="mail-reader-meta"><span class="avatar">${esc((selected?.sender_name||'SR').slice(0,2).toUpperCase())}</span><div><b>${esc(selected?.sender_name||'Stefano Russo')}</b><div style="font-size:9px;color:var(--muted);margin-top:3px">${esc(selected?.sender_email||'stefano@aorug.com')} · 发给我</div></div><span class="status green" style="margin-left:auto">意向值 ${selected?.intent_score||92}</span></div><h2>${esc(selected?.subject||'Re: Catalog and 40HQ loading')}</h2><div class="mail-body"><p>Hi,</p><p>${esc(selected?.body_text||'Thanks for the introduction. Please send your latest catalog and the loading quantity for a 40HQ container. We would like to review the wool rug collection this week.')}</p><p>Best regards,<br>${esc(selected?.sender_name?.split(' ')[0]||'Stefano')}</p></div><div class="ai-draft"><div style="display:flex;align-items:center;gap:7px"><span style="color:var(--violet)">${ico('spark')}</span><b>AI 建议回复</b><span class="status green" style="margin-left:auto">简洁专业</span></div><textarea id="mail-draft">${esc(selected?.draft_text||`Hi Stefano,\n\nThank you for your interest. I have attached our latest wool rug catalog. A 40HQ container can load approximately 2,400–2,800 pieces depending on the size mix.\n\nCould you share your preferred sizes and target quantity? I will prepare a precise loading plan and quotation today.\n\nBest regards,\nZhe`)}</textarea><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-action="save-draft" data-mail-id="${esc(selected?.id||'')}">保存草稿</button><button class="btn dark" data-action="queue-mail" data-mail-id="${esc(selected?.id||'')}">确认并加入发送队列 →</button></div></div></article></div></section>`;
}

function renderMail(){
  if(!state.mailConnected)return renderMailLegacy();
  const fallback=[{id:'demo-1',sender_name:'Stefano Russo',sender_email:'stefano@aorug.com',subject:'Re: Catalog and 40HQ loading',body_text:'请发送最新目录和装柜信息，我们希望本周确认。',created_at:'10:24',direction:'inbound',status:'received',intent_score:92,draft_text:''},{id:'demo-2',sender_name:'Marta Kowalska',sender_email:'marta@example.com',subject:'Payment terms for quotation',body_text:'Could you confirm the 30/70 payment terms?',created_at:'昨天',direction:'inbound',status:'received',intent_score:85,draft_text:''}];
  const allMessages=state.backendMailMessages.length?state.backendMailMessages:fallback;
  const pendingStatuses=['queued','needs_connection'];
  const folderFilters={收件箱:item=>item.direction!=='outbound'&&item.status!=='deleted',已加星标:()=>false,待发送:item=>pendingStatuses.includes(item.status),已发送:item=>item.status==='sent',草稿:item=>Boolean(item.draft_text)&&item.status==='drafted',待跟进:item=>Number(item.intent_score||0)>=70&&!pendingStatuses.includes(item.status),垃圾箱:item=>item.status==='deleted'};
  const visibleMessages=allMessages.filter(folderFilters[state.mailFolder]||folderFilters.收件箱);
  const selected=visibleMessages.find(item=>item.id===state.selectedMailId)||visibleMessages[0];
  const counts={收件箱:allMessages.filter(folderFilters.收件箱).length,已加星标:0,已发送:allMessages.filter(folderFilters.已发送).length,草稿:allMessages.filter(folderFilters.草稿).length,待跟进:allMessages.filter(folderFilters.待跟进).length,垃圾箱:allMessages.filter(folderFilters.垃圾箱).length};
  counts.待发送=allMessages.filter(folderFilters.待发送).length;
  const folders=['收件箱','待发送','已发送','草稿','待跟进','垃圾箱'];
  const defaultDraft=selected?`Hi ${selected.sender_name?.split(' ')[0]||''},\n\nThank you for your interest. I will prepare the requested information and quotation today.\n\nBest regards,\nZhe`:'';
  const activeMailFrom=state.mailSenderEmail||state.backendMailAccounts[0]?.email||'未绑定个人发件箱';
  const mailBindingHint=state.mailCanSend?`✅ 已绑定个人发件箱：${esc(activeMailFrom)}`:`⚠ 还没绑定可发送邮箱：请先绑定自己的 Gmail 应用专用密码`;
  const statusText={received:'已收到',drafted:'草稿',queued:'待发送',needs_connection:'待连接邮箱',sent:'已发送',deleted:'已删除'};
  const statusClass=status=>status==='sent'?'green':pendingStatuses.includes(status)?'amber':'green';
  const reader=selected?`<article class="mail-reader"><div class="mail-reader-meta"><span class="avatar">${esc((selected.sender_name||'邮件').slice(0,2).toUpperCase())}</span><div><b>${esc(selected.sender_name||'未知发件人')}</b><div style="font-size:9px;color:var(--muted);margin-top:3px">${esc(selected.sender_email||'')} · ${selected.direction==='outbound'?'发给客户':'发给我'}</div></div><span class="status ${statusClass(selected.status)}" style="margin-left:auto">${esc(statusText[selected.status]||selected.status||'')}</span></div><h2>${esc(selected.subject||'无主题')}</h2><div class="mail-body"><p>${esc(selected.body_text||'暂无正文')}</p></div><div class="ai-draft"><div style="display:flex;align-items:center;gap:7px"><span style="color:var(--violet)">${ico('spark')}</span><b>${selected.direction==='outbound'?'待发送正文':'AI 建议回复'}</b><span class="status ${statusClass(selected.status)}" style="margin-left:auto">${selected.direction==='outbound'?(state.mailCanSend?'可发送':'待绑定邮箱'):'简洁专业'}</span></div><textarea id="mail-draft" aria-label="邮件草稿">${esc(selected.draft_text||defaultDraft)}</textarea><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-action="save-draft" data-mail-id="${esc(selected.id)}">保存草稿</button>${selected.direction==='outbound'?`<button class="btn dark" data-action="send-mail-now" data-mail-id="${esc(selected.id)}" ${state.mailCanSend?'':'disabled'}>用我的 Gmail 发送 →</button>`:`<button class="btn dark" data-action="queue-mail" data-mail-id="${esc(selected.id)}">确认并加入发送队列 →</button>`}</div>${selected.direction==='outbound'&&!state.mailCanSend?`<p style="font-size:11px;color:var(--muted);margin:10px 0 0">请先绑定自己的 Gmail 应用专用密码。未绑定时不会从管理员邮箱发出。</p>`:selected.status==='needs_connection'?`<p style="font-size:11px;color:var(--muted);margin:10px 0 0">当前发件：${esc(activeMailFrom)}。可以直接确认发送；如果失败，再检查邮箱授权。</p>`:''}</div></article>`:`<article class="mail-reader empty-state"><div><h3>${esc(state.mailFolder)}暂无邮件</h3><p>切换其他文件夹或同步邮箱后再查看。</p></div></article>`;
  return `<section class="mail-page"><div class="toolbar-top"><div><h1>邮件</h1><p style="font-size:11px;color:var(--muted);margin:4px 0 0">${mailBindingHint}</p></div><div class="toolbar-actions"><div class="search-control">${ico('search')}<input data-mail-search aria-label="搜索邮件" placeholder="搜索邮件"></div><button class="btn" data-action="google-mail-setup">${state.mailCanSend?'更换我的 Gmail':'绑定我的 Gmail'}</button><button class="btn dark" data-action="auto-send-mail-queue" ${(counts.待发送&&state.mailCanSend)?'':'disabled'}>立即发送待发送${counts.待发送?`(${counts.待发送})`:''}</button><button class="btn" data-action="disconnect-mail">断开账户</button><button class="btn" data-action="compose-mail">${ico('plus')}写邮件</button></div></div>${state.mailCanSend?'':`<div class="card" style="margin:0 30px 14px;padding:14px;background:#fff8ed;border-color:#f0d5a3"><b>发送前需要绑定自己的 Gmail</b><p style="font-size:11px;color:var(--muted);margin:6px 0 0">内测用户各自绑定自己的邮箱；未绑定时只能保存草稿，不会从管理员邮箱发送。</p><button class="btn dark" data-action="google-mail-setup" style="margin-top:10px">去绑定 Gmail</button></div>`}<div class="mail-inbox"><aside class="mail-folders" aria-label="邮件文件夹">${folders.map(folder=>`<button class="folder ${state.mailFolder===folder?'active':''}" data-action="mail-folder" data-mail-folder="${folder}" aria-pressed="${state.mailFolder===folder}"><span>${folder}</span><b>${counts[folder]||''}</b></button>`).join('')}</aside><div class="mail-list"><div class="mail-search search-control">${ico('search')}<input data-mail-search aria-label="筛选当前邮箱" placeholder="筛选当前邮箱"></div>${visibleMessages.map(item=>`<button class="mail-item ${selected?.id===item.id?'active':''}" data-action="select-mail" data-mail-id="${esc(item.id)}"><span class="mail-item-head"><b>${esc(item.sender_name||'未知发件人')}</b><small>${esc(shortDate(item.created_at))}</small></span><h3>${esc(item.subject||'无主题')}</h3><p>${esc(item.body_text||'')}</p></button>`).join('')||`<div class="empty-state" style="min-height:180px"><p>当前文件夹没有邮件</p></div>`}</div>${reader}</div></section>`;
}

function renderDriveLegacy(){
  const fallback=[{id:'',name:'产品知识库',mime_type:'文件夹',updated_at:'今天 00:30',size:0},{id:'',name:'2026 产品目录与 FOB 价格.xlsx',mime_type:'XLSX',updated_at:'昨天 18:20',size:2516582},{id:'',name:'外贸沟通规范.md',mime_type:'MD',updated_at:'昨天 14:05',size:18432},{id:'',name:'装柜与物流规则.pdf',mime_type:'PDF',updated_at:'08/01 10:12',size:5033164}];
  const files=state.backendOnline?state.backendFiles:fallback;
  const folders=state.backendOnline?state.backendFolders:[];
  return `<section class="page wide"><div class="drive-top"><div style="display:flex;align-items:center;gap:12px"><h1 style="font-size:21px;margin:0">网盘</h1><div class="drive-tabs"><button class="tab active">我的文件</button><button class="tab">团队文件</button><button class="tab">我的分享</button></div><div class="toolbar-actions"><button class="btn" data-action="new-folder">新建文件夹</button><button class="btn dark" data-action="upload">${ico('upload')}上传文件</button></div></div></div><div class="card knowledge-banner"><span>${ico('spark')}</span><div><h3>组织知识库已启用</h3><p>AI 会在背调、报价、写邮件和商机建议中引用已授权的产品、交付与沟通规则。</p></div><button class="btn" data-action="settings-org">管理组织能力</button></div><div class="card drive-table"><div class="drive-row" style="color:var(--muted);font-size:10px"><div>名称</div><div>修改时间</div><div>状态 / 大小</div><div>操作</div></div>${folders.map(f=>`<div class="drive-row"><div class="drive-file"><span class="drive-icon">DIR</span><b>${esc(f.name)}</b></div><div>${esc(shortDate(f.updated_at))}</div><div>${esc(f.path)}</div><div><button class="mini-icon" data-action="delete-folder" data-folder-id="${esc(f.id)}" title="删除空文件夹">×</button></div></div>`).join('')}${files.map(f=>`<div class="drive-row"><div class="drive-file"><span class="drive-icon">${esc((f.name.split('.').pop()||f.mime_type||'文件').slice(0,5).toUpperCase())}</span><b>${esc(f.name)}</b></div><div>${esc(shortDate(f.updated_at))}</div><div>${esc(f.knowledge_status||'已保存')} · ${fileSize(f.size)}</div><div style="display:flex"><button class="mini-icon" data-action="download-file" data-file-id="${esc(f.id)}" title="下载">↓</button><button class="mini-icon" data-action="file-more" data-file-id="${esc(f.id)}" title="管理">${ico('dots')}</button></div></div>`).join('')}${state.backendOnline&&!folders.length&&!files.length?`<div class="empty-state" style="min-height:180px;grid-column:1/-1"><div><p>还没有文件，上传后会自动进入知识解析。</p></div></div>`:''}</div><div class="drop-zone" id="drop-zone"><b>添加文件</b><p>将文件拖放到此处，或点击上传到知识库</p><button class="btn" data-action="upload">选择文件</button></div></section>`;
}

function renderDrive(){
  const tabs=['我的文件','团队文件','我的分享'];
  const shares=state.backendFileShares.map(item=>({...item,id:item.file_id,isShare:true,updated_at:item.created_at}));
  const files=state.driveTab==='我的分享'?shares:state.backendFiles;
  const folders=state.driveTab==='我的分享'?[]:state.backendFolders;
  const hint=state.driveTab==='团队文件'?'当前组织尚未配置独立团队归属，因此展示组织内全部文件。':state.driveTab==='我的分享'?'仅展示仍在有效期内的分享记录。':'展示当前账户可管理的文件与文件夹。';
  const rows=folders.map(folder=>`<div class="drive-row"><div class="drive-file"><span class="drive-icon">DIR</span><b>${esc(folder.name)}</b></div><div>${esc(shortDate(folder.updated_at))}</div><div>${esc(folder.path)}</div><div><button class="mini-icon" data-action="delete-folder" data-folder-id="${esc(folder.id)}" aria-label="删除空文件夹 ${esc(folder.name)}">×</button></div></div>`).join('')+files.map(file=>`<div class="drive-row"><div class="drive-file"><span class="drive-icon">${esc((file.name.split('.').pop()||file.mime_type||'文件').slice(0,5).toUpperCase())}</span><b>${esc(file.name)}</b></div><div>${esc(shortDate(file.updated_at))}</div><div>${file.isShare?`有效至 ${esc(shortDate(file.expires_at))}`:`${esc(file.knowledge_status||'已保存')} · ${fileSize(file.size)}`}</div><div style="display:flex">${file.isShare?`<button class="mini-icon" data-action="share-file" data-file-id="${esc(file.id)}" aria-label="重新生成 ${esc(file.name)} 的分享链接">↗</button>`:`<button class="mini-icon" data-action="download-file" data-file-id="${esc(file.id)}" aria-label="下载 ${esc(file.name)}">↓</button><button class="mini-icon" data-action="file-more" data-file-id="${esc(file.id)}" aria-label="管理 ${esc(file.name)}">${ico('dots')}</button>`}</div></div>`).join('');
  return `<section class="page wide"><div class="drive-top"><div style="display:flex;align-items:center;gap:12px"><h1 style="font-size:21px;margin:0">网盘</h1><div class="drive-tabs" role="tablist" aria-label="网盘视图">${tabs.map(tab=>`<button class="tab ${state.driveTab===tab?'active':''}" role="tab" aria-selected="${state.driveTab===tab}" data-action="drive-tab" data-drive-tab="${tab}">${tab}</button>`).join('')}</div><div class="toolbar-actions"><button class="btn" data-action="new-folder">新建文件夹</button><button class="btn dark" data-action="upload">${ico('upload')}上传文件</button></div></div><p class="drive-hint">${hint}</p></div><div class="card knowledge-banner"><span>${ico('spark')}</span><div><h3>组织知识库已启用</h3><p>AI 会引用已授权的产品、交付与沟通规则。</p></div><button class="btn" data-action="settings-org">管理组织能力</button></div><div class="card drive-table"><div class="drive-row" style="color:var(--muted);font-size:10px"><div>名称</div><div>修改时间</div><div>状态 / 大小</div><div>操作</div></div>${rows||`<div class="empty-state" style="min-height:180px;grid-column:1/-1"><div><p>${state.driveTab==='我的分享'?'还没有有效分享。':'还没有文件，上传后会自动进入知识解析。'}</p></div></div>`}</div><div class="drop-zone" id="drop-zone"><b>添加文件</b><p>将文件拖放到此处，或点击上传到知识库</p><button class="btn" data-action="upload">选择文件</button></div></section>`;
}

function renderOpportunityKanban(){
  const columns=[['research','调研中'],['proposal','提案中'],['negotiation','谈判中'],['won','赢单']];
  const total=columns.reduce((sum,[key])=>sum+opportunities[key].length,0);
  return `<section class="page toolbar-page"><div class="toolbar-top"><h1>商机</h1><div class="tabs" role="tablist" aria-label="商机视图"><button class="tab" role="tab" aria-selected="false" data-action="opportunity-view" data-opportunity-view="table">表格</button><button class="tab active" role="tab" aria-selected="true" data-action="opportunity-view" data-opportunity-view="kanban">看板</button></div><span class="section-label">共 ${total} 条商机 · ${money(state.backendDashboard?.pipeline_amount||3050000,'CNY')}</span><div class="toolbar-actions"><button class="btn" data-action="refresh">${ico('filter')}刷新</button><button class="btn dark" data-action="create-entity" data-type="opportunity">${ico('plus')}新建商机</button></div></div><div class="kanban">${columns.map(([key,title])=>`<section class="kanban-col" data-stage="${key}"><div class="kanban-col-head"><b>${title}</b><span class="tag">${opportunities[key].length}</span></div>${opportunities[key].map((d,i)=>`<article class="deal-card" draggable="true" data-deal="${key}-${i}" data-id="${esc(d[4]||'')}" data-version="${esc(d[5]||'')}"><h3>${d[0]}</h3><small>${d[1]}</small><strong>${d[2]}</strong><div class="deal-foot"><span class="tag">${d[3]}</span><button class="avatar" data-action="edit-entity" data-type="opportunities" data-id="${esc(d[4]||'')}" aria-label="编辑商机 ${esc(d[0])}">Z</button></div></article>`).join('')}</section>`).join('')}</div></section>`;
}

function renderOpportunities(){
  if(state.opportunityView!=='table')return renderOpportunityKanban();
  const stageNames={research:'调研中',proposal:'提案中',negotiation:'谈判中',won:'赢单'};
  const rows=backendRecords.opportunities.map(item=>`<div class="table-row" style="grid-template-columns:1.4fr 1.2fr .8fr 1fr 1.2fr 72px"><div>${esc(item.name)}</div><div>${esc(item.company_name||'—')}</div><div>${esc(stageNames[item.stage]||item.stage)}</div><div>${money(item.amount,item.currency)}</div><div>${esc(item.next_step||'—')}</div><div><button class="mini-icon" data-action="edit-entity" data-type="opportunities" data-id="${esc(item.id)}" aria-label="编辑商机 ${esc(item.name)}">✎</button></div></div>`).join('');
  return `<section class="page toolbar-page"><div class="toolbar-top"><h1>商机</h1><div class="tabs" role="tablist" aria-label="商机视图"><button class="tab active" role="tab" aria-selected="true" data-action="opportunity-view" data-opportunity-view="table">表格</button><button class="tab" role="tab" aria-selected="false" data-action="opportunity-view" data-opportunity-view="kanban">看板</button></div><span class="section-label">共 ${backendRecords.opportunities.length} 条商机</span><div class="toolbar-actions"><button class="btn dark" data-action="create-entity" data-type="opportunity">${ico('plus')}新建商机</button></div></div><div class="table-wrap"><div class="data-table"><div class="table-row header" style="grid-template-columns:1.4fr 1.2fr .8fr 1fr 1.2fr 72px"><div>商机</div><div>客户</div><div>阶段</div><div>金额</div><div>下一步</div><div>操作</div></div>${rows}</div></div></section>`;
}

function renderQuotationsLegacy(){
  const q=quotes[0];
  return `<section class="page toolbar-page"><div class="toolbar-top"><h1>报价</h1><div class="search-control">${ico('search')}<input placeholder="搜索报价"></div><span class="section-label">共 ${quotes.length} 条报价</span><div class="toolbar-actions"><button class="btn" data-action="export">导出</button><button class="btn" data-route="new-task">${ico('spark')}超能助手</button><button class="btn dark" data-action="create-quote">${ico('plus')}新增报价</button></div></div><div class="quote-preview"><div class="card quote-list">${quotes.map((item,i)=>`<article class="quote-list-item ${i===0?'active':''}"><h3>${item.id} · ${item.company}</h3><p>${item.date}　${item.amount}　<span class="status ${item.status==='已发送'?'green':'amber'}">${item.status}</span></p></article>`).join('')}</div><article class="card quote-doc"><div class="quote-doc-head"><div><span class="section-label">QUOTATION</span><h2>${q.id}</h2><p style="color:var(--muted);font-size:10px">报价日期：${q.date} · 有效期 15 天</p></div><div style="text-align:right"><b>AMAZING TRADE CO., LTD.</b><p style="font-size:10px;line-height:1.7;color:var(--muted)">Nanjing, China<br>sales@amazingtrade.cn</p></div></div><div style="display:flex;justify-content:space-between;margin-top:24px"><div><small>报价给</small><h3>${q.company}</h3><p style="font-size:10px;color:var(--muted)">Attn: Marta Kowalska · Warsaw, Poland</p></div><span class="status amber">${q.status}</span></div><table><thead><tr><th>商品</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th></tr></thead><tbody><tr><td>Aurora 羊毛手织地毯</td><td>160×230cm</td><td>240</td><td>$82.00</td><td>$19,680.00</td></tr><tr><td>Nordic 平织地毯</td><td>140×200cm</td><td>300</td><td>$46.50</td><td>$13,950.00</td></tr><tr><td>户外 PET 再生地毯</td><td>120×180cm</td><td>100</td><td>$39.80</td><td>$3,980.00</td></tr></tbody></table><div class="quote-total"><small style="font-size:10px;color:var(--muted)">FOB SHANGHAI · TOTAL</small><br><b>${q.amount}</b></div><div style="margin-top:34px;border-top:1px solid var(--line);padding-top:18px;font-size:10px;line-height:1.8;color:var(--muted)">付款条款：30% 预付，70% 见提单副本。交期：收到预付款后 22–28 天。包装：出口标准包装。</div></article></div></section>`;
}

function renderQuotations(){
  const records=backendRecords.quotations;
  if(!records.length)return renderQuotationsLegacy();
  const selected=records.find(item=>item.id===state.selectedQuoteId)||records[0];
  const items=Array.isArray(selected.items)?selected.items:[];
  const itemRows=items.length?items.map(item=>{const quantity=Number(item.quantity||0);const unit=Number(item.unit_price||0);return `<tr><td>${esc(item.name||'未命名商品')}</td><td>${esc(item.specification||'—')}</td><td>${quantity}</td><td>${money(unit,selected.currency)}</td><td>${money(quantity*unit,selected.currency)}</td></tr>`}).join(''):`<tr><td colspan="5">尚未添加报价明细</td></tr>`;
  return `<section class="page toolbar-page"><div class="toolbar-top"><h1>报价</h1><div class="search-control">${ico('search')}<input data-quote-search aria-label="搜索报价" placeholder="搜索报价"></div><span class="section-label">共 ${records.length} 条报价</span><div class="toolbar-actions"><button class="btn" data-action="export">导出当前报价</button><button class="btn" data-route="new-task">${ico('spark')}超能助手</button><button class="btn dark" data-action="create-quote">${ico('plus')}新增报价</button></div></div><div class="quote-preview"><div class="card quote-list">${records.map(item=>`<button class="quote-list-item ${selected.id===item.id?'active':''}" data-action="select-quote" data-quote-id="${esc(item.id)}"><h3>${esc(item.quote_no)} · ${esc(item.company_name)}</h3><p>${esc(shortDate(item.created_at))}　${money(item.amount,item.currency)}　<span class="status ${item.status==='已发送'?'green':'amber'}">${esc(item.status)}</span></p></button>`).join('')}</div><article class="card quote-doc"><div class="quote-doc-head"><div><span class="section-label">QUOTATION</span><h2>${esc(selected.quote_no)}</h2><p style="color:var(--muted);font-size:10px">报价日期：${esc(shortDate(selected.created_at))} · 有效期：${esc(shortDate(selected.valid_until))}</p></div><div style="text-align:right"><b>${esc(state.orgName)}</b><p style="font-size:10px;line-height:1.7;color:var(--muted)">当前组织报价工作台</p></div></div><div style="display:flex;justify-content:space-between;margin-top:24px"><div><small>报价给</small><h3>${esc(selected.company_name)}</h3></div><div style="display:flex;align-items:center;gap:7px"><span class="status ${selected.status==='已发送'?'green':'amber'}">${esc(selected.status)}</span><button class="btn" data-action="edit-entity" data-type="quotations" data-id="${esc(selected.id)}">编辑</button></div></div><table><thead><tr><th>商品</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th></tr></thead><tbody>${itemRows}</tbody></table><div class="quote-total"><small style="font-size:10px;color:var(--muted)">${esc(selected.currency)} · TOTAL</small><br><b>${money(selected.amount,selected.currency)}</b></div><div style="margin-top:34px;border-top:1px solid var(--line);padding-top:18px;font-size:10px;line-height:1.8;color:var(--muted)">付款条款：${esc(selected.terms||'待确认')}</div></article></div></section>`;
}

function renderHistory(){
  const rows=state.backendConversations.length?state.backendConversations.map(item=>[item.title,item.status==='completed'?'任务已完成，可继续追问':'任务正在处理中',item.id,shortDate(item.updated_at),item.skill]):[['美国东方地毯背调','已完成客户判断与下一步动作','research-task','00:42','company_research'],['设置企业邮箱','等待选择邮箱类型','mail-setup-task','00:10','mail_setup'],['德国储能分销商名单','已找到 18 家候选公司','lead-task','昨天','lead_generation']];
  return `<section class="history-page"><div class="search-control">${ico('search')}<input id="history-search" placeholder="搜索任务"></div><h1 style="font-size:24px">历史任务</h1><div class="history-group"><h2>${state.backendOnline?'已保存会话':'本地示例'}</h2>${rows.map(x=>`<button class="history-item" ${state.backendOnline?`data-action="open-conversation" data-conversation-id="${esc(x[2])}"`:`data-route="${x[2]}"`} style="width:100%;text-align:left"><span class="history-icon">${ico('spark')}</span><div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div><time>${esc(x[3])}</time><span class="tag">${esc(x[4]||'默认')}</span></button>`).join('')}</div></section>`;
}

function renderResearchTask(){
  return `<section class="chat-page"><div class="chat-detail"><div class="chat-detail-head"><button class="btn" data-action="share" title="分享对话">↗ 分享</button><button class="btn dark" data-action="show-more-skills" title="打开 AI 技能中心">${ico('grid')}AI技能中心</button></div><article class="message user"><div class="message-label">@查客户靠不靠谱</div><p>请依据 https://americanorientalrug.com/ 或上传的文件，判断这个客户是否值得开发。</p></article><article class="message"><div class="process-box"><div class="process-head"><b>工作过程</b><span class="status green">历史示例</span></div><div class="process-steps"><div class="process-step done"><b>解析官网</b><span>演示流程，不代表本次真实检索</span></div><div class="process-step done"><b>主体核验</b><span>演示流程，不代表已完成核验</span></div><div class="process-step done"><b>采购分析</b><span>演示流程，不代表真实采购数据</span></div><div class="process-step done"><b>形成动作</b><span>演示流程，不作为开发依据</span></div></div></div><div class="sample-banner"><b>历史示例</b><span>以下内容仅用于展示页面结构，不是实时背调结果，也不能直接用于联系客户或发送开发信。</span></div><div class="report-summary"><p>示例结论：有条件推进，优先级 B。</p><ul><li><b>示例机会：</b>产品覆盖手工地毯、定制楼梯地毯，和我方品类有重合。</li><li><b>示例风险：</b>更像零售/电商渠道，采购负责人和进口能力待核验。</li><li><b>示例动作：</b>先确认采购负责人、主销规格、是否接受新供应商。</li></ul><p>正式判断必须从“新建任务”重新检索，并逐条显示来源和核验状态。</p></div><div class="artifact"><span class="file-type">示例</span><div><b>AmericanOrientalRug客户判断（历史示例）</b><small>仅用于界面演示 · 不代表真实核验结果</small></div><button class="btn" data-action="sample-report-warning">查看说明</button></div><div class="suggestion-row"><button data-prompt="抓这个客户官网公开邮箱、电话和表单。">找官网联系方式</button><button data-prompt="为这个客户写一封英文首封开发信。">写开发信</button><button data-prompt="列出这个客户暂缓开发的条件。">放入观察</button></div></article></div>${composer()}</section>`;
}

function renderMailSetupTask(){
  return `<section class="chat-page"><div class="chat-detail"><div class="chat-detail-head"><button class="btn icon-button" data-action="share">↗</button></div><article class="message user"><p>帮我设置企业邮箱，让 AI 可以整理收件箱和生成回复草稿。</p></article><article class="message"><div class="message-label">邮箱连接助手</div><h2>先绑定你自己的邮箱</h2><p>每个内测用户都要绑定自己的 Gmail；发送动作会从自己的邮箱发出，不共用管理员邮箱。</p><div class="automation-grid" style="margin-top:18px"><button class="card automation-card" data-action="mail-provider" data-provider="Microsoft 365"><div class="automation-icon">M</div><h3>Microsoft 365</h3><p>适合 Outlook 企业邮箱，后续可接 OAuth。</p></button><button class="card automation-card" data-action="mail-provider" data-provider="Google Workspace"><div class="automation-icon">G</div><h3>Gmail / Google Workspace</h3><p>当前已支持 Gmail 应用专用密码发送。</p></button><button class="card automation-card" data-action="mail-provider" data-provider="IMAP"><div class="automation-icon">IM</div><h3>其他企业邮箱</h3><p>后续可接腾讯、阿里、网易或自建 SMTP。</p></button></div><div class="process-box"><div class="process-head"><b>Gmail 绑定路径</b><span>约 3 分钟</span></div><div class="process-steps"><div class="process-step"><b>1. 打开 Google 账号</b><span>进入 myaccount.google.com/security</span></div><div class="process-step"><b>2. 开启两步验证</b><span>安全性 → 您登录 Google 的方式 → 两步验证</span></div><div class="process-step"><b>3. 生成应用专用密码</b><span>安全性 → 应用专用密码，或直接打开 myaccount.google.com/apppasswords</span></div><div class="process-step"><b>4. 回填到系统</b><span>复制 16 位密码；系统不需要你的网页登录密码</span></div></div></div></article></div>${composer()}</section>`;
}

function renderLeadTask(){
  return `<section class="chat-page"><div class="chat-detail"><article class="message user"><p>寻找德国、法国和荷兰的家居地毯进口商，优先年采购额较高且有自有零售渠道的公司。</p></article><article class="message"><div class="process-box"><div class="process-head"><b>客户搜索与筛选</b><span class="status green">已完成</span></div><div class="process-steps"><div class="process-step done"><b>市场画像</b><span>3 个国家 · 5 类渠道</span></div><div class="process-step done"><b>公司发现</b><span>126 家候选公司</span></div><div class="process-step done"><b>资格筛选</b><span>18 家高匹配公司</span></div><div class="process-step done"><b>联系人匹配</b><span>41 位采购联系人</span></div></div></div><h2>已整理 18 家高匹配候选公司</h2><p>优先推荐 Bauhaus AG、Home24 SE、Maisons du Monde 和 Leen Bakker。名单已按采购可能性、渠道覆盖和联系可达性评分。</p><div class="artifact"><span class="file-type">XLSX</span><div><b>欧洲家居地毯进口商名单_260803.xlsx</b><small>18 家公司 · 41 位联系人 · 公开来源已标注</small></div><button class="btn" data-action="export">下载</button></div><div class="suggestion-row"><button data-route="companies">写入公司库</button><button data-route="people">查看联系人</button><button data-prompt="为前 5 家公司生成个性化首封开发信。">生成首封开发信</button></div></article></div>${composer()}</section>`;
}

function renderLiveTask(){
  const t=state.liveTask || {query:'',progress:0,status:'running'};
  const done=t.status==='done';
  const failed=t.status==='failed';
  const waitingForModel=!done&&Number(t.progress)>=90&&t.skill!=='lead_generation';
  const delivery=taskDelivery(t.result,t.skill);
  const emailDraftCount=t.skill==='email_copilot'&&done?emailDraftTargets(t).length:0;
  const deliverySummary=emailDraftCount?`已按 ${emailDraftCount} 家选中客户分别生成针对性开发信。每封信均显示对应的收件对象；官网未公开邮箱的客户只保存草稿，不进入发送队列。`:delivery.summary;
  const artifactName=t.artifact?.name||`AI任务结果_${new Date().toISOString().slice(0,10)}.html`;
  const suggestions=taskSuggestions(t.skill).map(([label,prompt,nextSkill])=>{const fullPrompt=t.skill==='contact_discovery'?`${prompt}\n\n官网联系方式结果：\n${t.result||''}`:prompt;return `<button data-prompt="${esc(fullPrompt)}" data-skill="${esc(nextSkill||t.skill||'default')}">${esc(label)}</button>`}).join('');
  const leadPanel=renderLeadImportPanel(t);
  const emailPanel=renderEmailDraftPanel(t);
  const summaryBlock=t.skill==='lead_generation'?'':`<div class="ai-result task-summary">${renderAiResult(deliverySummary)}</div>`;
  const artifactMeta=t.skill==='lead_generation'?'客户名单已保存 · 可继续处理':(t.artifact?.source||'结果已保存')+' · 可继续追问';
  const fullResultBlock=t.skill==='lead_generation'?'':`<details class="full-result"><summary>查看详细结果</summary><div class="ai-result">${renderAiResult(delivery.detail)}</div></details>`;
  const processStages=t.skill==='lead_generation'?[['任务定义','锁定产品、市场和客户角色',20],['公开检索','多组来源发现候选主体',43],['官网核验','打开页面核对主体和品类',72],['交付审计','去重、联系方式分级和缺口说明',100]]:[['理解目标','拆解任务与结果格式',20],['检索与分析','整合公开信息和工作区资料',52],['交叉验证','核对冲突信息与风险',76],['生成结果','整理行动建议与交付文件',100]];
  const taskPrompt=done
    ?`<details class="process-box task-request"><summary class="process-head"><b>查看本次任务要求</b><span>展开</span></summary><div class="task-request-body"><p>${esc(t.query)}</p></div></details>`
    :`<article class="message user"><p>${esc(t.query)}</p></article>`;
  return `<section class="chat-page"><div class="chat-detail" id="live-chat">${taskPrompt}<article class="message"><details class="process-box" ${done?'':'open'}><summary class="process-head"><b>${done?'已完成的工作':failed?'真实检索未完成':'正在执行任务'}</b><span class="status ${done?'green':failed?'red':'amber'}">${done?'已完成':failed?'未完成':`${t.progress}%`}</span></summary><div class="process-steps">${processStages.map(x=>`<div class="process-step ${t.progress>=x[2]?'done':''}"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div></details>${renderLeadQualityPanel(t)}${done?`<div class="task-complete"><span class="status green">任务已完成</span><h2>${esc(delivery.title)}</h2>${summaryBlock}</div>${leadPanel}${emailPanel}<div class="artifact"><span class="file-type">HTML</span><div><b>${esc(artifactName)}</b><small>${esc(artifactMeta)}</small></div><button class="btn" data-action="open-report">打开结果</button></div>${fullResultBlock}<div class="suggestion-row">${suggestions}</div>`:`<div class="sample-banner"><b>${failed?'未生成结果':'任务进行中'}</b><span>${failed?'真实检索服务没有返回可核验结果；系统不会用演示数据替代。请检查信息源配置后重新提交。':waitingForModel?'正在整理公开资料，数量较多时需要等待一会儿；完成后会明确显示实际交付数。':'正在整理客户名单和联系方式，完成后会显示可操作结果。你可以离开本页面，任务会继续在后台运行。'}</span></div>`}</article></div>${composer()}</section>`;
}

function render(){
  updateNav();
  document.body.classList.toggle('chat-active', ['new-task','research-task','mail-setup-task','lead-task','live-task'].includes(state.route));
  const renderers={
    'new-task':renderNewTask,'dashboard':renderDashboard,'mail':renderMail,'tasks':renderTasks,'drive':renderDrive,
    'products':()=>renderEntityTable('products'),'companies':renderCustomerLibrary,'people':()=>renderEntityTable('people'),
    'opportunities':renderOpportunities,'quotations':renderQuotations,'samples':()=>renderEntityTable('samples'),'orders':()=>renderEntityTable('orders'),
    'history':renderHistory,'research-task':renderResearchTask,'mail-setup-task':renderMailSetupTask,'lead-task':renderLeadTask,'live-task':renderLiveTask
  };
  main.innerHTML = (renderers[state.route] || renderDashboard)();
  if(!main.querySelector('h1')){
    const fallbackTitles={
      'research-task':'美国东方地毯背调',
      'mail-setup-task':'设置企业邮箱',
      'lead-task':'欧洲家居地毯客户开发',
      'live-task':'AI 任务执行'
    };
    main.insertAdjacentHTML('afterbegin',`<h1 class="sr-only">${esc(fallbackTitles[state.route]||'远帆 AI')}</h1>`);
  }
  const pageTitle=main.querySelector('h1')?.textContent?.trim()||'远帆 AI';
  document.title=`${pageTitle}｜远帆 AI`;
  const announcer=document.querySelector('#route-announcer');if(announcer)announcer.textContent=`已进入${pageTitle}`;
  bindDynamic();
}

function bindDynamic(){
  const input=document.querySelector('#chat-input');
  const send=document.querySelector('[data-action="send-chat"]');
  input?.addEventListener('input',()=>{if(send)send.disabled=!input.value.trim()});
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});
  document.querySelector('#history-search')?.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('.history-item').forEach(x=>x.classList.toggle('hidden',!x.textContent.toLowerCase().includes(q)));
  });
  document.querySelector('[data-table-search]')?.addEventListener('input',e=>{const type=e.target.dataset.tableSearch;tableUi[type]=tableUi[type]||{};tableUi[type].query=e.target.value.trim();applyTableView(type)});
  document.querySelector('[data-customer-library-search]')?.addEventListener('input',e=>{const query=e.target.value.trim().toLowerCase();document.querySelectorAll('[data-customer-card]').forEach(card=>card.classList.toggle('hidden',!card.dataset.customerSearch.includes(query)))});
  document.querySelector('[data-task-result-search]')?.addEventListener('input',e=>{
    const query=e.target.value.trim().toLowerCase();
    document.querySelectorAll('.task-result-card').forEach(card=>card.classList.toggle('hidden',!card.dataset.taskSearch.toLowerCase().includes(query)));
  });
  document.querySelectorAll('[data-mail-search]').forEach(input=>input.addEventListener('input',e=>{const query=e.target.value.toLowerCase();document.querySelectorAll('.mail-item').forEach(item=>item.classList.toggle('hidden',!item.textContent.toLowerCase().includes(query)))}));
  const dz=document.querySelector('#drop-zone');
  if(dz){['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragging')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragging');if(ev==='drop'&&e.dataTransfer.files.length)uploadFiles(e.dataTransfer.files)}));}
  const selectAllLeads=document.querySelector('[data-lead-select-all]');
  const leadChecks=Array.from(document.querySelectorAll('[data-lead-index]'));
  selectAllLeads?.addEventListener('change',()=>{
    leadChecks.forEach(input=>{input.checked=selectAllLeads.checked});
    syncLeadSelectionState();
    showToast(selectAllLeads.checked?`已全选 ${leadChecks.length} 条客户`:'已取消全选');
  });
  leadChecks.forEach(input=>input.addEventListener('change',syncLeadSelectionState));
  syncLeadSelectionState();
  const selectAllEmails=document.querySelector('[data-email-select-all]');
  const emailChecks=Array.from(document.querySelectorAll('[data-email-index]'));
  selectAllEmails?.addEventListener('change',()=>{
    emailChecks.forEach(input=>{if(!input.disabled)input.checked=selectAllEmails.checked});
    syncEmailSelectionState();
    showToast(selectAllEmails.checked?`已全选 ${emailChecks.filter(input=>!input.disabled).length} 封开发信`:'已取消全选开发信');
  });
  emailChecks.forEach(input=>{
    input.addEventListener('change',syncEmailSelectionState);
    input.addEventListener('click',()=>setTimeout(syncEmailSelectionState,0));
  });
  syncEmailSelectionState();
  bindKanban();
}

function runLocalTask(query){
  clearInterval(window.taskTimer);
  state.liveTask=state.liveTask||{query,progress:0,status:'running'};
  state.liveTask.status='failed';
  state.liveTask.progress=0;
  state.liveTask.result='真实检索服务不可用，未生成客户名单或背调结果。';
  state.liveTask.artifact={};
  save();
  if(state.route==='live-task')render();
}

async function pollAiTask(jobId){
  clearTimeout(window.taskPollTimer);
  try{
    const job=await api(`/ai/tasks/${jobId}`);
    if(!state.liveTask||state.liveTask.backendId!==jobId)return;
    window.taskPollFailures=0;
    state.liveTask.progress=job.progress||0;
    state.liveTask.step=job.current_step||'';
    state.liveTask.skill=job.skill||state.liveTask.skill||'default';
    state.liveTask.result=job.result||'';
    state.liveTask.artifact=job.artifact||{};
    state.liveTask.status=job.status==='completed'?'done':job.status==='failed'?'failed':'running';
    save(); if(state.route==='live-task')render();
    if(job.status==='completed'&&!state.liveTask.synced){state.liveTask.synced=true;save();await loadBackend();return}
    if(!['completed','failed'].includes(job.status))window.taskPollTimer=setTimeout(()=>pollAiTask(jobId),1200);
  }catch(error){
    state.backendOnline=false;
    window.taskPollFailures=(window.taskPollFailures||0)+1;
    if(window.taskPollFailures<=12){
      window.taskPollTimer=setTimeout(()=>pollAiTask(jobId),2500);
      return;
    }
    if(state.liveTask?.backendId===jobId){
      state.liveTask.status='failed';
      state.liveTask.progress=0;
      state.liveTask.result='真实检索任务状态连续读取失败，未生成演示结果。请检查后端连接后重试。';
      save();
      if(state.route==='live-task')render();
    }
  }
}

function openSampleReportNotice(){
  openModal('历史示例，不是正式背调','这条记录没有对应的真实任务编号，不能作为客户判断或开发依据。',`<div class="settings-panel"><div class="sample-banner"><b>仅供演示</b><span>页面中的公司结论、联系方式、采购判断和建议动作都不代表已完成实时检索或交叉核验。</span></div><div class="form-section"><h4>要获得真实结果</h4><p>请从“新建任务”重新提交公司官网或客户检索要求。系统会保存真实任务编号，并在结果中展示来源链接、检索时间、联系方式类型和核验状态。</p><button class="btn dark" data-route="new-task" data-close-modal="true">新建真实任务</button></div></div>`,false);
}

async function openLiveReport(){
  let jobId=state.liveTask?.backendId;
  if(!jobId){
    // 旧版本曾把任务仅保存在浏览器中，导致页面有结果但缺少真实任务编号。
    // 与服务器的已完成任务精确匹配后自动补回编号，避免误打开演示报告。
    try{
      const normalize=value=>String(value||'').replace(/\s+/g,'').trim();
      const taskPrompt=normalize(state.liveTask?.query);
      if(taskPrompt.length>=40){
        const jobs=(state.backendAiJobs?.length?state.backendAiJobs:await api('/ai/tasks?limit=100'))||[];
        let matched=jobs
          .filter(job=>job.status==='completed'&&normalize(job.prompt)===taskPrompt)
          .sort((a,b)=>String(b.finished_at||b.updated_at||'').localeCompare(String(a.finished_at||a.updated_at||'')))[0];
        // 旧界面与新界面对同一任务的描述前缀不同（例如“找潜在买家”/“一键开发客户”）。
        // 在产品、市场和数量至少两项一致时，关联最近完成的同类真实任务。
        if(!matched){
          const field=(text,label)=>{
            const match=String(text||'').match(new RegExp(`${label}[：:]\\s*([^；;，,\\n]+)`,'i'));
            return normalize(match?.[1]).slice(0,80);
          };
          const liveProduct=field(state.liveTask?.query,'产品');
          const liveMarket=field(state.liveTask?.query,'目标市场');
          const liveCount=(String(state.liveTask?.query||'').match(/输出数量[：:]?\\s*(\\d+)/)||[])[1]||'';
          matched=jobs.filter(job=>{
            if(job.status!=='completed')return false;
            const jobProduct=field(job.prompt,'产品');
            const jobMarket=field(job.prompt,'目标市场');
            const jobCount=(String(job.prompt||'').match(/输出数量[：:]?\\s*(\\d+)/)||[])[1]||'';
            const sameProduct=Boolean(liveProduct&&jobProduct&&(liveProduct.includes(jobProduct)||jobProduct.includes(liveProduct)));
            const sameMarket=Boolean(liveMarket&&jobMarket&&(liveMarket.includes(jobMarket)||jobMarket.includes(liveMarket)));
            const sameCount=Boolean(liveCount&&jobCount&&liveCount===jobCount);
            return (sameProduct&&sameMarket)||(sameProduct&&sameCount)||(sameMarket&&sameCount);
          }).sort((a,b)=>String(b.finished_at||b.updated_at||'').localeCompare(String(a.finished_at||a.updated_at||'')))[0];
        }
        if(matched){
          state.liveTask={...state.liveTask,backendId:matched.id,conversationId:matched.conversation_id,result:matched.result||state.liveTask.result,artifact:matched.artifact||state.liveTask.artifact};
          save();
          jobId=matched.id;
        }
      }
    }catch(error){/* 关联失败时继续显示明确提示，不能伪造报告。 */}
  }
  if(!jobId){
    openSampleReportNotice();
    return;
  }
  try{
    const headers={};const token=localStorage.getItem(AUTH_TOKEN_KEY);if(token)headers.Authorization=`Bearer ${token}`;
    const response=await fetch(`${API_BASE}/ai/tasks/${jobId}/report`,{headers});
    if(!response.ok){const data=await response.json();throw new Error(data.detail||'报告打开失败')}
    const blob=await response.blob();const url=URL.createObjectURL(blob);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){showToast(error.message)}
}

async function openConversation(conversationId){
  try{
    const conversation=await api(`/conversations/${conversationId}`);
    const userMessage=[...(conversation.messages||[])].reverse().find(item=>item.role==='user');
    const assistantMessage=[...(conversation.messages||[])].reverse().find(item=>item.role==='assistant');
    state.liveTask={query:userMessage?.content||conversation.title,progress:conversation.status==='completed'?100:35,status:conversation.status==='completed'?'done':'running',result:assistantMessage?.content||'这个会话还没有生成最终结果。',conversationId};
    save();routeTo('live-task');
  }catch(error){showToast(`打开会话失败：${error.message}`)}
}

async function getAiJob(jobId){
  let job=(state.backendAiJobs||[]).find(item=>item.id===jobId);
  if(!job)job=await api(`/ai/tasks/${jobId}`);
  return job;
}
async function openAiJobResult(jobId){
  try{
    const job=await getAiJob(jobId);
    const leads=extractLeadCandidates(job.result,job.prompt);
    const leadActions=leads.length?`<div class="toolbar-actions" style="margin:12px 0 4px"><button class="btn dark" data-action="resume-ai-job" data-job-id="${esc(job.id)}">回到任务页继续处理</button><button class="btn" data-action="resume-ai-job" data-job-id="${esc(job.id)}" data-open-leads="1">导入客户/生成开发信</button></div><div class="lead-import-table" style="margin-top:14px"><div class="lead-import-row head"><div>#</div><div>客户</div><div>官网</div><div>下一步</div></div>${leads.map((lead,index)=>`<div class="lead-import-row"><div>${index+1}</div><div><b>${esc(lead.name)}</b><small>${esc(lead.summary||'待核验')}</small></div><div><a href="${esc(lead.url)}" target="_blank" rel="noopener">${esc(lead.domain||lead.url)}</a></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn" data-action="research-lead" data-job-id="${esc(job.id)}" data-lead-index="${index}">查客户</button><button class="btn" data-action="email-lead" data-job-id="${esc(job.id)}" data-lead-index="${index}">写信</button></div></div>`).join('')}</div>`:`<div class="toolbar-actions" style="margin:12px 0 4px"><button class="btn dark" data-action="resume-ai-job" data-job-id="${esc(job.id)}">回到任务页继续追问</button><button class="btn" data-action="open-report">打开报告</button></div>`;
    openModal(leads.length?'客户名单成果':'任务成果','往期结果已保存，后续动作可以从这里继续，不需要重新跑一遍。',`<div class="settings-panel"><div class="form-section"><h4>任务要求</h4><p>${esc(job.prompt||'')}</p><p class="lead">${esc(skillLabel(job.skill))} · ${esc(shortDate(job.finished_at||job.updated_at))}</p></div>${leadActions}<details class="full-result" style="margin-top:16px" ${leads.length?'':'open'}><summary>查看原始完整结果</summary><div class="ai-result">${renderAiResult(job.result||'')}</div></details></div>`);
  }catch(error){showToast(`打开失败：${error.message}`)}
}
async function resumeAiJob(jobId){
  try{
    const job=await getAiJob(jobId);
    const done=job.status==='completed';
    state.liveTask={
      query:job.prompt||aiTaskTitle(job),
      skill:job.skill||'default',
      progress:done?100:(job.progress||35),
      status:done?'done':(job.status||'running'),
      step:job.current_step||'',
      result:job.result||'',
      artifact:job.artifact||{},
      backendId:job.id,
      conversationId:job.conversation_id
    };
    closeModal(true);
    save();
    routeTo('live-task');
    showToast(done?'已打开往期任务成果，可以继续导入、背调或写信':'已回到正在执行的任务');
  }catch(error){showToast(`继续失败：${error.message}`)}
}
async function continueLeadAction(jobId,index=0,mode='research'){
  try{
    const job=await getAiJob(jobId);
    const leads=extractLeadCandidates(job.result,job.prompt);
    const lead=leads[Number(index)||0];
    if(!lead){showToast('没有找到这条客户记录');return}
    closeModal(true);
    const isEmail=mode==='email';
    const query=isEmail
      ? `@写开发/跟进信\n客户：${lead.name}\n官网：${lead.url}\n客户背景：${lead.summary||'待核验'}\n目标：写一封简洁专业的英文首封开发信，推介我们的商务地毯/商用地面材料供应能力。\n请只输出：客户意图假设、不能承诺的点、英文主题、英文正文、中文备注。不要长篇分析；默认只生成草稿，不发送。`
      : `@查客户靠不靠谱\n目标公司：${lead.name}\n官网：${lead.url}\n已知线索：${lead.summary||'待核验'}\n请用短格式判断是否值得开发：结论与优先级、关键事实、待确认、今天3个动作、首次核验话术。没有证据的信息标为待核验，不要风险矩阵和长篇背景。`;
    state.liveTask={query,skill:isEmail?'email_copilot':'company_research',progress:8,status:'running',result:''};
    save();routeTo('live-task');
    try{const next=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt:query,skill:state.liveTask.skill})});state.liveTask.backendId=next.id;state.liveTask.progress=next.progress||0;save();pollAiTask(next.id)}
    catch(error){showToast('真实检索服务不可用，未生成演示结果');runLocalTask(query)}
  }catch(error){showToast(`继续失败：${error.message}`)}
}

async function sendChat(){
  const input=document.querySelector('#chat-input');
  const query=input?.value.trim();
  if(!query) return;
  const skill=state.pendingSkill||'default';
  state.pendingSkill='default';
  state.liveTask={query,skill,progress:8,status:'running',result:''};
  save(); routeTo('live-task');
  try{
    const job=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt:query,skill})});
    state.backendOnline=true;
    state.liveTask.backendId=job.id;
    state.liveTask.progress=job.progress||0;
    save();
    pollAiTask(job.id);
  }catch(error){
    state.backendOnline=false;
    showToast('真实检索服务不可用，未生成演示结果');
    runLocalTask(query);
  }
}

function openModal(title,subtitle,content,wide=true){
  if(modalLayer.classList.contains('open')){
    const focused=document.activeElement;
    const returnToken=`modal-return-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    if(focused&&modalLayer.contains(focused))focused.setAttribute('data-modal-return',returnToken);
    modalHistory.push({
      title:document.querySelector('#modal-title').textContent,
      subtitle:document.querySelector('#modal-subtitle').textContent,
      content:modalContent.innerHTML,
      width:modalLayer.querySelector('.modal').style.width,
      returnToken
    });
  }else{
    previousFocus=document.activeElement;
    modalHistory.length=0;
  }
  document.querySelector('#modal-title').textContent=title;
  document.querySelector('#modal-subtitle').textContent=subtitle;
  modalContent.innerHTML=content;
  modalLayer.classList.add('open');modalLayer.setAttribute('aria-hidden','false');
  modalLayer.querySelector('.modal').style.width=wide?'min(960px,96vw)':'min(560px,94vw)';
  setTimeout(()=>{(modalLayer.querySelector('[autofocus]')||modalLayer.querySelector('input,textarea,select,button'))?.focus()},20);
}
function replaceModal(title,subtitle,content,wide=true){
  document.querySelector('#modal-title').textContent=title;
  document.querySelector('#modal-subtitle').textContent=subtitle;
  modalContent.innerHTML=content;
  modalLayer.classList.add('open');modalLayer.setAttribute('aria-hidden','false');
  modalLayer.querySelector('.modal').style.width=wide?'min(960px,96vw)':'min(560px,94vw)';
  setTimeout(()=>{(modalLayer.querySelector('[autofocus]')||modalLayer.querySelector('input,textarea,select,button'))?.focus()},20);
}
function closeModal(closeAll=false){
  if(closeAll)modalHistory.length=0;
  if(modalHistory.length){
    const prior=modalHistory.pop();
    document.querySelector('#modal-title').textContent=prior.title;
    document.querySelector('#modal-subtitle').textContent=prior.subtitle;
    modalContent.innerHTML=prior.content;
    modalLayer.querySelector('.modal').style.width=prior.width;
    const target=modalContent.querySelector(`[data-modal-return="${prior.returnToken}"]`);
    target?.removeAttribute('data-modal-return');
    setTimeout(()=>target?.focus(),20);
    return;
  }
  const wasOpen=modalLayer.classList.contains('open');
  modalLayer.classList.remove('open');modalLayer.setAttribute('aria-hidden','true');
  if(wasOpen&&previousFocus?.focus)previousFocus.focus();
}
const settingsGroups=[
  ['个人',[['connect','Connect 账号'],['mail-settings','邮件设置'],['custom-ai','自定义 AI'],['sync-monitor','同步监控'],['automation','自动任务'],['mcp','MCP 服务器']]],
  ['组织',[['organization','组织设置'],['members','成员与邀请'],['chatbot','聊天机器人'],['agents','Agent 管理'],['skills','技能管理'],['quota','组织额度']]],
  ['贸易',[['company-profile','公司抬头'],['incoterms','贸易术语'],['logistics','物流装载'],['payment','结算条款'],['currency','币种与汇率']]]
];
function openSettings(tab='organization'){
  const nav=settingsGroups.map(([g,items])=>`<div class="settings-group"><span>${g}</span>${items.map(i=>`<button data-setting-tab="${i[0]}" class="${i[0]===tab?'active':''}">${i[1]}</button>`).join('')}</div>`).join('');
  openModal('设置','管理个人和组织设置。',`<div class="settings-shell"><aside class="settings-nav"><div class="settings-org"><small>当前组织</small><b>${esc(state.orgName)}</b><span class="status green" style="margin-top:7px">已激活</span></div>${nav}</aside><section class="settings-panel" id="settings-panel">${settingsPanel(tab)}</section></div>`);
}
function settingsPanel(tab){
  const org=state.workspaceSettings.organization||{};
  const mcpEndpoint=location.port==='8766'?`${location.origin}/mcp`:`${location.protocol.startsWith('http')?location.protocol:'http:'}//${location.hostname||'127.0.0.1'}:8766/mcp`;
  const memberRows=state.backendMembers.map(item=>`<div class="settings-list-row"><span class="avatar">${esc((item.name||'用').slice(0,1).toUpperCase())}</span><div><b>${esc(item.name)}</b><small>${esc(item.role)} · ${esc(item.email)}</small></div>${item.role==='owner'?'<span class="status green">所有者</span>':`<button class="btn danger" data-action="remove-member" data-member-id="${esc(item.id)}">移除</button>`}</div>`).join('');
  const agentRows=state.backendAgents.map(item=>`<div class="settings-list-row" data-agent-row data-search-text="${esc(`${item.name} ${item.scope} ${item.description||''}`)}"><span class="automation-icon">${ico('spark')}</span><div><b>${esc(item.name)}　<span class="tag">${esc(item.scope)}</span></b><small>${esc(item.description||'尚未填写说明')}</small></div><button class="btn" data-action="edit-agent" data-agent-id="${esc(item.id)}">编辑</button></div>`).join('');
  const channelText={email:'Email',linkedin:'LinkedIn',whatsapp:'WhatsApp'};
  const connectRows=state.backendConnectAccounts.map(item=>`<div class="settings-list-row"><span class="automation-icon">${item.channel==='email'?ico('mail'):item.channel==='linkedin'?ico('person'):ico('spark')}</span><div><b>${esc(item.name)} <span class="tag">${esc(channelText[item.channel]||item.channel)}</span></b><small>${esc(item.account_identifier)} · ${item.can_send?'可创建触达':'仅接收'} · ${item.lifecycle_status==='ready'?'已就绪':'待配置'}</small></div><button class="btn" data-action="open-outreach-form" data-channel="${esc(item.channel)}" data-account-id="${esc(item.id)}">测试触达</button>${item.channel==='linkedin'?`<button class="btn" data-action="open-linkedin-like-form" data-account-id="${esc(item.id)}">测试点赞</button>`:''}</div>`).join('');
  const outreachRows=state.backendOutreachJobs.slice(0,8).map(job=>`<div class="settings-list-row"><div><b>${esc(channelText[job.channel]||job.channel)} · ${esc(job.action==='linkedin_post_like'?'LinkedIn 点赞':'触达任务')}</b><small>${esc(job.recipient?.address||job.recipient?.profile_url||job.recipient?.phone||'未填写目标')} · ${esc(job.result?.next_step||job.status)}</small></div><button class="btn" data-action="refresh-outreach-job" data-job-id="${esc(job.id)}">${esc(job.status)}</button></div>`).join('');
  const panels={
    'organization':`<h3>组织设置</h3><p class="lead">维护当前组织信息、能力配置和共享知识。</p><div class="form-section"><h4>组织能力</h4><p>上传公司资料或填写官网，让 AI 结合商品库与知识文件生成组织能力摘要。</p><label class="field">官网首页链接<input id="org-website" value="${esc(org.website||'https://example.com')}" placeholder="https://example.com"></label><label class="field">资料文件<button class="btn" data-action="upload" style="display:flex;margin-top:7px">${ico('upload')}上传资料</button></label><button class="btn primary" data-action="generate-org">开始生成 AI 任务</button></div><div class="form-section"><h4>组织资料</h4><label class="field">组织名称<input id="org-name" value="${esc(org.name||state.orgName)}"></label><label class="field">组织描述<textarea id="org-description">${esc(org.description||'专业家居地毯供应商，面向欧洲和北美市场。')}</textarea></label><label class="field">共享上下文<textarea id="org-context">${esc(org.context||'默认使用 FOB 上海报价；所有外发邮件需人工确认。')}</textarea></label><button class="btn primary" data-action="save-organization">保存组织资料</button></div>`,
    'custom-ai':`<h3>自定义 AI</h3><p class="lead">保存偏好与沟通习惯，让 AI 更懂你。</p><div class="form-section"><label class="field">我应该如何称呼你？<input id="pref-name" value="${esc(state.userName)}"></label><label class="field">我如何更好地帮助你？<textarea id="pref-tone">${esc(state.preferredTone)}。长邮件先总结要点；客户跟进必须给出下一步动作；未经确认不发送邮件。</textarea></label><button class="btn primary" data-action="save-preferences">保存偏好</button></div>`,
    'connect':`<h3>Connect 账号</h3><p class="lead">对标 Revor Connect：统一管理 Email、LinkedIn、WhatsApp 账号，并创建待确认触达任务。当前为本地安全演示，不会真实外发。</p><div class="toolbar-actions" style="margin:0 0 14px"><button class="btn dark" data-action="connect-demo-account" data-channel="email">连接演示 Email</button><button class="btn" data-action="connect-demo-account" data-channel="linkedin">连接演示 LinkedIn</button><button class="btn" data-action="connect-demo-account" data-channel="whatsapp">连接演示 WhatsApp</button></div><div class="settings-list">${connectRows||'<div class="settings-list-row"><small>还没有 Connect 账号，请先连接一个演示账号。</small></div>'}</div><div class="form-section" style="margin-top:14px"><h4>已跑通的对标能力</h4><div class="skill-grid"><article class="skill-card"><h4>查询账号</h4><p>支持按渠道读取账号状态、发送/接收能力。</p></article><article class="skill-card"><h4>创建触达</h4><p>Email、LinkedIn、WhatsApp 均可创建任务并进入待确认。</p></article><article class="skill-card"><h4>任务状态</h4><p>可查询 queued、running、succeeded 等状态和执行结果。</p></article><article class="skill-card"><h4>LinkedIn 点赞</h4><p>已做本地模拟校验，真实动作需授权后开启。</p></article></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px"><button class="btn dark" data-action="open-outreach-form">创建触达测试</button><button class="btn" data-action="open-linkedin-like-form">LinkedIn 点赞测试</button></div></div><h4 style="margin-top:20px">最近触达任务</h4><div class="settings-list">${outreachRows||'<div class="settings-list-row"><small>还没有触达任务</small></div>'}</div>`,
    'automation':`<h3>自动任务</h3><p class="lead">开关会持久化；“立即运行”会执行本地检查并保存运行记录。</p><div class="settings-list">${[['followup','每日客户跟进检查','每天检查活跃商机'],['inbox','收件箱意图摘要','每 30 分钟检查待处理邮件'],['customerRisk','客户风险监控','每天检查重点公司资料完整性'],['quotation','报价到期提醒','每天检查未确认报价'],['dailyBrief','每日销售简报','每天生成任务与商机摘要'],['tradeSync','贸易记录整理','每周整理现有采购字段']].map(x=>{const item=state.backendAutomations.find(a=>a.automation_key===x[0]);return `<div class="settings-list-row"><div><b>${x[1]}</b><small>${x[2]} · 下次 ${shortDate(item?.next_run_at)}</small></div><button class="btn" data-action="run-automation" data-automation-key="${x[0]}">立即运行</button><button class="switch ${state.automations[x[0]]?'on':''}" data-automation="${x[0]}" aria-label="${x[1]}"></button></div>`}).join('')}</div><h4 style="margin-top:20px">最近运行</h4><div class="settings-list">${state.automationRuns.length?state.automationRuns.slice(0,6).map(run=>`<div class="settings-list-row"><div><b>${esc(run.automation_key)}</b><small>${esc(run.result)} · ${shortDate(run.finished_at)}</small></div><span class="status green">完成</span></div>`).join(''):`<div class="settings-list-row"><div><small>还没有运行记录</small></div></div>`}</div>`,
    'mcp':`<h3>MCP 服务器</h3><p class="lead">本机已提供标准 JSON-RPC 工具端点；生产部署时请强制登录并使用 HTTPS。</p><div class="form-section"><h4>工作区工具网关</h4><p><span class="status green">后端已启用</span> · 6 个真实工具 · 支持搜索、查询与创建任务</p><label class="field">服务器地址<input id="mcp-address" value="${esc(mcpEndpoint)}" readonly></label><button class="btn" data-action="copy-mcp">复制地址</button><button class="btn dark" data-action="open-token-form" style="margin-left:6px">生成访问令牌</button></div><h4 style="margin-top:20px">有效令牌</h4><div class="settings-list">${state.apiTokens.length?state.apiTokens.map(token=>`<div class="settings-list-row"><div><b>${esc(token.name)}</b><small>${esc(token.token_prefix)}… · 到期 ${shortDate(token.expires_at)}${token.last_used_at?` · 最近使用 ${shortDate(token.last_used_at)}`:''}</small></div><button class="btn danger" data-action="revoke-token" data-token-id="${esc(token.id)}">撤销</button></div>`).join(''):'<div class="settings-list-row"><small>尚未生成访问令牌</small></div>'}</div>`,
    'agents':`<h3>Agent 管理</h3><p class="lead">本地持久化 Agent 名称、作用域、说明和执行指令。</p><div class="toolbar-actions" style="margin:0 0 14px"><div class="search-control">${ico('search')}<input data-agent-search aria-label="搜索 Agent" placeholder="搜索 Agent"></div><button class="btn dark" data-action="create-agent">${ico('plus')}新增</button></div><div class="settings-list">${agentRows||'<div class="settings-list-row"><small>还没有 Agent</small></div>'}</div>`,
    'skills':`<h3>技能管理</h3><p class="lead">为智能体提供可复用的最佳实践与工具。当前内置 8 个外贸销售技能。</p><div class="toolbar-actions" style="margin:0 0 14px"><div class="search-control">${ico('search')}<input data-skill-search aria-label="搜索技能" placeholder="搜索技能"></div><button class="btn dark" data-action="skill-import-guide">${ico('upload')}导入 Skill</button></div><div class="skill-grid">${[['找潜在买家','输入产品和国家，生成去重后的优先开发名单'],['查客户靠不靠谱','主体、业务、匹配度和风险核验'],['找官网联系方式','抓取官网公开邮箱、电话、WhatsApp、表单和社交入口'],['写开发/跟进信','生成可人工审核的英文开发信和催复信'],['做报价单','把产品、数量和贸易条款整理成报价草稿'],['配产品方案','从商品资料组合卖点、MOQ、交期和样品策略'],['跟进已沟通客户','已有询盘后判断该催单、补资料、寄样还是暂停'],['查进口记录（需数据）','需要海关/贸易数据源；未接入时只分析你提供的记录']].map((x,i)=>`<article class="skill-card" data-skill-row data-search-text="${x[0]} ${x[1]}"><span class="status ${i>5?'amber':'green'}">${i>5?'后期再用':'常用'}</span><h4>${x[0]}</h4><p>${x[1]}</p><button class="text-button" data-action="skill-detail" data-skill-name="${x[0]}" data-skill-description="${x[1]}">查看配置 →</button></article>`).join('')}</div>`,
    'mail-settings':`<h3>邮件设置</h3><p class="lead">每个用户绑定自己的 Gmail 发件箱；开发信只会从当前登录用户的邮箱发出。</p><div class="settings-list"><div class="settings-list-row"><span class="automation-icon">${ico('mail')}</span><div><b>我的 Gmail 发件箱</b><small>${state.mailCanSend?`已绑定 · ${esc(state.mailSenderEmail||'')}`:'尚未绑定可发送邮箱'}</small></div><button class="btn" data-action="google-mail-setup">${state.mailCanSend?'更换邮箱':'开始绑定'}</button></div></div><div class="form-section" style="margin-top:14px"><h4>应用专用密码路径</h4><p class="lead">Google 账号 → 安全性 → 两步验证 → 应用专用密码；也可以直接打开 myaccount.google.com/apppasswords。复制 16 位密码后回填到绑定弹窗。</p><label class="field">默认签名<textarea>Best regards,\nZhe\nAmazing Trade Co., Ltd.</textarea></label><label class="field">发送规则<select><option>每次都需要人工确认</option><option>仅白名单自动发送</option></select></label></div>`,
    'sync-monitor':`<h3>同步监控</h3><p class="lead">查看邮箱、云盘和 CRM 数据同步状态。</p><div class="settings-list">${[['邮箱同步','未连接','amber'],['云盘索引','刚刚完成','green'],['公司资料','5 家已同步','green'],['贸易数据','等待授权','amber']].map(x=>`<div class="settings-list-row"><div><b>${x[0]}</b><small>${x[1]}</small></div><span class="status ${x[2]}">${x[1]}</span></div>`).join('')}</div>`,
    'members':`<h3>成员与邀请</h3><p class="lead">本地创建成员账户；临时密码只展示一次，由管理员自行安全转交。</p><div class="settings-list">${memberRows||'<div class="settings-list-row"><small>还没有成员</small></div>'}</div><button class="btn dark" style="margin-top:14px" data-action="invite">邀请成员</button>`,
    'chatbot':`<h3>聊天机器人</h3><p class="lead">本地预览已可用；企业微信或网站发布需要对应平台的应用凭据。</p><div class="form-section"><h4>销售协作机器人</h4><p>本地预览复用当前 AI 任务、客户、商机与知识库数据，不会对外发送消息。</p><button class="btn dark" data-action="preview-chatbot">打开本地预览</button><button class="btn" data-action="show-channel-guide" style="margin-left:6px">查看接入条件</button></div>`,
    'quota':`<h3>组织用量</h3><p class="lead">本地版不限制调用额度，以下为数据库中的实际数量。</p><div class="metric-grid" style="grid-template-columns:1fr 1fr"><article class="card metric-card"><small>AI 会话</small><strong>${state.backendConversations.length}</strong><span>已保存会话</span></article><article class="card metric-card"><small>知识文件</small><strong>${state.backendFiles.length}</strong><span>${fileSize(state.backendFiles.reduce((sum,file)=>sum+Number(file.size||0),0))}</span></article></div>`,
    'company-profile':`<h3>公司抬头</h3><p class="lead">用于报价、订单和对外文件。</p><div class="form-section"><label class="field">公司英文名<input value="AMAZING TRADE CO., LTD."></label><label class="field">公司地址<input value="Nanjing, Jiangsu, China"></label><button class="btn primary" data-action="save-generic">保存</button></div>`,
    'incoterms':`<h3>贸易术语</h3><p class="lead">维护默认价格条款和费用说明。</p><div class="settings-list">${['FOB Shanghai','CIF Rotterdam','EXW Nanjing'].map((x,i)=>`<div class="settings-list-row"><div><b>${x}</b><small>${i===0?'默认条款':'可用于报价'}</small></div><span class="status ${i===0?'green':''}">${i===0?'默认':'启用'}</span></div>`).join('')}</div>`,
    'logistics':`<h3>物流装载</h3><p class="lead">配置柜型、可用体积和装柜预留。</p><div class="form-section">${[['20GP','28'],['40GP','58'],['40HQ','68']].map(x=>`<label class="field">${x[0]} 可用体积（m³）<input type="number" value="${x[1]}" min="1" step="0.1"></label>`).join('')}<label class="field">默认预留比例（%）<input type="number" value="5" min="0" max="30"></label><button class="btn primary" data-action="save-generic">保存</button></div>`,
    'payment':`<h3>结算条款</h3><p class="lead">维护收付款节点和默认账期。</p><div class="form-section"><label class="field">默认条款<select><option>30% T/T 预付，70% 见提单副本</option><option>100% T/T 预付</option><option>不可撤销即期信用证</option></select></label><button class="btn primary" data-action="save-generic">保存</button></div>`,
    'currency':`<h3>币种与汇率</h3><p class="lead">设置相对人民币的内部核算汇率。</p><div class="form-section">${[['USD','美元','7.18'],['EUR','欧元','7.84'],['CNY','人民币','1.00']].map(x=>`<label class="field">${x[0]} · ${x[1]}<input type="number" value="${x[2]}" min="0.0001" step="0.0001"></label>`).join('')}<button class="btn primary" data-action="save-generic">保存</button></div>`
  };
  return panels[tab] || panels.organization;
}

function openSimpleForm(type){
  const names={tasks:'任务',products:'商品',companies:'公司',people:'联系人',samples:'样品',orders:'订单',opportunity:'商机','文件夹':'文件夹','报价':'报价','Agent':'Agent','成员':'成员'};
  const label=names[type]||'记录';
  openModal(`新建${label}`,`填写最少信息即可创建，稍后可以继续完善。`,`<div class="settings-panel"><div class="form-section"><label class="field">${label}名称<input id="entity-name" autofocus placeholder="请输入${label}名称"></label><label class="field">负责人<select id="entity-owner"><option>者着</option><option>AI 助理</option></select></label><label class="field">备注<textarea id="entity-note" placeholder="补充背景、截止时间或下一步要求"></textarea></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="confirm-create" data-type="${esc(type)}">确认创建</button></div></div></div>`,false);
}

const entityNames={tasks:'任务',products:'商品',companies:'公司',people:'联系人',samples:'样品',orders:'订单',opportunities:'商机',quotations:'报价'};
const entityFields={
  companies:[['name','公司名称'],['country','国家/地区'],['city','城市'],['role','合作角色'],['status','合作状态'],['domain','主域名'],['source','来源'],['owner','负责人'],['description','备注','textarea']],
  people:[['name','联系人姓名'],['company_id','所属公司','company'],['email','邮箱','email'],['title','职位'],['contact_type','联系人类型'],['decision_role','决策角色'],['status','联系状态'],['last_contact','最近联系'],['owner','负责人']],
  products:[['name','商品名称'],['sku','SKU'],['category','分类'],['price','价格','number'],['currency','币种'],['moq','MOQ'],['lead_time','交期'],['status','状态'],['description','商品说明','textarea']],
  tasks:[['title','任务名称'],['status','状态'],['priority','优先级'],['task_type','任务类型'],['due_at','截止时间'],['owner','负责人'],['description','任务说明','textarea']],
  opportunities:[['name','商机名称'],['company_name','客户公司'],['stage','阶段'],['priority','优先级'],['amount','金额','number'],['currency','币种'],['next_step','下一步'],['expected_close','预计成交日','date'],['owner','负责人']],
  quotations:[['quote_no','报价编号'],['company_name','客户公司'],['status','状态'],['amount','金额','number'],['currency','币种'],['valid_until','有效期','date'],['terms','付款条款','textarea'],['owner','负责人']],
  samples:[['sample_no','样品单号'],['company_name','客户公司'],['product_name','商品'],['quantity','数量'],['status','物流状态'],['expected_at','预计到达','date'],['tracking_no','物流单号'],['owner','负责人']],
  orders:[['order_no','订单号'],['company_name','客户公司'],['amount','金额','number'],['currency','币种'],['status','订单状态'],['ship_at','预计出运','date'],['payment_progress','收款进度','number'],['owner','负责人']]
};
function normalizeResourceType(type){return ({opportunity:'opportunities','报价':'quotations'})[type]||type}
function entityFieldHtml(field,value=''){
  const [key,label,type='text']=field;
  if(type==='textarea')return `<label class="field">${label}<textarea data-entity-field="${key}">${esc(value)}</textarea></label>`;
  if(type==='company')return `<label class="field">${label}<select data-entity-field="${key}"><option value="">请选择公司</option>${backendRecords.companies.map(item=>`<option value="${esc(item.id)}" ${item.id===value?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>`;
  return `<label class="field">${label}<input data-entity-field="${key}" type="${type}" value="${esc(value)}" ${type==='number'?'step="0.01"':''}></label>`;
}
function openEntityEditor(type,id=''){
  const resource=normalizeResourceType(type);
  const fields=entityFields[resource];
  if(!fields){openSimpleForm(type);return}
  const record=id?backendRecords[resource]?.find(item=>item.id===id):null;
  const label=entityNames[resource]||'记录';
  openModal(record?`编辑${label}`:`新建${label}`,record?'修改后会立即保存到数据库。':'填写业务信息并保存到数据库。',`<div class="settings-panel"><div class="form-section entity-edit-grid">${fields.map(field=>entityFieldHtml(field,record?.[field[0]]??'')).join('')}<div style="display:flex;justify-content:${record?'space-between':'flex-end'};gap:7px;grid-column:1/-1">${record?`<button class="btn danger" data-action="confirm-delete-entity" data-type="${resource}" data-id="${esc(id)}">删除记录</button>`:''}<span style="margin-left:auto;display:flex;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="save-entity" data-type="${resource}" data-id="${esc(id)}">保存</button></span></div></div></div>`,false);
}
async function saveEntity(resource,id=''){
  const record=id?backendRecords[resource]?.find(item=>item.id===id):null;
  const payload={};
  document.querySelectorAll('[data-entity-field]').forEach(input=>{
    let value=input.value.trim();
    if(input.type==='number')value=value===''?null:Number(value);
    payload[input.dataset.entityField]=value;
  });
  if(record?.version)payload.version=record.version;
  try{
    await api(`/entities/${resource}${id?`/${id}`:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
    closeModal();await loadBackend();showToast(id?'记录已更新':'记录已创建');
  }catch(error){showToast(`保存失败：${error.message}`)}
}
function confirmDeleteEntity(resource,id){
  const record=backendRecords[resource]?.find(item=>item.id===id);
  openModal('确认删除','记录会进入回收状态，审计日志仍会保留。',`<div class="settings-panel"><div class="form-section"><h4>${esc(record?.name||record?.title||record?.company_name||id)}</h4><p>删除后不会继续出现在业务列表中。</p><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn danger" data-action="delete-entity" data-type="${resource}" data-id="${esc(id)}">确认删除</button></div></div></div>`,false);
}
async function deleteEntity(resource,id){
  try{await api(`/entities/${resource}/${id}`,{method:'DELETE'});closeModal(true);await loadBackend();showToast('记录已删除')}
  catch(error){showToast(`删除失败：${error.message}`)}
}

async function confirmCreate(type){
  const name=document.querySelector('#entity-name')?.value.trim();
  if(!name){showToast('请先填写名称');return}
  const owner=document.querySelector('#entity-owner')?.value||state.userName;
  const note=document.querySelector('#entity-note')?.value.trim()||'';
  const resources={tasks:'tasks',products:'products',companies:'companies',people:'people',samples:'samples',orders:'orders',opportunity:'opportunities','报价':'quotations'};
  const resource=resources[type];
  if(!resource){closeModal();showToast(`${name} 已在当前工作区创建`);return}
  try{
    await api(`/entities/${resource}`,{method:'POST',body:JSON.stringify({name,owner,description:note})});
    closeModal();
    await loadBackend();
    showToast(`${name} 已保存到数据库`);
  }catch(error){showToast(`创建失败：${error.message}`)}
}

async function persistLeadsToCustomerLibrary(leads,mode='selected'){
  if(!leads.length){showToast(mode==='all'?'当前没有可保存的客户':'请先选择要导入的客户');return}
  const existing=new Set(backendRecords.companies.flatMap(item=>[item.name?.toLowerCase(),item.domain?.toLowerCase()]).filter(Boolean));
  let created=0,skipped=0,failed=0;
  for(const lead of leads){
    if(existing.has(lead.name.toLowerCase())||(lead.domain&&existing.has(lead.domain.toLowerCase()))){skipped++;continue}
    try{
      await api('/entities/companies',{method:'POST',body:JSON.stringify(leadPayload(lead))});
      created++;
      existing.add(lead.name.toLowerCase());
      if(lead.domain)existing.add(lead.domain.toLowerCase());
    }catch(error){
      if(error.status===409)skipped++;
      else failed++;
    }
  }
  await loadBackend();
  render();
  showToast(`已保存 ${created} 家客户到客户库${skipped?`，跳过 ${skipped} 家重复`:''}${failed?`，${failed} 家失败`:''}`);
}
async function importSelectedLeads(){
  await persistLeadsToCustomerLibrary(selectedLeadCandidates(),'selected');
}
async function importAllLeads(){
  const leads=extractLeadCandidates(state.liveTask?.result,state.liveTask?.query);
  await persistLeadsToCustomerLibrary(leads,'all');
}
function selectPriorityLeads(){
  const leads=extractLeadCandidates(state.liveTask?.result,state.liveTask?.query);
  document.querySelectorAll('[data-lead-index]').forEach(input=>{
    const lead=leads[Number(input.dataset.leadIndex)];
    input.checked=Boolean(lead&&(/高/.test(lead.priority)||leads.indexOf(lead)<3));
  });
  syncLeadSelectionState();
  showToast('已选择高优先级客户');
}
async function draftLeadEmails(autoRun=false){
  const leads=selectedLeadCandidates();
  if(!leads.length){showToast('请先选择客户');return}
  const rows=leads.map((lead,index)=>`${index+1}. ${lead.name}（${lead.domain||lead.url}）\n官网公开联系方式：${lead.contact||'官网未公开'}\n公开摘要：${lead.summary||lead.role||'待补充'}\n个性化依据：${lead.summary||lead.verify||'官网核验结果'}`).join('\n\n');
  const prompt=`请严格为下面全部 ${leads.length} 家客户各生成 1 封针对性英文首封开发信，不能只写前几家，也不能合并成一封群发信。\n\n硬性要求：\n1. 每封必须引用该公司的公开摘要、背调信号或个性化依据，不能只替换公司名。\n2. 同一批邮件的主题、开头、卖点和 CTA 不能同质化；请轮换这些角度：项目采购、渠道补货、零售选品、耐用/易维护场景、采购入口核验。\n3. 主题行要像真人邮件，短、自然，不要营销口号，不用感叹号和表情。\n4. 正文 90-150 英文词；先说对方场景，再说我们能帮什么，最后只问一个低摩擦问题。\n5. 不承诺价格、交期、认证、库存和付款；没有官网公开邮箱的只生成草稿并标注“未找到官网公开邮箱，不得发送”。\n6. 每封输出：公司名、收件邮箱、切入点、英文主题、英文正文、发送前人工核验项。\n\n客户资料：\n${rows}`;
  if(!autoRun){
    state.pendingSkill='email_copilot';
    routeTo('new-task');
    setTimeout(()=>{const input=document.querySelector('#chat-input');if(input){input.value=prompt;input.dispatchEvent(new Event('input'));input.focus()}},20);
    return;
  }
  state.liveTask={query:'为选中客户生成首封开发信',skill:'email_copilot',progress:8,status:'running',statusText:'正在为每家客户生成针对性草稿',result:'',emailTargets:leads.map(lead=>({...lead})),queuedEmailKeys:[]};
  save();routeTo('live-task');
  try{
    const job=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt,skill:'email_copilot'})});
    state.liveTask.backendId=job.id;state.liveTask.progress=job.progress||0;save();pollAiTask(job.id);
  }catch(error){showToast('真实检索服务不可用，未生成演示结果');runLocalTask(prompt)}
}
async function autoProcessLeads(){
  const leads=selectedLeadCandidates();
  if(!leads.length){showToast('请先选择客户');return}
  await importSelectedLeads();
  await draftLeadEmails(true);
}
function selectedEmailDrafts(){
  const drafts=emailDraftTargets(state.liveTask||{});
  return Array.from(document.querySelectorAll('[data-email-index]:checked')).map(input=>{
    const index=Number(input.dataset.emailIndex);
    const draft=drafts[index];
    if(!draft)return null;
    return {...draft,subject:document.querySelector(`[data-email-subject="${index}"]`)?.value.trim()||draft.subject,body:document.querySelector(`[data-email-body="${index}"]`)?.value.trim()||draft.body};
  }).filter(Boolean);
}
async function queueSelectedLeadEmails(sendNow=false){
  const selected=selectedEmailDrafts();
  if(!selected.length){showToast('请先勾选要处理的开发信');return}
  if(sendNow&&!window.confirm(`将发送已勾选的 ${selected.length} 封开发信；没有官网公开邮箱的客户会跳过。确认发送吗？`))return;
  const queuedKeys=new Set(state.liveTask?.queuedEmailKeys||[]);
  const createdIds=[];let queued=0,skipped=0,failed=0,sent=0;
  for(const draft of selected){
    if(!draft.email||queuedKeys.has(draft.key)){skipped++;continue}
    try{
      const item=await api('/mail/drafts',{method:'POST',body:JSON.stringify({to_email:draft.email,recipient_name:draft.recipientName,company_name:draft.company,subject:draft.subject,body_text:draft.body,queue:true})});
      queuedKeys.add(draft.key);createdIds.push(item.id);queued++;
    }catch(error){failed++}
  }
  if(sendNow){
    for(const id of createdIds){
      try{const result=await api(`/mail/messages/${id}/send`,{method:'POST',body:JSON.stringify({confirm:true})});if(result.sent)sent++;else failed++}catch(error){failed++}
    }
  }
  if(state.liveTask){state.liveTask.queuedEmailKeys=Array.from(queuedKeys);save()}
  await loadBackend();
  if(sendNow){state.mailFolder=sent?'已发送':'待发送';state.selectedMailId='';save();render();showToast(`发件服务器已接受 ${sent} 封${skipped?`，跳过 ${skipped} 封`:''}${failed?`，失败 ${failed} 封`:''}；请到邮箱“已发送”查看`)}
  else{render();showToast(`已加入发送队列 ${queued} 封${skipped?`，跳过 ${skipped} 封`:''}${failed?`，失败 ${failed} 封`:''}`)}
}

async function uploadFiles(fileList){
  const files=Array.from(fileList||[]);
  if(!files.length)return;
  let completed=0;
  for(const file of files){
    try{
      const form=new FormData();form.append('file',file);
      await api('/files',{method:'POST',body:form});
      completed++;
    }catch(error){showToast(`${file.name} 上传失败：${error.message}`)}
  }
  if(completed){await loadBackend();showToast(`已上传并解析 ${completed} 个文件`)}
}

function openFolderForm(){
  openModal('新建文件夹','文件夹会保存到当前组织网盘。',`<div class="settings-panel"><div class="form-section"><label class="field">文件夹名称<input id="folder-name" placeholder="例如：2026 产品资料"></label><label class="field">上级路径<select id="folder-parent"><option value="/">根目录</option>${state.backendFolders.map(folder=>`<option value="${esc(folder.path)}">${esc(folder.path)}</option>`).join('')}</select></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="create-folder">创建</button></div></div></div>`,false);
}
async function createFolder(){
  const name=document.querySelector('#folder-name')?.value.trim();
  const parent=document.querySelector('#folder-parent')?.value||'/';
  if(!name){showToast('请输入文件夹名称');return}
  try{await api('/folders',{method:'POST',body:JSON.stringify({name,parent})});closeModal();await loadBackend();showToast('文件夹已创建')}
  catch(error){showToast(`创建失败：${error.message}`)}
}
function openFileActions(fileId){
  const file=state.backendFiles.find(item=>item.id===fileId);if(!file)return;
  openModal('管理文件','重命名、移动、分享或删除当前文件。',`<div class="settings-panel"><div class="form-section"><label class="field">文件名<input id="file-rename" value="${esc(file.name)}"></label><label class="field">所在文件夹<select id="file-folder"><option value="/">根目录</option>${state.backendFolders.map(folder=>`<option value="${esc(folder.path)}" ${folder.path===file.folder?'selected':''}>${esc(folder.path)}</option>`).join('')}</select></label><p>知识状态：${esc(file.knowledge_status||'已保存')}　大小：${fileSize(file.size)}</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn" data-action="save-file-meta" data-file-id="${esc(fileId)}">保存修改</button><button class="btn" data-action="share-file" data-file-id="${esc(fileId)}">复制分享链接</button><button class="btn" data-action="download-file" data-file-id="${esc(fileId)}">下载</button><button class="btn danger" data-action="delete-file" data-file-id="${esc(fileId)}">删除文件</button></div></div></div>`,false);
}
async function saveFileMeta(fileId){
  const name=document.querySelector('#file-rename')?.value.trim();const folder=document.querySelector('#file-folder')?.value||'/';
  try{await api(`/files/${fileId}`,{method:'PATCH',body:JSON.stringify({name,folder})});closeModal();await loadBackend();showToast('文件信息已更新')}
  catch(error){showToast(`更新失败：${error.message}`)}
}
async function shareFile(fileId){
  try{const result=await api(`/files/${fileId}/share`,{method:'POST'});await navigator.clipboard?.writeText(result.share_url);showToast('分享链接已复制，72 小时内有效')}
  catch(error){showToast(`分享失败：${error.message}`)}
}
async function downloadFile(fileId){
  try{const headers={};const token=localStorage.getItem(AUTH_TOKEN_KEY);if(token)headers.Authorization=`Bearer ${token}`;const response=await fetch(`${API_BASE}/files/${fileId}/download`,{headers});if(!response.ok)throw new Error('下载失败');const blob=await response.blob();const disposition=response.headers.get('content-disposition')||'';const match=disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);const file=state.backendFiles.find(item=>item.id===fileId);const name=decodeURIComponent(match?.[1]||file?.name||'下载文件');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);showToast('文件已下载')}
  catch(error){showToast(`下载失败：${error.message}`)}
}
async function deleteFile(fileId){
  try{await api(`/files/${fileId}`,{method:'DELETE'});closeModal();await loadBackend();showToast('文件已移入回收状态')}
  catch(error){showToast(`删除失败：${error.message}`)}
}
async function deleteFolder(folderId){
  try{await api(`/folders/${folderId}`,{method:'DELETE'});await loadBackend();showToast('文件夹已删除')}
  catch(error){showToast(`删除失败：${error.message}`)}
}

async function connectDemoMail(provider='演示邮箱'){
  try{
    await api('/mail/accounts/connect-demo',{method:'POST',body:JSON.stringify({provider,email:'sales@example.com',display_name:'销售邮箱'})});
    await loadBackend();closeModal();routeTo('mail');showToast('邮箱已连接，最近邮件已同步');
  }catch(error){state.mailConnected=true;save();routeTo('mail');showToast(`当前使用本地预览：${error.message}`)}
}

async function openGoogleMailSetup(){
  let status={configured:false,from:'',host:'smtp.gmail.com',port:587};
  try{status=await api('/mail/google-smtp/status')}catch(error){}
  openModal('绑定我的 Gmail 发件箱','开发信会从当前登录用户自己的 Gmail 发出，不会共用管理员邮箱。请填应用专用密码，不要填网页登录密码。',`<div class="settings-panel"><div class="form-section"><h4>当前状态</h4><p>${status.configured?`✅ 已绑定：${esc(status.from)}`:'⚠ 未绑定可发送的个人 Gmail'}</p><div class="entity-edit-grid"><label class="field">我的 Gmail 邮箱<input id="google-smtp-email" value="${esc(status.from||'')}" placeholder="name@gmail.com"></label><label class="field">应用专用密码<input id="google-smtp-password" type="password" autocomplete="new-password" placeholder="16位密码，例如 abcd efgh ijkl mnop"></label><label class="field">发件名称<input id="google-smtp-name" value="销售邮箱"></label><label class="field">SMTP 设置<input value="smtp.gmail.com · TLS 587" disabled></label></div><div class="card" style="padding:12px;background:#fbf8ff"><h4 style="margin-top:0">应用专用密码在哪里生成？</h4><ol style="font-size:12px;line-height:1.8;margin:8px 0 0;padding-left:18px"><li>打开 <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">Google 账号 → 安全性</a></li><li>找到“您登录 Google 的方式”，先确认“两步验证”已开启</li><li>再打开 <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">应用专用密码页面</a></li><li>输入应用名称，例如“远帆AI”，点击创建</li><li>复制 Google 生成的 16 位密码，粘贴到上面的输入框</li></ol><p class="lead" style="margin-top:10px">注意：应用专用密码只显示一次；如果忘了，重新生成一个即可。修改 Google 登录密码后，旧的应用专用密码会失效。</p></div><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="connect-google-smtp">保存并测试连接</button></div></div></div>`,false);
}

async function connectGoogleSmtp(){
  const email=document.querySelector('#google-smtp-email')?.value.trim();
  const appPassword=document.querySelector('#google-smtp-password')?.value.trim();
  const fromName=document.querySelector('#google-smtp-name')?.value.trim()||'销售邮箱';
  if(!email||!appPassword){showToast('请填写 Google 邮箱和应用专用密码');return}
  try{
    showToast('正在测试 Google 邮箱连接…');
    const result=await api('/mail/google-smtp/connect',{method:'POST',body:JSON.stringify({email,app_password:appPassword,from_name:fromName,test_connection:true})});
    await loadBackend();
    state.mailFolder='待发送';
    save();
    closeModal();
    routeTo('mail');
    showToast(result.ok?'Google 邮箱已连接，可以确认发送':'连接未通过，请检查应用专用密码');
  }catch(error){showToast(`连接失败：${error.message}`)}
}

async function disconnectMail(){
  const account=state.backendMailAccounts[0];
  try{if(account)await api(`/mail/accounts/${account.id}`,{method:'DELETE'});await loadBackend();showToast('邮箱账户已断开')}
  catch(error){showToast(`断开失败：${error.message}`)}
}

const connectDemoProfiles={
  email:{channel:'email',name:'销售邮箱演示账号',account_identifier:'sales@example.com',provider:'smtp-imap-demo',can_send:true,can_receive:true},
  linkedin:{channel:'linkedin',name:'LinkedIn 销售代表演示账号',account_identifier:'https://www.linkedin.com/in/sales-demo',provider:'linkedin-demo',can_send:true,can_receive:false},
  whatsapp:{channel:'whatsapp',name:'WhatsApp 商务演示账号',account_identifier:'+86 138 0000 0000',provider:'whatsapp-demo',can_send:true,can_receive:false}
};
async function connectDemoOutreachAccount(channel='email'){
  const payload=connectDemoProfiles[channel]||connectDemoProfiles.email;
  try{
    await api('/connect/accounts/demo',{method:'POST',body:JSON.stringify(payload)});
    await loadBackend();
    openSettings('connect');
    showToast(`${payload.name} 已连接`);
  }catch(error){showToast(`连接失败：${error.message}`)}
}
function openOutreachForm(channel='',accountId=''){
  const accounts=state.backendConnectAccounts;
  const options=accounts.map(item=>`<option value="${esc(item.id)}" data-channel="${esc(item.channel)}" ${item.id===accountId?'selected':''}>${esc(item.name)} · ${esc({email:'Email',linkedin:'LinkedIn',whatsapp:'WhatsApp'}[item.channel]||item.channel)}</option>`).join('');
  if(!accounts.length){
    openModal('创建触达测试','需要先有 Connect 账号。',`<div class="settings-panel"><div class="form-section"><p>请先连接至少一个演示账号，再创建触达任务。</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn dark" data-action="connect-demo-account" data-channel="email">连接 Email</button><button class="btn" data-action="connect-demo-account" data-channel="linkedin">连接 LinkedIn</button><button class="btn" data-action="connect-demo-account" data-channel="whatsapp">连接 WhatsApp</button></div></div></div>`,false);
    return;
  }
  const selected=accounts.find(item=>item.id===accountId)||accounts.find(item=>item.channel===channel)||accounts[0];
  openModal('创建触达测试','本地会创建一条待确认触达任务，不会真实发送。',`<div class="settings-panel"><div class="form-section"><label class="field">发送账号<select id="outreach-account">${options}</select></label><div class="entity-edit-grid"><label class="field">客户姓名<input id="outreach-name" value="Ahmed Al Faisal"></label><label class="field">Email 收件人<input id="outreach-email" value="buyer@example.com" placeholder="Email 渠道必填"></label><label class="field">LinkedIn 主页<input id="outreach-linkedin" value="https://www.linkedin.com/in/demo-buyer" placeholder="LinkedIn 渠道必填"></label><label class="field">WhatsApp 手机号<input id="outreach-phone" value="+966 50 000 0000" placeholder="WhatsApp 渠道必填"></label><label class="field" style="grid-column:1/-1">主题<input id="outreach-subject" value="Commercial flooring proposal for your Saudi projects"></label><label class="field" style="grid-column:1/-1">触达内容<textarea id="outreach-text">Hi Ahmed, I noticed your team works on commercial flooring projects in Saudi Arabia. We supply durable carpets and stain-resistant flooring options for hotels, offices and schools. Would it be useful if I send a short product-match sheet and loading plan?</textarea></label></div><p class="lead">提示：选择 Email 账号会用邮箱字段；LinkedIn 用主页链接；WhatsApp 用手机号。</p><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="send-outreach-test">创建任务</button></div></div></div>`,false);
  const select=document.querySelector('#outreach-account');
  if(select&&selected)select.value=selected.id;
}
async function sendOutreachTest(){
  const select=document.querySelector('#outreach-account');
  const option=select?.selectedOptions?.[0];
  const channel=option?.dataset.channel||'email';
  const body={
    account_id:select?.value||'',
    channel,
    action:'outreach',
    recipient:{
      name:document.querySelector('#outreach-name')?.value.trim(),
      address:document.querySelector('#outreach-email')?.value.trim(),
      profile_url:document.querySelector('#outreach-linkedin')?.value.trim(),
      phone:document.querySelector('#outreach-phone')?.value.trim()
    },
    content:{
      subject:document.querySelector('#outreach-subject')?.value.trim(),
      text:document.querySelector('#outreach-text')?.value.trim()
    },
    metadata:{source:'ui-connect-test',requires_human_confirmation:true},
    min_channel_task_interval_seconds:60
  };
  try{
    const job=await api('/outreach/dispatches',{method:'POST',headers:{'Idempotency-Key':`ui-${Date.now()}-${Math.random().toString(16).slice(2)}`},body:JSON.stringify(body)});
    await new Promise(resolve=>setTimeout(resolve,800));
    await loadBackend();
    openSettings('connect');
    showToast(`触达任务已创建：${job.status}`);
  }catch(error){showToast(`创建失败：${error.message}`)}
}
function openLinkedinLikeForm(accountId=''){
  const accounts=state.backendConnectAccounts.filter(item=>item.channel==='linkedin');
  if(!accounts.length){
    openModal('LinkedIn 点赞测试','需要先连接 LinkedIn 演示账号。',`<div class="settings-panel"><div class="form-section"><p>这一步对标 Revor 的 LinkedIn post-likes 能力；当前本地模式不会真实点赞。</p><button class="btn dark" data-action="connect-demo-account" data-channel="linkedin">连接演示 LinkedIn</button></div></div>`,false);
    return;
  }
  const options=accounts.map(item=>`<option value="${esc(item.id)}" ${item.id===accountId?'selected':''}>${esc(item.name)} · ${esc(item.account_identifier)}</option>`).join('');
  openModal('LinkedIn 点赞测试','本地会完成候选帖子选择与动作校验，不会真实操作 LinkedIn。',`<div class="settings-panel"><div class="form-section"><label class="field">LinkedIn 账号<select id="linkedin-like-account">${options}</select></label><label class="field">目标主页<input id="linkedin-like-profile" value="https://www.linkedin.com/in/demo-buyer"></label><label class="field">判断偏好<textarea id="linkedin-like-content">优先选择与酒店、办公室、学校工程地毯或地面材料采购相关的帖子。</textarea></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="send-linkedin-like-test">创建点赞任务</button></div></div></div>`,false);
}
async function sendLinkedinLikeTest(){
  const body={
    account_id:document.querySelector('#linkedin-like-account')?.value||'',
    profile_url:document.querySelector('#linkedin-like-profile')?.value.trim(),
    content:document.querySelector('#linkedin-like-content')?.value.trim(),
    post_limit:20,
    locale:'zh',
    min_channel_task_interval_seconds:60
  };
  try{
    const job=await api('/outreach/linkedin/post-likes',{method:'POST',headers:{'Idempotency-Key':`ui-like-${Date.now()}-${Math.random().toString(16).slice(2)}`},body:JSON.stringify(body)});
    await new Promise(resolve=>setTimeout(resolve,800));
    await loadBackend();
    openSettings('connect');
    showToast(`LinkedIn 点赞任务已创建：${job.status}`);
  }catch(error){showToast(`创建失败：${error.message}`)}
}
async function refreshOutreachJob(jobId){
  try{
    const job=await api(`/outreach/jobs/${jobId}`);
    await loadBackend();
    openSettings('connect');
    showToast(`任务状态：${job.status}`);
  }catch(error){showToast(`查询失败：${error.message}`)}
}

async function saveMailDraft(messageId,queue=false){
  const textValue=document.querySelector('#mail-draft')?.value.trim();
  if(!textValue){showToast('草稿内容不能为空');return}
  const id=messageId||state.backendMailMessages[0]?.id;
  if(!id){showToast('本地草稿已保存');return}
  try{
    if(queue)await api(`/mail/messages/${id}/queue`,{method:'POST',body:JSON.stringify({draft_text:textValue,require_confirmation:true})});
    else await api(`/mail/messages/${id}/draft`,{method:'PATCH',body:JSON.stringify({text:textValue})});
    await loadBackend();
    showToast(queue?'已加入人工确认队列，未对外发送':'草稿已保存到数据库');
  }catch(error){showToast(`保存失败：${error.message}`)}
}
async function sendMailNow(messageId){
  const id=messageId||state.selectedMailId;
  if(!id){showToast('请先选择一封待发送邮件');return}
  const textValue=document.querySelector('#mail-draft')?.value.trim();
  try{
    if(textValue)await api(`/mail/messages/${id}/draft`,{method:'PATCH',body:JSON.stringify({text:textValue})});
    const result=await api(`/mail/messages/${id}/send`,{method:'POST',body:JSON.stringify({confirm:true})});
    await loadBackend();
    if(result.sent){
      state.mailFolder='已发送';
      state.selectedMailId=id;
      save();
      render();
      showToast('发件服务器已接受邮件；请到邮箱“已发送”查看');
    }else{
      state.mailFolder='待发送';
      state.selectedMailId=id;
      save();
      render();
      showToast(result.detail||'还差发件邮箱连接');
    }
  }catch(error){showToast(`发送失败：${error.message}`)}
}
async function autoSendMailQueue(){
  const pendingCount=state.backendMailMessages.filter(item=>['queued','needs_connection'].includes(item.status)&&item.direction==='outbound').length;
  if(!pendingCount){showToast('没有待发送邮件');return}
  try{
    showToast(`正在自动发送 ${pendingCount} 封待发送邮件…`);
    const result=await api('/mail/queue/auto-send',{method:'POST',body:JSON.stringify({confirm:true,limit:Math.min(pendingCount,100)})});
    await loadBackend();
    state.mailFolder=result.sent_count>0?'已发送':'待发送';
    state.selectedMailId='';
    save();
    render();
    if(result.sent_count>0)showToast(`已发送 ${result.sent_count} 封；失败 ${result.failed_count||0} 封`);
    else showToast(result.detail||'还没连接发件邮箱，邮件仍在待发送');
  }catch(error){showToast(`自动发送失败：${error.message}`)}
}
function selectMail(messageId){state.selectedMailId=messageId;save();render()}
function selectMailFolder(folder){state.mailFolder=folder;state.selectedMailId='';save();render()}
function selectDriveTab(tab){state.driveTab=tab;save();render()}
function selectOpportunityView(view){state.opportunityView=view;save();render()}
function selectQuote(quoteId){state.selectedQuoteId=quoteId;save();render()}

async function savePreferences(){
  state.userName=document.querySelector('#pref-name')?.value.trim()||state.userName;
  state.preferredTone=document.querySelector('#pref-tone')?.value.trim()||state.preferredTone;
  save();
  try{await api('/settings/profile',{method:'PATCH',body:JSON.stringify({value:{userName:state.userName,preferredTone:state.preferredTone}})});showToast('AI 偏好已保存到数据库')}
  catch(error){showToast('偏好已保存到当前设备')}
}
async function saveGenericSettings(){
  const tab=document.querySelector('[data-setting-tab].active')?.dataset.settingTab||'general';
  const values={};
  document.querySelectorAll('#settings-panel input,#settings-panel textarea,#settings-panel select').forEach((input,index)=>{const label=input.closest('label')?.childNodes[0]?.textContent?.trim()||`字段${index+1}`;values[label]=input.value});
  try{await api(`/settings/ui_${tab}`,{method:'PATCH',body:JSON.stringify({value:values})});showToast('设置已保存到数据库')}
  catch(error){showToast(`保存失败：${error.message}`)}
}

async function saveOrganization(){
  const value={name:document.querySelector('#org-name')?.value.trim()||state.orgName,website:document.querySelector('#org-website')?.value.trim()||'',description:document.querySelector('#org-description')?.value.trim()||'',context:document.querySelector('#org-context')?.value.trim()||''};
  try{await api('/settings/organization',{method:'PATCH',body:JSON.stringify({value})});state.orgName=value.name;state.workspaceSettings.organization=value;save();document.querySelector('#settings-panel').innerHTML=settingsPanel('organization');showToast('组织资料已保存到数据库')}
  catch(error){showToast(`保存失败：${error.message}`)}
}
async function generateOrganizationProfile(){
  const website=document.querySelector('#org-website')?.value.trim()||state.workspaceSettings.organization?.website||'';
  const query=`请结合当前商品库和知识库，为“${state.orgName}”生成结构化组织能力摘要。官网线索：${website||'未填写'}。请区分已知资料与待核验信息，不要假设已经访问外部网站；输出主营产品、目标市场、供应能力、交付、贸易条款、优势、缺口和建议补充资料。`;
  closeModal();state.liveTask={query,progress:5,status:'running',result:''};save();routeTo('live-task');
  try{const job=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt:query,skill:'general_sales'})});state.liveTask.backendId=job.id;save();pollAiTask(job.id)}
  catch(error){runLocalTask(query)}
}
function openTokenForm(){
  openModal('生成访问令牌','令牌仅展示一次，可用于 MCP 客户端或工作区接口。',`<div class="settings-panel"><div class="form-section"><label class="field">令牌名称<input id="token-name" value="我的 MCP 客户端"></label><label class="field">有效期<select id="token-days"><option value="30">30 天</option><option value="90">90 天</option><option value="365">365 天</option></select></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="create-token">生成</button></div></div></div>`,false);
}
async function createAccessToken(){
  const name=document.querySelector('#token-name')?.value.trim()||'工作区工具令牌';const expires_days=Number(document.querySelector('#token-days')?.value||30);
  try{const result=await api('/api-tokens',{method:'POST',body:JSON.stringify({name,expires_days})});await loadBackend();replaceModal('令牌已生成','请现在复制并妥善保存，关闭后无法再次查看。',`<div class="settings-panel"><div class="form-section"><label class="field">访问令牌<textarea id="generated-token" readonly>${esc(result.token)}</textarea></label><p>到期时间：${esc(result.expires_at)}</p><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn dark" data-action="copy-generated-token">复制令牌</button><button class="btn" data-close-modal>完成</button></div></div></div>`,false)}
  catch(error){showToast(`生成失败：${error.message}`)}
}
async function revokeToken(tokenId){
  try{await api(`/api-tokens/${tokenId}`,{method:'DELETE'});await loadBackend();openSettings('mcp');showToast('访问令牌已撤销')}
  catch(error){showToast(`撤销失败：${error.message}`)}
}
function openAgentForm(agentId=''){
  const agent=state.backendAgents.find(item=>item.id===agentId)||{};
  openModal(agentId?'编辑 Agent':'新增 Agent','执行指令会作为本地 Agent 配置持久化。',`<div class="settings-panel"><div class="form-section"><label class="field">Agent 名称<input id="agent-name" value="${esc(agent.name||'')}"></label><label class="field">作用域<select id="agent-scope">${['组织 Agent','个人 Agent'].map(scope=>`<option ${agent.scope===scope?'selected':''}>${scope}</option>`).join('')}</select></label><label class="field">能力说明<input id="agent-description" value="${esc(agent.description||'')}"></label><label class="field">执行指令<textarea id="agent-instructions">${esc(agent.instructions||'')}</textarea></label><div style="display:flex;justify-content:${agentId?'space-between':'flex-end'};gap:7px">${agentId?`<button class="btn danger" data-action="delete-agent" data-agent-id="${esc(agentId)}">删除</button>`:''}<span style="margin-left:auto;display:flex;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="save-agent" data-agent-id="${esc(agentId)}">保存</button></span></div></div></div>`,false);
}
async function saveAgent(agentId=''){
  const payload={name:document.querySelector('#agent-name')?.value.trim(),scope:document.querySelector('#agent-scope')?.value||'组织 Agent',description:document.querySelector('#agent-description')?.value.trim()||'',instructions:document.querySelector('#agent-instructions')?.value.trim()||'',enabled:true};
  if(!payload.name){showToast('请输入 Agent 名称');return}
  try{await api(`/agents${agentId?`/${agentId}`:''}`,{method:agentId?'PATCH':'POST',body:JSON.stringify(payload)});closeModal(true);await loadBackend();openSettings('agents');showToast(agentId?'Agent 已更新':'Agent 已创建')}
  catch(error){showToast(`保存失败：${error.message}`)}
}
async function deleteAgent(agentId){
  try{await api(`/agents/${agentId}`,{method:'DELETE'});closeModal(true);await loadBackend();openSettings('agents');showToast('Agent 已删除')}
  catch(error){showToast(`删除失败：${error.message}`)}
}
function openMemberForm(){
  openModal('新增成员账户','系统不会对外发送邀请；请手动安全转交一次性临时密码。',`<div class="settings-panel"><div class="form-section"><label class="field">成员姓名<input id="member-name"></label><label class="field">邮箱<input id="member-email" type="email"></label><label class="field">角色<select id="member-role"><option value="member">普通成员</option><option value="admin">管理员</option></select></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="create-member">创建账户</button></div></div></div>`,false);
}
async function createMember(){
  const payload={name:document.querySelector('#member-name')?.value.trim(),email:document.querySelector('#member-email')?.value.trim(),role:document.querySelector('#member-role')?.value||'member'};
  if(!payload.name||!payload.email){showToast('请填写姓名和邮箱');return}
  try{const result=await api('/members',{method:'POST',body:JSON.stringify(payload)});await loadBackend();replaceModal('成员账户已创建','临时密码只展示一次，系统没有发送外部邮件。',`<div class="settings-panel"><div class="form-section"><p><b>${esc(result.member.name)}</b> · ${esc(result.member.email)}</p><label class="field">临时密码<input id="member-temp-password" value="${esc(result.temporary_password)}" readonly></label><button class="btn dark" data-action="copy-member-password">复制登录信息</button><button class="btn" data-close-modal style="margin-left:6px">完成</button></div></div>`,false)}
  catch(error){showToast(`创建失败：${error.message}`)}
}
async function removeMember(memberId){
  try{await api(`/members/${memberId}`,{method:'DELETE'});await loadBackend();openSettings('members');showToast('成员已移除')}
  catch(error){showToast(`移除失败：${error.message}`)}
}
function previewChatbot(){
  openModal('销售协作机器人 · 本地预览','消息会作为真实 AI 任务保存到当前工作区。',`<div class="settings-panel"><div class="form-section"><label class="field">测试消息<textarea id="chatbot-prompt" placeholder="例如：今天有哪些高优先级任务？"></textarea></label><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn" data-close-modal>取消</button><button class="btn dark" data-action="send-chatbot-preview">发送测试</button></div></div></div>`,false);
}
async function sendChatbotPreview(){
  const prompt=document.querySelector('#chatbot-prompt')?.value.trim();if(!prompt){showToast('请输入测试消息');return}
  closeModal(true);state.liveTask={query:`[机器人本地预览] ${prompt}`,progress:5,status:'running',result:''};save();routeTo('live-task');
  try{const job=await api('/ai/tasks',{method:'POST',body:JSON.stringify({prompt,skill:'general_sales'})});state.liveTask.backendId=job.id;save();pollAiTask(job.id)}catch(error){runLocalTask(prompt)}
}

async function toggleAutomation(button){
  const key=button.dataset.automation;
  const next=!state.automations[key];
  state.automations[key]=next;button.classList.toggle('on',next);save();
  try{await api(`/automations/${key}`,{method:'PATCH',body:JSON.stringify({enabled:next})});showToast(next?'自动任务已启用':'自动任务已暂停')}
  catch(error){state.automations[key]=!next;button.classList.toggle('on',!next);save();showToast(`更新失败：${error.message}`)}
}
async function runAutomation(key){
  try{const result=await api(`/automations/${key}/run`,{method:'POST'});await loadBackend();const panel=document.querySelector('#settings-panel');if(panel)panel.innerHTML=settingsPanel('automation');showToast(result.result)}
  catch(error){showToast(`运行失败：${error.message}`)}
}
function openSkills(){
  const skills=[
    ['找潜在买家','输出可核验客户清单并自动准备下一步','lead_generation','@找潜在买家&#10;产品：请填写产品、材质、价格带和 MOQ&#10;目标市场：请填写国家或地区&#10;目标客户：进口商 / 分销商 / 零售商 / 品牌方（请选填）&#10;系统自动完成官网核验、联系方式采集和去重；有邮箱的客户继续自动生成针对性开发信。每行要短，没有可验证来源时不得编造公司。'],
    ['跟进已沟通客户','客户问过价/要过资料后，判断下一步动作','opportunity_coach','@跟进已沟通客户&#10;请只挑最该推进的前 3 个，输出今天唯一动作、给客户的一句话、升级/放弃条件。'],
    ['查客户靠不靠谱','判断是否值得开发，并给下一步动作','company_research','@查客户靠不靠谱&#10;目标公司：请填写名称或粘贴官网&#10;资料范围：官网 / 上传文件 / 工作区资料&#10;请用短格式判断是否值得开发：结论与优先级、关键事实、待确认、今天3个动作、首次核验话术。'],
    ['找官网联系方式','尽量完整抓官网公开邮箱、电话、WhatsApp、表单和社交入口','contact_discovery','@找官网联系方式&#10;目标公司：请填写名称或粘贴官网&#10;目标品类：请填写&#10;尽量完整输出已经抓到、可以直接使用的公开邮箱、电话、WhatsApp、Contact/Quote表单和官方社交入口；抓不到就明确写未找到官网公开联系方式。'],
    ['查进口记录（需数据）','需要海关/贸易数据源；未接入时只分析你提供的记录','trade_analysis','@查进口记录（需数据）&#10;目标公司：请填写名称或粘贴官网&#10;目标产品 / HS 编码（如有）：请填写&#10;请只分析已上传、已提供或可核验的贸易线索；如果没有海关/贸易数据源，请明确说明当前不能声称查到了进口记录。'],
    ['做报价单','生成带贸易边界的可确认报价草稿','quotation','@做报价单&#10;客户与目的地：请填写&#10;产品 / 规格 / 数量 / 包装：请填写&#10;贸易术语：EXW / FOB / CIF / DAP / DDP（请填写）&#10;请先列缺失参数；资料足够时给报价草稿。'],
    ['写开发/跟进信','提炼客户意图并生成可审核的英文草稿','email_copilot','@写开发/跟进信&#10;客户背景 / 往来上下文：请粘贴邮件或填写要点&#10;目标：推进询盘 / 催复 / 报价跟进 / 样品确认 / 异议处理（请填写）&#10;请输出英文主题、正文和中文备注；默认只生成草稿，不发送。'],
    ['配产品方案','组合 SKU、卖点与成交条件','general_sales','@配产品方案&#10;目标市场 / 客户类型：请填写&#10;应用场景与预算：请填写&#10;请输出主推款、备选款、为什么适合、还缺哪些参数和客户沟通话术。']
  ];
  const cards=WORKFLOW_CENTER_ORDER.map(key=>{const skill=WORKFLOW_SKILLS[key];const hint=SECONDARY_WORKFLOW_HINTS[key];return `<button class="skill-card" data-action="activate-workflow" data-skill="${key}" style="text-align:left">${hint?`<span class="status amber">${esc(hint)}</span>`:'<span class="status green">常用</span>'}<span class="automation-icon">${ico(skill.icon)}</span><h4>${skill.name}</h4><p>${skill.description}</p><small class="skill-card-cta">填写参数后执行 →</small></button>`}).join('');
  openModal('AI 技能中心','先用前 5 个常用工具；标黄的是后期或需要额外数据源的功能。',`<div class="settings-panel"><div class="skill-grid">${cards}</div></div>`);
}
function openCommand(){
  previousFocus=document.activeElement;commandLayer.classList.add('open');commandLayer.setAttribute('aria-hidden','false');commandInput.value='';renderCommandResults('');setTimeout(()=>commandInput.focus(),30);
}
function closeCommand(){const wasOpen=commandLayer.classList.contains('open');commandLayer.classList.remove('open');commandLayer.setAttribute('aria-hidden','true');if(wasOpen&&previousFocus?.focus)previousFocus.focus()}
const commands=[['dashboard','仪表盘','查看今天优先动作与 AI 简报','home'],['new-task','新建 AI 任务','找买家、查客户、补联系方式、写邮件或做报价','spark'],['mail','邮件','绑定 Gmail、查看草稿和已发送记录','mail'],['tasks','成果','查看往期 AI 任务成果并继续执行','task'],['drive','资料库','管理产品、交付、认证和公司资料','drive'],['research-task','美国东方地毯背调','继续已有 AI 会话','history']];
function renderCommandResults(query){
  const rows=commands.filter(x=>x[1].includes(query)||x[2].includes(query)).map((x,i)=>`<button class="command-result ${i===0?'active':''}" data-route="${x[0]}">${ico(x[3])}<span><b>${x[1]}</b><small>${x[2]}</small></span></button>`).join('');
  document.querySelector('#command-results').innerHTML=rows||`<div class="empty-state" style="min-height:120px"><div><p>没有找到匹配内容</p></div></div>`;
}
async function searchCommand(query){
  if(!query){renderCommandResults('');return}
  try{
    const result=await api(`/search?q=${encodeURIComponent(query)}`);
    const icons={companies:'company',people:'person',products:'product',tasks:'task',opportunities:'deal',conversations:'history'};
    const rows=result.items.map((item,i)=>`<button class="command-result ${i===0?'active':''}" data-route="${esc(item.route)}"><span style="color:var(--violet)">${ico(icons[item.route]||'search')}</span><span><b>${esc(item.title)}</b><small>${esc(item.subtitle||item.type)}</small></span></button>`).join('');
    document.querySelector('#command-results').innerHTML=rows||`<div class="empty-state" style="min-height:120px"><div><p>没有找到匹配内容</p></div></div>`;
  }catch(error){renderCommandResults(query)}
}
function applyTableView(type){
  const config=tableUi[type]||{query:'',filter:'全部'};
  document.querySelectorAll('[data-table-row]').forEach(row=>{
    const text=(row.dataset.record||'').toLowerCase();
    const queryOk=!config.query||text.includes(config.query.toLowerCase());
    let filterOk=true;
    if(config.filter&&!['全部','我的','我负责的','我参与的'].includes(config.filter)){
      if(config.filter==='今日')filterOk=text.includes('今天');
      else if(config.filter==='逾期')filterOk=text.includes('逾期');
      else filterOk=text.includes(config.filter.toLowerCase());
    }else if(['我的','我负责的'].includes(config.filter))filterOk=text.includes(state.userName.toLowerCase());
    row.classList.toggle('hidden',!(queryOk&&filterOk));
  });
}
function setTableFilter(button){
  const type=button.dataset.type;tableUi[type]=tableUi[type]||{};tableUi[type].filter=button.dataset.filter;
  button.parentElement.querySelectorAll('.tab').forEach(item=>item.classList.toggle('active',item===button));applyTableView(type);
}
function sortTable(type){
  const table=document.querySelector('.data-table');if(!table)return;
  tableUi[type]=tableUi[type]||{};tableUi[type].descending=!tableUi[type].descending;
  const rows=Array.from(table.querySelectorAll('[data-table-row]')).sort((a,b)=>a.dataset.record.localeCompare(b.dataset.record,'zh-CN')*(tableUi[type].descending?-1:1));
  const add=table.querySelector('.add-row');rows.forEach(row=>table.insertBefore(row,add));showToast(tableUi[type].descending?'已按名称降序排列':'已按名称升序排列');
}
function exportCsv(){
  let rows,filename;
  if(state.route==='quotations'){
    const quote=backendRecords.quotations.find(item=>item.id===state.selectedQuoteId)||backendRecords.quotations[0];
    if(!quote){showToast('没有可导出的报价');return}
    rows=[['报价编号','客户','状态','金额','币种','有效期','付款条款'],[quote.quote_no,quote.company_name,quote.status,quote.amount,quote.currency,quote.valid_until,quote.terms]];
    filename=`报价_${quote.quote_no}.csv`;
  }else{
    rows=[['公司','国家/地区','合作状态','主域名'],...companies.map(x=>[x[0],x[1],x[3],x[4]])];
    filename='客户与商机数据.csv';
  }
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);showToast('数据已导出');
}
function bindKanban(){
  let dragging;
  document.querySelectorAll('.deal-card').forEach(card=>card.addEventListener('dragstart',()=>{dragging=card;card.classList.add('dragging')}));
  document.querySelectorAll('.deal-card').forEach(card=>card.addEventListener('dragend',()=>card.classList.remove('dragging')));
  document.querySelectorAll('.kanban-col').forEach(col=>{col.addEventListener('dragover',e=>e.preventDefault());col.addEventListener('drop',async e=>{e.preventDefault();if(!dragging)return;const id=dragging.dataset.id;const stage=col.dataset.stage;const version=Number(dragging.dataset.version||0)||undefined;col.appendChild(dragging);if(!id){showToast('离线卡片已移动');return}try{await api(`/entities/opportunities/${id}`,{method:'PATCH',body:JSON.stringify({stage,version})});await loadBackend();showToast(`商机已保存到“${col.querySelector('b')?.textContent||stage}”`)}catch(error){await loadBackend();showToast(`移动失败：${error.message}`)}})});
}
async function toggleRowCheck(input){
  const key=input.dataset.rowCheck;state.completedTasks[key]=input.checked;save();
  if(input.dataset.resource==='tasks'&&input.dataset.id){
    const record=backendRecords.tasks.find(item=>item.id===input.dataset.id);
    try{await api(`/entities/tasks/${input.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:input.checked?'已完成':'待处理',version:record?.version})});await loadBackend();showToast(input.checked?'任务已完成':'任务已恢复')}
    catch(error){input.checked=!input.checked;state.completedTasks[key]=input.checked;save();showToast(`更新失败：${error.message}`)}
  }else showToast(input.checked?'已选中当前记录':'已取消选择');
}

document.addEventListener('click',e=>{
  const folderEl=e.target.closest('.folder:not([data-action])');
  if(folderEl){folderEl.parentElement.querySelectorAll('.folder').forEach(x=>x.classList.remove('active'));folderEl.classList.add('active');showToast(`已切换到${folderEl.querySelector('span')?.textContent||'当前文件夹'}`);return}
  const routeEl=e.target.closest('[data-route]');
  if(routeEl){routeTo(routeEl.dataset.route);closeCommand();return}
  const promptEl=e.target.closest('[data-prompt]');
  if(promptEl){
    const prompt=promptEl.dataset.prompt;
    state.pendingSkill=promptEl.dataset.skill||'default';
    if(modalLayer.classList.contains('open'))closeModal(true);
    if(state.route!=='new-task'&&!['research-task','mail-setup-task','lead-task','live-task'].includes(state.route))routeTo('new-task');
    setTimeout(()=>{const input=document.querySelector('#chat-input');if(input){input.value=prompt;input.dispatchEvent(new Event('input'));input.focus()}},10);return;
  }
  if(e.target.closest('[data-close-modal]')){closeModal();return}
  const tab=e.target.closest('[data-setting-tab]');
  if(tab){document.querySelectorAll('[data-setting-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');document.querySelector('#settings-panel').innerHTML=settingsPanel(tab.dataset.settingTab);return}
  const automation=e.target.closest('[data-automation]');
  if(automation){toggleAutomation(automation);return}
  const rowCheck=e.target.closest('[data-row-check]');
  if(rowCheck){toggleRowCheck(rowCheck);return}
  const actionEl=e.target.closest('[data-action]');
  if(!actionEl)return;
  const action=actionEl.dataset.action;
  const actions={
    'send-chat':sendChat,'settings':()=>openSettings('organization'),'settings-automation':()=>openSettings('automation'),'settings-org':()=>openSettings('organization'),'login':openAccountSecurity,'logout':logout,'submit-login':submitLogin,'change-password':changePassword,
    'show-more-skills':openSkills,'activate-workflow':()=>activateWorkflow(actionEl.dataset.skill),'start-one-click':startOneClickDevelopment,'close-workflow':()=>{state.activeWorkflow='';state.workflowValues={};save();render()},'workflow-choice':()=>chooseWorkflowValue(actionEl),'submit-workflow':()=>submitWorkflow(actionEl.dataset.skill),'command':openCommand,'refresh':()=>loadBackend({silent:false}),'preview-mail':()=>connectDemoMail('演示邮箱'),
    'disconnect-mail':disconnectMail,'connect-demo-account':()=>connectDemoOutreachAccount(actionEl.dataset.channel),'open-outreach-form':()=>openOutreachForm(actionEl.dataset.channel,actionEl.dataset.accountId),'send-outreach-test':sendOutreachTest,'open-linkedin-like-form':()=>openLinkedinLikeForm(actionEl.dataset.accountId),'send-linkedin-like-test':sendLinkedinLikeTest,'refresh-outreach-job':()=>refreshOutreachJob(actionEl.dataset.jobId),'upload':()=>globalFile.click(),'insert-link':()=>{const input=document.querySelector('#chat-input');if(input){input.value+=' https://';input.focus();input.dispatchEvent(new Event('input'))}},
    'save-draft':()=>saveMailDraft(actionEl.dataset.mailId,false),'queue-mail':()=>saveMailDraft(actionEl.dataset.mailId,true),'send-mail-now':()=>sendMailNow(actionEl.dataset.mailId),'auto-send-mail-queue':autoSendMailQueue,'compose-mail':()=>routeTo('new-task'),'select-mail':()=>selectMail(actionEl.dataset.mailId),'mail-folder':()=>selectMailFolder(actionEl.dataset.mailFolder),
    'new-folder':openFolderForm,'create-folder':createFolder,'delete-folder':()=>deleteFolder(actionEl.dataset.folderId),'drive-tab':()=>selectDriveTab(actionEl.dataset.driveTab),'file-more':()=>openFileActions(actionEl.dataset.fileId),'save-file-meta':()=>saveFileMeta(actionEl.dataset.fileId),'share-file':()=>shareFile(actionEl.dataset.fileId),'delete-file':()=>deleteFile(actionEl.dataset.fileId),'download-file':()=>downloadFile(actionEl.dataset.fileId),'create-entity':()=>openEntityEditor(actionEl.dataset.type),'edit-entity':()=>openEntityEditor(actionEl.dataset.type,actionEl.dataset.id),'save-entity':()=>saveEntity(actionEl.dataset.type,actionEl.dataset.id),'confirm-delete-entity':()=>confirmDeleteEntity(actionEl.dataset.type,actionEl.dataset.id),'delete-entity':()=>deleteEntity(actionEl.dataset.type,actionEl.dataset.id),'confirm-create':()=>confirmCreate(actionEl.dataset.type),'opportunity-view':()=>selectOpportunityView(actionEl.dataset.opportunityView),'select-quote':()=>selectQuote(actionEl.dataset.quoteId),
    'create-quote':()=>openEntityEditor('quotations'),'export':exportCsv,'share':()=>{navigator.clipboard?.writeText(location.href);showToast('对话链接已复制')},'open-report':openLiveReport,'sample-report-warning':openSampleReportNotice,'import-selected-leads':importSelectedLeads,'import-all-leads':importAllLeads,'select-priority-leads':selectPriorityLeads,'draft-lead-emails':()=>draftLeadEmails(false),'auto-process-leads':autoProcessLeads,'queue-selected-lead-emails':()=>queueSelectedLeadEmails(false),'send-selected-lead-emails':()=>queueSelectedLeadEmails(true),
    'mail-provider':()=>String(actionEl.dataset.provider||'').includes('Google')?openGoogleMailSetup():connectDemoMail(actionEl.dataset.provider),'google-mail-setup':openGoogleMailSetup,'connect-google-smtp':connectGoogleSmtp,
    'copy-mcp':()=>{navigator.clipboard?.writeText(document.querySelector('#mcp-address')?.value||'');showToast('MCP 地址已复制')},'open-token-form':openTokenForm,'create-token':createAccessToken,'copy-generated-token':()=>{navigator.clipboard?.writeText(document.querySelector('#generated-token')?.value||'');showToast('访问令牌已复制')},'revoke-token':()=>revokeToken(actionEl.dataset.tokenId),
    'create-agent':()=>openAgentForm(),'edit-agent':()=>openAgentForm(actionEl.dataset.agentId),'save-agent':()=>saveAgent(actionEl.dataset.agentId),'delete-agent':()=>deleteAgent(actionEl.dataset.agentId),'invite':openMemberForm,'create-member':createMember,'remove-member':()=>removeMember(actionEl.dataset.memberId),'copy-member-password':()=>{const value=`${document.querySelector('#member-temp-password')?.value||''}`;navigator.clipboard?.writeText(value);showToast('临时密码已复制')},
    'preview-chatbot':previewChatbot,'send-chatbot-preview':sendChatbotPreview,'show-channel-guide':()=>openModal('外部渠道接入条件','这一步需要目标平台提供的凭据，当前已保留安全接入边界。',`<div class="settings-panel"><div class="form-section"><h4>企业微信</h4><p>需要企业 ID、应用 AgentId 与 Secret，并在服务端配置回调域名。</p><h4>网站嵌入</h4><p>需要可公开访问的 HTTPS 域名、访问限流策略和访客数据授权说明。</p><h4>当前可用</h4><p>本地预览、AI 任务持久化、知识库上下文和人工确认流程均已可用。</p></div></div>`,false),'generate-org':generateOrganizationProfile,'save-organization':saveOrganization,
    'save-preferences':savePreferences,'open-conversation':()=>openConversation(actionEl.dataset.conversationId),'open-ai-job':()=>openAiJobResult(actionEl.dataset.jobId),'resume-ai-job':()=>resumeAiJob(actionEl.dataset.jobId),'continue-first-lead':()=>continueLeadAction(actionEl.dataset.jobId,0,'research'),'research-lead':()=>continueLeadAction(actionEl.dataset.jobId,actionEl.dataset.leadIndex,'research'),'email-lead':()=>continueLeadAction(actionEl.dataset.jobId,actionEl.dataset.leadIndex,'email'),'skill-detail':()=>openModal(actionEl.dataset.skillName,'当前内置技能配置。',`<div class="settings-panel"><div class="form-section"><h4>能力说明</h4><p>${esc(actionEl.dataset.skillDescription)}</p><h4>执行规则</h4><p>优先引用工作区已授权数据；区分事实、推断与待核验项；涉及外发和最终价格时必须人工确认。</p></div></div>`,false),'skill-import-guide':()=>openModal('导入 Skill','本地版支持以说明文件建设技能知识。',`<div class="settings-panel"><div class="form-section"><p>请上传 UTF-8 编码的 Markdown、TXT 或 JSON 说明文件。文件会先进入知识库；正式启用前需要管理员审核其指令和权限范围。</p><button class="btn dark" data-action="upload">选择说明文件</button></div></div>`,false),
    'save-generic':saveGenericSettings,'table-tab':()=>setTableFilter(actionEl),'sort-table':()=>sortTable(actionEl.dataset.type),'run-automation':()=>runAutomation(actionEl.dataset.automationKey),
    'model':()=>showToast(state.aiProvider==='deepseek'?`当前模型：${state.aiModel||'DeepSeek'}`:'当前使用本地执行器'),'upgrade':()=>showToast('演示版已解锁全部界面，无需购买'),'help':()=>openModal('帮助与反馈','快速了解工作台和获取支持。',`<div class="settings-panel"><div class="skill-grid"><article class="skill-card"><h4>新手指南</h4><p>从新建 AI 任务开始，描述你想完成的销售工作。</p></article><article class="skill-card"><h4>连接邮箱</h4><p>同步客户往来，让 AI 识别意图并起草回复。</p></article><article class="skill-card"><h4>建设知识库</h4><p>上传产品、价格、认证和交付资料。</p></article><article class="skill-card"><h4>提交反馈</h4><p>演示环境不发送外部消息。</p></article></div></div>`)
  };
  actions[action]?.();
});

function trapFocus(container,event){
  if(event.key!=='Tab')return;const focusable=Array.from(container.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(item=>item.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
document.querySelector('#more-toggle').addEventListener('click',()=>{state.moreOpen=!state.moreOpen;save();updateNav()});
document.querySelector('#collapse-sidebar').addEventListener('click',()=>{state.collapsed=!state.collapsed;save();updateNav()});
document.querySelector('#mobile-menu').addEventListener('click',e=>{const open=sidebar.classList.toggle('mobile-open');e.currentTarget.setAttribute('aria-expanded',String(open))});
document.querySelector('#user-menu-button').addEventListener('click',e=>{e.stopPropagation();const menu=document.querySelector('#user-menu');const open=menu.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open))});
document.querySelector('#conversation-toggle').addEventListener('click',e=>{const list=document.querySelector('#conversation-list');const open=!list.classList.toggle('hidden');e.currentTarget.setAttribute('aria-expanded',String(open))});
document.querySelector('#conversation-sort').addEventListener('click',()=>{const list=document.querySelector('#conversation-list');Array.from(list.children).sort((a,b)=>a.textContent.localeCompare(b.textContent,'zh-CN')).forEach(item=>list.appendChild(item));showToast('历史任务已按名称排序')});
document.querySelector('#help-fab').addEventListener('click',()=>document.querySelector('[data-action="help"]').click());
document.querySelectorAll('[data-close-modal]').forEach(x=>x.addEventListener('click',closeModal));
modalLayer.addEventListener('click',e=>{if(e.target===modalLayer)closeModal()});
commandLayer.addEventListener('click',e=>{if(e.target===commandLayer)closeCommand()});
modalLayer.addEventListener('keydown',e=>trapFocus(modalLayer,e));
commandLayer.addEventListener('keydown',e=>trapFocus(commandLayer,e));
commandInput.addEventListener('input',e=>{clearTimeout(window.commandSearchTimer);const query=e.target.value.trim();window.commandSearchTimer=setTimeout(()=>searchCommand(query),180)});
commandInput.addEventListener('keydown',e=>{if(e.key==='Enter'){document.querySelector('.command-result.active')?.click()}if(e.key==='Escape')closeCommand()});
globalFile.addEventListener('change',async()=>{if(globalFile.files.length)await uploadFiles(globalFile.files);globalFile.value=''});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}if(e.key==='Escape'){closeModal();closeCommand();document.querySelector('#user-menu').classList.remove('open');document.querySelector('#user-menu-button').setAttribute('aria-expanded','false')}});
document.addEventListener('click',e=>{if(!e.target.closest('.user-card,.user-menu')){document.querySelector('#user-menu').classList.remove('open');document.querySelector('#user-menu-button').setAttribute('aria-expanded','false')}});
document.addEventListener('input',e=>{
  const query=e.target.value?.trim().toLowerCase()||'';
  if(e.target.matches('[data-quote-search]'))document.querySelectorAll('.quote-list-item').forEach(item=>item.classList.toggle('hidden',!item.textContent.toLowerCase().includes(query)));
  if(e.target.matches('[data-agent-search]'))document.querySelectorAll('[data-agent-row]').forEach(item=>item.classList.toggle('hidden',!item.dataset.searchText.toLowerCase().includes(query)));
  if(e.target.matches('[data-skill-search]'))document.querySelectorAll('[data-skill-row]').forEach(item=>item.classList.toggle('hidden',!item.dataset.searchText.toLowerCase().includes(query)));
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-email-index],[data-email-select-all]'))syncEmailSelectionState();
});
window.addEventListener('hashchange',()=>{
  if(location.hash==='#main'){
    return;
  }
  const route=location.hash.replace('#/','');if(route&&route!==state.route){state.route=route;render()}
});

updateUserChrome();
render();
loadBackend();


