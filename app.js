let tasks = [];
let inventory = [];
let inventoryImports = [];

let memories = [];
let conversations = [];
let briefings = [];
let topics = [];
let englishPlans = [];
let papers = [];
let events = [];
let projects = [];
let aiTasks = [];
let inboxItems = [];
let mailStatus = {configured:false,provider:'qq',email:'',lastTestedAt:'',lastSyncedAt:'',autoSync:true,syncIntervalMinutes:5,syncLimit:50};
let mailSyncing = false;
let inboxFilter = 'pending';
let activeAITaskId = null;
let agentContextSelection = 'workspace';
let editingEventId = null;
let editingProjectId = null;
let activeProjectId = null;
let activeProjectTab = 'overview';
let activeTopicId = null;
let aiConfigured = false;
let appUpdateStatus = {state:'idle',currentVersion:'—',availableVersion:'',percent:0,error:''};
let updateStatusUnsubscribe = null;
let taskFilter = 'all';
let projectFilter = 'all';
let autoBriefingRunning = false;
function getWeekStart(value = new Date()) { const date=new Date(value);const day=date.getDay()||7;date.setHours(0,0,0,0);date.setDate(date.getDate()-day+1);return date }
let calendarStart = getWeekStart();
let pendingAttachment = null;
let xterm = null;
let fitAddon = null;
let terminalStarted = false;
let terminalStartPromise = null;
const viewNames = { dashboard:'工作台总览',today:'今日待办',calendar:'日程安排',projects:'项目中心','project-detail':'项目工作区',papers:'论文与科研',english:'英语学习',briefing:'每日情报',diy:'DIY 项目',inventory:'电子元件库',inbox:'AI 收件箱',memory:'AI 记忆中心',terminal:'Agent 终端' };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const h = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setCountBadge = (id, count) => { const el=document.getElementById(id); if(el){el.textContent=count;el.hidden=count===0} };
const updateNotificationIndicator = () => { const el=$('#notificationDot');const pendingMail=mailStatus.configured&&inboxItems.some(item=>item.account===mailStatus.email&&!item.processedAt);if(el)el.hidden=!(tasks.some(t=>!t.done)||inventory.some(p=>Number(p.qty)<=2)||pendingMail); };

function greetingForHour(hour){if(hour>=5&&hour<9)return'早上好';if(hour<12)return'上午好';if(hour<14)return'中午好';if(hour<18)return'下午好';if(hour<23)return'晚上好';return'夜深了'}
function updateClockGreeting(){
  const now=new Date();const week=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];const greeting=greetingForHour(now.getHours());
  const hasWorkspaceData=tasks.length||projects.length||inventory.length||events.length||papers.length||englishPlans.length||topics.length;
  const greetingText=$('#dashboardGreetingText');if(greetingText)greetingText.textContent=`${greeting}，${hasWorkspaceData?'继续推进你的工作台':'开始建立你的工作台'}`;
  const aiWelcome=$('#aiWelcome');if(aiWelcome)aiWelcome.textContent=`${greeting}！我可以参考你的任务、库存和长期记忆与你对话。`;
  const date=$('#todayDate');if(date)date.textContent=`${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日 · ${week[now.getDay()]}`;
}

function dateKeyFrom(value){
  const date=value?new Date(value):null;
  if(!date||Number.isNaN(date.getTime()))return'';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function taskScheduledDate(task){
  if(/^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate||''))return task.scheduledDate;
  return task.time==='今天'?dateKeyFrom(task.createdAt):'';
}
function taskDateLabel(task){
  const key=taskScheduledDate(task);
  if(!key)return task.time||'待安排';
  const [year,month,day]=key.split('-').map(Number);
  const scheduled=new Date(year,month-1,day,12);
  const now=new Date();const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  const days=Math.round((today-scheduled)/86400000);
  if(days===0)return'今天';
  if(days===1)return'昨天';
  if(days===2)return'前天';
  return year===now.getFullYear()?`${month}月${day}日`:`${year}年${month}月${day}日`;
}
function taskMeta(task){
  const project=linkedProjectName(task.projectId);
  const source=String(task.meta||'手动创建').replace(/\s*·\s*(?:待处理|已完成)\s*$/,'')||'手动创建';
  return `${source} · ${task.done?'已完成':'待处理'}${project?` · ${project}`:''}`;
}
function renderTasks() {
  const openTasks=tasks.filter(t=>!t.done);
  const completedTasks=tasks.filter(t=>t.done).length;
  const today=localDateKey();
  const now=new Date();const weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7),12);const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+6);
  const weekStartKey=localDateKey(weekStart);const weekEndKey=localDateKey(weekEnd);
  const weekTasks=tasks.filter(task=>{const date=taskScheduledDate(task);return date&&date>=weekStartKey&&date<=weekEndKey});
  const weekCompleted=weekTasks.filter(task=>task.done).length;
  const completionPercent=weekTasks.length?Math.round(weekCompleted/weekTasks.length*100):0;
  const todayTasks=tasks.filter(t=>taskScheduledDate(t)===today);
  const todayOpen=todayTasks.filter(t=>!t.done).length;
  const todayDone=todayTasks.filter(t=>t.done).length;
  $('#focusList').innerHTML = openTasks.length ? openTasks.slice(0,3).map(t => `<div class="focus-item ${t.done?'done':''}"><button class="check" data-task="${t.id}">${t.done?'✓':''}</button><div><b>${h(t.title)}</b><small>${h(taskMeta(t).split(' · ')[0])}${linkedProjectName(t.projectId)?` · ${h(linkedProjectName(t.projectId))}`:''}</small></div><em>${h(taskDateLabel(t))}</em></div>`).join('') : '<div class="empty-state"><span>✓</span><b>还没有今日任务</b><small>创建任务后，最重要的三项会出现在这里</small><button data-action="add-task">创建任务</button></div>';
  const visibleTasks = tasks.filter(t => taskFilter === 'all' ? !t.done&&taskScheduledDate(t)===today : taskFilter === 'done' ? t.done : !t.done);
  $('#fullTaskList').innerHTML = visibleTasks.length ? visibleTasks.map(t => `<div class="task-row ${t.done?'done':''}"><button class="task-check" data-task="${t.id}">${t.done?'✓':''}</button><div><b>${h(t.title)}</b><small>${h(taskMeta(t))}</small></div><time>${h(taskDateLabel(t))}</time></div>`).join('') : '<div class="memory-empty"><span>✓</span><b>这里暂时没有任务</b><small>切换其他分类，或创建一项新任务</small></div>';
  setCountBadge('todoBadge',openTasks.length);
  $('#dashboardSummary').textContent=openTasks.length?`你有 ${openTasks.length} 项未完成任务。其他模块会在录入真实数据后自动汇总。`:'目前还没有个人数据。创建任务或项目后，这里会自动汇总。';
  $('#taskCompletionPercent').textContent=weekTasks.length?completionPercent:'—';
  $('#taskCompletionSummary').textContent=weekTasks.length?`本周已完成 ${weekCompleted} / ${weekTasks.length} 项任务`:'本周暂无任务';
  $('#taskCompletionRing').classList.toggle('empty',!weekTasks.length);
  $('#taskCompletionRing').style.background=weekTasks.length?`conic-gradient(#3e7659 0 ${completionPercent}%,#e5ebe7 ${completionPercent}%)`:'#e5ebe7';
  $('#taskOpenCount').textContent=openTasks.length;
  $('#taskDoneCount').textContent=completedTasks;
  $('#taskTotalCount').textContent=tasks.length;
  $('#taskStatsBadge').textContent=!weekTasks.length?'本周暂无':completionPercent===100?'本周完成':completionPercent>=60?'进展良好':'持续推进';
  $('#taskTodayTitle').textContent=!todayTasks.length?'今日暂无任务':todayOpen?`今天还有 ${todayOpen} 项`:'今日任务已完成';
  $('#taskTodayCopy').textContent=!todayTasks.length?'可以安排一项新任务':todayOpen?`已完成 ${todayDone} 项，继续推进`:`已完成 ${todayDone} 项，今天辛苦了`;
  updateNotificationIndicator();
}

const projectTypeLabels={research:'科研项目',startup:'创业 / 产品',software:'软件开发',electronics:'电子 / PCB',model:'模型研究',diy:'DIY / 创作',other:'其他'};
const projectStatusLabels={idea:'想法',planning:'规划中',active:'进行中',paused:'已暂停',completed:'已完成'};
const projectFileCategoryLabels={circuit:'电路图',bom:'BOM 表',schematic:'原理图',model:'3D 模型',code:'软件代码',paper:'论文资料',contract:'合同文档',test:'测试记录',other:'其他资料'};
const projectFileCategorySelections=new Map();
function selectedProjectFileCategory(projectId=activeProjectId){
  const value=projectFileCategorySelections.get(String(projectId));
  if(Object.hasOwn(projectFileCategoryLabels,value))return value;
  const project=projects.find(item=>String(item.id)===String(projectId));
  return Object.hasOwn(projectFileCategoryLabels,project?.lastFileCategory)?project.lastFileCategory:'circuit';
}
function projectFileCategoryOptions(projectId=activeProjectId){
  const selected=selectedProjectFileCategory(projectId);
  return Object.entries(projectFileCategoryLabels).map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('');
}
function projectCard(project){
  const tags=Array.isArray(project.tags)?project.tags:[];const progress=Math.max(0,Math.min(100,Number(project.progress)||0));const fileCount=Array.isArray(project.files)?project.files.length:0;const logCount=Array.isArray(project.logs)?project.logs.length:0;
  return `<article class="project-card" data-category="${h(project.type||'other')}" data-project-open="${h(project.id)}"><div><span class="project-type-dot">${project.type==='diy'?'◇':'▦'}</span><em>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</em><button data-project-edit="${h(project.id)}" title="编辑项目">•••</button></div><h2>${h(project.name)}</h2><p>${h(project.description||'还没有补充项目说明。')}</p>${tags.length?`<div class="tags">${tags.slice(0,4).map(tag=>`<span>${h(tag)}</span>`).join('')}</div>`:'<div class="tags"><span>暂无标签</span></div>'}<div class="project-card-counts"><span>▤ ${fileCount} 份资料</span><span>◷ ${logCount} 条日志</span></div><div class="project-foot"><div class="progress"><i style="width:${progress}%"></i></div><b>${progress}%</b></div></article>`
}
function renderProjects(){
  const visible=projects.filter(project=>projectFilter==='all'||project.type===projectFilter);
  const grid=$('#projectsGrid');if(grid)grid.innerHTML=`${visible.map(projectCard).join('')}<button class="new-project" data-action="add-project"><span>＋</span><b>${projects.length?'新建项目':'创建第一个项目'}</b><small>从想法开始，逐步补充进度与上下文</small></button>`;
  const diy=projects.filter(project=>project.type==='diy');const diyContainer=$('#diyProjectsContainer');if(diyContainer)diyContainer.innerHTML=diy.length?`${diy.map(projectCard).join('')}<button class="new-project" data-action="add-diy-project"><span>＋</span><b>新建 DIY 项目</b><small>记录电路、代码、BOM 与测试过程</small></button>`:'<article class="card project-empty-card"><div class="empty-state"><span>◇</span><b>还没有 DIY 项目</b><small>新建项目后再逐步加入电路、软件、BOM 和实验记录</small><button data-action="add-diy-project">创建第一个 DIY 项目</button></div></article>';
  const dashboard=$('#dashboardProjects');if(dashboard)dashboard.innerHTML=projects.length?`<div class="dashboard-project-list">${projects.slice(0,3).map(project=>`<button data-project-open="${h(project.id)}"><span><b>${h(project.name)}</b><small>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</small></span><em>${Math.max(0,Math.min(100,Number(project.progress)||0))}%</em></button>`).join('')}</div>`:'<div class="empty-state"><span>▦</span><b>还没有项目</b><small>科研、创业、软件和 DIY 项目都可以从这里开始</small><button data-action="add-project">创建第一个项目</button></div>';
}

