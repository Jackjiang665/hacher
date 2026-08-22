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
let editingEventId = null;
let editingProjectId = null;
let activeTopicId = null;
let aiConfigured = false;
let taskFilter = 'all';
let projectFilter = 'all';
function getWeekStart(value = new Date()) { const date=new Date(value);const day=date.getDay()||7;date.setHours(0,0,0,0);date.setDate(date.getDate()-day+1);return date }
let calendarStart = getWeekStart();
let pendingAttachment = null;
let xterm = null;
let fitAddon = null;
let terminalStarted = false;
let terminalStartPromise = null;
const viewNames = { dashboard:'工作台总览',today:'今日待办',calendar:'日程安排',projects:'项目中心',papers:'论文与科研',english:'英语学习',briefing:'每日情报',diy:'DIY 项目',inventory:'电子元件库',memory:'AI 记忆中心',terminal:'Agent 终端' };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const h = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setCountBadge = (id, count) => { const el=document.getElementById(id); if(el){el.textContent=count;el.hidden=count===0} };
const updateNotificationIndicator = () => { const el=$('#notificationDot'); if(el)el.hidden=!(tasks.some(t=>!t.done)||inventory.some(p=>Number(p.qty)<=2)); };

function greetingForHour(hour){if(hour>=5&&hour<9)return'早上好';if(hour<12)return'上午好';if(hour<14)return'中午好';if(hour<18)return'下午好';if(hour<23)return'晚上好';return'夜深了'}
function updateClockGreeting(){
  const now=new Date();const week=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];const greeting=greetingForHour(now.getHours());
  const hasWorkspaceData=tasks.length||projects.length||inventory.length||events.length||papers.length||englishPlans.length||topics.length;
  const greetingText=$('#dashboardGreetingText');if(greetingText)greetingText.textContent=`${greeting}，${hasWorkspaceData?'继续推进你的工作台':'开始建立你的工作台'}`;
  const aiWelcome=$('#aiWelcome');if(aiWelcome)aiWelcome.textContent=`${greeting}！我可以参考你的任务、库存和长期记忆与你对话。`;
  const date=$('#todayDate');if(date)date.textContent=`${now.getFullYear()} 年 ${now.getMonth()+1} 月 ${now.getDate()} 日 · ${week[now.getDay()]}`;
}

function renderTasks() {
  const openTasks=tasks.filter(t=>!t.done);
  const completedTasks=tasks.filter(t=>t.done).length;
  const completionPercent=tasks.length?Math.round(completedTasks/tasks.length*100):0;
  $('#focusList').innerHTML = openTasks.length ? openTasks.slice(0,3).map(t => `<div class="focus-item ${t.done?'done':''}"><button class="check" data-task="${t.id}">${t.done?'✓':''}</button><div><b>${h(t.title)}</b><small>${h(t.meta.split(' · ')[0])}</small></div><em>${h(t.time)}</em></div>`).join('') : '<div class="empty-state"><span>✓</span><b>还没有今日任务</b><small>创建任务后，最重要的三项会出现在这里</small><button data-action="add-task">创建任务</button></div>';
  const visibleTasks = tasks.filter(t => taskFilter === 'all' || (taskFilter === 'done' ? t.done : !t.done));
  $('#fullTaskList').innerHTML = visibleTasks.length ? visibleTasks.map(t => `<div class="task-row ${t.done?'done':''}"><button class="task-check" data-task="${t.id}">${t.done?'✓':''}</button><div><b>${h(t.title)}</b><small>${h(t.meta)}</small></div><time>${h(t.time)}</time></div>`).join('') : '<div class="memory-empty"><span>✓</span><b>这里暂时没有任务</b><small>切换其他分类，或创建一项新任务</small></div>';
  setCountBadge('todoBadge',openTasks.length);
  $('#dashboardSummary').textContent=openTasks.length?`你有 ${openTasks.length} 项未完成任务。其他模块会在录入真实数据后自动汇总。`:'目前还没有个人数据。创建任务或项目后，这里会自动汇总。';
  $('#taskCompletionPercent').textContent=completionPercent;
  $('#taskCompletionSummary').textContent=tasks.length?`已完成 ${completedTasks} / ${tasks.length} 项任务`:'当前暂无任务';
  $('#taskCompletionRing').style.background=`conic-gradient(#3e7659 0 ${completionPercent}%,#e5ebe7 ${completionPercent}%)`;
  $('#dailyPlanHint').textContent=openTasks.length?`你当前有 ${openTasks.length} 项未完成任务。AI 会只依据这些真实待办给出安排建议。`:'当前没有足够的真实任务数据。先创建待办，再让 AI 帮你安排。';
  updateNotificationIndicator();
}

