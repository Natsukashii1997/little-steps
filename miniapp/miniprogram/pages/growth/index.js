const store = require('../../lib/store');
const { getHeaderLayout } = require('../../lib/layout');
const validation = require('../../lib/validation');
const derive = require('../../lib/derive');
const { BABY } = require('../../lib/constants');
const { measured, measurementText, buildCharts } = require('../../lib/growth-view');

const today = (nowValue) => validation.todayKey(nowValue);
const id = () => `growth-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const displayDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : '未填写';
};
const displayRecordDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${year}.${Number(month)}.${Number(day)}` : '未填写';
};
const errorText = (error, fallback) => error && (error.errMsg || error.message) || fallback;
function profileFrom(data) {
  const baby = Object.assign({}, BABY, data && data.baby || {});
  return {
    name: baby.name,
    birthDate: baby.birthDate,
    birthDateText: displayDate(baby.birthDate),
    birthWeight: Number(baby.birthWeight),
    birthHeight: Number(baby.birthHeight),
  };
}
function ageLabel(birthDate, nowValue) {
  const age = derive.babyAge(birthDate, nowValue);
  return `${age.months}个月${age.days}天`;
}
function normalise(data, profile) {
  const records = data.growthRecords || [];
  const storedBirth = records.find((record) => record.date === profile.birthDate);
  const birth = {
    id: storedBirth && storedBirth.id || 'birth-growth',
    date: profile.birthDate,
    weight: profile.birthWeight,
    height: profile.birthHeight,
    note: '出生记录',
    isBirth: true,
  };
  const list = records.filter((record) => record.date !== profile.birthDate).map((record) => ({ ...record, isBirth:false }));
  return [birth, ...list].sort((a,b) => String(b.date).localeCompare(String(a.date))).map((record) => ({
    ...record,
    displayDate: displayRecordDate(record.date),
    weightText: measurementText(record.weight),
    heightText: measurementText(record.height),
    noteText: record.note || '—',
  }));
}

Page({
  data: {
    headerHeight: getHeaderLayout().totalHeight,
    babyProfile: profileFrom({ baby: BABY }),
    records: [],
    chartPoints: [],
    charts: [],
    latest: {},
    ageLabel: ageLabel(BABY.birthDate),
    today: today(),
    saving: false,
    editor: { open:false },
    undoVisible: false,
    undoTrashId: '',
    undoMessage: '',
    undoToken: '',
  },
  onLoad() { this.unsubscribe = store.subscribe(() => this.refresh()); this.refresh(); },
  onShow(){ this.refresh(); }, onUnload(){ if(this.unsubscribe) this.unsubscribe(); },
  onShareAppMessage(){ return { title:'硕之的成长曲线', path:'/pages/growth/index' }; },
  refresh() {
    const data = store.getData();
    const now = this.now ? this.now() : new Date();
    const babyProfile = profileFrom(data);
    const records = normalise(data, babyProfile);
    this.setData({
      babyProfile,
      records,
      chartPoints:[...records].reverse(),
      charts:buildCharts(records),
      latest:{ ...records[0], dateText:displayDate(records[0].date) },
      today:today(now),
      ageLabel:ageLabel(babyProfile.birthDate, now),
    });
  },
  onNavigate(e){ const page = e.detail?.page || e.currentTarget.dataset.page; if(page) wx.reLaunch({ url:`/pages/${page}/index` }); },
  noop(){},
  openAdd(){ this.setData({ editor:{ open:true, id:'', isBirth:false, date:this.data.today, height:'', weight:'', note:'' } }); },
  openEdit(e){ const row=this.data.records.find((r)=>r.id===e.currentTarget.dataset.id); if(!row)return; this.setData({ editor:{ open:true,id:row.id,isBirth:row.isBirth,date:row.date,height:measured(row.height)?String(row.height):'',weight:measured(row.weight)?String(row.weight):'',note:row.note||'' } }); },
  closeEditor(){ if(this.data.saving)return; this.setData({ editor:{open:false} }); },
  changeDate(e){ this.setData({'editor.date':e.detail.value}); }, changeHeight(e){this.setData({'editor.height':e.detail.value});}, changeWeight(e){this.setData({'editor.weight':e.detail.value});}, changeNote(e){this.setData({'editor.note':e.detail.value});},
  async saveRecord(){
    if(this.data.saving)return;
    const e=this.data.editor;
    const result=validation.validateGrowthRecord(e,store.getData().growthRecords,this.now ? this.now() : new Date());
    if(!result.ok)return wx.showToast({title:result.message,icon:'none'});
    const record={...result.value,id:e.id||id()};
    try{
      this.setData({saving:true});
      await store.upsert('growthRecords',record);
      this.setData({editor:{open:false}});
      wx.showToast({title:'已保存',icon:'success'});
    }catch(error){
      wx.showToast({title:errorText(error,'保存失败，请重试'),icon:'none'});
    }finally{
      this.setData({saving:false});
    }
  },
  async deleteRecord(){
    if(this.data.saving)return;
    const e=this.data.editor;
    if(!e.id||e.isBirth)return;
    const confirmed=await new Promise((resolve)=>wx.showModal({title:'删除成长数据？',content:'删除后 30 天内可恢复。',success:(result)=>resolve(result.confirm),fail:()=>resolve(false)}));
    if(!confirmed)return;
    try{
      this.setData({saving:true});
      const removed=await store.remove('growthRecords',e.id);
      this.setData({editor:{open:false}});
      this.showUndo(removed,'成长记录已删除');
    }catch(error){
      wx.showToast({title:errorText(error,'删除失败，请重试'),icon:'none'});
    }finally{
      this.setData({saving:false});
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
  }
});
