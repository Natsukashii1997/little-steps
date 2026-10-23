const store = require('../../lib/store');
const media = require('../../lib/media');
const { getHeaderLayout } = require('../../lib/layout');
const derive = require('../../lib/derive');
const validation = require('../../lib/validation');
const { BABY, VACCINE_SCHEDULE: SCHEDULE } = require('../../lib/constants');
const HEALTH_TABS = ['vaccine','ability','checkup'];
const HEALTH_TAB_ITEMS = [
  { key:'vaccine', label:'疫苗' },
  { key:'ability', label:'发育' },
  { key:'checkup', label:'儿保' }
];
const ABILITY_ARTS = [
  '../../assets/health/development-tummy-time.png',
  '../../assets/health/development-rollover.png',
  '../../assets/health/development-sitting.png'
];
const CHECKUP_ARTS = [
  '../../assets/health/checkup-newborn.png',
  '../../assets/health/checkup-one-month.png',
  '../../assets/health/checkup-four-month.png'
];
const iconFor = (name) => /五联|轮状/.test(name) ? '../../assets/health/vaccine-five-in-one.png' : /麻腮风/.test(name) ? '../../assets/health/vaccine-mmr.png' : '../../assets/health/vaccine-hepb.png';
const pad = (n) => String(n).padStart(2,'0');
const today = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const id = (kind) => `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dateText = (v) => { const a=String(v||'').split('-'); return a.length===3 ? `${a[0]}年${Number(a[1])}月${Number(a[2])}日` : '待安排'; };
function monthDate(months,birthDate){ const b=new Date(`${birthDate||BABY.birthDate}T12:00:00`); b.setMonth(b.getMonth()+Number(months||0)); return `${b.getFullYear()}-${pad(b.getMonth()+1)}-${pad(b.getDate())}`; }
function baseSchedule(birthDate){ return SCHEDULE.map((s,index)=>({ id:`vaccine-schedule-${s.key||index}`,scheduleKey:s.key,scheduleOrder:index,ageLabel:s.ageLabel,name:s.name,dose:s.dose,dueDate:monthDate(s.ageMonths,birthDate),note:s.note||'按当地接种门诊安排',choiceGroup:s.choiceGroup })); }
function deriveVaccines(data){ const stored=data.vaccines||[]; const byKey={};stored.forEach((x)=>{if(x.scheduleKey)byKey[x.scheduleKey]=x;}); const birthDate=data.baby&&data.baby.birthDate||BABY.birthDate;const base=baseSchedule(birthDate).map((x)=>({...x,...(byKey[x.scheduleKey]||{})})); const customs=stored.filter((x)=>!x.scheduleKey); return [...base,...customs]; }
function formatVaccineGroups(vaccines, age) {
  return derive.visibleVaccineGroups(vaccines).map(group => {
    const schedule = SCHEDULE.find(item => item.ageLabel === group.ageLabel);
    const isCurrent = Boolean(schedule && age && schedule.ageMonths === age.months
      && (schedule.ageMonths !== 0 || age.days === 0));
    return { label:group.ageLabel, isCurrent, items:group.items.map(item => ({
      ...item, iconSrc:iconFor(item.name), noteText:item.note || '按当地接种门诊安排', dueDateText:dateText(item.dueDate)
    })) };
  });
}
function stableArt(assets,value){let hash=0;String(value||'').split('').forEach((char)=>{hash=(hash*31+char.charCodeAt(0))>>>0;});return assets[hash%assets.length];}
function abilityArt(record){
  if(record.imageId)return record.imageId;
  const key=`${record.id||''} ${record.name||''}`;
  if(/head-lift|抬头|俯趴|趴卧/.test(key))return ABILITY_ARTS[0];
  if(/face-focus|rollover|注视|追视|翻身/.test(key))return ABILITY_ARTS[1];
  if(/limb-movement|四肢|活动|独坐|坐稳/.test(key))return ABILITY_ARTS[2];
  return stableArt(ABILITY_ARTS,key);
}
function checkupArt(record){
  const key=`${record.id||''} ${record.name||''}`;
  if(/checkup-newborn|新生儿|出生/.test(key))return CHECKUP_ARTS[0];
  if(/checkup-one-month|满月|1月龄|一个月/.test(key))return CHECKUP_ARTS[1];
  if(/checkup-four-month|4月龄|四月龄|四个月/.test(key))return CHECKUP_ARTS[2];
  return stableArt(CHECKUP_ARTS,key);
}
function formatAbilities(data){ return [...(data.abilities||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map((x)=>({...x,dateText:dateText(x.date),artSrc:abilityArt(x),artMode:'aspectFit'})); }
function formatCheckups(data){ return [...(data.checkups||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map((x)=>({...x,dateText:dateText(x.date),artSrc:checkupArt(x),artMode:'aspectFit'})); }
function selectedHero(tab,data){ if(tab==='vaccine')return {title:'疫苗接种',subtitle:'宝宝疫苗接种指南',count:`已记录 ${(data.vaccines||[]).filter(x=>x.completedDate).length} 条接种记录`,artSrc:'../../assets/health/vaccine-hero.png'}; if(tab==='ability')return {title:'发育里程碑',subtitle:'每一次小小进步，都值得珍藏',count:`已记录 ${(data.abilities||[]).length} 个里程碑`,artSrc:'../../assets/health/development-hero-bear.png',secondaryArtSrc:'../../assets/health/development-hero-baby.png'}; return {title:'儿保记录',subtitle:'把每次检查与建议，温柔收好',count:`已保存 ${(data.checkups||[]).length} 次儿保记录`,artSrc:'../../assets/health/checkup-hero-bear.png',secondaryArtSrc:'../../assets/health/checkup-hero-stethoscope.png'}; }
const errorText = (error,fallback) => error && (error.errMsg || error.message) || fallback;

Page({
  data:{ headerHeight:getHeaderLayout().totalHeight, healthTabs:HEALTH_TAB_ITEMS, tab:'vaccine', vaccineGroups:[], abilities:[], checkups:[], hero:{}, birthDate:BABY.birthDate, today:today(), editor:{open:false}, editorSaving:false, uploading:false, undoVisible:false, undoTrashId:'', undoMessage:'', undoToken:'' },
  onLoad(options={}){const tab=HEALTH_TABS.includes(options.tab)?options.tab:this.data.tab;this.setData({tab});this.unsubscribe=store.subscribe(()=>this.refresh());this.refresh();}, onShow(){this.refresh();},onUnload(){if(this.unsubscribe)this.unsubscribe();}, noop(){},
  onShareAppMessage(){ return { title:'硕之的健康记录', path:'/pages/health/index' }; },
  refresh(){const data=store.getData();const tab=this.data.tab;this.setData({birthDate:data.baby&&data.baby.birthDate||BABY.birthDate,today:today(),vaccineGroups:formatVaccineGroups(deriveVaccines(data),derive.babyAge(data.baby&&data.baby.birthDate||BABY.birthDate,this.now ? this.now() : new Date())),abilities:formatAbilities(data),checkups:formatCheckups(data),hero:selectedHero(tab,data)});},
  onNavigate(e){const page=e.detail?.page||e.currentTarget.dataset.page;if(page)wx.reLaunch({url:`/pages/${page}/index`});},
  switchTab(e){const tab=e.detail&&e.detail.key;if(!HEALTH_TABS.includes(tab))return;const data=store.getData();this.setData({tab,hero:selectedHero(tab,data)});},
  openAdd(){const tab=this.data.tab;if(tab==='vaccine')this.openVaccineEditor();else if(tab==='ability')this.openAbilityEditor();else this.openCheckupEditor();},
  openVaccine(e){const record=deriveVaccines(store.getData()).find((x)=>x.id===e.currentTarget.dataset.id);if(record)this.openVaccineEditor(record);},
  openVaccineEditor(record={}){const completed=Boolean(record.completedDate);const currentDay=this.data.today||today();this.setData({editor:{open:true,kind:'vaccine',title:record.id?'编辑接种记录':'新增接种记录',id:record.id||'',system:Boolean(record.scheduleKey),scheduleKey:record.scheduleKey||'',ageLabel:record.ageLabel||'',name:record.name||'',dose:record.dose||'',dueDate:record.dueDate||currentDay,completed,completedDate:record.completedDate||currentDay,wasCompleted:completed,cancelCompletion:false,note:record.note||'',choiceGroup:record.choiceGroup||''}});},
  openAbility(e){const r=(store.getData().abilities||[]).find(x=>x.id===e.currentTarget.dataset.id);if(r)this.openAbilityEditor(r);},
  openAbilityEditor(record={}){this.setData({editor:{open:true,kind:'ability',title:record.id?'编辑发育里程碑':'新增发育里程碑',id:record.id||'',date:record.date||today(),name:record.name||'',description:record.description||'',imageId:record.imageId||'',originalImageId:record.imageId||''}});},
  openCheckup(e){const r=(store.getData().checkups||[]).find(x=>x.id===e.currentTarget.dataset.id);if(r)this.openCheckupEditor(r);},
  openCheckupEditor(record={}){this.setData({editor:{open:true,kind:'checkup',title:record.id?'编辑儿保记录':'新增儿保记录',id:record.id||'',date:record.date||today(),name:record.name||'',tips:record.tips||'',completed:Boolean(record.completedDate),completedDate:record.completedDate||today()}});},
  async closeEditor(){
    if(this.data.editorSaving||this.data.uploading)return;
    const e=this.data.editor||{};
    if(e.kind==='ability')await media.discardDraft({originalRefs:[e.originalImageId],currentRefs:[e.imageId]});
    this.setData({editor:{open:false}});
  },
  changeAgeLabel(e){this.setData({'editor.ageLabel':e.detail.value});},changeName(e){this.setData({'editor.name':e.detail.value});},changeDose(e){this.setData({'editor.dose':e.detail.value});},changeDueDate(e){this.setData({'editor.dueDate':e.detail.value});},changeDate(e){this.setData({'editor.date':e.detail.value});},changeCompletedDate(e){this.setData({'editor.completedDate':e.detail.value});},changeDescription(e){this.setData({'editor.description':e.detail.value});},changeTips(e){this.setData({'editor.tips':e.detail.value});},
  async toggleCompleted(){
    if(this.data.editorSaving||this.data.uploading)return;
    if(!this.data.editor.completed){
      this.setData({'editor.completed':true,'editor.completedDate':this.data.today,'editor.cancelCompletion':false});
      return;
    }
    const needsConfirmation=this.data.editor.kind==='vaccine'&&this.data.editor.wasCompleted;
    if(needsConfirmation){
      const confirmed=await new Promise((resolve)=>wx.showModal({title:'取消已接种？',content:'这会取消这条接种记录，删除后 30 天内可恢复。',success:(result)=>resolve(result.confirm),fail:()=>resolve(false)}));
      if(!confirmed)return;
    }
    this.setData({'editor.completed':false,'editor.cancelCompletion':needsConfirmation});
  },
  async saveEditor(){
    if(this.data.editorSaving)return;
    const e=this.data.editor;
    const data=store.getData();
    const dayReference=this.data.today+'T12:00:00';
    const cancelVaccination=e.kind==='vaccine'&&e.id&&e.wasCompleted&&e.cancelCompletion&&!e.completed;
    let collection;
    let record;

    if(e.kind==='vaccine'){
      collection='vaccines';
      if(!cancelVaccination){
        if(!String(e.name||'').trim()||!String(e.dose||'').trim()||!e.dueDate)return wx.showToast({title:'请填写疫苗名称、次数和日期',icon:'none'});
        const dueResult=validation.validateDateNotBeforeBirth(e.dueDate,'计划接种日期');
        if(!dueResult.ok)return wx.showToast({title:dueResult.message,icon:'none'});
        if(e.completed){
          const completedResult=validation.validateDateInLife(e.completedDate,dayReference,'实际接种日期');
          if(!completedResult.ok)return wx.showToast({title:completedResult.message,icon:'none'});
        }
        record={id:e.id||id('vaccine'),scheduleKey:e.scheduleKey||undefined,ageLabel:String(e.ageLabel||'').trim()||'其他',name:e.name.trim(),dose:e.dose.trim(),dueDate:e.dueDate,completedDate:e.completed?e.completedDate:'',note:e.note||'按当地接种门诊安排',choiceGroup:e.choiceGroup||undefined};
        const family=derive.vaccineChoiceFamily(record.choiceGroup);
        const conflict=e.completed&&family&&deriveVaccines(data).find((item)=>item.id!==record.id&&item.completedDate&&derive.vaccineChoiceFamily(item.choiceGroup)===family&&item.choiceGroup!==record.choiceGroup);
        if(conflict)return wx.showToast({title:'同一替代方案只能选择一条路径',icon:'none'});
      }
    }else if(e.kind==='ability'){
      if(!String(e.name||'').trim()||!e.date)return wx.showToast({title:'请填写日期和里程碑',icon:'none'});
      const dateResult=validation.validateDateInLife(e.date,dayReference,'记录日期');
      if(!dateResult.ok)return wx.showToast({title:dateResult.message,icon:'none'});
      const duplicate=(data.abilities||[]).find((item)=>item.id!==e.id&&item.date===e.date&&String(item.name).trim()===e.name.trim());
      if(duplicate)return wx.showToast({title:'同日同名里程碑已存在',icon:'none'});
      record={id:e.id||id('ability'),date:e.date,name:e.name.trim(),description:String(e.description||'').trim(),imageId:e.imageId||undefined};
      collection='abilities';
    }else{
      if(!String(e.name||'').trim()||!e.date)return wx.showToast({title:'请填写日期和儿保项目',icon:'none'});
      const planResult=validation.validateDateNotBeforeBirth(e.date,'儿保日期');
      if(!planResult.ok)return wx.showToast({title:planResult.message,icon:'none'});
      if(e.completed){
        const completedResult=validation.validateDateInLife(e.completedDate,dayReference,'完成日期');
        if(!completedResult.ok)return wx.showToast({title:completedResult.message,icon:'none'});
      }
      const duplicate=(data.checkups||[]).find((item)=>item.id!==e.id&&item.date===e.date&&String(item.name).trim()===e.name.trim());
      if(duplicate)return wx.showToast({title:'同日同名儿保记录已存在',icon:'none'});
      record={id:e.id||id('checkup'),date:e.date,name:e.name.trim(),tips:String(e.tips||'').trim(),completedDate:e.completed?e.completedDate:''};
      collection='checkups';
    }

    try{
      this.setData({editorSaving:true});
      if(cancelVaccination){
        const removed=await store.remove(collection,e.id);
        this.setData({editor:{open:false}});
        this.showUndo(removed,'接种记录已删除');
        return;
      }else if(e.kind==='ability'){
        await media.commitChange({
          originalRefs:[e.originalImageId],
          currentRefs:[e.imageId],
          persist:()=>store.upsert(collection,record)
        });
      }else{
        await store.upsert(collection,record);
      }
      this.setData({editor:{open:false}});
      wx.showToast({title:'已保存',icon:'success'});
    }catch(error){
      if(e.kind==='ability')this.setData({'editor.imageId':e.originalImageId||''});
      wx.showToast({title:errorText(error,'保存失败，请重试'),icon:'none'});
    }finally{
      this.setData({editorSaving:false});
    }
  },
  async deleteEditor(){
    if(this.data.editorSaving||this.data.uploading)return;
    const e=this.data.editor;
    if(!e.id||e.system)return;
    const collection=e.kind==='ability'?'abilities':e.kind==='checkup'?'checkups':'vaccines';
    const confirmed=await new Promise((resolve)=>wx.showModal({title:'删除这条记录？',content:'删除后 30 天内可恢复。',success:(result)=>resolve(result.confirm),fail:()=>resolve(false)}));
    if(!confirmed)return;
    try{
      this.setData({editorSaving:true});
      const removed=await store.remove(collection,e.id);
      this.setData({editor:{open:false}});
      this.showUndo(removed,'记录已删除');
    }catch(error){
      wx.showToast({title:errorText(error,'删除失败，请重试'),icon:'none'});
    }finally{
      this.setData({editorSaving:false});
    }
  },
  showUndo(result,message){
    const trashId=result&&result.trashId||'';
    if(!trashId){wx.showToast({title:message||'已删除',icon:'success'});return;}
    this.setData({undoVisible:true,undoTrashId:trashId,undoMessage:message||'已删除',undoToken:trashId+':'+Date.now()});
  },
  onUndoExpired(){this.setData({undoVisible:false,undoTrashId:'',undoMessage:'',undoToken:''});},
  async undoLastDelete(){
    const trashId=this.data.undoTrashId;
    if(!trashId||this.undoRestoring)return;
    this.undoRestoring=true;
    try{
      await store.restoreFromTrash(trashId);
      if(this.data.undoTrashId===trashId)this.onUndoExpired();
      wx.showToast({title:'已恢复',icon:'success'});
    }catch(error){
      wx.showToast({title:errorText(error,'恢复失败，请到回收站重试'),icon:'none'});
    }finally{this.undoRestoring=false;}
  },
  async chooseImage(){
    if(this.data.uploading||this.data.editorSaving)return;
    try{
      const selected=await media.chooseImage({count:1});
      const file=selected[0];
      if(!file)return;
      this.setData({uploading:true});
      wx.showLoading({title:'正在准备图片'});
      const uploaded=await media.uploadImage(file);
      const imageId=media.mediaPath(uploaded);
      if(!imageId)throw new Error('图片保存失败');
      const previousDraft=this.data.editor.imageId;
      this.setData({'editor.imageId':imageId});
      await media.discardDraft({originalRefs:[this.data.editor.originalImageId],currentRefs:[previousDraft]});
      wx.showToast({title:'图片已选择',icon:'success'});
    }catch(error){
      if(error&&error.errMsg&&error.errMsg.indexOf('cancel')!==-1)return;
      wx.showToast({title:errorText(error,'图片保存失败，请重试'),icon:'none'});
    }finally{
      wx.hideLoading();
      this.setData({uploading:false});
    }
  }
});