const projectTypeLabels={research:'科研项目',startup:'创业 / 产品',software:'软件开发',electronics:'电子 / PCB',model:'模型研究',diy:'DIY / 创作',other:'其他'};
const projectStatusLabels={idea:'想法',planning:'规划中',active:'进行中',paused:'已暂停',completed:'已完成'};
function projectCard(project){
  const tags=Array.isArray(project.tags)?project.tags:[];const progress=Math.max(0,Math.min(100,Number(project.progress)||0));
  return `<article class="project-card" data-category="${h(project.type||'other')}"><div><span class="project-type-dot">${project.type==='diy'?'◇':'▦'}</span><em>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</em><button data-project-open="${h(project.id)}" title="编辑项目">•••</button></div><h2>${h(project.name)}</h2><p>${h(project.description||'还没有补充项目说明。')}</p>${tags.length?`<div class="tags">${tags.slice(0,4).map(tag=>`<span>${h(tag)}</span>`).join('')}</div>`:'<div class="tags"><span>暂无标签</span></div>'}<div class="project-foot"><div class="progress"><i style="width:${progress}%"></i></div><b>${progress}%</b></div></article>`
}
function renderProjects(){
  const visible=projects.filter(project=>projectFilter==='all'||project.type===projectFilter);
  const grid=$('#projectsGrid');if(grid)grid.innerHTML=`${visible.map(projectCard).join('')}<button class="new-project" data-action="add-project"><span>＋</span><b>${projects.length?'新建项目':'创建第一个项目'}</b><small>从想法开始，逐步补充进度与上下文</small></button>`;
  const diy=projects.filter(project=>project.type==='diy');const diyContainer=$('#diyProjectsContainer');if(diyContainer)diyContainer.innerHTML=diy.length?`${diy.map(projectCard).join('')}<button class="new-project" data-action="add-diy-project"><span>＋</span><b>新建 DIY 项目</b><small>记录电路、代码、BOM 与测试过程</small></button>`:'<article class="card project-empty-card"><div class="empty-state"><span>◇</span><b>还没有 DIY 项目</b><small>新建项目后再逐步加入电路、软件、BOM 和实验记录</small><button data-action="add-diy-project">创建第一个 DIY 项目</button></div></article>';
  const dashboard=$('#dashboardProjects');if(dashboard)dashboard.innerHTML=projects.length?`<div class="dashboard-project-list">${projects.slice(0,3).map(project=>`<button data-project-open="${h(project.id)}"><span><b>${h(project.name)}</b><small>${h(projectTypeLabels[project.type]||'其他')} · ${h(projectStatusLabels[project.status]||'规划中')}</small></span><em>${Math.max(0,Math.min(100,Number(project.progress)||0))}%</em></button>`).join('')}</div>`:'<div class="empty-state"><span>▦</span><b>还没有项目</b><small>科研、创业、软件和 DIY 项目都可以从这里开始</small><button data-action="add-project">创建第一个项目</button></div>';
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
    const file=files[index];rows[index].state='working';rows[index].message='正在调用千问识别';updateInventoryBatchProgress(rows,index,files.length);
    try{
      if(file.size>10*1024*1024)throw new Error('图片超过 10 MB');
      const result=await window.orbito.recognizeInventoryImage({name:file.name,dataUrl:await fileDataUrl(file)});
      if(result.duplicate){rows[index].state='duplicate';rows[index].message='这张截图以前已经入库，已跳过';duplicates++;updateInventoryBatchProgress(rows,index+1,files.length);continue}
      if(!result.items?.length){rows[index].state='error';rows[index].message='没有识别到电子元器件';failed++;updateInventoryBatchProgress(rows,index+1,files.length);continue}
      const fileChanges=result.items.map(item=>mergeRecognizedPart(item,file.name));changes.push(...fileChanges);recognized+=result.items.length;inventoryImports.push({hash:result.imageHash,fileName:file.name,items:result.items.length,createdAt:new Date().toISOString()});
      rows[index].state='done';rows[index].message=`识别 ${result.items.length} 项，已自动入库`;renderInventory();await saveState();
    }catch(error){rows[index].state='error';rows[index].message=error.message||String(error);failed++}
    updateInventoryBatchProgress(rows,index+1,files.length);
  }
  const review=changes.filter(change=>change.part.needsReview).length;
  showModal(`<div class="modal-icon">✓</div><h2>批量入库完成</h2><p>${files.length} 张截图已处理，识别到 ${recognized} 项元器件并写入仓库。</p><div class="batch-summary"><div><b>${recognized}</b><small>识别项目</small></div><div><b>${changes.filter(change=>change.created).length}</b><small>新增种类</small></div><div><b>${changes.filter(change=>!change.created).length}</b><small>合并累加</small></div><div><b>${review}</b><small>待核对</small></div></div>${duplicates||failed?`<div class="batch-note">${duplicates?`${duplicates} 张重复截图已跳过。`:''}${failed?`${failed} 张未能完成识别。`:''}</div>`:''}<div class="batch-result-list">${changes.slice(0,30).map(change=>`<div><span>${change.created?'新增':'累加'}</span><b>${h(change.part.name)}</b><small>${h(change.part.spec)} · 当前 ${change.part.qty}</small></div>`).join('')}</div><div class="modal-actions"><button class="confirm" data-action="close-modal">查看仓库</button></div>`)
}