function renderDashboardBriefing(){
  const card=$('#dashboardBriefing');if(!card)return;
  if(!topics.length){card.innerHTML='<div class="ai-badge">✦</div><p class="label light">AI 晨间简报</p><h2>尚未设置主题</h2><p class="brief-copy">添加关注主题后，系统会每天检索真实论文与网页资讯。</p><button data-view-link="briefing">设置关注主题 <span>→</span></button>';return}
  const searched=topics.filter(topic=>topic.searchedAt).sort((a,b)=>new Date(b.searchedAt)-new Date(a.searchedAt));
  const latest=searched[0];
  if(!latest){card.innerHTML='<div class="ai-badge">✦</div><p class="label light">AI 晨间简报</p><h2>等待首次更新</h2><p class="brief-copy">已经设置关注主题，点击进入每日情报即可立即刷新。</p><button data-view-link="briefing">立即生成 <span>→</span></button>';return}
  const total=topics.reduce((sum,topic)=>sum+(Array.isArray(topic.results)?topic.results.length:0),0);const result=Array.isArray(latest.results)?latest.results[0]:null;const today=localDateKey(latest.searchedAt)===localDateKey();const time=new Date(latest.searchedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  card.innerHTML=`<div class="ai-badge">✦</div><p class="label light">AI 晨间简报 · ${h(today?'今日已更新':`上次 ${time}`)}</p><h2>${h(latest.name)}</h2><p class="brief-copy">${result?h(result.title||result.summary||'已取得最新情报'):h('本次搜索暂未返回结果')}<small>${topics.length} 个主题 · ${total} 条真实来源</small></p><button data-view-link="briefing">查看每日情报 <span>→</span></button>`;
}

function renderInventory() {
  $('#inventoryBody').innerHTML = inventory.length ? inventory.map((p,i)=>`<tr><td>${h(p.name)}${p.needsReview?'<small class="inventory-review">待核对</small>':''}</td><td>${h(p.category)}</td><td>${h(p.spec)}${p.sourceFiles?.length?`<small class="inventory-source">来源：${h(p.sourceFiles.slice(-2).join('、'))}</small>`:''}</td><td>${h(p.location)}</td><td><div class="qty-control"><button data-qty="${i}" data-delta="-1">−</button><b class="${p.qty<=2?'red':''}">${p.qty}</b><button data-qty="${i}" data-delta="1">＋</button></div></td><td><div class="inventory-row-actions"><button class="part-edit-btn" data-part-edit="${i}">编辑</button><button class="zero-btn" data-zero="${i}">设为 0</button></div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><span>⌘</span><b>仓库是空的</b><small>手动添加元器件，或一次选择多张购买截图让 AI 自动入库</small><button data-action="inventory-import">批量截图识别</button></div></td></tr>';
  const total=inventory.reduce((sum,p)=>sum+(Number(p.qty)||0),0);const low=inventory.filter(p=>Number(p.qty)<=2).length;
  ['inventoryTypes','dashInventoryTypes'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=inventory.length});
  ['totalParts','dashInventoryTotal'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=total});
  ['lowStockCount','dashLowStock'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=low});
  setCountBadge('inventoryBadge',inventory.length);
  updateNotificationIndicator();
}

function inventoryKey(item){return `${item.name||''}|${item.spec||''}`.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g,'').replace(/[，,；;、]/g,'')}
function mergeRecognizedPart(item,fileName){
  const key=inventoryKey(item);const existing=inventory.find(part=>inventoryKey(part)===key);
  if(existing){existing.qty=(Number(existing.qty)||0)+(Number(item.qty)||1);existing.confidence=Math.max(Number(existing.confidence)||0,Number(item.confidence)||0);existing.needsReview=Boolean(existing.needsReview||item.confidence<.65);existing.sourceFiles=[...new Set([...(existing.sourceFiles||[]),fileName])].slice(-10);return {part:existing,created:false}}
  const part={name:item.name,category:item.category||'其他',spec:item.spec||'待补充',location:'未分配',qty:Number(item.qty)||1,confidence:Number(item.confidence)||0,needsReview:Number(item.confidence)<.65,sourceFiles:[fileName],createdAt:new Date().toISOString()};inventory.unshift(part);return {part,created:true}
}
function fileDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)})}
function updateInventoryBatchProgress(rows,current,total){const status=$('#inventoryBatchStatus');const list=$('#inventoryBatchRows');const bar=$('#inventoryBatchBar');if(status)status.textContent=`正在处理 ${Math.min(current,total)} / ${total}`;if(bar)bar.style.width=`${total?Math.round(current/total*100):0}%`;if(list)list.innerHTML=rows.map(row=>`<div class="batch-row ${row.state}"><span>${row.state==='done'?'✓':row.state==='error'?'!':row.state==='duplicate'?'↺':'…'}</span><div><b>${h(row.name)}</b><small>${h(row.message)}</small></div></div>`).join('')}
async function processInventoryScreenshots(selectedFiles){
  const files=[...selectedFiles].filter(file=>file.type.startsWith('image/')).slice(0,20);if(!files.length){showToast('请选择图片文件');return}if(!window.orbito?.recognizeInventoryImage){showToast('批量识别只在桌面应用中可用');return}
  const rows=files.map(file=>({name:file.name,state:'waiting',message:'等待识别'}));const changes=[];let failed=0,duplicates=0,recognized=0;
  showModal(`<div class="modal-icon">⌘</div><h2>AI 正在批量识别并入库</h2><p id="inventoryBatchStatus">准备处理 ${files.length} 张截图</p><div class="batch-progress"><i id="inventoryBatchBar"></i></div><div class="batch-rows" id="inventoryBatchRows"></div><div class="modal-actions"><button class="cancel" data-action="close-modal">后台继续</button></div>`);updateInventoryBatchProgress(rows,0,files.length);
  for(let index=0;index<files.length;index++){
    const file=files[index];rows[index].state='working';rows[index].message='正在后台识别';updateInventoryBatchProgress(rows,index,files.length);
    try{
      if(file.size>10*1024*1024)throw new Error('图片超过 10 MB');
      const result=await window.orbito.recognizeInventoryImage({name:file.name,dataUrl:await fileDataUrl(file)});
      if(result.duplicate){rows[index].state='duplicate';rows[index].message='这张截图以前已经入库，已跳过';duplicates++;updateInventoryBatchProgress(rows,index+1,files.length);continue}
      if(!result.items?.length){rows[index].state='error';rows[index].message='没有识别到电子元器件';failed++;updateInventoryBatchProgress(rows,index+1,files.length);continue}
      const fileChanges=result.items.map(item=>mergeRecognizedPart(item,file.name));changes.push(...fileChanges);recognized+=result.items.length;inventoryImports.push({hash:result.imageHash,fileName:file.name,items:result.items.length,createdAt:new Date().toISOString()});
      rows[index].state='done';rows[index].message=`识别 ${result.items.length} 项，已自动入库`;renderInventory();await saveState(['inventory','inventoryImports']);
    }catch(error){rows[index].state='error';rows[index].message=error.message||String(error);failed++}
    updateInventoryBatchProgress(rows,index+1,files.length);
  }
  const review=changes.filter(change=>change.part.needsReview).length;
  showModal(`<div class="modal-icon">✓</div><h2>批量入库完成</h2><p>${files.length} 张截图已处理，识别到 ${recognized} 项元器件并写入仓库。</p><div class="batch-summary"><div><b>${recognized}</b><small>识别项目</small></div><div><b>${changes.filter(change=>change.created).length}</b><small>新增种类</small></div><div><b>${changes.filter(change=>!change.created).length}</b><small>合并累加</small></div><div><b>${review}</b><small>待核对</small></div></div>${duplicates||failed?`<div class="batch-note">${duplicates?`${duplicates} 张重复截图已跳过。`:''}${failed?`${failed} 张未能完成识别。`:''}</div>`:''}<div class="batch-result-list">${changes.slice(0,30).map(change=>`<div><span>${change.created?'新增':'累加'}</span><b>${h(change.part.name)}</b><small>${h(change.part.spec)} · 当前 ${change.part.qty}</small></div>`).join('')}</div><div class="modal-actions"><button class="confirm" data-action="close-modal">查看仓库</button></div>`)
}

function partEditModal(index){const part=inventory[index];if(!part)return;showModal(`<div class="modal-icon">⌘</div><h2>编辑元器件</h2><p>修改 AI 识别结果后，“待核对”标记会自动清除。</p><input id="partEditIndex" type="hidden" value="${index}"><div class="form-grid"><div class="form-field full"><label>名称</label><input id="partEditName" value="${h(part.name)}"></div><div class="form-field"><label>分类</label><input id="partEditCategory" value="${h(part.category)}"></div><div class="form-field"><label>库存数量</label><input id="partEditQty" type="number" min="0" step="1" value="${Number(part.qty)||0}"></div><div class="form-field full"><label>规格 / 型号 / 封装</label><input id="partEditSpec" value="${h(part.spec)}"></div><div class="form-field full"><label>存放位置</label><input id="partEditLocation" value="${h(part.location)}"></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-part-edit">保存修改</button></div>`)}
async function savePartEdit(){const index=Number($('#partEditIndex')?.value);const part=inventory[index];const name=$('#partEditName')?.value.trim();if(!part||!name){showToast('请输入元器件名称');return}Object.assign(part,{name,category:$('#partEditCategory')?.value.trim()||'其他',spec:$('#partEditSpec')?.value.trim()||'待补充',location:$('#partEditLocation')?.value.trim()||'未分配',qty:Math.max(0,Math.round(Number($('#partEditQty')?.value)||0)),needsReview:false,updatedAt:new Date().toISOString()});renderInventory();await saveState(['inventory']);closeModal();showToast('元器件信息已更新')}

function renderMemories() {
  setCountBadge('memoryBadge',memories.length);
  $('#memoryCount').textContent = `${memories.length} 条`;
  $('#memoryList').innerHTML = memories.length ? memories.map((m,i)=>`<div class="memory-item"><span>◉</span><div><b>${h(m.text)}</b><small>${h(m.source || '手动添加')} · ${m.createdAt ? new Date(m.createdAt).toLocaleDateString('zh-CN') : '刚刚'}</small></div><button data-memory-delete="${i}">删除</button></div>`).join('') : '<div class="memory-empty"><span>◉</span><b>还没有长期记忆</b><small>点击“添加记忆”，或在对话中明确告诉 AI“请记住……”</small></div>';
}

function inboxDate(value){
  const date=value?new Date(value):null;if(!date||Number.isNaN(date.getTime()))return'时间未知';
  const now=new Date();const sameDay=date.toDateString()===now.toDateString();
  return sameDay?date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function renderInbox(){
  const status=$('#inboxStatus');const list=$('#inboxList');if(!status||!list)return;
  const accountItems=mailStatus.configured?inboxItems.filter(item=>item.account===mailStatus.email):[];const unread=accountItems.filter(item=>item.unread).length;const pending=accountItems.filter(item=>!item.processedAt).length;
  const visibleItems=accountItems.filter(item=>inboxFilter==='all'||(inboxFilter==='processed'?Boolean(item.processedAt):!item.processedAt));
  setCountBadge('inboxBadge',pending);$('#inboxCount').textContent=`${visibleItems.length} 封`;
  $$('.inbox-tabs [data-inbox-filter]').forEach(button=>button.classList.toggle('active',button.dataset.inboxFilter===inboxFilter));
  status.innerHTML=`<article><span class="${mailStatus.configured?'connected':''}">${mailStatus.configured?'✓':'○'}</span><div><small>邮箱连接</small><b>${mailStatus.configured?h(mailStatus.email):'尚未连接'}</b></div></article><article><span>↻</span><div><small>${mailStatus.autoSync?'自动同步':'手动同步'}</small><b>${mailStatus.lastSyncedAt?h(inboxDate(mailStatus.lastSyncedAt)):'尚未同步'}${mailStatus.autoSync?` · ${Number(mailStatus.syncIntervalMinutes)||5} 分钟`:''}</b></div></article><article><span>●</span><div><small>待处理 / QQ 未读</small><b>${pending} / ${unread} 封</b></div></article>`;
  const syncButton=$('#mailSyncButton');if(syncButton){syncButton.disabled=mailSyncing||!mailStatus.configured;syncButton.textContent=mailSyncing?'同步中…':`↻ 同步 ${Number(mailStatus.syncLimit)||50} 封`}
  if(!mailStatus.configured){list.innerHTML='<div class="inbox-empty"><span>⌑</span><b>先连接你的 QQ 邮箱</b><small>hacher 只读取最近邮件的发件人、主题、时间和未读状态，不读取正文，也不会改变邮箱内容。</small><button data-action="mail-settings">连接 QQ 邮箱</button></div>';return}
  if(!accountItems.length){list.innerHTML=`<div class="inbox-empty"><span>↻</span><b>还没有同步邮件</b><small>点击“同步邮件”，从 QQ 邮箱只读获取最近 ${Number(mailStatus.syncLimit)||50} 封邮件。</small><button data-action="mail-sync">开始第一次同步</button></div>`;return}
  if(!visibleItems.length){list.innerHTML=`<div class="inbox-empty compact"><span>✓</span><b>${inboxFilter==='pending'?'待处理邮件已经清空':'这里还没有邮件'}</b><small>${inboxFilter==='pending'?'已处理的邮件可以在“已处理”中找到。':'切换其他分类查看邮件。'}</small></div>`;renderDashboardInbox();return}
  list.innerHTML=`<div class="inbox-list">${visibleItems.map(item=>{const address=item.from?.[0]?.address||'';return `<article class="inbox-row ${item.unread?'unread':''} ${item.processedAt?'processed':''}" data-mail-open="${h(item.id)}"><span class="inbox-unread-dot"></span><div class="inbox-sender"><b>${h(item.sender||'未知发件人')}</b><small>${h(address)}</small></div><div class="inbox-subject"><b>${h(item.subject||'（无主题）')}</b><small>${item.processedAt?'已处理 · ':''}点击按需读取正文</small></div><time>${h(inboxDate(item.receivedAt))}</time><button class="inbox-process-btn" data-mail-process="${h(item.id)}">${item.processedAt?'移回待处理':'标记已处理'}</button></article>`}).join('')}</div>`;
  renderDashboardInbox();updateNotificationIndicator();
}

function renderDashboardInbox(){
  const card=$('#dashboardInbox');if(!card)return;const accountItems=mailStatus.configured?inboxItems.filter(item=>item.account===mailStatus.email):[];const pending=accountItems.filter(item=>!item.processedAt);const recent=pending.slice(0,3);
  if(!mailStatus.configured){card.innerHTML='<div class="card-title"><div><p class="label">AI 收件箱</p><h2>尚未连接邮箱</h2></div><button class="text-btn" data-view-link="inbox">连接 QQ 邮箱 →</button></div><p class="dashboard-inbox-empty">连接后，这里只显示需要你处理的邮件摘要。</p>';return}
  card.innerHTML=`<div class="card-title"><div><p class="label">AI 收件箱</p><h2>${pending.length?`${pending.length} 封待处理`:'收件箱已清空'}</h2></div><button class="text-btn" data-view-link="inbox">进入收件箱 →</button></div>${recent.length?`<div class="dashboard-mail-list">${recent.map(item=>`<button data-mail-open="${h(item.id)}"><span><b>${h(item.subject||'（无主题）')}</b><small>${h(item.sender||'未知发件人')}</small></span><time>${h(inboxDate(item.receivedAt))}</time></button>`).join('')}</div>`:'<p class="dashboard-inbox-empty">目前没有需要处理的邮件。</p>'}`;
}

async function loadMailStatus(){
  if(!window.orbito?.getMailStatus)return;
  try{mailStatus=await window.orbito.getMailStatus()||mailStatus}catch(error){console.error(error)}
}

async function mailSettingsModal(){
  await loadMailStatus();
  showModal(`<div class="modal-icon">⌑</div><h2>QQ 邮箱与同步</h2><p>授权码由 Windows 加密保存。邮件正文仅在打开时按需读取，不写入长期工作台数据。</p><div class="api-status ${mailStatus.configured?'connected':''}"><span></span><b>${mailStatus.configured?'已连接':'尚未连接'}</b><small>${mailStatus.configured?'留空授权码可继续使用本机已保存的配置':'请填写 QQ 邮箱生成的授权码，不是 QQ 密码'}</small></div><div class="form-grid"><div class="form-field full"><label>QQ 邮箱地址</label><input id="mailSettingsEmail" type="email" value="${h(mailStatus.email||'')}" placeholder="name@qq.com" autocomplete="username" spellcheck="false"></div><div class="form-field full"><label>IMAP 授权码</label><input id="mailSettingsCode" type="password" placeholder="${mailStatus.configured?'已加密保存，留空即可':'粘贴 QQ 邮箱生成的授权码'}" autocomplete="new-password" spellcheck="false"></div><div class="form-field"><label>每次检查最近邮件</label><select id="mailSyncLimit">${[20,50,100,200].map(value=>`<option value="${value}" ${Number(mailStatus.syncLimit)===value?'selected':''}>${value} 封</option>`).join('')}</select></div><div class="form-field"><label>自动同步间隔</label><select id="mailSyncInterval">${[1,5,10,15].map(value=>`<option value="${value}" ${Number(mailStatus.syncIntervalMinutes)===value?'selected':''}>${value} 分钟</option>`).join('')}</select></div><label class="mail-auto-toggle full"><input id="mailAutoSync" type="checkbox" ${mailStatus.autoSync!==false?'checked':''}><span><b>自动同步新邮件</b><small>软件运行或最小化到托盘时继续检查；启动和电脑唤醒后也会补同步。</small></span></label></div><div class="mail-privacy-note"><b>只读边界</b><span>不会发送邮件或改变 QQ 邮箱的已读状态；“已处理”只保存在 hacher 本地。</span></div><a class="api-help-link" href="https://mail.qq.com/" target="_blank" rel="noreferrer">打开 QQ 邮箱设置 →</a><div class="modal-actions">${mailStatus.configured?'<button class="danger-modal-btn" data-action="mail-clear">断开连接</button>':''}<button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="mail-save-test">保存并测试</button></div>`);
  setTimeout(()=>$('#mailSettingsEmail')?.focus(),100);
}

async function saveAndTestMail(){
  const email=$('#mailSettingsEmail')?.value.trim()||'';const authCode=$('#mailSettingsCode')?.value.trim()||'';const autoSync=Boolean($('#mailAutoSync')?.checked);const syncIntervalMinutes=Number($('#mailSyncInterval')?.value)||5;const syncLimit=Number($('#mailSyncLimit')?.value)||50;const button=$('[data-action="mail-save-test"]');
  if(!email){showToast('请输入 QQ 邮箱地址');return}
  if(button){button.disabled=true;button.textContent='正在测试…'}
  try{const result=await window.orbito?.saveAndTestMail({email,authCode,autoSync,syncIntervalMinutes,syncLimit});if(!result?.ok){showToast(result?.error||'连接测试失败');return}mailStatus=result.status;closeModal();renderInbox();renderDashboardInbox();showToast(autoSync?'邮箱设置已保存，自动同步已开启':'邮箱设置已保存')}
  catch(error){showToast('连接失败：'+(error.message||error))}finally{if(button){button.disabled=false;button.textContent='保存并测试'}}
}

async function syncMailInbox(){
  if(mailSyncing)return;if(!mailStatus.configured){mailSettingsModal();return}
  mailSyncing=true;renderInbox();
  try{const result=await window.orbito?.syncMailInbox({limit:Number(mailStatus.syncLimit)||50});if(!result?.ok){showToast(result?.error||'同步失败');return}if(Array.isArray(result.state?.inboxItems))inboxItems=result.state.inboxItems;mailStatus=result.status||mailStatus;renderInbox();showToast(`同步完成：新增 ${result.added||0} 封，更新 ${result.updated||0} 封`)}
  catch(error){showToast('同步失败：'+(error.message||error))}finally{mailSyncing=false;renderInbox()}
}

async function clearMailSettings(){
  if(!window.confirm('确定断开 QQ 邮箱？本机已同步的邮件列表会保留，授权码会立即删除。'))return;
  try{const result=await window.orbito?.clearMailSettings();if(!result?.ok){showToast(result?.error||'断开失败');return}mailStatus=result.status||{configured:false,provider:'qq',email:'',lastTestedAt:'',lastSyncedAt:'',autoSync:true,syncIntervalMinutes:5,syncLimit:50};closeModal();renderInbox();renderDashboardInbox();showToast('已断开 QQ 邮箱并删除本机授权码')}
  catch(error){showToast('断开失败：'+(error.message||error))}
}

async function openMailDetail(itemId){
  const item=inboxItems.find(value=>value.id===itemId);if(!item)return;
  showModal(`<div class="mail-detail-loading"><span>⌑</span><h2>${h(item.subject||'（无主题）')}</h2><p>正在从 QQ 邮箱按需读取正文…</p></div>` ,true);
  try{const result=await window.orbito?.getMailDetail(itemId);if(!result?.ok){showModal(`<div class="modal-icon">!</div><h2>无法打开邮件</h2><p>${h(result?.error||'读取正文失败')}</p><div class="modal-actions"><button class="confirm" data-action="close-modal">关闭</button></div>`);return}const detail=result.detail;const attachments=detail.attachments?.length?`<div class="mail-attachments"><b>附件（仅显示信息）</b>${detail.attachments.map(file=>`<div><span>▤</span><p><b>${h(file.name)}</b><small>${h(file.contentType)} · ${h(formatFileSize(file.size))}</small></p></div>`).join('')}</div>`:'';showModal(`<div class="mail-detail-head"><p>${h(detail.from)}</p><h2>${h(detail.subject)}</h2><small>${h(detail.date?new Date(detail.date).toLocaleString('zh-CN'):'时间未知')}${detail.to?` · 收件人 ${h(detail.to)}`:''}</small></div><div class="mail-detail-body">${h(detail.text).replace(/\n/g,'<br>')}</div>${attachments}<div class="modal-actions"><button class="cancel" data-action="close-modal">关闭</button><button class="confirm" data-mail-process="${h(item.id)}">${item.processedAt?'移回待处理':'标记已处理'}</button></div>`,true)}
  catch(error){showToast('读取邮件失败：'+(error.message||error))}
}

async function toggleMailProcessed(itemId){
  const item=inboxItems.find(value=>value.id===itemId);if(!item)return;item.processedAt=item.processedAt?null:new Date().toISOString();await saveState(['inboxItems']);renderInbox();renderDashboardInbox();showToast(item.processedAt?'已移入“已处理”':'已移回待处理');if($('#modalWrap').classList.contains('show'))closeModal();
}

function localDateKey(value=new Date()){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function renderEnglishPlans(){
  const container=$('#englishPlansContainer');if(!container)return;
  if(!englishPlans.length){container.innerHTML='<article class="card"><div class="empty-state"><span>A</span><b>还没有英语学习计划</b><small>创建计划后，学习记录和真实统计会显示在这里</small><button data-action="english-session">创建第一个计划</button></div></article>';return}
  const today=localDateKey();
  container.innerHTML=`<div class="english-plan-grid">${englishPlans.map(plan=>{
    const sessions=Array.isArray(plan.sessions)?plan.sessions:[];
    const completedToday=sessions.some(session=>session.date===today);
    const totalMinutes=sessions.reduce((sum,session)=>sum+(Number(session.minutes)||0),0);
    return `<article class="card english-plan-card"><div class="english-plan-head"><span>A</span><div><p>${h(plan.level||'未设置水平')} · ${h(plan.goal||'综合提升')}</p><h2>${h(plan.name)}</h2></div><button data-english-delete="${plan.id}" title="删除计划">×</button></div><div class="english-plan-metrics"><div><b>${sessions.length}</b><small>累计学习</small></div><div><b>${totalMinutes}</b><small>累计分钟</small></div><div><b>${Number(plan.minutesPerDay)||0}</b><small>每日分钟</small></div><div><b>${Number(plan.daysPerWeek)||0}</b><small>每周天数</small></div></div>${plan.notes?`<p class="english-plan-note">${h(plan.notes)}</p>`:''}<div class="english-plan-actions"><small>${completedToday?'今天已经完成学习记录':'完成后记录一次真实学习'}</small><button class="${completedToday?'done':''}" data-english-complete="${plan.id}">${completedToday?'✓ 今日已学习':'记录今日学习'}</button></div></article>`
  }).join('')}</div>`;
}

function formatFileSize(bytes){const size=Number(bytes)||0;if(size<1024)return `${size} B`;if(size<1024*1024)return `${(size/1024).toFixed(1)} KB`;return `${(size/1024/1024).toFixed(1)} MB`}

function renderPapers(){
  const container=$('#papersContainer');if(!container)return;
  if(!papers.length){container.innerHTML='<article class="card"><div class="empty-state"><span>⌁</span><b>还没有论文</b><small>导入 PDF，文件会复制到 hacher 的本地论文库</small><button data-action="paper-import">导入第一篇论文</button></div></article>';return}
  container.innerHTML=`<div class="paper-library">${papers.map((paper,index)=>{const linked=(paper.projectIds||[]).map(linkedProjectName).filter(Boolean);return `<article class="card paper-library-item"><span class="paper-file-icon">PDF</span><div class="paper-library-body"><p>${h(paper.status||'待读')} · ${h(formatFileSize(paper.size))} · ${paper.importedAt?new Date(paper.importedAt).toLocaleDateString('zh-CN'):'日期未知'}${linked.length?` · 项目：${h(linked.join('、'))}`:''}</p><h2>${h(paper.title||paper.fileName||'未命名论文')}</h2><small>${h(paper.fileName||'本地 PDF')}</small></div><div class="paper-library-actions"><button class="outline-btn" data-paper-open="${h(paper.id)}">打开 PDF</button><button class="paper-delete-btn" data-paper-delete="${h(paper.id)}" title="删除论文">删除</button></div></article>`}).join('')}</div>`;
}

async function importPapers(){
  if(!window.orbito?.importPapers){showToast('论文导入只在桌面应用中可用');return}
  try{
    const result=await window.orbito.importPapers();
    if(result?.canceled)return;
    if(result?.state&&Array.isArray(result.state.papers))papers=result.state.papers;
    else if(Array.isArray(result?.papers))for(const paper of result.papers.filter(item=>!item.duplicate))papers.unshift(paper);
    renderPapers();
    const duplicates=(result?.papers||[]).filter(item=>item.duplicate).length;
    const created=(result?.papers||[]).length-duplicates;
    showToast(created?`已导入 ${created} 篇论文${duplicates?`，${duplicates} 篇已存在`:''}`:'所选论文已经在库中');
  }catch(error){showToast(`论文导入失败：${error.message||error}`)}
}

function renderCalendar() {
  const end = new Date(calendarStart); end.setDate(end.getDate() + 6);
  const sameMonth = calendarStart.getMonth() === end.getMonth();
  $('#calendarRange').textContent = sameMonth
    ? `${calendarStart.getFullYear()} 年 ${calendarStart.getMonth()+1} 月 ${calendarStart.getDate()}–${end.getDate()} 日`
    : `${calendarStart.getFullYear()} 年 ${calendarStart.getMonth()+1} 月 ${calendarStart.getDate()} 日 – ${end.getMonth()+1} 月 ${end.getDate()} 日`;
  const todayKey=localDateKey();
  const days=Array.from({length:7},(_,index)=>{const date=new Date(calendarStart);date.setDate(date.getDate()+index);return date});
  const weekStartKey=localDateKey(calendarStart);const weekEndKey=localDateKey(end);
  const weekEvents=events.filter(event=>event.date>=weekStartKey&&event.date<=weekEndKey).sort((a,b)=>`${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const hours=Array.from({length:24},(_,index)=>index);
  const week=$('#calendarWeek');
  if(week){
    const headers=days.map((date,index)=>`<div class="calendar-day-head ${localDateKey(date)===todayKey?'today':''}"><span>${['周一','周二','周三','周四','周五','周六','周日'][index]}</span><b>${date.getDate()}</b></div>`).join('');
    const columns=days.map(date=>{const dateKey=localDateKey(date);const dayEvents=weekEvents.filter(event=>event.date===dateKey);return `<div class="calendar-day-column ${dateKey===todayKey?'today':''}" data-calendar-date="${dateKey}">${dayEvents.map(event=>calendarEventMarkup(event,dayEvents)).join('')}</div>`}).join('');
    week.innerHTML=`<div class="calendar-week-head"><div class="calendar-zone">00–24</div>${headers}</div><div class="calendar-scroll"><div class="calendar-time-axis">${hours.map(hour=>`<span>${String(hour).padStart(2,'0')}:00</span>`).join('')}</div>${columns}</div>`;
    setTimeout(()=>{const scroll=week.querySelector('.calendar-scroll');if(scroll)scroll.scrollTop=Math.max(0,(todayKey>=weekStartKey&&todayKey<=weekEndKey?new Date().getHours()-2:7)*48)},0);
  }
  const agenda=$('#weekAgenda');
  if(agenda)agenda.innerHTML=weekEvents.length?weekEvents.map(event=>`<button class="agenda-event" data-calendar-event="${h(event.id)}"><time><b>${Number(event.date.slice(8,10))}</b><small>${['周日','周一','周二','周三','周四','周五','周六'][new Date(`${event.date}T00:00:00`).getDay()]}</small></time><span class="agenda-color ${eventColor(event)}"></span><div><b>${h(event.title)}</b><small>${h(event.startTime)}–${h(event.endTime)}${event.location?` · ${h(event.location)}`:''}</small></div><em>查看</em></button>`).join(''):'<div class="empty-state small"><span>◷</span><b>本周还没有日程</b><small>新建日程后，会同时显示在时间轴和这里</small><button data-action="add-event">新建日程</button></div>';
  if($('#weekEventCount'))$('#weekEventCount').textContent=`${weekEvents.length} 项`;
  renderTodaySchedule();
}

function eventColor(event){return ['research','meeting','experiment','personal'].includes(event.category)?event.category:'other'}
function timeMinutes(value){const [hour,minute]=String(value||'00:00').split(':').map(Number);return hour*60+minute}
function eventsOverlap(left,right){return String(left.id)!==String(right.id)&&left.date===right.date&&timeMinutes(left.startTime)<timeMinutes(right.endTime)&&timeMinutes(left.endTime)>timeMinutes(right.startTime)}
function calendarEventMarkup(event,dayEvents){const start=Math.max(0,timeMinutes(event.startTime));const finish=Math.min(24*60,timeMinutes(event.endTime));const top=start/60*48;const height=Math.max(28,(finish-start)/60*48);const conflict=dayEvents.some(other=>eventsOverlap(event,other));return `<button class="calendar-event ${eventColor(event)}${conflict?' conflict':''}" style="top:${top}px;height:${height}px" data-calendar-event="${h(event.id)}" title="${h(event.title)} ${h(event.startTime)}–${h(event.endTime)}"><b>${h(event.title)}</b><small>${h(event.startTime)}–${h(event.endTime)}</small></button>`}
function renderTodaySchedule(){const container=$('#todaySchedule');if(!container)return;const todayEvents=events.filter(event=>event.date===localDateKey()).sort((a,b)=>a.startTime.localeCompare(b.startTime));container.innerHTML=todayEvents.length?`<div class="today-event-list">${todayEvents.slice(0,4).map(event=>`<button data-view-link="calendar"><time>${h(event.startTime)}</time><span class="agenda-color ${eventColor(event)}"></span><div><b>${h(event.title)}</b><small>至 ${h(event.endTime)}${event.location?` · ${h(event.location)}`:''}</small></div></button>`).join('')}</div>`:'<div class="empty-state small"><span>◷</span><b>今天没有日程</b><small>添加日程后会显示在这里</small><button data-action="add-event">添加日程</button></div>'}

function renderTopicCards() {
  const container = $('#topicCards');
  if (!container) return;
  container.innerHTML = topics.map(t => {
    const count = (t.results || []).length;
    const dateStr = t.searchedAt ? new Date(t.searchedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '未搜索';
    const isActive = t.id === activeTopicId;
    return `<div class="topic-card${isActive ? ' active' : ''}" data-topic-id="${t.id}"><p class="topic-name">${h(t.name)}</p><p class="topic-meta">${count} 条结果 · ${dateStr}</p><button class="topic-delete" data-topic-delete="${t.id}" title="删除主题">×</button></div>`;
  }).join('');
}

function renderTopicResults() {
  const container = $('#topicResults');
  if (!container) return;
  if (!topics.length) {
    container.innerHTML = '<div class="topic-results-empty"><span>✦</span><b>还没有关注主题</b><small>点击上方"添加主题"，开始追踪你感兴趣的研究方向。</small></div>';
    return;
  }
  const topic = topics.find(t => t.id === activeTopicId);
  if (!topic) {
    container.innerHTML = '<div class="topic-results-empty"><span>✦</span><b>选择一个主题查看结果</b><small>点击上方主题卡片，展开对应的论文和网页资讯。</small></div>';
    return;
  }
  const arxivResults = (topic.results || []).filter(r => r.source !== 'web');
  const webResults = (topic.results || []).filter(r => r.source === 'web');
  const searchedAt = topic.searchedAt ? new Date(topic.searchedAt).toLocaleString('zh-CN') : '尚未搜索';

  let html = `<div class="topic-result-header"><h2>${h(topic.name)}</h2><small>最后更新：${searchedAt}</small></div>`;

  if (!topic.results || !topic.results.length) {
    html += '<div class="topic-results-empty"><span>✦</span><b>暂无搜索结果</b><small>点击"全部刷新"为此主题搜索最新内容。</small></div>';
    container.innerHTML = html;
    return;
  }

  if (arxivResults.length) {
    html += '<div class="topic-result-source">arXiv 论文</div>';
    html += arxivResults.slice(0, 10).map((paper, i) => {
      const authors = (paper.authors || []).slice(0, 4).join(', ');
      const more = (paper.authors || []).length > 4 ? ' 等' : '';
      return `<div class="paper-entry"><span class="paper-num">${i + 1}</span><div class="paper-body"><h3><a href="${h(paper.url)}" target="_blank">${h(paper.title)}</a></h3><p class="paper-authors">${h(authors)}${more}</p><p class="paper-meta">提交日期：${h(paper.published || '未知')}</p><p class="paper-summary">${h((paper.summary || '').slice(0, 300))}${(paper.summary || '').length > 300 ? '…' : ''}</p></div></div>`;
    }).join('');
  }

  if (webResults.length) {
    html += '<div class="topic-result-source web-source">网页资讯</div>';
    html += webResults.slice(0, 10).map((item, i) => {
      return `<div class="paper-entry web-entry"><span class="paper-num">${i + 1}</span><div class="paper-body"><h3><a href="${h(item.url)}" target="_blank">${h(item.title)}</a></h3><p class="paper-summary">${h((item.summary || '').slice(0, 300))}${(item.summary || '').length > 300 ? '…' : ''}</p></div></div>`;
    }).join('');
  }

  container.innerHTML = html;
}

function renderBriefings() {
  // Legacy compat — just re-render the new topic views
  renderTopicCards();
  renderTopicResults();
}

async function autoBriefing() {
  // Run auto-search for each topic, but only once per day
  if (autoBriefingRunning || !aiConfigured || !topics.length) { renderDashboardBriefing(); return; }
  const dateKey = value => { const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };
  const today = dateKey(new Date());
  const pendingTopics = topics.filter(t => !t.searchedAt || dateKey(t.searchedAt) !== today);
  if (!pendingTopics.length) { renderDashboardBriefing(); return; }
  autoBriefingRunning = true;
  setTopicStatus('searching', `正在搜索 ${pendingTopics.length} 个关注主题…`);
  let succeeded = 0;
  const failures = [];
  for (const topic of pendingTopics) {
    try {
      await window.orbito.generateTopicBriefing(topic.id);
      succeeded++;
    } catch (err) {
      console.error(`Briefing search failed for "${topic.name}":`, err);
      failures.push(topic.name);
    }
  }
  // Reload state after search
  try {
    const state = await window.orbito.getState();
    if (Array.isArray(state.topics)) topics = state.topics;
    if (Array.isArray(state.briefings)) briefings = state.briefings;
    renderTopicCards();
    renderTopicResults();
    renderDashboardBriefing();
    setTopicStatus(failures.length?'error':'done', failures.length?`已更新 ${succeeded} 个主题，${failures.length} 个失败，可稍后重试`:`已更新 ${succeeded} 个主题的情报`);
    setTimeout(() => setTopicStatus('', ''), 3000);
  } catch (err) {
    setTopicStatus('error', `更新情报时出错：${err.message}`);
  } finally {
    autoBriefingRunning = false;
  }
}

function setTopicStatus(type, text) {
  const el = $('#topicStatus');
  if (!el) return;
  if (!text) { el.hidden = true; el.className = 'briefing-status'; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = 'briefing-status' + (type ? ' ' + type : '');
}

async function refreshAllTopics() {
  if (!window.orbito) { showToast('每日情报只在桌面应用中可用'); return; }
  if (!aiConfigured) { showToast('后台智能服务尚未配置，无法执行搜索'); return; }
  if (!topics.length) { showToast('请先添加关注主题'); return; }
  setTopicStatus('searching', `正在搜索 ${topics.length} 个关注主题…`);
  for (const topic of topics) {
    try {
      await window.orbito.generateTopicBriefing(topic.id);
    } catch (err) {
      console.error(`Briefing failed for "${topic.name}":`, err);
    }
  }
  const state = await window.orbito.getState();
  if (Array.isArray(state.topics)) topics = state.topics;
  if (Array.isArray(state.briefings)) briefings = state.briefings;
  renderTopicCards();
  renderTopicResults();
  renderDashboardBriefing();
  setTopicStatus('done', `情报已生成`);
  setTimeout(() => setTopicStatus('', ''), 3000);
}

async function saveState(domains=null) {
  if (!window.orbito) return;
  const all={tasks,inventory,inventoryImports,conversations:conversations.slice(-100),memories,briefings,topics,englishPlans,papers,events,projects,aiTasks,inboxItems};
  const changes=Array.isArray(domains)?Object.fromEntries(domains.map(key=>[key,all[key]])):all;
  try { await (window.orbito.patchState?window.orbito.patchState(changes):window.orbito.saveState(all)); }
  catch (error) { console.error(error); showToast('本地保存失败，请稍后重试'); }
}

function switchView(id) {
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===(id==='project-detail'?'projects':id)));
  document.querySelector('.sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='terminal')setTimeout(()=>initTerminal(),80);
  if(id==='inbox')renderInbox();
}

function setTerminalStatus(running, text){const el=$('#terminalStatus');if(!el)return;el.classList.toggle('running',running);el.lastChild.textContent=text}

async function initTerminal(force=false){
  if(!window.orbito){showToast('终端只在桌面应用中可用');return false}
  if(terminalStartPromise&&!force)return terminalStartPromise;
  if(!xterm){
    xterm=new window.Terminal({cursorBlink:true,convertEol:true,fontFamily:'Cascadia Mono, Consolas, monospace',fontSize:14,lineHeight:1.25,scrollback:5000,theme:{background:'#111816',foreground:'#d5dfd9',cursor:'#78c49b',selectionBackground:'#315441',black:'#111816',brightBlack:'#59665f',green:'#70bf8d',brightGreen:'#8ad4a4',blue:'#73a5c2',brightBlue:'#95c3dc',yellow:'#d3aa63',brightYellow:'#e8c681',red:'#d6766e',brightRed:'#ed9189'}});
    fitAddon=new window.FitAddon.FitAddon();xterm.loadAddon(fitAddon);xterm.open($('#terminalContainer'));fitAddon.fit();
    xterm.onData(data=>window.orbito.terminalWrite(data));
    window.orbito.onTerminalData(data=>xterm.write(data));
    window.orbito.onTerminalExit(()=>{terminalStarted=false;setTerminalStatus(false,'已结束');xterm.writeln('\r\n\x1b[33m[终端已结束，可点击“重启终端”]\x1b[0m')});
    const observer=new ResizeObserver(()=>{if(!fitAddon||!xterm)return;fitAddon.fit();if(terminalStarted)window.orbito.terminalResize(xterm.cols,xterm.rows)});observer.observe($('#terminalContainer'));
  }
  if(terminalStarted&&!force){fitAddon.fit();xterm.focus();return true}
  terminalStartPromise=(async()=>{if(force){await window.orbito.terminalKill();xterm.reset()}setTerminalStatus(false,'正在启动…');fitAddon.fit();const result=await window.orbito.terminalStart({cols:xterm.cols,rows:xterm.rows});if(!result.ok){setTerminalStatus(false,'启动失败');xterm.writeln(`\x1b[31m终端启动失败：${result.error}\x1b[0m`);return false}terminalStarted=true;$('#terminalCwd').textContent=result.cwd;if(result.ignoredProxies?.length){const endpoints=[...new Set(result.ignoredProxies.map(item=>item.endpoint))].join('、');xterm.writeln(`\x1b[33m[已忽略未运行的本地代理 ${endpoints}，终端将尝试直连]\x1b[0m\r\n`)}setTerminalStatus(true,'运行中');xterm.focus();return true})();
  try{return await terminalStartPromise}finally{terminalStartPromise=null}
}

async function openClaude(){switchView('terminal');const ok=await initTerminal();if(ok){xterm.writeln('\r\n\x1b[36m[正在启动 Claude Code…]\x1b[0m');window.orbito.terminalWrite('claude\r')}}

async function showTerminalContext(){switchView('terminal');const ok=await initTerminal();if(ok)window.orbito.terminalWrite('node tools/hacher.cjs context\r')}

function showToast(text){const t=$('#toast');t.querySelector('p').textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2300)}
function showModal(html,wide=false){$('#modalContent').innerHTML=html;$('#modal').classList.toggle('project-detail-modal',wide);$('#modalWrap').classList.add('show');$('#overlay').classList.add('show')}
function closeModal(){ $('#modalWrap').classList.remove('show');$('#modal').classList.remove('project-detail-modal');$('#overlay').classList.remove('show') }
function inferredAgentContext(){const page=$('.page.active')?.id;if(page==='project-detail'&&activeProjectId)return`project:${activeProjectId}`;if(['today','calendar'].includes(page))return'today';if(page==='inventory')return'inventory';if(page==='papers')return'papers';if(page==='briefing')return'briefing';return'workspace'}
function openAI(options={}){const config=options&&typeof options==='object'&&!options.target?options:{};const wasOpen=$('#aiPanel').classList.contains('open');if(config.context)agentContextSelection=config.context;else if(!wasOpen&&!config.keepContext)agentContextSelection=inferredAgentContext();const running=aiTasks.find(task=>['queued','running'].includes(task.status));if(running&&!config.keepTask)activeAITaskId=running.id;$('#aiPanel').classList.add('open');setAIPane('tasks');renderAITaskCenter();if(config.prompt!==undefined){$('#agentRequestInput').value=config.prompt;setTimeout(()=>$('#agentRequestInput')?.focus(),120)}}
function closeAI(){ $('#aiPanel').classList.remove('open') }

const aiTaskStatusLabels={queued:'等待中',running:'执行中',completed:'已完成',failed:'失败',canceled:'已取消'};
function latestAITask(type,projectId=null){return aiTasks.filter(task=>task.type===type&&(projectId===null||String(task.projectId)===String(projectId))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]||null}
function aiTaskTime(value){if(!value)return'';return new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}
function setAIPane(name){$$('[data-ai-pane]').forEach(button=>button.classList.toggle('active',button.dataset.aiPane===name));$('#aiTaskPane').hidden=name!=='tasks';$('#aiQuickPane').hidden=name!=='quick';if(name==='quick')setTimeout(()=>$('#chatInput')?.focus(),120)}
function agentList(items,empty='暂无'){return Array.isArray(items)&&items.length?`<ul>${items.map(item=>`<li>${h(typeof item==='string'?item:item?.title||'')}</li>`).join('')}</ul>`:`<p class="ai-result-empty">${h(empty)}</p>`}
function agentContextOptions(){return [{value:'workspace',label:'工作台总览'},{value:'today',label:'今日任务与日程'},{value:'inventory',label:'元件仓库'},{value:'papers',label:'论文与研究资料'},{value:'briefing',label:'每日情报'},...projects.map(project=>({value:`project:${project.id}`,label:`项目：${project.name}`}))]}
function renderAgentContextPicker(){const select=$('#agentContextSelect');if(!select)return;const options=agentContextOptions();if(!options.some(item=>item.value===agentContextSelection))agentContextSelection='workspace';select.innerHTML=options.map(item=>`<option value="${h(item.value)}" ${item.value===agentContextSelection?'selected':''}>${h(item.label)}</option>`).join('');const selected=options.find(item=>item.value===agentContextSelection);$('#aiContext').textContent=selected?.label||'工作台总览';renderAgentSuggestions()}
function renderAgentSuggestions(){const box=$('#agentSuggestions');if(!box)return;const project=agentContextSelection.startsWith('project:');const values=project?['看看目前最需要推进什么','根据日志和任务总结最近进展','检查风险并给出下一步']:agentContextSelection==='today'?['帮我安排今天','看看今天有没有冲突','把未完成任务排个优先级']:agentContextSelection==='inventory'?['检查哪些元件需要补货','看看项目 BOM 是否缺料','整理库存异常']:agentContextSelection==='papers'?['总结目前的研究资料','帮我梳理阅读顺序','找出与项目有关的论文']:['告诉我现在最应该先做什么','总结最近的工作进展','检查有哪些被忽略的问题'];box.innerHTML=values.map(value=>`<button type="button" data-agent-suggestion="${h(value)}">${h(value)}</button>`).join('')}
function aiTaskResultHtml(task,compact=false){
  const result=task?.result||{};
  if(task?.status==='failed')return `<div class="ai-result-error"><b>任务没有完成</b><p>${h(task.error||'Claude Agent 执行失败')}</p>${task.rawOutput?`<details><summary>查看执行详情</summary><pre>${h(task.rawOutput)}</pre></details>`:''}<button data-view-link="terminal">打开 Agent 终端检查配置</button></div>`;
  if(task?.status!=='completed')return `<div class="ai-result-running"><span>✦</span><div><b>${h(task?.step||'准备中')}</b><small>可以关闭面板，任务会在后台继续</small><i><em style="width:${Number(task?.progress)||0}%"></em></i></div></div>`;
  if(task.type==='assistant-request'){const actions=Array.isArray(result.suggestedActions)?result.suggestedActions:[];return `<div class="ai-structured-result assistant-result"><div class="ai-result-summary"><span>✦</span><div><b>${h(result.title||'助手结果')}</b><p>${h(result.summary||'任务已经完成')}</p></div></div>${result.answer?`<div class="assistant-answer">${h(result.answer).replace(/\n/g,'<br>')}</div>`:''}${Array.isArray(result.sections)?result.sections.map(section=>`<div class="ai-result-block"><b>${h(section.title||'要点')}</b>${agentList(section.items)}</div>`).join(''):''}${actions.length?`<div class="assistant-proposed-actions"><b>${task.actionsAppliedAt?'已执行的操作':'等待你确认的操作'}</b>${actions.map(action=>`<div><span>${action.type==='create_event'?'◷':action.type==='add_project_log'?'▤':'✓'}</span><p><b>${h(action.title||action.summary||'工作台操作')}</b><small>${h(action.reason||'执行前需要确认')}</small></p></div>`).join('')}</div>${task.actionsAppliedAt?'<div class="assistant-actions-applied">✓ 已写入工作台</div>':`<div class="ai-result-actions"><button data-action="apply-assistant-actions" data-ai-task-id="${h(task.id)}">确认执行 ${actions.length} 项操作</button></div>`}`:''}</div>`}
  if(task.type==='plan-day')return `<div class="ai-structured-result ${compact?'compact':''}"><div class="ai-result-summary"><span>☀</span><div><b>今日安排建议</b><p>${h(result.summary||'规划已完成')}</p></div></div>${result.priorities?.length?`<div class="ai-result-block"><b>优先事项</b>${agentList(result.priorities)}</div>`:''}<div class="ai-schedule-result">${Array.isArray(result.schedule)&&result.schedule.length?result.schedule.map(row=>`<div><time>${h(row.start||'')}<small>${h(row.end||'')}</small></time><span><b>${h(row.title||'未命名安排')}</b><small>${h(row.reason||'')}</small></span></div>`).join(''):'<p class="ai-result-empty">没有生成可排入日历的时段</p>'}</div>${result.conflicts?.length?`<div class="ai-result-block warning"><b>冲突与风险</b>${agentList(result.conflicts)}</div>`:''}${!compact?`<div class="ai-result-actions"><button data-action="apply-ai-plan" data-ai-task-id="${h(task.id)}">确认并加入日历</button><button data-action="open-ai">在任务中心查看</button></div>`:''}</div>`;
  return `<div class="ai-structured-result ${compact?'compact':''}"><div class="ai-result-summary"><span>▦</span><div><b>${h(result.health||'项目分析')}</b><p>${h(result.summary||'分析已完成')}</p></div></div><div class="ai-project-analysis-grid"><div><b>当前阻塞</b>${agentList(result.blockers,'没有识别到明确阻塞')}</div><div><b>今天可做</b>${agentList(result.immediateActions,'暂无')}</div><div><b>本周推进</b>${agentList(result.weekActions,'暂无')}</div></div>${!compact&&result.suggestedTasks?.length?`<div class="ai-result-actions"><button data-action="apply-project-suggestions" data-ai-task-id="${h(task.id)}">确认并创建建议任务</button><button data-action="open-ai">在任务中心查看</button></div>`:''}</div>`;
}
function renderAITaskCenter(){
  const list=$('#aiTaskList');const detail=$('#aiTaskDetail');if(!list||!detail)return;
  renderAgentContextPicker();
  if(!activeAITaskId||!aiTasks.some(task=>task.id===activeAITaskId))activeAITaskId=aiTasks[0]?.id||null;
  list.innerHTML=aiTasks.length?aiTasks.slice(0,12).map(task=>`<button class="ai-task-item ${task.id===activeAITaskId?'active':''}" data-ai-task-select="${h(task.id)}"><span class="${h(task.status)}">${task.status==='completed'?'✓':task.status==='failed'?'!':'✦'}</span><div><b>${h(task.title)}${task.projectId?` · ${h(linkedProjectName(task.projectId)||'项目')}`:''}</b><small>${h(task.contextLabel||task.step||aiTaskStatusLabels[task.status]||'')} · ${h(aiTaskTime(task.createdAt))}</small><i><em style="width:${Number(task.progress)||0}%"></em></i></div></button>`).join(''):'<div class="ai-task-empty"><span>✦</span><b>还没有助手任务</b><small>选择上下文并告诉助手你想完成什么。</small></div>';
  const task=aiTasks.find(item=>item.id===activeAITaskId);detail.innerHTML=task?`<div class="ai-task-detail-head"><div><small>${h(aiTaskStatusLabels[task.status]||'')}</small><h3>${h(task.title)}</h3></div>${['queued','running'].includes(task.status)?`<button data-action="cancel-ai-task" data-ai-task-id="${h(task.id)}">取消</button>`:''}</div>${aiTaskResultHtml(task)}${task.status==='completed'&&task.rawOutput?`<details class="ai-execution-details"><summary>查看 Agent 执行详情</summary><pre>${h(task.rawOutput)}</pre></details>`:''}`:'';
  renderAITaskStatus();renderAIOriginResults();
}
function renderAITaskStatus(){
  const bar=$('#aiTaskStatusBar');if(!bar)return;const running=aiTasks.find(task=>['queued','running'].includes(task.status)&&!task.statusDismissedAt);bar.hidden=!running;if(running){$('#aiTaskStatusTitle').textContent=`${running.title} · ${running.progress||0}%`;$('#aiTaskStatusText').textContent=running.step||aiTaskStatusLabels[running.status];$('#aiTaskStatusProgress').style.width=`${running.progress||0}%`}const side=$('#sidebarAIStatus');const anyRunning=aiTasks.find(task=>['queued','running'].includes(task.status));if(side)side.textContent=anyRunning?`${anyRunning.title} · ${anyRunning.progress||0}%`:'需要时再叫我'}
function aiOriginNotice(task,label){if(!task||task.originDismissedAt||['queued','running'].includes(task.status))return'';const failed=task.status==='failed';const summary=failed?(task.error||'任务没有完成'):(task.result?.summary||'分析已经完成，可在任务中心查看完整结果。');return `<article class="ai-origin-notice ${failed?'failed':''}"><span>${failed?'!':'✦'}</span><div><b>${h(label)}${failed?'未完成':'已完成'}</b><small>${h(summary)}</small></div><button data-action="view-ai-task" data-ai-task-id="${h(task.id)}">查看</button><button class="ai-origin-dismiss" data-action="dismiss-ai-origin" data-ai-task-id="${h(task.id)}" title="隐藏这条提示" aria-label="隐藏 AI 结果提示">×</button></article>`}
function renderAIOriginResults(){const dashboard=$('#dailyPlanResult');const plan=latestAITask('plan-day');if(dashboard)dashboard.innerHTML=aiOriginNotice(plan,'今日规划')}
function viewAITask(taskId){activeAITaskId=taskId;openAI({keepContext:true,keepTask:true});activeAITaskId=taskId;renderAITaskCenter()}
async function dismissAIOrigin(taskId){const task=aiTasks.find(item=>item.id===taskId);if(!task)return;task.originDismissedAt=new Date().toISOString();await saveState(['aiTasks']);renderAIOriginResults();if($('#project-detail').classList.contains('active'))renderProjectWorkspace()}
async function dismissAIStatus(){const task=aiTasks.find(item=>['queued','running'].includes(item.status));if(!task)return;task.statusDismissedAt=new Date().toISOString();await saveState(['aiTasks']);renderAITaskStatus()}
async function startAgentTask(type){if(!window.orbito?.startAgentTask){showToast('AI 任务只在桌面应用中可用');return}const project=projects.find(item=>String(item.id)===String(activeProjectId));if(type==='analyze-project'&&!project){showToast('请先进入一个项目');return}openAI();setAIPane('tasks');try{const result=await window.orbito.startAgentTask({type,projectId:project?.id||null,originView:$('.page.active')?.id||'dashboard'});if(result?.task){aiTasks.unshift(result.task);activeAITaskId=result.task.id;renderAITaskCenter();showToast('AI 任务已开始，可关闭面板继续使用工作台')}}catch(error){showToast(`无法启动 AI 任务：${error.message||error}`)}}
async function submitAssistantRequest(){const request=$('#agentRequestInput')?.value.trim();if(!request){showToast('先告诉助手你想完成什么');return}if(!window.orbito?.startAgentTask){showToast('AI 助手只在桌面应用中可用');return}const [kind,id]=agentContextSelection.split(':');const label=agentContextOptions().find(item=>item.value===agentContextSelection)?.label||'工作台总览';const button=$('#agentSubmitButton');button.disabled=true;button.textContent='正在交给助手…';try{const result=await window.orbito.startAgentTask({type:'assistant-request',request,contextType:kind,contextLabel:label,projectId:kind==='project'?id:null,originView:$('.page.active')?.id||'dashboard'});if(result?.task){aiTasks.unshift(result.task);activeAITaskId=result.task.id;$('#agentRequestInput').value='';renderAITaskCenter();showToast('助手已开始处理，可以关闭面板继续工作')}}catch(error){showToast(`无法启动助手：${error.message||error}`)}finally{button.disabled=false;button.innerHTML='交给助手 <span>→</span>'}}
function openAssistantPreset(context,prompt){openAI({context,prompt,keepTask:true})}
async function cancelAgentTask(taskId){const result=await window.orbito?.cancelAgentTask(taskId);if(result?.task){aiTasks=aiTasks.map(task=>task.id===taskId?result.task:task);renderAITaskCenter();showToast('AI 任务已取消')}}
async function applyAIPlan(taskId){const task=aiTasks.find(item=>item.id===taskId);const rows=task?.result?.schedule;if(!Array.isArray(rows)||!rows.length){showToast('没有可加入日历的安排');return}if(!window.confirm(`把 ${rows.length} 项 AI 建议加入今天的日历？`))return;const valid=rows.filter(row=>/^\d{2}:\d{2}$/.test(row.start||'')&&/^\d{2}:\d{2}$/.test(row.end||''));const existing=new Set(events.filter(item=>item.aiTaskId===taskId).map(item=>`${item.startTime}|${item.title}`));valid.forEach((row,index)=>{if(!existing.has(`${row.start}|${row.title}`))events.push({id:`event-ai-${Date.now()}-${index}`,title:row.title,date:localDateKey(),startTime:row.start,endTime:row.end,location:'',category:'other',notes:`AI 规划建议：${row.reason||''}`,projectId:null,aiTaskId:taskId,createdAt:new Date().toISOString()})});task.originDismissedAt=new Date().toISOString();await saveState(['events','aiTasks']);renderCalendar();renderTasks();renderAIOriginResults();showToast('已将 AI 建议加入今日日历')}
async function applyProjectSuggestions(taskId){const task=aiTasks.find(item=>item.id===taskId);const suggestions=task?.result?.suggestedTasks;if(!Array.isArray(suggestions)||!suggestions.length){showToast('没有可创建的建议任务');return}if(!window.confirm(`把 ${suggestions.length} 项建议创建为项目待办？`))return;suggestions.forEach((item,index)=>tasks.unshift({id:`task-ai-${Date.now()}-${index}`,title:item.title,meta:`AI 项目分析 · ${item.reason||'待确认'}`,time:'待安排',projectId:task.projectId,done:false,aiTaskId:taskId,createdAt:new Date().toISOString()}));task.originDismissedAt=new Date().toISOString();await saveState(['tasks','aiTasks']);renderTasks();renderProjectWorkspace();showToast('建议任务已创建并关联项目')}
async function applyAssistantActions(taskId){const task=aiTasks.find(item=>item.id===taskId);const actions=Array.isArray(task?.result?.suggestedActions)?task.result.suggestedActions:[];if(!actions.length){showToast('没有等待执行的操作');return}if(!window.confirm(`确认执行助手提出的 ${actions.length} 项工作台操作？`))return;const domains=new Set();let applied=0;actions.slice(0,20).forEach((action,index)=>{const projectId=projects.some(project=>String(project.id)===String(action.projectId))?action.projectId:(task.projectId||null);if(action.type==='create_task'&&String(action.title||'').trim()){tasks.unshift({id:`task-agent-${Date.now()}-${index}`,title:String(action.title).trim().slice(0,160),meta:`AI 助手建议 · ${String(action.reason||'已确认').slice(0,160)}`,time:String(action.time||'待安排').slice(0,60),projectId,done:false,aiTaskId:taskId,createdAt:new Date().toISOString()});domains.add('tasks');applied++}else if(action.type==='create_event'&&String(action.title||'').trim()&&/^\d{4}-\d{2}-\d{2}$/.test(action.date||'')&&/^\d{2}:\d{2}$/.test(action.startTime||'')&&/^\d{2}:\d{2}$/.test(action.endTime||'')){events.push({id:`event-agent-${Date.now()}-${index}`,title:String(action.title).trim().slice(0,160),date:action.date,startTime:action.startTime,endTime:action.endTime,location:'',category:'other',notes:`AI 助手建议：${String(action.reason||'').slice(0,300)}`,projectId,aiTaskId:taskId,createdAt:new Date().toISOString()});domains.add('events');applied++}else if(action.type==='add_project_log'&&projectId){const project=projects.find(item=>String(item.id)===String(projectId));if(project){ensureProjectSchema(project);project.logs.unshift({id:`log-agent-${Date.now()}-${index}`,date:localDateKey(),summary:String(action.summary||action.title||'AI 助手记录').slice(0,200),improvements:String(action.improvements||'').slice(0,1000),problems:String(action.problems||'').slice(0,1000),nextSteps:String(action.nextSteps||'').slice(0,1000),createdAt:new Date().toISOString()});project.updatedAt=new Date().toISOString();domains.add('projects');applied++}}});if(!applied){showToast('建议中没有格式有效的可执行操作');return}task.actionsAppliedAt=new Date().toISOString();domains.add('aiTasks');await saveState([...domains]);renderTasks();renderCalendar();renderProjects();if($('#project-detail').classList.contains('active'))renderProjectWorkspace();renderAITaskCenter();showToast(`已确认执行 ${applied} 项操作`)}

function formModal(type,defaultProjectId=''){
  const data={
    task:['新建任务','任务名称','输入任务名称','所属项目','可选'],
    event:['新建日程','日程名称','输入日程名称','日期与时间','请选择'],
    project:['创建项目','项目名称','输入项目名称','项目类型','请选择'],
    part:['手动入库','元器件名称','输入名称或型号','数量','1']
  }[type];
  const secondaryField={
    task:`<select id="secondaryField"><option value="">不关联项目</option>${projects.map(project=>`<option value="${h(project.id)}" ${String(project.id)===String(defaultProjectId)?'selected':''}>${h(project.name)}</option>`).join('')}</select>`,
    event:'<input id="secondaryField" type="datetime-local">',
    project:'<select id="secondaryField"><option value="" selected disabled>请选择</option><option value="research">科研项目</option><option value="startup">创业 / 产品</option><option value="software">软件开发</option><option value="electronics">电子 / PCB</option><option value="model">模型研究</option><option value="diy">DIY / 创作</option><option value="other">其他</option></select>',
    part:'<input id="secondaryField" type="number" min="0" step="1" value="1">'
  }[type];
  showModal(`<div class="modal-icon">＋</div><h2>${data[0]}</h2><p>请填写基本信息，之后可以继续补充上下文并交给 AI 协助整理。</p><div class="form-grid"><div class="form-field full"><label>${data[1]}</label><input id="primaryField" placeholder="${data[2]}"></div><div class="form-field"><label>${data[3]}</label>${secondaryField}</div><div class="form-field"><label>关联标签</label><input placeholder="可选"></div><div class="form-field full"><label>补充说明</label><textarea rows="3" placeholder="写下需要 AI 理解的上下文…"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-confirm="${type}">确认创建</button></div>`);
  setTimeout(()=>$('#primaryField')?.focus(),100);
}

function projectModal(defaultType='',projectId=null){
  const project=projectId?projects.find(item=>String(item.id)===String(projectId)):null;editingProjectId=project?.id||null;const type=project?.type||defaultType||'research';
  showModal(`<div class="modal-icon">▦</div><h2>${project?'编辑项目':defaultType==='diy'?'创建 DIY 项目':'创建项目'}</h2><p>项目会保存在本机，并同步显示在项目中心、总览和对应分类页面。</p><div class="form-grid"><div class="form-field full"><label>项目名称</label><input id="projectName" value="${h(project?.name||'')}" placeholder="输入项目名称"></div><div class="form-field"><label>项目类型</label><select id="projectType"><option value="research" ${type==='research'?'selected':''}>科研项目</option><option value="startup" ${type==='startup'?'selected':''}>创业 / 产品</option><option value="software" ${type==='software'?'selected':''}>软件开发</option><option value="electronics" ${type==='electronics'?'selected':''}>电子 / PCB</option><option value="model" ${type==='model'?'selected':''}>模型研究</option><option value="diy" ${type==='diy'?'selected':''}>DIY / 创作</option><option value="other" ${type==='other'?'selected':''}>其他</option></select></div><div class="form-field"><label>当前状态</label><select id="projectStatus"><option value="idea" ${project?.status==='idea'?'selected':''}>想法</option><option value="planning" ${!project||project?.status==='planning'?'selected':''}>规划中</option><option value="active" ${project?.status==='active'?'selected':''}>进行中</option><option value="paused" ${project?.status==='paused'?'selected':''}>已暂停</option><option value="completed" ${project?.status==='completed'?'selected':''}>已完成</option></select></div><div class="form-field"><label>当前进度（%）</label><input id="projectProgress" type="number" min="0" max="100" step="1" value="${h(project?.progress??0)}"></div><div class="form-field"><label>关联标签</label><input id="projectTags" value="${h((project?.tags||[]).join(', '))}" placeholder="用逗号分隔，可选"></div><div class="form-field full"><label>项目说明</label><textarea id="projectDescription" rows="4" placeholder="目标、当前情况，以及希望 AI 理解的上下文…">${h(project?.description||'')}</textarea></div></div><div class="modal-actions">${project?`<button class="danger-modal-btn" data-project-delete="${h(project.id)}">删除</button>`:''}<button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-project">${project?'保存修改':'确认创建'}</button></div>`);setTimeout(()=>$('#projectName')?.focus(),100)
}

async function saveProject(){
  const name=$('#projectName')?.value.trim();if(!name){showToast('请输入项目名称');return}const existing=editingProjectId?projects.find(item=>String(item.id)===String(editingProjectId)):null;
  const next={...(existing||{}),id:editingProjectId||Date.now(),name,type:$('#projectType')?.value||'other',status:$('#projectStatus')?.value||'planning',progress:Math.max(0,Math.min(100,Math.round(Number($('#projectProgress')?.value)||0))),tags:($('#projectTags')?.value||'').split(/[,，]/).map(tag=>tag.trim()).filter(Boolean).slice(0,12),description:$('#projectDescription')?.value.trim()||'',files:Array.isArray(existing?.files)?existing.files:[],logs:Array.isArray(existing?.logs)?existing.logs:[],createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(editingProjectId)projects=projects.map(item=>String(item.id)===String(editingProjectId)?next:item);else projects.unshift(next);renderProjects();renderTasks();await saveState(['projects']);closeModal();if(existing&&$('#project-detail').classList.contains('active')){activeProjectId=next.id;renderProjectWorkspace()}editingProjectId=null;showToast(existing?'项目已更新':'项目已创建并保存')
}

function parseProjectDate(value){
  if(!value)return null;
  const text=String(value);
  const dateOnly=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(dateOnly)return new Date(Number(dateOnly[1]),Number(dateOnly[2])-1,Number(dateOnly[3]),12);
  const date=new Date(text);
  return Number.isNaN(date.getTime())?null:date;
}
function projectTimestamp(value){return parseProjectDate(value)?.getTime()||0}
function projectDate(value,withTime=false){
  const date=parseProjectDate(value);if(!date)return'未知日期';
  const hasTime=!/^\d{4}-\d{2}-\d{2}$/.test(String(value));
  return date.toLocaleString('zh-CN',withTime&&hasTime?{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}:{year:'numeric',month:'2-digit',day:'2-digit'});
}
function projectLogMoment(log){return log.occurredAt||log.createdAt||log.date}
function projectLogOccurredAt(dateKey,now=new Date()){
  const parts=String(dateKey||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!parts)return now.toISOString();
  return new Date(Number(parts[1]),Number(parts[2])-1,Number(parts[3]),now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds()).toISOString();
}
function projectFileIcon(file){const ext=(file.name?.split('.').pop()||'FILE').toUpperCase();return h(ext.slice(0,4))}
function projectTimeline(project){
  const rows=[{date:project.createdAt,type:'project',title:'创建项目',detail:project.description||'建立项目档案'}];
  for(const file of project.files||[])rows.push({date:file.addedAt,type:'file',title:`${file.mode==='link'?'关联':'导入'}资料：${file.name}`,detail:projectFileCategoryLabels[file.category]||'其他资料'});
  for(const log of project.logs||[])rows.push({date:projectLogMoment(log),type:'log',title:log.summary||'新增工作日志',detail:log.improvements||log.problems||log.nextSteps||'记录了项目进展'});
  return rows.filter(row=>row.date).sort((a,b)=>projectTimestamp(b.date)-projectTimestamp(a.date));
}
function projectDetailModal(projectId){
  const project=projects.find(item=>String(item.id)===String(projectId));if(!project)return;activeProjectId=project.id;if(!Array.isArray(project.files))project.files=[];if(!Array.isArray(project.logs))project.logs=[];
  const files=project.files.map(file=>`<div class="project-file-row"><span class="project-file-icon">${projectFileIcon(file)}</span><div><b>${h(file.name)}</b><small>${h(projectFileCategoryLabels[file.category]||'其他资料')} · ${h(file.mode==='link'?'外部关联':'项目资料库')} · ${h(formatFileSize(file.size))}</small></div><button data-project-file-open="${h(file.id)}">打开</button><button class="remove" data-project-file-remove="${h(file.id)}">移除</button></div>`).join('');
  const logs=project.logs.slice().sort((a,b)=>projectTimestamp(projectLogMoment(b))-projectTimestamp(projectLogMoment(a))).map(log=>`<article class="project-log"><div><time>${h(projectDate(log.date||projectLogMoment(log)))}</time><button data-project-log-delete="${h(log.id)}" title="删除日志">×</button></div><h4>${h(log.summary||'工作记录')}</h4>${log.improvements?`<p><b>完成 / 改进</b>${h(log.improvements)}</p>`:''}${log.problems?`<p class="problem"><b>遗留问题</b>${h(log.problems)}</p>`:''}${log.nextSteps?`<p><b>下一步</b>${h(log.nextSteps)}</p>`:''}</article>`).join('');
  const timeline=projectTimeline(project).slice(0,30).map(row=>`<div class="project-timeline-row ${h(row.type)}"><span></span><div><time>${h(projectDate(row.date,true))}</time><b>${h(row.title)}</b><small>${h(row.detail)}</small></div></div>`).join('');
  showModal(`<div class="project-detail-head"><div><p>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</p><h2>${h(project.name)}</h2><small>${h(project.description||'还没有补充项目说明。')}</small></div><button class="outline-btn" data-project-edit="${h(project.id)}">编辑项目</button></div><div class="project-detail-metrics"><div><b>${Math.max(0,Math.min(100,Number(project.progress)||0))}%</b><small>当前进度</small></div><div><b>${project.files.length}</b><small>关联资料</small></div><div><b>${project.logs.length}</b><small>工作日志</small></div><div><b>${h(projectDate(project.updatedAt||project.createdAt))}</b><small>最近更新</small></div></div><div class="project-detail-grid"><section class="project-detail-section"><div class="project-section-head"><div><p>项目资料</p><h3>文件与成果</h3></div><select id="projectFileCategory">${projectFileCategoryOptions(project.id)}</select><button class="outline-btn" data-action="project-link-files">关联原文件</button><button class="solid-btn" data-action="project-import-files">复制进资料库</button></div><div class="project-file-list">${files||'<div class="project-empty"><b>还没有项目资料</b><small>可以复制保存一份，也可以关联电脑上的原文件。</small></div>'}</div></section><section class="project-detail-section"><div class="project-section-head"><div><p>工作记录</p><h3>项目日志</h3></div><button class="solid-btn" data-action="project-add-log">＋ 写日志</button></div><div class="project-log-list">${logs||'<div class="project-empty"><b>还没有工作日志</b><small>记录做了什么、改进了什么、还剩什么问题。</small></div>'}</div></section><section class="project-detail-section project-timeline-section"><div class="project-section-head"><div><p>自动汇总</p><h3>项目时间线</h3></div></div><div class="project-timeline">${timeline}</div></section></div>`,true);
}

function projectLogModal(){
  const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;
  showModal(`<div class="modal-icon">◷</div><h2>记录项目进展</h2><p>${h(project.name)} · 写下今天完成的工作、改进和遗留问题。</p><div class="form-grid"><div class="form-field"><label>日期</label><input id="projectLogDate" type="date" value="${localDateKey()}"></div><div class="form-field"><label>一句话摘要</label><input id="projectLogSummary" placeholder="例如：完成第一版 PCB 布线"></div><div class="form-field full"><label>完成了什么 / 有什么改进</label><textarea id="projectLogImprovements" rows="3" placeholder="记录具体修改、实验结果或取得的进展…"></textarea></div><div class="form-field full"><label>还有什么问题</label><textarea id="projectLogProblems" rows="3" placeholder="未解决的问题、风险或失败原因…"></textarea></div><div class="form-field full"><label>下一步</label><textarea id="projectLogNext" rows="2" placeholder="接下来准备做什么…"></textarea></div></div><div class="modal-actions"><button class="cancel" data-project-open="${h(project.id)}">返回项目</button><button class="confirm" data-action="project-save-log">保存日志</button></div>`);
}
async function saveProjectLog(){
  const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;const summary=$('#projectLogSummary')?.value.trim();const improvements=$('#projectLogImprovements')?.value.trim();const problems=$('#projectLogProblems')?.value.trim();const nextSteps=$('#projectLogNext')?.value.trim();if(!summary&&!improvements&&!problems&&!nextSteps){showToast('请至少填写一项日志内容');return}
  const saveButton=$('[data-action="project-save-log"]');if(saveButton?.disabled)return;if(saveButton){saveButton.disabled=true;saveButton.textContent='保存中…'}
  const now=new Date();const date=$('#projectLogDate')?.value||localDateKey();if(!Array.isArray(project.logs))project.logs=[];project.logs.unshift({id:`${Date.now()}-${Math.random().toString(16).slice(2,8)}`,date,occurredAt:projectLogOccurredAt(date,now),summary:summary||'项目工作记录',improvements,problems,nextSteps,createdAt:now.toISOString()});project.updatedAt=now.toISOString();await saveState(['projects']);renderProjects();projectDetailModal(project.id);showToast('项目日志已保存');
}
async function deleteProjectLog(button){
  const project=projects.find(item=>String(item.id)===String(activeProjectId));
  const log=project?.logs?.find(item=>String(item.id)===String(button.dataset.projectLogDelete));
  if(!log||!window.confirm('确定删除这条项目日志？'))return;
  button.disabled=true;
  project.logs=project.logs.filter(item=>String(item.id)!==String(log.id));
  project.updatedAt=new Date().toISOString();
  await saveState(['projects']);
  renderProjects();
  renderProjectWorkspace();
  showToast('项目日志已删除，可以立即重新记录');
}
async function attachProjectFiles(mode){
  const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project||!window.orbito?.attachProjectFiles)return;const category=$('#projectFileCategory')?.value||selectedProjectFileCategory(project.id);projectFileCategorySelections.set(String(project.id),category);try{const result=await window.orbito.attachProjectFiles({projectId:project.id,mode,category});if(!result?.ok){showToast(result?.error||'添加文件失败');return}if(result.canceled)return;if(Array.isArray(result.state?.projects))projects=result.state.projects;renderProjects();projectDetailModal(project.id);showToast(`已${mode==='link'?'关联':'导入'} ${result.added?.length||0} 个文件`)}catch(error){showToast(`添加文件失败：${error.message||error}`)}
}

function ensureProjectSchema(project){
  for(const key of ['files','logs','bom','milestones','issues','decisions'])if(!Array.isArray(project[key]))project[key]=[];
  return project;
}
function linkedProjectName(projectId){return projects.find(project=>String(project.id)===String(projectId))?.name||''}
function openProjectWorkspace(projectId,tab='overview'){
  const project=projects.find(item=>String(item.id)===String(projectId));if(!project)return;activeProjectId=project.id;activeProjectTab=tab;ensureProjectSchema(project);renderProjectWorkspace();closeModal();switchView('project-detail');
}
function projectDetailModal(projectId){openProjectWorkspace(projectId,activeProjectTab)}
function projectWorkspaceEmpty(title,copy,action=''){return `<div class="project-workspace-empty"><b>${h(title)}</b><small>${h(copy)}</small>${action}</div>`}
function projectWorkspaceFiles(project){return project.files.map(file=>`<div class="project-file-row"><span class="project-file-icon">${projectFileIcon(file)}</span><div><b>${h(file.name)}</b><small>${h(projectFileCategoryLabels[file.category]||'其他资料')} · ${h(file.mode==='link'?'外部关联':'项目资料库')} · ${h(formatFileSize(file.size))}</small></div><button data-project-file-open="${h(file.id)}">打开</button><button class="remove" data-project-file-remove="${h(file.id)}">移除</button></div>`).join('')}
function projectWorkspaceLogs(project){return project.logs.slice().sort((a,b)=>projectTimestamp(projectLogMoment(b))-projectTimestamp(projectLogMoment(a))).map(log=>`<article class="project-log"><div><time>${h(projectDate(log.date||projectLogMoment(log)))}</time><button data-project-log-delete="${h(log.id)}" title="删除日志">×</button></div><h4>${h(log.summary||'工作记录')}</h4>${log.improvements?`<p><b>完成 / 改进</b>${h(log.improvements)}</p>`:''}${log.problems?`<p class="problem"><b>遗留问题</b>${h(log.problems)}</p>`:''}${log.nextSteps?`<p><b>下一步</b>${h(log.nextSteps)}</p>`:''}</article>`).join('')}
function bomInventoryPart(entry){return inventory.find(part=>String(part.id)===String(entry.inventoryId))}
function renderProjectWorkspace(){
  const project=projects.find(item=>String(item.id)===String(activeProjectId));const header=$('#projectWorkspaceHeader');const content=$('#projectWorkspaceContent');if(!project||!header||!content)return;ensureProjectSchema(project);
  const linkedTasks=tasks.filter(item=>String(item.projectId)===String(project.id));const linkedEvents=events.filter(item=>String(item.projectId)===String(project.id));const linkedPapers=papers.filter(item=>(item.projectIds||[]).some(id=>String(id)===String(project.id)));const openIssues=project.issues.filter(item=>item.status!=='resolved');const openTasks=linkedTasks.filter(item=>!item.done);const shortage=project.bom.filter(entry=>(Number(bomInventoryPart(entry)?.qty)||0)<(Number(entry.requiredQty)||0));
  header.innerHTML=`<div class="project-workspace-title"><div><p>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</p><h1>${h(project.name)}</h1><small>${h(project.description||'还没有补充项目说明。')}</small></div><button class="outline-btn" data-project-edit="${h(project.id)}">编辑项目</button><button class="solid-btn" data-action="project-add-log">＋ 记录进展</button></div><div class="project-workspace-metrics"><div><b>${Math.max(0,Math.min(100,Number(project.progress)||0))}%</b><small>项目进度</small></div><div><b>${openTasks.length}</b><small>未完成任务</small></div><div><b>${shortage.length}</b><small>BOM 缺料</small></div><div><b>${openIssues.length}</b><small>未解决问题</small></div></div>`;
  $$('#projectWorkspaceTabs [data-project-tab]').forEach(button=>button.classList.toggle('active',button.dataset.projectTab===activeProjectTab));
  if(activeProjectTab==='overview'){
    const timeline=[...projectTimeline(project),...linkedTasks.map(item=>({date:item.completedAt||item.createdAt,type:'task',title:`任务：${item.title}`,detail:item.done?'已完成':'待处理'})),...linkedEvents.map(item=>({date:`${item.date}T${item.startTime||'00:00'}:00`,type:'event',title:`日程：${item.title}`,detail:`${item.startTime||''}–${item.endTime||''}`})),...linkedPapers.map(item=>({date:item.importedAt,type:'paper',title:`论文：${item.title||item.fileName}`,detail:item.status||'待读'})),...project.milestones.map(item=>({date:item.dueDate||item.createdAt,type:'milestone',title:`里程碑：${item.title}`,detail:item.status==='done'?'已完成':'计划中'})),...project.issues.map(item=>({date:item.createdAt,type:'issue',title:`问题：${item.title}`,detail:item.status==='resolved'?'已解决':`${item.severity||'medium'} · 待解决`})),...project.decisions.map(item=>({date:item.date||item.createdAt,type:'decision',title:`决策：${item.title}`,detail:item.decision||item.rationale||''}))].filter(row=>row.date).sort((a,b)=>projectTimestamp(b.date)-projectTimestamp(a.date)).slice(0,20);
    content.innerHTML=`<div class="project-overview-grid"><article class="project-workspace-card"><div class="project-card-head"><div><p>下一步</p><h2>正在推进</h2></div><button data-project-tab-jump="work">查看全部</button></div>${openTasks.length?openTasks.slice(0,4).map(item=>`<div class="project-compact-row"><button class="task-check" data-task="${h(item.id)}"></button><div><b>${h(item.title)}</b><small>${h(taskDateLabel(item))}</small></div></div>`).join(''):projectWorkspaceEmpty('还没有项目任务','从项目中创建任务后会自动联动今日待办。','<button data-action="project-add-task">＋ 新建任务</button>')}</article><article class="project-workspace-card"><div class="project-card-head"><div><p>项目健康度</p><h2>需要关注</h2></div><button data-project-tab-jump="governance">管理</button></div><div class="project-health-list"><div><b>${openIssues.length}</b><small>未解决问题</small></div><div><b>${shortage.length}</b><small>BOM 缺料项</small></div><div><b>${project.milestones.filter(item=>item.status!=='done').length}</b><small>待完成里程碑</small></div></div></article><article class="project-workspace-card project-overview-timeline"><div class="project-card-head"><div><p>自动汇总</p><h2>项目时间线</h2></div></div><div class="project-timeline">${timeline.map(row=>`<div class="project-timeline-row ${h(row.type)}"><span></span><div><time>${h(projectDate(row.date,true))}</time><b>${h(row.title)}</b><small>${h(row.detail)}</small></div></div>`).join('')}</div></article></div>`;
  }else if(activeProjectTab==='work'){
    content.innerHTML=`<div class="project-linked-grid"><article class="project-workspace-card"><div class="project-card-head"><div><p>执行</p><h2>项目任务</h2></div><button data-action="project-link-tasks">管理关联</button><button data-action="project-add-task">＋ 新建</button></div>${linkedTasks.length?linkedTasks.map(item=>`<div class="project-compact-row ${item.done?'done':''}"><button class="task-check" data-task="${h(item.id)}">${item.done?'✓':''}</button><div><b>${h(item.title)}</b><small>${h(taskDateLabel(item))} · ${item.done?'已完成':'待处理'}</small></div></div>`).join(''):projectWorkspaceEmpty('没有关联任务','在这里创建的任务会同步到今日待办。')}</article><article class="project-workspace-card"><div class="project-card-head"><div><p>时间</p><h2>项目日程</h2></div><button data-action="project-link-events">管理关联</button><button data-action="project-add-event">＋ 新建</button></div>${linkedEvents.length?linkedEvents.sort((a,b)=>`${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)).map(item=>`<button class="project-linked-event" data-calendar-event="${h(item.id)}"><time>${h(item.date)}<b>${h(item.startTime)}</b></time><div><b>${h(item.title)}</b><small>${h(item.endTime)}${item.location?` · ${h(item.location)}`:''}</small></div></button>`).join(''):projectWorkspaceEmpty('没有关联日程','会议、实验和交付日期可以关联到项目。')}</article><article class="project-workspace-card"><div class="project-card-head"><div><p>研究资料</p><h2>关联论文</h2></div><button data-action="project-link-papers">管理关联</button></div>${linkedPapers.length?linkedPapers.map(item=>`<div class="project-linked-paper"><span>PDF</span><div><b>${h(item.title||item.fileName)}</b><small>${h(item.status||'待读')}</small></div><button data-paper-open="${h(item.id)}">打开</button></div>`).join(''):projectWorkspaceEmpty('没有关联论文','可以从本地论文库选择并关联到当前项目。')}</article></div>`;
  }else if(activeProjectTab==='files'){
    const files=projectWorkspaceFiles(project);content.innerHTML=`<article class="project-workspace-card"><div class="project-card-head project-file-toolbar"><div><p>项目资料</p><h2>文件与成果</h2></div><select id="projectFileCategory">${projectFileCategoryOptions(project.id)}</select><button class="outline-btn" data-action="project-link-files">关联原文件</button><button class="solid-btn" data-action="project-import-files">复制进资料库</button></div><div class="project-file-list workspace-list">${files||projectWorkspaceEmpty('还没有项目资料','可以保存独立副本，也可以关联电脑上的原文件。')}</div></article>`;
  }else if(activeProjectTab==='logs'){
    content.innerHTML=`<article class="project-workspace-card"><div class="project-card-head"><div><p>工作记录</p><h2>项目日志</h2></div><button class="solid-btn" data-action="project-add-log">＋ 写日志</button></div><div class="project-log-list workspace-list">${projectWorkspaceLogs(project)||projectWorkspaceEmpty('还没有工作日志','记录完成内容、改进、遗留问题和下一步。')}</div></article>`;
  }else if(activeProjectTab==='bom'){
    const rows=project.bom.map(entry=>{const part=bomInventoryPart(entry);const stock=Number(part?.qty)||0;const required=Number(entry.requiredQty)||0;const missing=Math.max(0,required-stock);return `<div class="bom-row ${missing?'shortage':''}"><div><b>${h(entry.name||part?.name||'未命名元件')}</b><small>${h(entry.spec||part?.spec||'')} ${entry.notes?`· ${h(entry.notes)}`:''}</small></div><span>需求 <b>${required}</b></span><span>库存 <b>${stock}</b></span><strong>${missing?`缺 ${missing}`:'充足'}</strong><button data-bom-remove="${h(entry.id)}">移除</button></div>`}).join('');content.innerHTML=`<article class="project-workspace-card"><div class="project-card-head"><div><p>物料联动</p><h2>BOM 与元件库存</h2></div><span class="bom-summary ${shortage.length?'warn':''}">${shortage.length?`${shortage.length} 项缺料`:'库存满足需求'}</span><button class="solid-btn" data-action="project-add-bom">＋ 添加物料</button></div><div class="bom-list">${rows||projectWorkspaceEmpty('BOM 还是空的','从元件仓库选择物料并填写项目所需数量。')}</div></article>`;
  }else{
    const milestones=project.milestones.map(item=>`<div class="governance-row"><button class="governance-check ${item.status==='done'?'done':''}" data-milestone-toggle="${h(item.id)}">${item.status==='done'?'✓':''}</button><div><b>${h(item.title)}</b><small>${h(item.dueDate||'未设置日期')} · ${item.status==='done'?'已完成':'计划中'}</small></div><button data-governance-remove="milestones:${h(item.id)}">×</button></div>`).join('');const issues=project.issues.map(item=>`<div class="governance-row issue-${h(item.severity||'medium')}"><button class="governance-check ${item.status==='resolved'?'done':''}" data-issue-toggle="${h(item.id)}">${item.status==='resolved'?'✓':'!'}</button><div><b>${h(item.title)}</b><small>${h(item.severity||'medium')} · ${item.status==='resolved'?'已解决':'待解决'}${item.notes?` · ${h(item.notes)}`:''}</small></div><button data-governance-remove="issues:${h(item.id)}">×</button></div>`).join('');const decisions=project.decisions.map(item=>`<div class="decision-row"><time>${h(item.date||'')}</time><div><b>${h(item.title)}</b><p>${h(item.decision||'')}</p>${item.rationale?`<small>原因：${h(item.rationale)}</small>`:''}</div><button data-governance-remove="decisions:${h(item.id)}">×</button></div>`).join('');content.innerHTML=`<div class="governance-grid"><article class="project-workspace-card"><div class="project-card-head"><div><p>关键节点</p><h2>里程碑</h2></div><button data-action="project-add-milestone">＋ 添加</button></div>${milestones||projectWorkspaceEmpty('还没有里程碑','记录样机、投稿或交付等关键节点。')}</article><article class="project-workspace-card"><div class="project-card-head"><div><p>风险跟踪</p><h2>问题清单</h2></div><button data-action="project-add-issue">＋ 添加</button></div>${issues||projectWorkspaceEmpty('没有未记录的问题','把技术障碍、风险和待解决事项集中管理。')}</article><article class="project-workspace-card governance-decisions"><div class="project-card-head"><div><p>过程依据</p><h2>决策记录</h2></div><button data-action="project-add-decision">＋ 添加</button></div>${decisions||projectWorkspaceEmpty('还没有决策记录','记录采用某个方案以及背后的原因。')}</article></div>`;
  }
}

async function ensureInventoryIds(){let changed=false;inventory.forEach((part,index)=>{if(!part.id){part.id=`part-${Date.now()}-${index}`;changed=true}});if(changed)await saveState(['inventory'])}
async function projectBomModal(){const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;await ensureInventoryIds();showModal(`<div class="modal-icon">B</div><h2>添加 BOM 物料</h2><p>${h(project.name)} · 可关联仓库元件，也可以先记录尚未入库的计划物料。</p><div class="form-grid"><div class="form-field full"><label>关联仓库元件</label><select id="bomInventory"><option value="">尚未入库 / 手动填写</option>${inventory.map(part=>`<option value="${h(part.id)}">${h(part.name)} · ${h(part.spec||'')}（库存 ${Number(part.qty)||0}）</option>`).join('')}</select></div><div class="form-field"><label>物料名称（未关联时必填）</label><input id="bomCustomName" placeholder="例如：STM32F407 主控"></div><div class="form-field"><label>规格 / 型号</label><input id="bomCustomSpec" placeholder="型号、封装或参数"></div><div class="form-field"><label>需求数量</label><input id="bomRequired" type="number" min="1" step="1" value="1"></div><div class="form-field"><label>备注</label><input id="bomNotes" placeholder="用途、位号或替代型号"></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-bom">添加到 BOM</button></div>`)}
async function saveProjectBom(){const project=projects.find(item=>String(item.id)===String(activeProjectId));const part=inventory.find(item=>String(item.id)===String($('#bomInventory')?.value));const name=part?.name||$('#bomCustomName')?.value.trim();if(!project||!name){showToast('请选择仓库元件或填写物料名称');return}ensureProjectSchema(project);const existing=part?project.bom.find(item=>String(item.inventoryId)===String(part.id)):null;const requiredQty=Math.max(1,Math.round(Number($('#bomRequired')?.value)||1));if(existing){existing.requiredQty=requiredQty;existing.notes=$('#bomNotes')?.value.trim()||existing.notes||'';existing.updatedAt=new Date().toISOString()}else project.bom.push({id:`bom-${Date.now()}`,inventoryId:part?.id||null,name,spec:part?.spec||$('#bomCustomSpec')?.value.trim()||'',requiredQty,notes:$('#bomNotes')?.value.trim()||'',createdAt:new Date().toISOString()});project.updatedAt=new Date().toISOString();await saveState(['projects']);closeModal();renderProjectWorkspace();showToast(existing?'BOM 数量已更新':'物料已加入 BOM')}
function projectPapersModal(){const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;showModal(`<div class="modal-icon">PDF</div><h2>关联项目论文</h2><p>勾选与“${h(project.name)}”相关的本地论文。</p><div class="project-paper-picker">${papers.length?papers.map(paper=>`<label><input type="checkbox" value="${h(paper.id)}" ${(paper.projectIds||[]).some(id=>String(id)===String(project.id))?'checked':''}><span><b>${h(paper.title||paper.fileName)}</b><small>${h(paper.fileName||'本地 PDF')}</small></span></label>`).join(''):projectWorkspaceEmpty('论文库是空的','请先在论文与科研页面导入 PDF。')}</div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-papers">保存关联</button></div>`)}
async function saveProjectPapers(){const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;const selected=new Set($$('.project-paper-picker input:checked').map(input=>String(input.value)));papers.forEach(paper=>{const ids=(paper.projectIds||[]).filter(id=>String(id)!==String(project.id));if(selected.has(String(paper.id)))ids.push(project.id);paper.projectIds=ids});await saveState(['papers']);closeModal();renderPapers();renderProjectWorkspace();showToast('论文关联已更新')}
function projectItemsModal(kind){const project=projects.find(item=>String(item.id)===String(activeProjectId));if(!project)return;const isTask=kind==='tasks';const items=isTask?tasks:events;showModal(`<div class="modal-icon">${isTask?'✓':'◷'}</div><h2>关联项目${isTask?'任务':'日程'}</h2><p>勾选需要归入“${h(project.name)}”的${isTask?'任务':'日程'}。取消勾选会保留原记录，只解除关联。</p><input type="hidden" id="projectItemsKind" value="${kind}"><div class="project-paper-picker">${items.length?items.map(item=>`<label><input type="checkbox" value="${h(item.id)}" ${String(item.projectId)===String(project.id)?'checked':''}><span><b>${h(item.title)}</b><small>${isTask?h(taskDateLabel(item)):h(`${item.date||''} ${item.startTime||''}–${item.endTime||''}`)}</small></span></label>`).join(''):projectWorkspaceEmpty(isTask?'还没有任务':'还没有日程',isTask?'先创建一项任务。':'先创建一项日程。')}</div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-items">保存关联</button></div>`)}
async function saveProjectItems(){const project=projects.find(item=>String(item.id)===String(activeProjectId));const kind=$('#projectItemsKind')?.value;const items=kind==='tasks'?tasks:events;if(!project||!['tasks','events'].includes(kind))return;const selected=new Set($$('.project-paper-picker input:checked').map(input=>String(input.value)));items.forEach(item=>{if(selected.has(String(item.id)))item.projectId=project.id;else if(String(item.projectId)===String(project.id))item.projectId=null});await saveState([kind]);closeModal();renderTasks();renderCalendar();renderProjectWorkspace();showToast('项目关联已更新')}
function milestoneModal(){showModal(`<div class="modal-icon">◆</div><h2>添加项目里程碑</h2><p>记录样机、投稿、验收或交付等关键节点。</p><div class="form-grid"><div class="form-field full"><label>里程碑</label><input id="milestoneTitle" placeholder="例如：完成第一版样机"></div><div class="form-field"><label>计划日期</label><input id="milestoneDate" type="date" value="${localDateKey()}"></div><div class="form-field"><label>状态</label><select id="milestoneStatus"><option value="planned">计划中</option><option value="done">已完成</option></select></div><div class="form-field full"><label>说明</label><textarea id="milestoneNotes" rows="3"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-milestone">保存</button></div>`)}
async function saveMilestone(){const project=projects.find(item=>String(item.id)===String(activeProjectId));const title=$('#milestoneTitle')?.value.trim();if(!project||!title){showToast('请输入里程碑名称');return}ensureProjectSchema(project);project.milestones.push({id:`milestone-${Date.now()}`,title,dueDate:$('#milestoneDate')?.value||'',status:$('#milestoneStatus')?.value||'planned',notes:$('#milestoneNotes')?.value.trim()||'',createdAt:new Date().toISOString()});project.updatedAt=new Date().toISOString();await saveState(['projects']);closeModal();renderProjectWorkspace();showToast('里程碑已添加')}
function issueModal(){showModal(`<div class="modal-icon">!</div><h2>记录项目问题</h2><p>集中跟踪技术障碍、风险和待解决事项。</p><div class="form-grid"><div class="form-field full"><label>问题</label><input id="issueTitle" placeholder="一句话说明问题"></div><div class="form-field"><label>严重程度</label><select id="issueSeverity"><option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option><option value="critical">严重</option></select></div><div class="form-field"><label>状态</label><select id="issueStatus"><option value="open">待解决</option><option value="resolved">已解决</option></select></div><div class="form-field full"><label>补充说明</label><textarea id="issueNotes" rows="3"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-issue">保存</button></div>`)}
async function saveIssue(){const project=projects.find(item=>String(item.id)===String(activeProjectId));const title=$('#issueTitle')?.value.trim();if(!project||!title){showToast('请输入问题内容');return}ensureProjectSchema(project);project.issues.unshift({id:`issue-${Date.now()}`,title,severity:$('#issueSeverity')?.value||'medium',status:$('#issueStatus')?.value||'open',notes:$('#issueNotes')?.value.trim()||'',createdAt:new Date().toISOString()});project.updatedAt=new Date().toISOString();await saveState(['projects']);closeModal();renderProjectWorkspace();showToast('问题已记录')}
function decisionModal(){showModal(`<div class="modal-icon">◇</div><h2>记录项目决策</h2><p>记录最终采用的方案以及做出选择的原因。</p><div class="form-grid"><div class="form-field"><label>日期</label><input id="decisionDate" type="date" value="${localDateKey()}"></div><div class="form-field"><label>决策主题</label><input id="decisionTitle" placeholder="例如：主控芯片选型"></div><div class="form-field full"><label>最终决定</label><textarea id="decisionText" rows="3" placeholder="采用什么方案？"></textarea></div><div class="form-field full"><label>原因与权衡</label><textarea id="decisionRationale" rows="3" placeholder="为什么这样决定？放弃了哪些方案？"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="project-save-decision">保存</button></div>`)}
async function saveDecision(){const project=projects.find(item=>String(item.id)===String(activeProjectId));const title=$('#decisionTitle')?.value.trim();const decision=$('#decisionText')?.value.trim();if(!project||!title||!decision){showToast('请填写决策主题和最终决定');return}ensureProjectSchema(project);project.decisions.unshift({id:`decision-${Date.now()}`,date:$('#decisionDate')?.value||localDateKey(),title,decision,rationale:$('#decisionRationale')?.value.trim()||'',createdAt:new Date().toISOString()});project.updatedAt=new Date().toISOString();await saveState(['projects']);closeModal();renderProjectWorkspace();showToast('决策记录已保存')}

function eventModal(eventId=null,defaultProjectId=''){
  const event=eventId?events.find(item=>String(item.id)===String(eventId)):null;editingEventId=event?.id||null;
  const now=new Date();const roundedMinutes=Math.ceil(now.getMinutes()/30)*30;now.setMinutes(roundedMinutes,0,0);const later=new Date(now.getTime()+60*60*1000);
  const currentWeekEnd=new Date(calendarStart);currentWeekEnd.setDate(currentWeekEnd.getDate()+6);const today=new Date();today.setHours(0,0,0,0);const defaultDate=today>=calendarStart&&today<=currentWeekEnd?localDateKey(today):localDateKey(calendarStart);
  const start=event?.startTime||`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;const end=event?.endTime||`${String(later.getHours()).padStart(2,'0')}:${String(later.getMinutes()).padStart(2,'0')}`;
  const projectId=event?.projectId||defaultProjectId||'';
  showModal(`<div class="modal-icon">◷</div><h2>${event?'编辑日程':'新建日程'}</h2><p>填写明确的开始和结束时间，保存后会显示在周时间轴中。</p><div class="form-grid"><div class="form-field full"><label>日程名称</label><input id="eventTitle" value="${h(event?.title||'')}" placeholder="例如：组会、实验或产品讨论"></div><div class="form-field full"><label>日期</label><input id="eventDate" type="date" value="${h(event?.date||defaultDate)}"></div><div class="form-field"><label>开始时间</label><input id="eventStart" type="time" step="300" value="${h(start)}"></div><div class="form-field"><label>结束时间</label><input id="eventEnd" type="time" step="300" value="${h(end)}"></div><div class="form-field"><label>类型</label><select id="eventCategory"><option value="research" ${event?.category==='research'?'selected':''}>科研 / 学习</option><option value="meeting" ${event?.category==='meeting'?'selected':''}>会议</option><option value="experiment" ${event?.category==='experiment'?'selected':''}>实验</option><option value="personal" ${event?.category==='personal'?'selected':''}>个人事务</option><option value="other" ${!event||event?.category==='other'?'selected':''}>其他</option></select></div><div class="form-field"><label>地点</label><input id="eventLocation" value="${h(event?.location||'')}" placeholder="可选"></div><div class="form-field full"><label>关联项目</label><select id="eventProject"><option value="">不关联项目</option>${projects.map(project=>`<option value="${h(project.id)}" ${String(project.id)===String(projectId)?'selected':''}>${h(project.name)}</option>`).join('')}</select></div><div class="form-field full"><label>补充说明</label><textarea id="eventNotes" rows="3" placeholder="需要准备什么，或希望 AI 理解的上下文…">${h(event?.notes||'')}</textarea></div></div><div class="modal-actions">${event?'<button class="danger-modal-btn" data-event-delete="'+h(event.id)+'">删除</button>':''}<button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-event">${event?'保存修改':'确认创建'}</button></div>`);setTimeout(()=>$('#eventTitle')?.focus(),100)
}

async function saveEvent(){
  const title=$('#eventTitle')?.value.trim();const date=$('#eventDate')?.value;const startTime=$('#eventStart')?.value;const endTime=$('#eventEnd')?.value;
  if(!title){showToast('请输入日程名称');return}if(!date||!startTime||!endTime){showToast('请填写完整的日期和时间');return}if(timeMinutes(endTime)<=timeMinutes(startTime)){showToast('结束时间必须晚于开始时间');return}
  const oldEvent=editingEventId?events.find(item=>String(item.id)===String(editingEventId)):null;
  const next={id:editingEventId||Date.now(),title,date,startTime,endTime,category:$('#eventCategory')?.value||'other',projectId:$('#eventProject')?.value||null,location:$('#eventLocation')?.value.trim()||'',notes:$('#eventNotes')?.value.trim()||'',createdAt:oldEvent?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const conflict=events.some(item=>eventsOverlap(next,item));if(editingEventId)events=events.map(item=>String(item.id)===String(editingEventId)?next:item);else events.push(next);
  calendarStart=getWeekStart(new Date(`${date}T00:00:00`));renderCalendar();await saveState(['events']);closeModal();if($('#project-detail').classList.contains('active'))renderProjectWorkspace();editingEventId=null;showToast(conflict?'日程已保存，但与同日其他安排有重叠':'日程已保存并显示在时间轴')
}

function memoryModal(){
  showModal(`<div class="modal-icon">◉</div><h2>添加一条长期记忆</h2><p>这条内容会保存在本机，并在相关的 AI 对话中作为上下文使用。</p><div class="form-grid"><div class="form-field full"><label>希望 AI 记住什么？</label><textarea id="primaryField" rows="4" placeholder="例如：我更喜欢上午安排需要深度思考的科研任务。"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-confirm="memory">确认记住</button></div>`);
  setTimeout(()=>$('#primaryField')?.focus(),100);
}

function dailyPlan(){openAssistantPreset('today','根据我今天的真实任务和日程，帮我安排接下来应该怎么做。')}

function notificationsModal(){const open=tasks.filter(t=>!t.done);const low=inventory.filter(p=>Number(p.qty)<=2);const rows=[...open.slice(0,3).map(t=>`<div class="result-row"><b>待办</b><span>${h(t.title)}</span><span>${h(taskDateLabel(t))}</span></div>`),...low.slice(0,3).map(p=>`<div class="result-row"><b>库存</b><span>${h(p.name)}</span><span>剩余 ${p.qty}</span></div>`)];showModal(`<div class="modal-icon">♢</div><h2>通知</h2><p>这里只显示根据真实任务和库存生成的提醒。</p>${rows.length?`<div class="result-box">${rows.join('')}</div>`:'<div class="empty-state small"><b>目前没有通知</b><small>新增待办或库存记录后，相关提醒会出现在这里</small></div>'}<div class="modal-actions"><button class="confirm" data-action="read-notifications">全部已读</button></div>`)}

async function profileModal(){
  try{appUpdateStatus=await window.orbito?.getUpdateStatus()||appUpdateStatus}catch(error){console.error(error)}
  const updateCopy=appUpdateStatus.state==='available'?`发现 v${appUpdateStatus.availableVersion}`:appUpdateStatus.state==='downloaded'?`v${appUpdateStatus.availableVersion} 已下载`:appUpdateStatus.state==='up-to-date'?'当前已是最新版':`当前版本 v${appUpdateStatus.currentVersion||'—'}`;
  showModal(`<div class="modal-icon">XY</div><h2>我的工作区</h2><p>当前为单人、本地优先模式。账户与多端同步将在后续版本加入。</p><div class="result-box"><p><b>后台智能服务：</b>${aiConfigured?'已配置':'尚未配置'}</p><p><b>数据存储：</b>本机应用数据目录</p><p><b>长期记忆：</b>${memories.length} 条</p><p><b>未完成任务：</b>${tasks.filter(t=>!t.done).length} 项</p></div><div class="workspace-settings"><button type="button" data-action="api-settings"><span>🔑</span><div><b>后台智能服务</b><small>${aiConfigured?'用于截图识别、论文检索与每日情报':'配置后启用后台识别与检索'}</small></div><i>›</i></button><button type="button" data-action="app-update"><span>↻</span><div><b>版本与更新</b><small>${h(updateCopy)}</small></div><i>›</i></button></div><div class="modal-actions"><button class="cancel" data-action="show-data">打开数据位置</button><button class="confirm" data-action="close-modal">完成</button></div>`)
}

function formatUpdateBytes(value){const bytes=Math.max(0,Number(value)||0);if(!bytes)return'0 MB';if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/1024/1024).toFixed(1)} MB`}
function updatePanelMarkup(status=appUpdateStatus){
  const state=status.state||'idle';const current=h(status.currentVersion||'—');const available=h(status.availableVersion||'');
  if(state==='checking')return`<div class="update-state"><span class="update-spinner">↻</span><b>正在检查更新</b><p>正在连接 GitHub Releases，请稍候。</p></div><div class="modal-actions"><button class="cancel" data-action="close-modal">后台继续</button></div>`;
  if(state==='available')return`<div class="update-state available"><span>↑</span><b>发现新版本 v${available}</b><p>当前版本 v${current}。是否现在下载更新？</p></div>${status.releaseNotes?`<div class="update-notes"><b>更新说明</b><p>${h(status.releaseNotes).replace(/\n/g,'<br>')}</p></div>`:''}<div class="modal-actions"><button class="cancel" data-action="close-modal">稍后</button><button class="confirm" data-action="update-download">下载更新</button></div>`;
  if(state==='downloading'){const percent=Math.max(0,Math.min(100,Number(status.percent)||0));return`<div class="update-state"><span>↓</span><b>正在下载 v${available||current}</b><p>${percent.toFixed(1)}% · ${formatUpdateBytes(status.transferred)} / ${formatUpdateBytes(status.total)}${status.bytesPerSecond?` · ${formatUpdateBytes(status.bytesPerSecond)}/s`:''}</p></div><div class="update-progress"><i style="width:${percent}%"></i></div><div class="modal-actions"><button class="cancel" data-action="close-modal">后台下载</button><button class="confirm" disabled>下载中…</button></div>`}
  if(state==='downloaded')return`<div class="update-state downloaded"><span>✓</span><b>v${available||current} 已准备好</b><p>重启 hacher 后安装更新。工作台数据不会被删除。</p></div><div class="modal-actions"><button class="cancel" data-action="close-modal">稍后安装</button><button class="confirm" data-action="update-install">立即重启安装</button></div>`;
  if(state==='up-to-date')return`<div class="update-state downloaded"><span>✓</span><b>当前已是最新版</b><p>当前版本 v${current}。</p></div><div class="modal-actions"><button class="cancel" data-action="profile">返回</button><button class="confirm" data-action="update-check">重新检查</button></div>`;
  if(state==='unsupported')return`<div class="update-state error"><span>!</span><b>当前版本无法在线更新</b><p>${h(status.error||'请安装正式发布版后使用在线更新。')}</p></div><div class="modal-actions"><button class="confirm" data-action="close-modal">知道了</button></div>`;
  if(state==='error')return`<div class="update-state error"><span>!</span><b>检查更新失败</b><p>${h(status.error||'暂时无法连接更新服务，请稍后重试。')}</p></div><div class="modal-actions"><button class="cancel" data-action="profile">返回</button><button class="confirm" data-action="update-check">重试</button></div>`;
  return`<div class="update-state"><span>↻</span><b>检查 hacher 更新</b><p>当前版本 v${current}。只有在你确认后才会下载和安装。</p></div><div class="modal-actions"><button class="cancel" data-action="profile">返回</button><button class="confirm" data-action="update-check">检查更新</button></div>`
}
function renderAppUpdateStatus(status){appUpdateStatus={...appUpdateStatus,...status};const panel=$('#updatePanel');if(panel)panel.innerHTML=updatePanelMarkup(appUpdateStatus)}
async function appUpdateModal(){try{appUpdateStatus=await window.orbito?.getUpdateStatus()||appUpdateStatus}catch(error){appUpdateStatus={...appUpdateStatus,state:'error',error:error.message||String(error)}}showModal(`<div class="modal-icon">↻</div><h2>版本与更新</h2><p>更新由 GitHub Releases 提供。hacher 不会未经确认自动安装。</p><div id="updatePanel">${updatePanelMarkup(appUpdateStatus)}</div>`)}
async function checkAppUpdate(){renderAppUpdateStatus({state:'checking',error:''});try{const status=await window.orbito?.checkForUpdates();if(status)renderAppUpdateStatus(status)}catch(error){renderAppUpdateStatus({state:'error',error:error.message||String(error)})}}
async function downloadAppUpdate(){renderAppUpdateStatus({state:'downloading',percent:0,error:''});try{const status=await window.orbito?.downloadUpdate();if(status)renderAppUpdateStatus(status)}catch(error){renderAppUpdateStatus({state:'error',error:error.message||String(error)})}}
async function installAppUpdate(){if(!window.confirm('立即关闭 hacher 并安装更新？'))return;try{const result=await window.orbito?.installUpdate();if(result&&!result.ok)showToast(result.error||'更新尚未准备好')}catch(error){showToast('启动安装失败：'+(error.message||error))}}

async function apiSettingsModal(){
  let status={configured:aiConfigured,model:'qwen3.7-plus'};
  try{status=await window.orbito?.getAIStatus()||status}catch(error){console.error(error)}
  showModal(`<div class="modal-icon">🔑</div><h2>后台智能服务设置</h2><p>用于截图识别、论文检索词生成和每日情报。API Key 只保存在当前 Windows 用户的本机配置中，不会写入项目数据或上传到 GitHub。</p><div class="api-status ${status.configured?'connected':''}"><span></span><b>${status.configured?'已连接':'尚未配置'}</b><small>${status.configured?'留空 Key 可保留当前配置':'支持旧版 sk- 与新版 sk-ws- Key'}</small></div><div class="form-grid"><div class="form-field full"><label>阿里云百炼 API Key</label><input id="apiSettingsKey" type="password" placeholder="${status.configured?'已保存，如需更换请填写新 Key':'sk-ws-… 或 sk-…'}" autocomplete="new-password" spellcheck="false"></div><div class="form-field full"><label>后台模型</label><input id="apiSettingsModel" value="${h(status.model||'qwen3.7-plus')}" placeholder="qwen3.7-plus" spellcheck="false"></div></div><a class="api-help-link" href="https://bailian.console.aliyun.com/#/api-key" target="_blank" rel="noreferrer">前往阿里云百炼获取 API Key →</a><div class="modal-actions">${status.configured?'<button class="danger-modal-btn" data-action="clear-api-key">清除 Key</button>':''}<button class="cancel" data-action="profile">返回</button><button class="confirm" data-action="save-api-settings">保存配置</button></div>`);
  setTimeout(()=>$('#apiSettingsKey')?.focus(),100);
}

async function refreshAIStatus(){
  const status=await window.orbito.getAIStatus();
  aiConfigured=status.configured;
  $('#aiSetup')?.classList.toggle('show',!status.configured);
  return status;
}

async function saveAPISettings(){
  const button=$('[data-action="save-api-settings"]');
  const key=$('#apiSettingsKey')?.value.trim()||'';const model=$('#apiSettingsModel')?.value.trim()||'';
  if(button){button.disabled=true;button.textContent='保存中…'}
  try{
    const result=await window.orbito.saveAISettings({key,model});
    if(!result.ok){showToast(result.error||'保存失败');return}
    await refreshAIStatus();showToast('API 配置已保存并立即生效');profileModal();
  }catch(error){showToast('保存失败：'+error.message)}finally{if(button){button.disabled=false;button.textContent='保存配置'}}
}

async function clearAPIKey(){
  if(!window.confirm('确定清除本机保存的后台服务 API Key？清除后截图识别和情报检索将不可用。'))return;
  try{const result=await window.orbito.clearAIKey();if(!result.ok){showToast(result.error||'清除失败');return}await refreshAIStatus();showToast('API Key 已从本机清除');apiSettingsModal()}catch(error){showToast('清除失败：'+error.message)}
}

function searchModal(){const items=[...tasks.map(t=>`<button data-view-link="today">${h(t.title)} <small>待办</small></button>`),...inventory.map(p=>`<button data-view-link="inventory">${h(p.name)} <small>元件</small></button>`)];showModal(`<div class="modal-icon">⌕</div><h2>全局搜索</h2><p>只搜索已经录入工作台的真实内容。</p><div class="form-field full"><input id="searchInput" placeholder="输入关键词…"></div>${items.length?`<div class="result-box search-results">${items.join('')}</div>`:'<div class="empty-state small"><b>还没有可搜索的数据</b><small>先创建任务、项目或库存记录</small></div>'}<div class="modal-actions"><button class="confirm" data-action="close-modal">关闭</button></div>`);setTimeout(()=>$('#searchInput')?.focus(),100)}

function paperSearchModal(){showModal(`<div class="modal-icon">⌕</div><h2>搜索最新论文</h2><p>输入研究主题后，AI 将实时查询 arXiv，并且只依据真实返回结果回答。</p><div class="form-field full"><label>研究主题</label><input id="paperTopic" value="大模型不确定性量化" placeholder="例如：大模型不确定性量化"></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="execute-paper-search">开始搜索</button></div>`);setTimeout(()=>$('#paperTopic')?.focus(),100)}
async function executePaperSearch(){const topic=$('#paperTopic')?.value?.trim();if(!topic){showToast('请输入研究主题');return}showModal(`<div class="modal-icon">⌕</div><h2>正在检索真实论文</h2><p>后台服务正在生成检索词并查询 arXiv，请稍候。</p><div class="result-box"><p>检索主题：${h(topic)}</p></div>`);try{const result=await window.orbito?.chat({messages:[{role:'user',content:`搜索与“${topic}”相关的最新论文，只返回本次真实检索结果。`}],context:'论文与科研',tasks:[],inventory:[]});const text=h(result?.text||'本次检索没有返回结果').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noreferrer">$1</a>').replace(/\n/g,'<br>');showModal(`<div class="modal-icon">⌕</div><h2>论文检索结果</h2><p>以下内容来自本次真实 arXiv 查询。</p><div class="result-box paper-search-output">${text}</div><div class="modal-actions"><button class="confirm" data-action="close-modal">完成</button></div>`,true)}catch(error){showModal(`<div class="modal-icon">!</div><h2>检索失败</h2><p>${h(error.message||error)}</p><div class="modal-actions"><button class="confirm" data-action="close-modal">关闭</button></div>`)}}

function addTopicModal(){showModal(`<div class="modal-icon">✦</div><h2>添加关注主题</h2><p>输入你感兴趣的研究方向，系统会自动搜索 arXiv 论文和网页资讯。</p><div class="form-field full"><label>主题名称</label><input id="primaryField" placeholder="例如：大模型不确定性量化"></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-confirm="topic">添加主题</button></div>`);setTimeout(()=>$('#primaryField')?.focus(),100)}

function englishPlanModal(){
  showModal(`<div class="modal-icon">A</div><h2>创建英语学习计划</h2><p>设置一个可以真正执行和记录的学习节奏，之后可以随时继续完善。</p><div class="form-grid"><div class="form-field full"><label>计划名称</label><input id="englishPlanName" value="我的英语学习计划" placeholder="例如：科研英语提升"></div><div class="form-field"><label>当前水平</label><select id="englishPlanLevel"><option value="入门 / A1-A2">入门 / A1-A2</option><option value="中级 / B1-B2" selected>中级 / B1-B2</option><option value="进阶 / C1-C2">进阶 / C1-C2</option><option value="暂不确定">暂不确定</option></select></div><div class="form-field"><label>主要目标</label><select id="englishPlanGoal"><option value="论文阅读" selected>论文阅读</option><option value="学术写作">学术写作</option><option value="口语交流">口语交流</option><option value="词汇积累">词汇积累</option><option value="听力训练">听力训练</option><option value="综合提升">综合提升</option></select></div><div class="form-field"><label>每日学习时间（分钟）</label><input id="englishPlanMinutes" type="number" min="5" max="240" step="5" value="30"></div><div class="form-field"><label>每周学习天数</label><input id="englishPlanDays" type="number" min="1" max="7" step="1" value="5"></div><div class="form-field full"><label>补充说明</label><textarea id="englishPlanNotes" rows="3" placeholder="例如：重点积累论文中的术语和表达，每周完成一次英文摘要练习。"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-english-plan">确认创建</button></div>`);
  setTimeout(()=>$('#englishPlanName')?.focus(),100);
}

async function createEnglishPlan(){
  const name=$('#englishPlanName')?.value.trim();if(!name){showToast('请输入计划名称');return}
  const minutes=Math.max(5,Math.min(240,Number($('#englishPlanMinutes')?.value)||30));
  const days=Math.max(1,Math.min(7,Number($('#englishPlanDays')?.value)||5));
  englishPlans.unshift({id:Date.now(),name,level:$('#englishPlanLevel')?.value||'暂不确定',goal:$('#englishPlanGoal')?.value||'综合提升',minutesPerDay:minutes,daysPerWeek:days,notes:$('#englishPlanNotes')?.value.trim()||'',sessions:[],createdAt:new Date().toISOString()});
  renderEnglishPlans();await saveState(['englishPlans']);closeModal();showToast('英语学习计划已创建');
}

async function createTopic(name){
  if(!window.orbito){showToast('每日情报只在桌面应用中可用');return}
  try{
    const result=await window.orbito.addTopic(name);
    const state=await window.orbito.getState();
    topics=Array.isArray(state.topics)?state.topics:[];
    activeTopicId=result.topic.id;
    renderTopicCards();renderTopicResults();
    if(!result.created){showToast('这个主题已经存在');return}
    showToast('主题已添加，正在搜索…');
    try{await window.orbito.generateTopicBriefing(result.topic.id)}catch(error){showToast(error.message||'主题已添加，但搜索失败')}
    const updatedState=await window.orbito.getState();
    topics=Array.isArray(updatedState.topics)?updatedState.topics:[];
    renderTopicCards();renderTopicResults();
  }catch(error){showToast('添加主题失败：'+error.message)}
}

async function removeTopic(id){
  try{
    const result=await window.orbito.deleteTopic(id);
    topics=Array.isArray(result.topics)?result.topics:[];
    if(activeTopicId===id)activeTopicId=topics[0]?.id||null;
    renderTopicCards();renderTopicResults();
    showToast(result.ok?'主题已删除':'主题已经不存在');
  }catch(error){showToast('删除主题失败：'+error.message)}
}

function setAttachment(file){
  if(!file)return;
  if(!file.type.startsWith('image/')){showToast('当前版本的 AI 对话先支持图片文件');return}
  if(file.size>10*1024*1024){showToast('图片不能超过 10 MB');return}
  const reader=new FileReader();
  reader.onload=()=>{
    pendingAttachment={name:file.name,type:file.type,dataUrl:reader.result};
    $('#attachmentPreview').src=reader.result;$('#attachmentName').textContent=file.name;$('#chatAttachment').hidden=false;
  };
  reader.onerror=()=>showToast('图片读取失败，请换一张重试');
  reader.readAsDataURL(file);
}

function removeAttachment(){pendingAttachment=null;$('#chatAttachment').hidden=true;$('#attachmentPreview').removeAttribute('src');$('#chatFileInput').value=''}

async function simulateAI(text, attachment=null){
  const chat=$('#chat');
  const prompt=text||'请分析这张图片，并告诉我其中有哪些值得记录的信息。';
  const attachmentMarkup=attachment?`<div class="user-attachment"><span>图</span><small>${h(attachment.name)}</small></div>`:'';
  chat.insertAdjacentHTML('beforeend',`<div class="user-message"><div>${attachmentMarkup}${h(prompt)}</div></div>`);
  const apiContent=attachment?[{type:'text',text:prompt},{type:'image_url',image_url:{url:attachment.dataUrl}}]:prompt;
  const apiMessages=[...conversations.slice(-15).map(m=>({role:m.role,content:m.content})),{role:'user',content:apiContent}];
  conversations.push({role:'user',content:prompt,attachmentName:attachment?.name||null,createdAt:new Date().toISOString()});
  const explicitMemory=prompt.match(/(?:请)?记住[：,:，]?\s*(.+)/);
  if(explicitMemory && !memories.some(m=>m.text===explicitMemory[1])){
    memories.push({text:explicitMemory[1],source:'对话中明确要求',createdAt:new Date().toISOString()});
    renderMemories();
    await saveState(['memories','conversations']);
    showToast('已加入长期记忆');
  }
  const typingId=`typing-${Date.now()}`;
  chat.insertAdjacentHTML('beforeend',`<div class="ai-message" id="${typingId}"><span>✦</span><div><span class="typing"><i></i><i></i><i></i></span></div></div>`);
  chat.scrollTop=chat.scrollHeight;
  let reply='';
  try{
    if(window.orbito && aiConfigured){
      const result=await window.orbito.chat({messages:apiMessages,context:$('#aiContext').textContent,tasks,inventory});
      reply=result.text;
    }else{
      await new Promise(r=>setTimeout(r,550));
      reply='当前处于离线演示模式。检测到千问 API 后，我会结合你的本地任务、库存和长期记忆回答。';
      if(attachment)reply='当前处于离线模式，图片已经读取成功，但没有执行识别。连接千问后才能分析图片。';
      else reply='当前处于离线模式，我没有调用千问，也没有查询或修改任何数据。';
    }
  }catch(error){reply=`连接千问时遇到问题：${error.message || error}`}
  document.getElementById(typingId)?.remove();
  chat.insertAdjacentHTML('beforeend',`<div class="ai-message"><span>✦</span><div><p>${h(reply).replace(/\n/g,'</p><p>')}</p></div></div>`);
  conversations.push({role:'assistant',content:reply,createdAt:new Date().toISOString()});
  await saveState(['conversations']);
  chat.scrollTop=chat.scrollHeight;
}

document.addEventListener('click',e=>{
  const inboxFilterButton=e.target.closest('[data-inbox-filter]');if(inboxFilterButton){inboxFilter=inboxFilterButton.dataset.inboxFilter;renderInbox();return}
  const mailProcess=e.target.closest('[data-mail-process]');if(mailProcess){e.stopPropagation();toggleMailProcessed(mailProcess.dataset.mailProcess);return}
  const mailOpen=e.target.closest('[data-mail-open]');if(mailOpen){openMailDetail(mailOpen.dataset.mailOpen);return}
  const agentSuggestion=e.target.closest('[data-agent-suggestion]');if(agentSuggestion){$('#agentRequestInput').value=agentSuggestion.dataset.agentSuggestion;$('#agentRequestInput').focus();return}
  const aiPane=e.target.closest('[data-ai-pane]');if(aiPane){setAIPane(aiPane.dataset.aiPane);return}
  const aiTaskSelect=e.target.closest('[data-ai-task-select]');if(aiTaskSelect){activeAITaskId=aiTaskSelect.dataset.aiTaskSelect;renderAITaskCenter();return}
  const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);return}
  const link=e.target.closest('[data-view-link]');if(link){closeModal();switchView(link.dataset.viewLink);return}
  const taskFilterButton=e.target.closest('[data-task-filter]');if(taskFilterButton){taskFilter=taskFilterButton.dataset.taskFilter;$$('[data-task-filter]').forEach(b=>b.classList.toggle('active',b===taskFilterButton));renderTasks();return}
  const projectTab=e.target.closest('[data-project-tab]');if(projectTab){activeProjectTab=projectTab.dataset.projectTab;renderProjectWorkspace();return}
  const projectTabJump=e.target.closest('[data-project-tab-jump]');if(projectTabJump){activeProjectTab=projectTabJump.dataset.projectTabJump;renderProjectWorkspace();return}
  const projectFilterButton=e.target.closest('[data-project-filter]');if(projectFilterButton){projectFilter=projectFilterButton.dataset.projectFilter;$$('[data-project-filter]').forEach(b=>b.classList.toggle('active',b===projectFilterButton));renderProjects();return}
  const projectEdit=e.target.closest('[data-project-edit]');if(projectEdit){e.stopPropagation();projectModal('',projectEdit.dataset.projectEdit);return}
  const projectOpen=e.target.closest('[data-project-open]');if(projectOpen){projectDetailModal(projectOpen.dataset.projectOpen);return}
  const projectFileOpen=e.target.closest('[data-project-file-open]');if(projectFileOpen){window.orbito?.openProjectFile(activeProjectId,projectFileOpen.dataset.projectFileOpen).then(result=>{if(!result?.ok)showToast(result?.error||'无法打开文件')});return}
  const projectFileRemove=e.target.closest('[data-project-file-remove]');if(projectFileRemove){const project=projects.find(item=>String(item.id)===String(activeProjectId));const file=project?.files?.find(item=>String(item.id)===projectFileRemove.dataset.projectFileRemove);if(file&&window.confirm(`从项目中移除“${file.name}”？${file.mode==='import'?'项目资料库中的副本也会删除。':'电脑上的原文件不会删除。'}`)){window.orbito?.removeProjectFile(project.id,file.id).then(result=>{if(result?.ok){projects=result.state.projects;renderProjects();projectDetailModal(project.id);showToast('项目文件已移除')}else showToast(result?.error||'移除失败')})}return}
  const projectLogDelete=e.target.closest('[data-project-log-delete]');if(projectLogDelete){deleteProjectLog(projectLogDelete);return}
  const bomRemove=e.target.closest('[data-bom-remove]');if(bomRemove){const project=projects.find(item=>String(item.id)===String(activeProjectId));if(project&&window.confirm('确定从项目 BOM 中移除这项物料？')){project.bom=project.bom.filter(item=>String(item.id)!==bomRemove.dataset.bomRemove);project.updatedAt=new Date().toISOString();saveState(['projects']);renderProjectWorkspace();showToast('BOM 物料已移除')}return}
  const milestoneToggle=e.target.closest('[data-milestone-toggle]');if(milestoneToggle){const project=projects.find(item=>String(item.id)===String(activeProjectId));const item=project?.milestones?.find(value=>String(value.id)===milestoneToggle.dataset.milestoneToggle);if(item){item.status=item.status==='done'?'planned':'done';item.completedAt=item.status==='done'?new Date().toISOString():null;project.updatedAt=new Date().toISOString();saveState(['projects']);renderProjectWorkspace()}return}
  const issueToggle=e.target.closest('[data-issue-toggle]');if(issueToggle){const project=projects.find(item=>String(item.id)===String(activeProjectId));const item=project?.issues?.find(value=>String(value.id)===issueToggle.dataset.issueToggle);if(item){item.status=item.status==='resolved'?'open':'resolved';item.resolvedAt=item.status==='resolved'?new Date().toISOString():null;project.updatedAt=new Date().toISOString();saveState(['projects']);renderProjectWorkspace()}return}
  const governanceRemove=e.target.closest('[data-governance-remove]');if(governanceRemove){const project=projects.find(item=>String(item.id)===String(activeProjectId));const [collection,id]=governanceRemove.dataset.governanceRemove.split(':');if(project&&['milestones','issues','decisions'].includes(collection)&&window.confirm('确定删除这条记录？')){project[collection]=project[collection].filter(item=>String(item.id)!==String(id));project.updatedAt=new Date().toISOString();saveState(['projects']);renderProjectWorkspace()}return}
  const projectDelete=e.target.closest('[data-project-delete]');if(projectDelete){const project=projects.find(item=>String(item.id)===projectDelete.dataset.projectDelete);if(project&&window.confirm(`确定删除项目“${project.name}”？关联任务、日程和论文会保留，但取消项目关联。`)){projects=projects.filter(item=>String(item.id)!==projectDelete.dataset.projectDelete);tasks.forEach(item=>{if(String(item.projectId)===String(project.id))item.projectId=null});events.forEach(item=>{if(String(item.projectId)===String(project.id))item.projectId=null});papers.forEach(item=>{item.projectIds=(item.projectIds||[]).filter(id=>String(id)!==String(project.id))});renderProjects();renderTasks();saveState(['projects','tasks','events','papers']);closeModal();switchView('projects');editingProjectId=null;showToast('项目已删除，关联内容已保留')}return}
  const calendarButton=e.target.closest('[data-calendar]');if(calendarButton){if(calendarButton.dataset.calendar==='today')calendarStart=getWeekStart();else calendarStart.setDate(calendarStart.getDate()+(calendarButton.dataset.calendar==='next'?7:-7));renderCalendar();return}
  const calendarEvent=e.target.closest('[data-calendar-event]');if(calendarEvent){eventModal(calendarEvent.dataset.calendarEvent);return}
  const eventDelete=e.target.closest('[data-event-delete]');if(eventDelete){const event=events.find(item=>String(item.id)===eventDelete.dataset.eventDelete);if(event&&window.confirm(`确定删除日程“${event.title}”？`)){events=events.filter(item=>String(item.id)!==eventDelete.dataset.eventDelete);renderCalendar();saveState(['events']);closeModal();if($('#project-detail').classList.contains('active'))renderProjectWorkspace();showToast('日程已删除')}return}
  const task=e.target.closest('[data-task]');if(task){const t=tasks.find(x=>x.id==task.dataset.task);if(!t)return;t.done=!t.done;t.completedAt=t.done?new Date().toISOString():null;renderTasks();saveState(['tasks']);if($('#project-detail').classList.contains('active'))renderProjectWorkspace();showToast(t.done?'任务已完成，已移至“已完成”':'任务已恢复');return}
  const qty=e.target.closest('[data-qty]');if(qty){const p=inventory[+qty.dataset.qty];p.qty=Math.max(0,p.qty+(+qty.dataset.delta));renderInventory();saveState(['inventory']);return}
  const partEdit=e.target.closest('[data-part-edit]');if(partEdit){partEditModal(+partEdit.dataset.partEdit);return}
  const zero=e.target.closest('[data-zero]');if(zero){inventory[+zero.dataset.zero].qty=0;renderInventory();saveState(['inventory']);showToast('库存已设为 0');return}
  const memoryDelete=e.target.closest('[data-memory-delete]');if(memoryDelete){memories.splice(+memoryDelete.dataset.memoryDelete,1);renderMemories();saveState(['memories']);showToast('记忆已删除');return}
  const englishComplete=e.target.closest('[data-english-complete]');if(englishComplete){const plan=englishPlans.find(item=>item.id==englishComplete.dataset.englishComplete);if(plan){if(!Array.isArray(plan.sessions))plan.sessions=[];const today=localDateKey();const index=plan.sessions.findIndex(session=>session.date===today);if(index>=0)plan.sessions.splice(index,1);else plan.sessions.push({date:today,minutes:Number(plan.minutesPerDay)||0,createdAt:new Date().toISOString()});renderEnglishPlans();saveState(['englishPlans']);showToast(index>=0?'已取消今日记录':'今日学习已记录');}return}
  const englishDelete=e.target.closest('[data-english-delete]');if(englishDelete){const id=+englishDelete.dataset.englishDelete;const plan=englishPlans.find(item=>item.id===id);if(plan&&window.confirm(`确定删除学习计划"${plan.name}"？`)){englishPlans=englishPlans.filter(item=>item.id!==id);renderEnglishPlans();saveState(['englishPlans']);showToast('学习计划已删除');}return}
  const paperOpen=e.target.closest('[data-paper-open]');if(paperOpen){window.orbito?.openPaper(paperOpen.dataset.paperOpen).then(result=>{if(!result?.ok)showToast(result?.error||'无法打开论文')});return}
  const paperDelete=e.target.closest('[data-paper-delete]');if(paperDelete){const paper=papers.find(item=>String(item.id)===paperDelete.dataset.paperDelete);if(paper&&window.confirm(`确定删除论文“${paper.title}”？本地论文库中的 PDF 文件也会被删除。`)){window.orbito?.deletePaper(paper.id).then(result=>{if(result?.ok){papers=result.state.papers;renderPapers();showToast('论文已删除')}else showToast(result?.error||'删除论文失败')}).catch(error=>showToast(`删除论文失败：${error.message||error}`))}return}
  const topicDelete=e.target.closest('[data-topic-delete]');if(topicDelete){e.stopPropagation();const id=+topicDelete.dataset.topicDelete;const t=topics.find(x=>x.id===id);if(t&&window.confirm(`确定删除主题"${t.name}"？相关搜索结果也会一并删除。`))removeTopic(id);return}
  const topicCard=e.target.closest('[data-topic-id]');if(topicCard){const id=+topicCard.dataset.topicId;activeTopicId=activeTopicId===id?null:id;renderTopicCards();renderTopicResults();return}
  const confirmButton=e.target.closest('[data-confirm]');if(confirmButton){
    const type=confirmButton.dataset.confirm;const value=$('#primaryField')?.value?.trim();
    if(type==='task'&&value)tasks.unshift({id:Date.now(),title:value,meta:'手动创建',time:'今天',scheduledDate:localDateKey(),projectId:$('#secondaryField')?.value||null,done:false,createdAt:new Date().toISOString()});
    if(type==='part'&&value)inventory.unshift({name:value,category:'未分类',spec:'待补充',location:'未分配',qty:1});
    if(type==='memory'&&value)memories.unshift({text:value,source:'手动添加',createdAt:new Date().toISOString()});
    if(type==='topic'&&value){
      createTopic(value);
      closeModal();return
    }
    renderTasks();renderInventory();renderMemories();saveState(type==='task'?['tasks']:type==='part'?['inventory']:type==='memory'?['memories']:null);closeModal();if(type==='task'&&activeProjectId&&$('#project-detail').classList.contains('active'))renderProjectWorkspace();showToast(type==='inventory'?'3 种元器件已入库':type==='memory'?'长期记忆已保存':'操作已保存到本机');return
  }
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action){if(e.target.closest('button'))showToast('这个功能正在接入，后续版本会继续完善');return}
  ({
    'close-modal':closeModal,
    'quick-add':()=>formModal('task'),'add-task':()=>formModal('task'),'add-event':()=>eventModal(),'save-event':saveEvent,'add-project':()=>projectModal(),'add-diy-project':()=>projectModal('diy'),'save-project':saveProject,'add-part':()=>formModal('part'),'add-memory':memoryModal,'project-add-task':()=>formModal('task',activeProjectId),'project-add-event':()=>eventModal(null,activeProjectId),'project-link-tasks':()=>projectItemsModal('tasks'),'project-link-events':()=>projectItemsModal('events'),'project-save-items':saveProjectItems,'project-link-papers':projectPapersModal,'project-save-papers':saveProjectPapers,'project-add-bom':projectBomModal,'project-save-bom':saveProjectBom,'project-add-milestone':milestoneModal,'project-save-milestone':saveMilestone,'project-add-issue':issueModal,'project-save-issue':saveIssue,'project-add-decision':decisionModal,'project-save-decision':saveDecision,
    'paper-search':paperSearchModal,'execute-paper-search':executePaperSearch,
    'inventory-import':()=>$('#inventoryFileInput').click(),'save-part-edit':savePartEdit,'paper-import':importPapers,
    'search':searchModal,'notifications':notificationsModal,'profile':profileModal,'api-settings':apiSettingsModal,'save-api-settings':saveAPISettings,'clear-api-key':clearAPIKey,'mail-settings':mailSettingsModal,'mail-save-test':saveAndTestMail,'mail-sync':syncMailInbox,'mail-clear':clearMailSettings,'app-update':appUpdateModal,'update-check':checkAppUpdate,'update-download':downloadAppUpdate,'update-install':installAppUpdate,'read-notifications':()=>{const dot=document.querySelector('#notificationDot');if(dot)dot.hidden=true;closeModal();showToast('通知已全部标记为已读')},
    'add-purchase':()=>showToast('已加入待确认采购清单'),'paper-save':()=>showToast('已加入待读列表'),'create-insight':()=>showToast('已保存为产品洞察'),
    'english-session':englishPlanModal,'save-english-plan':createEnglishPlan,'add-topic':addTopicModal,'refresh-all-topics':refreshAllTopics,'brief-read':()=>showToast('后续版本可调用语音模型朗读'),'project-add-log':projectLogModal,'project-save-log':saveProjectLog,'project-import-files':()=>attachProjectFiles('import'),'project-link-files':()=>attachProjectFiles('link'),'show-data':()=>window.orbito?.showDataFolder(),
    'terminal-restart':()=>initTerminal(true),'terminal-claude':openClaude,'terminal-context':showTerminalContext,'terminal-clear':()=>{xterm?.clear();xterm?.focus()},'terminal-stop':async()=>{await window.orbito?.terminalKill();terminalStarted=false;setTerminalStatus(false,'已结束')}
  }[action]||(()=>showToast('此功能会在正式版本中接入')))();
});

document.addEventListener('change',e=>{
  if(e.target.id==='projectFileCategory'&&activeProjectId!=null){
    const value=e.target.value;
    if(Object.hasOwn(projectFileCategoryLabels,value))projectFileCategorySelections.set(String(activeProjectId),value);
  }
});

$('#overlay').addEventListener('click',()=>closeModal());
$('#mobileMenu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
$('#inventoryFileInput').addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';if(files.length)processInventoryScreenshots(files)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showToast('输入关键词即可搜索整个工作台')}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();formModal('task')}});

async function initialize(){
  if(window.orbito){
    try{
      appUpdateStatus=await window.orbito.getUpdateStatus()||appUpdateStatus;
      if(!updateStatusUnsubscribe)updateStatusUnsubscribe=window.orbito.onUpdateStatus(status=>renderAppUpdateStatus(status));
      window.orbito.onMailStatus?.(payload=>{if(payload?.status)mailStatus=payload.status;if(payload?.result?.added>0)showToast(`收到 ${payload.result.added} 封新邮件`);renderInbox();renderDashboardInbox()});
      const state=await window.orbito.getState();
      if(Array.isArray(state.tasks))tasks=state.tasks;
      if(Array.isArray(state.inventory))inventory=state.inventory;
      if(Array.isArray(state.inventoryImports))inventoryImports=state.inventoryImports;
      if(Array.isArray(state.conversations))conversations=state.conversations;
      if(Array.isArray(state.memories))memories=state.memories;
      if(Array.isArray(state.briefings))briefings=state.briefings;
      if(Array.isArray(state.topics)){
        topics=state.topics;
        if(topics.length) activeTopicId=topics[0].id;
      }
      if(Array.isArray(state.englishPlans))englishPlans=state.englishPlans;
      if(Array.isArray(state.papers))papers=state.papers;
      if(Array.isArray(state.events))events=state.events;
      if(Array.isArray(state.projects))projects=state.projects.map(ensureProjectSchema);
      if(Array.isArray(state.aiTasks))aiTasks=state.aiTasks;
      if(Array.isArray(state.inboxItems))inboxItems=state.inboxItems;
      papers.forEach(paper=>{if(!Array.isArray(paper.projectIds))paper.projectIds=[]});
      await loadMailStatus();
      await refreshAIStatus();
      if(!state.tasks)await saveState();
    }catch(error){console.error(error);}
  }
  renderTasks();renderInventory();renderMemories();renderCalendar();renderTopicCards();renderTopicResults();renderDashboardBriefing();renderEnglishPlans();renderPapers();renderProjects();renderAITaskCenter();renderInbox();renderDashboardInbox();
  updateNotificationIndicator();
  updateClockGreeting();setInterval(updateClockGreeting,60*1000);
  window.orbito?.onStateChanged?.(state=>{
    if(Array.isArray(state.tasks))tasks=state.tasks;
    if(Array.isArray(state.inventory))inventory=state.inventory;
    if(Array.isArray(state.inventoryImports))inventoryImports=state.inventoryImports;
    if(Array.isArray(state.conversations))conversations=state.conversations;
    if(Array.isArray(state.memories))memories=state.memories;
    if(Array.isArray(state.briefings))briefings=state.briefings;
    if(Array.isArray(state.topics))topics=state.topics;
    if(Array.isArray(state.englishPlans))englishPlans=state.englishPlans;
    if(Array.isArray(state.papers))papers=state.papers;
    if(Array.isArray(state.events))events=state.events;
    if(Array.isArray(state.projects))projects=state.projects.map(ensureProjectSchema);
    if(Array.isArray(state.aiTasks))aiTasks=state.aiTasks;
    if(Array.isArray(state.inboxItems))inboxItems=state.inboxItems;
    renderTasks();renderInventory();renderMemories();renderTopicCards();renderTopicResults();renderDashboardBriefing();renderEnglishPlans();renderPapers();renderProjects();renderAITaskCenter();renderInbox();renderDashboardInbox();if($('#project-detail').classList.contains('active'))renderProjectWorkspace();
  });
  // Auto-generate briefing on startup if API is configured and not yet today
  setTimeout(() => autoBriefing(), 1500);
  setInterval(() => autoBriefing(), 30*60*1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoBriefing()});
}
initialize();