function partEditModal(index){const part=inventory[index];if(!part)return;showModal(`<div class="modal-icon">⌘</div><h2>编辑元器件</h2><p>修改 AI 识别结果后，“待核对”标记会自动清除。</p><input id="partEditIndex" type="hidden" value="${index}"><div class="form-grid"><div class="form-field full"><label>名称</label><input id="partEditName" value="${h(part.name)}"></div><div class="form-field"><label>分类</label><input id="partEditCategory" value="${h(part.category)}"></div><div class="form-field"><label>库存数量</label><input id="partEditQty" type="number" min="0" step="1" value="${Number(part.qty)||0}"></div><div class="form-field full"><label>规格 / 型号 / 封装</label><input id="partEditSpec" value="${h(part.spec)}"></div><div class="form-field full"><label>存放位置</label><input id="partEditLocation" value="${h(part.location)}"></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-part-edit">保存修改</button></div>`)}
async function savePartEdit(){const index=Number($('#partEditIndex')?.value);const part=inventory[index];const name=$('#partEditName')?.value.trim();if(!part||!name){showToast('请输入元器件名称');return}Object.assign(part,{name,category:$('#partEditCategory')?.value.trim()||'其他',spec:$('#partEditSpec')?.value.trim()||'待补充',location:$('#partEditLocation')?.value.trim()||'未分配',qty:Math.max(0,Math.round(Number($('#partEditQty')?.value)||0)),needsReview:false,updatedAt:new Date().toISOString()});renderInventory();await saveState();closeModal();showToast('元器件信息已更新')}

function renderMemories() {
  setCountBadge('memoryBadge',memories.length);
  $('#memoryCount').textContent = `${memories.length} 条`;
  $('#memoryList').innerHTML = memories.length ? memories.map((m,i)=>`<div class="memory-item"><span>◉</span><div><b>${h(m.text)}</b><small>${h(m.source || '手动添加')} · ${m.createdAt ? new Date(m.createdAt).toLocaleDateString('zh-CN') : '刚刚'}</small></div><button data-memory-delete="${i}">删除</button></div>`).join('') : '<div class="memory-empty"><span>◉</span><b>还没有长期记忆</b><small>点击“添加记忆”，或在对话中明确告诉 AI“请记住……”</small></div>';
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
  container.innerHTML=`<div class="paper-library">${papers.map((paper,index)=>`<article class="card paper-library-item"><span class="paper-file-icon">PDF</span><div class="paper-library-body"><p>${h(paper.status||'待读')} · ${h(formatFileSize(paper.size))} · ${paper.importedAt?new Date(paper.importedAt).toLocaleDateString('zh-CN'):'日期未知'}</p><h2>${h(paper.title||paper.fileName||'未命名论文')}</h2><small>${h(paper.fileName||'本地 PDF')}</small></div><div class="paper-library-actions"><button class="outline-btn" data-paper-open="${h(paper.id)}">打开 PDF</button><button class="paper-delete-btn" data-paper-delete="${h(paper.id)}" title="删除论文">删除</button></div></article>`).join('')}</div>`;
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
  if (!aiConfigured || !topics.length) return;
  const dateKey = value => { const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };
  const today = dateKey(new Date());
  const pendingTopics = topics.filter(t => !t.searchedAt || dateKey(t.searchedAt) !== today);
  if (!pendingTopics.length) return;
  setTopicStatus('searching', `正在搜索 ${pendingTopics.length} 个关注主题…`);
  for (const topic of pendingTopics) {
    try {
      await window.orbito.generateTopicBriefing(topic.id);
    } catch (err) {
      console.error(`Briefing search failed for "${topic.name}":`, err);
    }
  }
  // Reload state after search
  try {
    const state = await window.orbito.getState();
    if (Array.isArray(state.topics)) topics = state.topics;
    if (Array.isArray(state.briefings)) briefings = state.briefings;
    renderTopicCards();
    renderTopicResults();
    setTopicStatus('done', `已更新 ${topics.length} 个主题的情报`);
    setTimeout(() => setTopicStatus('', ''), 3000);
  } catch (err) {
    setTopicStatus('error', `更新情报时出错：${err.message}`);
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
  if (!aiConfigured) { showToast('未检测到千问 API，无法执行搜索'); return; }
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
  setTopicStatus('done', `情报已生成`);
  setTimeout(() => setTopicStatus('', ''), 3000);
}

async function saveState() {
  if (!window.orbito) return;
  try { await window.orbito.saveState({ tasks, inventory, inventoryImports, conversations: conversations.slice(-100), memories, briefings, topics, englishPlans, papers, events, projects }); }
  catch (error) { console.error(error); showToast('本地保存失败，请稍后重试'); }
}

function switchView(id) {
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));
  $('#aiContext').textContent=viewNames[id]||'工作台';
  document.querySelector('.sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if(id==='terminal')setTimeout(()=>initTerminal(),80);
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
  terminalStartPromise=(async()=>{if(force){await window.orbito.terminalKill();xterm.reset()}setTerminalStatus(false,'正在启动…');fitAddon.fit();const result=await window.orbito.terminalStart({cols:xterm.cols,rows:xterm.rows});if(!result.ok){setTerminalStatus(false,'启动失败');xterm.writeln(`\x1b[31m终端启动失败：${result.error}\x1b[0m`);return false}terminalStarted=true;$('#terminalCwd').textContent=result.cwd;setTerminalStatus(true,'运行中');xterm.focus();return true})();
  try{return await terminalStartPromise}finally{terminalStartPromise=null}
}

async function openClaude(){switchView('terminal');const ok=await initTerminal();if(ok){xterm.writeln('\r\n\x1b[36m[正在启动 Claude Code…]\x1b[0m');window.orbito.terminalWrite('claude\r')}}

async function showTerminalContext(){switchView('terminal');const ok=await initTerminal();if(ok)window.orbito.terminalWrite('node tools/hacher.cjs context\r')}

function showToast(text){const t=$('#toast');t.querySelector('p').textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2300)}
function showModal(html){$('#modalContent').innerHTML=html;$('#modalWrap').classList.add('show');$('#overlay').classList.add('show')}
function closeModal(){ $('#modalWrap').classList.remove('show'); if(!$('#aiPanel').classList.contains('open'))$('#overlay').classList.remove('show') }
function openAI(){ $('#aiPanel').classList.add('open');$('#overlay').classList.add('show');setTimeout(()=>$('#chatInput').focus(),250) }
function closeAI(){ $('#aiPanel').classList.remove('open');if(!$('#modalWrap').classList.contains('show'))$('#overlay').classList.remove('show') }

function formModal(type){
  const data={
    task:['新建任务','任务名称','输入任务名称','所属项目','可选'],
    event:['新建日程','日程名称','输入日程名称','日期与时间','请选择'],
    project:['创建项目','项目名称','输入项目名称','项目类型','请选择'],
    part:['手动入库','元器件名称','输入名称或型号','数量','1']
  }[type];
  const secondaryField={
    task:'<input id="secondaryField" placeholder="可选">',
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
  const next={id:editingProjectId||Date.now(),name,type:$('#projectType')?.value||'other',status:$('#projectStatus')?.value||'planning',progress:Math.max(0,Math.min(100,Math.round(Number($('#projectProgress')?.value)||0))),tags:($('#projectTags')?.value||'').split(/[,，]/).map(tag=>tag.trim()).filter(Boolean).slice(0,12),description:$('#projectDescription')?.value.trim()||'',createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(editingProjectId)projects=projects.map(item=>String(item.id)===String(editingProjectId)?next:item);else projects.unshift(next);renderProjects();renderTasks();await saveState();closeModal();editingProjectId=null;showToast(existing?'项目已更新':'项目已创建并保存')
}

function eventModal(eventId=null){
  const event=eventId?events.find(item=>String(item.id)===String(eventId)):null;editingEventId=event?.id||null;
  const now=new Date();const roundedMinutes=Math.ceil(now.getMinutes()/30)*30;now.setMinutes(roundedMinutes,0,0);const later=new Date(now.getTime()+60*60*1000);
  const currentWeekEnd=new Date(calendarStart);currentWeekEnd.setDate(currentWeekEnd.getDate()+6);const today=new Date();today.setHours(0,0,0,0);const defaultDate=today>=calendarStart&&today<=currentWeekEnd?localDateKey(today):localDateKey(calendarStart);
  const start=event?.startTime||`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;const end=event?.endTime||`${String(later.getHours()).padStart(2,'0')}:${String(later.getMinutes()).padStart(2,'0')}`;
  showModal(`<div class="modal-icon">◷</div><h2>${event?'编辑日程':'新建日程'}</h2><p>填写明确的开始和结束时间，保存后会显示在周时间轴中。</p><div class="form-grid"><div class="form-field full"><label>日程名称</label><input id="eventTitle" value="${h(event?.title||'')}" placeholder="例如：组会、实验或产品讨论"></div><div class="form-field full"><label>日期</label><input id="eventDate" type="date" value="${h(event?.date||defaultDate)}"></div><div class="form-field"><label>开始时间</label><input id="eventStart" type="time" step="300" value="${h(start)}"></div><div class="form-field"><label>结束时间</label><input id="eventEnd" type="time" step="300" value="${h(end)}"></div><div class="form-field"><label>类型</label><select id="eventCategory"><option value="research" ${event?.category==='research'?'selected':''}>科研 / 学习</option><option value="meeting" ${event?.category==='meeting'?'selected':''}>会议</option><option value="experiment" ${event?.category==='experiment'?'selected':''}>实验</option><option value="personal" ${event?.category==='personal'?'selected':''}>个人事务</option><option value="other" ${!event||event?.category==='other'?'selected':''}>其他</option></select></div><div class="form-field"><label>地点</label><input id="eventLocation" value="${h(event?.location||'')}" placeholder="可选"></div><div class="form-field full"><label>补充说明</label><textarea id="eventNotes" rows="3" placeholder="需要准备什么，或希望 AI 理解的上下文…">${h(event?.notes||'')}</textarea></div></div><div class="modal-actions">${event?'<button class="danger-modal-btn" data-event-delete="'+h(event.id)+'">删除</button>':''}<button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="save-event">${event?'保存修改':'确认创建'}</button></div>`);setTimeout(()=>$('#eventTitle')?.focus(),100)
}

async function saveEvent(){
  const title=$('#eventTitle')?.value.trim();const date=$('#eventDate')?.value;const startTime=$('#eventStart')?.value;const endTime=$('#eventEnd')?.value;
  if(!title){showToast('请输入日程名称');return}if(!date||!startTime||!endTime){showToast('请填写完整的日期和时间');return}if(timeMinutes(endTime)<=timeMinutes(startTime)){showToast('结束时间必须晚于开始时间');return}
  const oldEvent=editingEventId?events.find(item=>String(item.id)===String(editingEventId)):null;
  const next={id:editingEventId||Date.now(),title,date,startTime,endTime,category:$('#eventCategory')?.value||'other',location:$('#eventLocation')?.value.trim()||'',notes:$('#eventNotes')?.value.trim()||'',createdAt:oldEvent?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const conflict=events.some(item=>eventsOverlap(next,item));if(editingEventId)events=events.map(item=>String(item.id)===String(editingEventId)?next:item);else events.push(next);
  calendarStart=getWeekStart(new Date(`${date}T00:00:00`));renderCalendar();await saveState();closeModal();editingEventId=null;showToast(conflict?'日程已保存，但与同日其他安排有重叠':'日程已保存并显示在时间轴')
}

function memoryModal(){
  showModal(`<div class="modal-icon">◉</div><h2>添加一条长期记忆</h2><p>这条内容会保存在本机，并在相关的 AI 对话中作为上下文使用。</p><div class="form-grid"><div class="form-field full"><label>希望 AI 记住什么？</label><textarea id="primaryField" rows="4" placeholder="例如：我更喜欢上午安排需要深度思考的科研任务。"></textarea></div></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-confirm="memory">确认记住</button></div>`);
  setTimeout(()=>$('#primaryField')?.focus(),100);
}

function dailyPlan(){openAI();simulateAI('请只根据我工作台中当前真实存在的待办，帮我规划今天；如果没有足够数据，请明确告诉我需要先录入什么。')}

function notificationsModal(){const open=tasks.filter(t=>!t.done);const low=inventory.filter(p=>Number(p.qty)<=2);const rows=[...open.slice(0,3).map(t=>`<div class="result-row"><b>待办</b><span>${h(t.title)}</span><span>${h(t.time)}</span></div>`),...low.slice(0,3).map(p=>`<div class="result-row"><b>库存</b><span>${h(p.name)}</span><span>剩余 ${p.qty}</span></div>`)];showModal(`<div class="modal-icon">♢</div><h2>通知</h2><p>这里只显示根据真实任务和库存生成的提醒。</p>${rows.length?`<div class="result-box">${rows.join('')}</div>`:'<div class="empty-state small"><b>目前没有通知</b><small>新增待办或库存记录后，相关提醒会出现在这里</small></div>'}<div class="modal-actions"><button class="confirm" data-action="read-notifications">全部已读</button></div>`)}

function profileModal(){showModal(`<div class="modal-icon">XY</div><h2>我的工作区</h2><p>当前为单人、本地优先模式。账户与多端同步将在后续版本加入。</p><div class="result-box"><p><b>AI 状态：</b>${aiConfigured?'千问已连接':'未检测到 API Key'}</p><p><b>数据存储：</b>本机应用数据目录</p><p><b>长期记忆：</b>${memories.length} 条</p><p><b>未完成任务：</b>${tasks.filter(t=>!t.done).length} 项</p></div><div class="workspace-settings"><button type="button" data-action="api-settings"><span>🔑</span><div><b>千问 API 设置</b><small>${aiConfigured?'更换 Key 或调整模型':'填写自己的 Key 以启用 AI'}</small></div><i>›</i></button></div><div class="modal-actions"><button class="cancel" data-action="show-data">打开数据位置</button><button class="confirm" data-action="close-modal">完成</button></div>`)}

async function apiSettingsModal(){
  let status={configured:aiConfigured,model:'qwen3.7-plus'};
  try{status=await window.orbito?.getAIStatus()||status}catch(error){console.error(error)}
  showModal(`<div class="modal-icon">🔑</div><h2>千问 API 设置</h2><p>配置你自己的阿里云百炼 API Key。Key 只保存在当前 Windows 用户的本机配置中，不会写入项目数据或上传到 GitHub。</p><div class="api-status ${status.configured?'connected':''}"><span></span><b>${status.configured?'已连接':'尚未配置'}</b><small>${status.configured?'留空 Key 可保留当前配置':'首次使用必须填写 API Key'}</small></div><div class="form-grid"><div class="form-field full"><label>API Key</label><input id="apiSettingsKey" type="password" placeholder="${status.configured?'已保存，如需更换请填写新 Key':'sk-xxxxxxxxxxxxxxxx'}" autocomplete="new-password" spellcheck="false"></div><div class="form-field full"><label>模型</label><input id="apiSettingsModel" value="${h(status.model||'qwen3.7-plus')}" placeholder="qwen3.7-plus" spellcheck="false"></div></div><a class="api-help-link" href="https://bailian.console.aliyun.com/#/api-key" target="_blank" rel="noreferrer">前往阿里云百炼获取 API Key →</a><div class="modal-actions">${status.configured?'<button class="danger-modal-btn" data-action="clear-api-key">清除 Key</button>':''}<button class="cancel" data-action="profile">返回</button><button class="confirm" data-action="save-api-settings">保存配置</button></div>`);
  setTimeout(()=>$('#apiSettingsKey')?.focus(),100);
}

async function refreshAIStatus(){
  const status=await window.orbito.getAIStatus();
  aiConfigured=status.configured;
  $('#panelAIStatus').textContent=status.configured?`千问 ${status.model} · 本地记忆已启用`:'离线模式 · 未检测到 API Key';
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
  if(!window.confirm('确定清除本机保存的千问 API Key？清除后 AI 功能将切换为离线模式。'))return;
  try{const result=await window.orbito.clearAIKey();if(!result.ok){showToast(result.error||'清除失败');return}await refreshAIStatus();showToast('API Key 已从本机清除');apiSettingsModal()}catch(error){showToast('清除失败：'+error.message)}
}

function searchModal(){const items=[...tasks.map(t=>`<button data-view-link="today">${h(t.title)} <small>待办</small></button>`),...inventory.map(p=>`<button data-view-link="inventory">${h(p.name)} <small>元件</small></button>`)];showModal(`<div class="modal-icon">⌕</div><h2>全局搜索</h2><p>只搜索已经录入工作台的真实内容。</p><div class="form-field full"><input id="searchInput" placeholder="输入关键词…"></div>${items.length?`<div class="result-box search-results">${items.join('')}</div>`:'<div class="empty-state small"><b>还没有可搜索的数据</b><small>先创建任务、项目或库存记录</small></div>'}<div class="modal-actions"><button class="confirm" data-action="close-modal">关闭</button></div>`);setTimeout(()=>$('#searchInput')?.focus(),100)}

function paperSearchModal(){showModal(`<div class="modal-icon">⌕</div><h2>搜索最新论文</h2><p>输入研究主题后，AI 将实时查询 arXiv，并且只依据真实返回结果回答。</p><div class="form-field full"><label>研究主题</label><input id="paperTopic" value="大模型不确定性量化" placeholder="例如：大模型不确定性量化"></div><div class="modal-actions"><button class="cancel" data-action="close-modal">取消</button><button class="confirm" data-action="execute-paper-search">开始搜索</button></div>`);setTimeout(()=>$('#paperTopic')?.focus(),100)}

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
  renderEnglishPlans();await saveState();closeModal();showToast('英语学习计划已创建');
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
    await saveState();
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
  await saveState();
  chat.scrollTop=chat.scrollHeight;
}

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);return}
  const link=e.target.closest('[data-view-link]');if(link){closeModal();switchView(link.dataset.viewLink);return}
  const taskFilterButton=e.target.closest('[data-task-filter]');if(taskFilterButton){taskFilter=taskFilterButton.dataset.taskFilter;$$('[data-task-filter]').forEach(b=>b.classList.toggle('active',b===taskFilterButton));renderTasks();return}
  const projectFilterButton=e.target.closest('[data-project-filter]');if(projectFilterButton){projectFilter=projectFilterButton.dataset.projectFilter;$$('[data-project-filter]').forEach(b=>b.classList.toggle('active',b===projectFilterButton));renderProjects();return}
  const projectOpen=e.target.closest('[data-project-open]');if(projectOpen){projectModal('',projectOpen.dataset.projectOpen);return}
  const projectDelete=e.target.closest('[data-project-delete]');if(projectDelete){const project=projects.find(item=>String(item.id)===projectDelete.dataset.projectDelete);if(project&&window.confirm(`确定删除项目“${project.name}”？`)){projects=projects.filter(item=>String(item.id)!==projectDelete.dataset.projectDelete);renderProjects();renderTasks();saveState();closeModal();editingProjectId=null;showToast('项目已删除')}return}
  const calendarButton=e.target.closest('[data-calendar]');if(calendarButton){if(calendarButton.dataset.calendar==='today')calendarStart=getWeekStart();else calendarStart.setDate(calendarStart.getDate()+(calendarButton.dataset.calendar==='next'?7:-7));renderCalendar();return}
  const calendarEvent=e.target.closest('[data-calendar-event]');if(calendarEvent){eventModal(calendarEvent.dataset.calendarEvent);return}
  const eventDelete=e.target.closest('[data-event-delete]');if(eventDelete){const event=events.find(item=>String(item.id)===eventDelete.dataset.eventDelete);if(event&&window.confirm(`确定删除日程“${event.title}”？`)){events=events.filter(item=>String(item.id)!==eventDelete.dataset.eventDelete);renderCalendar();saveState();closeModal();showToast('日程已删除')}return}
  const task=e.target.closest('[data-task]');if(task){const t=tasks.find(x=>x.id==task.dataset.task);t.done=!t.done;renderTasks();saveState();showToast(t.done?'任务已完成':'任务已恢复');return}
  const qty=e.target.closest('[data-qty]');if(qty){const p=inventory[+qty.dataset.qty];p.qty=Math.max(0,p.qty+(+qty.dataset.delta));renderInventory();saveState();return}
  const partEdit=e.target.closest('[data-part-edit]');if(partEdit){partEditModal(+partEdit.dataset.partEdit);return}
  const zero=e.target.closest('[data-zero]');if(zero){inventory[+zero.dataset.zero].qty=0;renderInventory();saveState();showToast('库存已设为 0');return}
  const memoryDelete=e.target.closest('[data-memory-delete]');if(memoryDelete){memories.splice(+memoryDelete.dataset.memoryDelete,1);renderMemories();saveState();showToast('记忆已删除');return}
  const englishComplete=e.target.closest('[data-english-complete]');if(englishComplete){const plan=englishPlans.find(item=>item.id==englishComplete.dataset.englishComplete);if(plan){if(!Array.isArray(plan.sessions))plan.sessions=[];const today=localDateKey();const index=plan.sessions.findIndex(session=>session.date===today);if(index>=0)plan.sessions.splice(index,1);else plan.sessions.push({date:today,minutes:Number(plan.minutesPerDay)||0,createdAt:new Date().toISOString()});renderEnglishPlans();saveState();showToast(index>=0?'已取消今日记录':'今日学习已记录');}return}
  const englishDelete=e.target.closest('[data-english-delete]');if(englishDelete){const id=+englishDelete.dataset.englishDelete;const plan=englishPlans.find(item=>item.id===id);if(plan&&window.confirm(`确定删除学习计划"${plan.name}"？`)){englishPlans=englishPlans.filter(item=>item.id!==id);renderEnglishPlans();saveState();showToast('学习计划已删除');}return}
  const paperOpen=e.target.closest('[data-paper-open]');if(paperOpen){window.orbito?.openPaper(paperOpen.dataset.paperOpen).then(result=>{if(!result?.ok)showToast(result?.error||'无法打开论文')});return}
  const paperDelete=e.target.closest('[data-paper-delete]');if(paperDelete){const paper=papers.find(item=>String(item.id)===paperDelete.dataset.paperDelete);if(paper&&window.confirm(`确定删除论文“${paper.title}”？本地论文库中的 PDF 文件也会被删除。`)){window.orbito?.deletePaper(paper.id).then(result=>{if(result?.ok){papers=result.state.papers;renderPapers();showToast('论文已删除')}else showToast(result?.error||'删除论文失败')}).catch(error=>showToast(`删除论文失败：${error.message||error}`))}return}
  const topicDelete=e.target.closest('[data-topic-delete]');if(topicDelete){e.stopPropagation();const id=+topicDelete.dataset.topicDelete;const t=topics.find(x=>x.id===id);if(t&&window.confirm(`确定删除主题"${t.name}"？相关搜索结果也会一并删除。`))removeTopic(id);return}
  const topicCard=e.target.closest('[data-topic-id]');if(topicCard){const id=+topicCard.dataset.topicId;activeTopicId=activeTopicId===id?null:id;renderTopicCards();renderTopicResults();return}
  const confirmButton=e.target.closest('[data-confirm]');if(confirmButton){
    const type=confirmButton.dataset.confirm;const value=$('#primaryField')?.value?.trim();
    if(type==='task'&&value)tasks.unshift({id:Date.now(),title:value,meta:'手动创建 · 待处理',time:'今天',done:false,createdAt:new Date().toISOString()});
    if(type==='part'&&value)inventory.unshift({name:value,category:'未分类',spec:'待补充',location:'未分配',qty:1});
    if(type==='memory'&&value)memories.unshift({text:value,source:'手动添加',createdAt:new Date().toISOString()});
    if(type==='topic'&&value){
      createTopic(value);
      closeModal();return
    }
    renderTasks();renderInventory();renderMemories();saveState();closeModal();showToast(type==='inventory'?'3 种元器件已入库':type==='memory'?'长期记忆已保存':'操作已保存到本机');return
  }
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action){if(e.target.closest('button'))showToast('这个功能正在接入，后续版本会继续完善');return}
  ({
    'open-ai':openAI,'close-ai':closeAI,'close-modal':closeModal,
    'quick-add':()=>formModal('task'),'add-task':()=>formModal('task'),'add-event':()=>eventModal(),'save-event':saveEvent,'add-project':()=>projectModal(),'add-diy-project':()=>projectModal('diy'),'save-project':saveProject,'add-part':()=>formModal('part'),'add-memory':memoryModal,
    'daily-plan':dailyPlan,'paper-search':paperSearchModal,'execute-paper-search':()=>{const topic=$('#paperTopic')?.value?.trim();if(!topic){showToast('请输入研究主题');return}closeModal();openAI();simulateAI(`请实时搜索与“${topic}”相关的最新论文。只列出这次真实检索返回的结果，并给出题目、作者、提交日期和可访问链接；不要虚构，也不要声称已经加入待办。`)},
    'upload':()=>$('#fileInput').click(),'inventory-import':()=>$('#inventoryFileInput').click(),'save-part-edit':savePartEdit,'paper-import':importPapers,'attach-image':()=>$('#chatFileInput').click(),'remove-attachment':removeAttachment,'inbox':()=>{closeModal();switchView('dashboard');setTimeout(()=>document.querySelector('.drop-zone').scrollIntoView({behavior:'smooth',block:'center'}),120)},
    'search':searchModal,'notifications':notificationsModal,'profile':profileModal,'api-settings':apiSettingsModal,'save-api-settings':saveAPISettings,'clear-api-key':clearAPIKey,'read-notifications':()=>{const dot=document.querySelector('#notificationDot');if(dot)dot.hidden=true;closeModal();showToast('通知已全部标记为已读')},
    'add-purchase':()=>showToast('已加入待确认采购清单'),'paper-save':()=>showToast('已加入待读列表'),'create-insight':()=>showToast('已保存为产品洞察'),
    'english-session':englishPlanModal,'save-english-plan':createEnglishPlan,'add-topic':addTopicModal,'refresh-all-topics':refreshAllTopics,'brief-read':()=>showToast('后续版本可调用语音模型朗读'),'project-open':()=>showToast('项目详情将在后续版本展开'),'show-data':()=>window.orbito?.showDataFolder(),
    'terminal-restart':()=>initTerminal(true),'terminal-claude':openClaude,'terminal-context':showTerminalContext,'terminal-clear':()=>{xterm?.clear();xterm?.focus()},'terminal-stop':async()=>{await window.orbito?.terminalKill();terminalStarted=false;setTerminalStatus(false,'已结束')}
  }[action]||(()=>showToast('此功能会在正式版本中接入')))();
});

$('#overlay').addEventListener('click',()=>{closeAI();closeModal()});
$('#mobileMenu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
$('#fileInput').addEventListener('change',e=>{const f=e.target.files[0];if(f){setAttachment(f);openAI();$('#chatInput').value='请识别这张图片中的内容，并先给出结构化草稿；不要直接写入任何数据。';e.target.value=''}});
$('#inventoryFileInput').addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';if(files.length)processInventoryScreenshots(files)});
$('#chatFileInput').addEventListener('change',e=>setAttachment(e.target.files[0]));
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#chatInput').value.trim();if(v||pendingAttachment){const attachment=pendingAttachment;removeAttachment();simulateAI(v,attachment);$('#chatInput').value=''}});
$$('.quick-prompts button').forEach(b=>b.addEventListener('click',()=>simulateAI(b.textContent)));
$('#aiSetupForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('#aiKeyInput');const key=input?.value?.trim();if(!key){showToast('请输入 API Key');return}const btn=e.target.querySelector('.ai-setup-save');btn.textContent='保存中…';btn.disabled=true;try{const result=await window.orbito.saveAIKey(key);if(result.ok){showToast('AI Key 已保存，正在启用…');input.value='';await refreshAIStatus()}else{showToast(result.error||'保存失败')}}catch(err){showToast('保存失败：'+err.message)}finally{btn.textContent='保存并启用';btn.disabled=false}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAI();closeModal()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showToast('输入关键词即可搜索整个工作台')}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();formModal('task')}});

async function initialize(){
  if(window.orbito){
    try{
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
      if(Array.isArray(state.projects))projects=state.projects;
      await refreshAIStatus();
      if(!state.tasks)await saveState();
    }catch(error){console.error(error);}
  }
  renderTasks();renderInventory();renderMemories();renderCalendar();renderTopicCards();renderTopicResults();renderEnglishPlans();renderPapers();renderProjects();
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
    if(Array.isArray(state.projects))projects=state.projects;
    renderTasks();renderInventory();renderMemories();renderTopicCards();renderTopicResults();renderEnglishPlans();renderPapers();renderProjects();
    showToast('工作台数据已由 Agent 更新');
  });
  // Auto-generate briefing on startup if API is configured and not yet today
  setTimeout(() => autoBriefing(), 1500);
}
initialize();
