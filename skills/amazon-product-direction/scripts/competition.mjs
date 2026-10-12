// Presets keep each sample and user-specified threshold visible beside its evidence.
export const COMPETITION_RULES = [
  ['new_product_3m','类目','方法一：BSR Top100','近3个月新品占比','比例','完整Top100；日期覆盖100条','采集日前3个日历月，含边界','≥10%：新手友好信号','>=',.10],
  ['new_product_6m','类目','方法一：BSR Top100','近6个月新品占比','比例','完整Top100；日期覆盖100条','采集日前6个日历月，含边界','≥20%：新手友好信号','>=',.20],
  ['listing_distribution','类目','方法一：BSR Top100','上架时间分布','观察','类目BSR Top100','3／6／12个月及更早；注明日期代理值','新品占比越大，机会越多'],
  ['review_time_distribution','类目','方法一：BSR Top100','评论时间分布','观察','类目BSR Top100；工具图表','注明横轴、时间方向、区间、统计对象','核实轴后解释左／右，轴未知则待验证'],
  ['review_count_distribution','类目','方法一：BSR Top100','评论数量分布','观察','类目BSR Top100','从低到高的分桶与各桶数量','低评论区多竞争小，高评论区多竞争大'],
  ['brand_monopoly','类目','方法一：BSR Top100','品牌垄断程度','比例','同站点同类目；工具原范围','填写品牌聚合范围、分子、分母及周期','<45%：可接受','<',.45],
  ['store_monopoly','类目','方法一：BSR Top100','店铺垄断程度','比例','同站点同类目；工具原范围','填写seller ID聚合范围、分子、分母及周期','<45%：可接受','<',.45],
  ['amazon_retail_share','类目','方法一：BSR Top100','Amazon自营占比','比例','类目BSR Top100','按实际销售方识别；FBA不等于自营','<19%：有利信号','<',.19],
  ['fbm_share','类目','方法一：BSR Top100','FBM占比','比例','类目BSR Top100','采集时代表卖家履约方式；注明比较基准','越高越有利，无固定通过线'],
  ['aplus_video_share','类目','方法一：BSR Top100','A+视频占比','比例','类目BSR Top100','注明原定义；A+、视频、两者同时分别记录','越少越有利，无固定通过线'],
  ['overall_rating','类目','方法一：BSR Top100','整体商品星级','星','类目BSR Top100','简单平均或销量加权；注明有效数量','越低越有改善机会，结合差评可解决性'],
  ['top50_low_review_sellers','类目','方法二：BSR Top50','评价数<1000的去重卖家数','家','完整类目BSR Top50','seller ID去重；一个卖家最多计一次','>20家：新手友好信号','>',20],
  ['keyword_bid','核心关键词','Amazon广告后台','关键词建议竞价／实际CPC','销售币种','同站点、同广告与匹配类型','词、建议区间或实际周期；币种和归因口径','比较竞价压力，再结合CVR核验利润'],
  ['shop_reviews','产品／店铺','商品页、卖家页','评论数量与星级','观察','代表竞品及同店产品','商品评价与店铺feedback分别记录','结合积累、增长、星级与重复差评'],
  ['shop_trademark','产品／店铺','官方商标数据库、品牌页','品牌商标','观察','目标销售国家、品牌主体','权利人、状态、类目、查询来源','判断品牌资源；A+不证明商标注册'],
  ['shop_location','产品／店铺','卖家公开公司信息','国家与地区','观察','实际seller ID对应公司主体','公开主体、国家、地区与来源','作为店铺证据，不单凭地区推断实力'],
  ['shop_catalog','产品／店铺','卖家列表、品牌店铺','产品列表与SKU策略','观察','所查店铺及在售列表','SKU数、类目集中、系列与新品；注明范围','识别覆盖强度与可切入空间'],
  ['shop_listing','产品／店铺','商品详情页','文案、图片、A+与视频','观察','代表竞品及对应版本','本地化、卖点、适配、实拍、场景与内容','指出可见差距与实现成本'],
  ['shop_external_promotion','产品／店铺','Keepa辅助、网页核查','站外推广','观察','ASIN／品牌／产品名搜索','Keepa变化时间、搜索式、渠道、推广链接与类型','历史变化不证明站外；查不到不等于没有'],
];
const ruleById = new Map(COMPETITION_RULES.map(r=>[r[0],r]));
const safe = v=>typeof v==='string'&&/^[=+@]/.test(v)?`'${v}`:v??null;
const statuses=['实测','估算','假设','待采集'];
export function validateCompetitionEvidence(p){
  if(p.competition_evidence==null)return;
  if(!Array.isArray(p.competition_evidence))throw Error('competition_evidence须为数组');
  for(const x of p.competition_evidence){
    const r=ruleById.get(x.metric);if(!r)throw Error(`未知竞争指标: ${x.metric}`);
    if(x.status&&!statuses.includes(x.status))throw Error('竞争数据状态无效');
    if(x.coverage&&!['完整','部分','未知'].includes(x.coverage))throw Error('竞争数据覆盖须为完整／部分／未知');
    if(x.analysis!=null&&typeof x.analysis!=='string')throw Error('竞争分析须为文字');
    if(x.value!=null){
      if(['比例','星','家'].includes(r[4])&&(typeof x.value!=='number'||!Number.isFinite(x.value)||x.value<0))throw Error('竞争数值须为非负有限数');
      if(r[4]==='比例'&&x.value>1)throw Error('竞争比例须为0–1小数');
      if(r[4]==='星'&&x.value>5)throw Error('商品星级最大5');
      if(r[4]==='家'&&(!Number.isInteger(x.value)||x.value>50))throw Error('Top50去重卖家数须为0–50整数');
      if(!['string','number'].includes(typeof x.value))throw Error('竞争观察须为文字或数字');
    }
    if(x.collected_at){const d=new Date(`${x.collected_at}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(x.collected_at)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==x.collected_at)throw Error('竞争采集日期无效');if(p.research?.collected_at&&x.collected_at>p.research.collected_at)throw Error('竞争采集日期晚于研究日期');}
  }
}
export function addCompetition(wb,p){
  const supplied=p.competition_evidence??[];
  const records=COMPETITION_RULES.flatMap(r=>{const matches=supplied.filter(x=>x.metric===r[0]);return matches.length?matches.map(x=>({r,x})): [{r,x:{}}];});
  const s=wb.worksheets.add('竞争分析'),end=records.length+5;
  s.showGridLines=false;s.tabColor='#537682';
  const area=s.getRange(`A1:O${end}`);area.format.font={name:'Arial',size:11,color:'#243247'};area.format.verticalAlignment='center';area.format.columnWidth=20;
  s.getRange('A2').values=[['类目、关键词与店铺竞争分析']];s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#192E4A'};
  s.getRange('A3').values=[['用户规则。阈值只产生单项信号；完整覆盖与口径核验后再综合判断。']];
  s.getRange('A4').values=[[safe(p.decision?.competition_tool_route??'工具路径待记录；无Sorftime key时使用Flapen＋ASINSIGHT')]];
  s.getRange('A5:O5').values=[['分析层级','选品分析方法','研究对象','指标','观察／数值','单位','样本范围','统计定义','数据覆盖','判断规则','信号／分析','数据来源','采集日期','数据状态','限制与缺口']];
  const header=s.getRange('A5:O5');header.format.fill='#263D59';header.format.font={name:'Arial',size:11,bold:true,color:'#FFFFFF'};header.format.wrapText=true;header.format.horizontalAlignment='center';header.format.rowHeight=42;header.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};
  s.getRange(`A6:O${end}`).values=records.map(({r,x})=>[r[1],r[2],x.subject??(r[1]==='类目'?(p.research?.category??p.research?.keyword):r[1]==='核心关键词'?p.research?.keyword:null),r[3],x.value,r[4]==='销售币种'?(x.unit??p.research?.currency):r[4],x.sample_scope,x.definition,x.coverage??'未知',r[7],null,x.source,x.collected_at?new Date(`${x.collected_at}T00:00:00Z`):null,x.status??'待采集',x.limit??`待核验：${r[5]}；${r[6]}`].map(v=>v instanceof Date?v:safe(v)));
  records.forEach(({r,x},i)=>{
    const row=i+6;
    if(r[4]==='比例')s.getRange(`E${row}`).setNumberFormat('0.0%');
    if(r[4]==='星')s.getRange(`E${row}`).setNumberFormat('0.00');
    if(['比例','星','家'].includes(r[4]))s.dataValidations.add({range:`E${row}`,rule:{type:r[4]==='家'?'whole':'decimal',operator:'between',formula1:0,formula2:r[4]==='比例'?1:r[4]==='星'?5:50}});
    const missing=`OR(C${row}="",F${row}="",AND(NOT(ISNUMBER(E${row})),E${row}=""),G${row}="",H${row}="",I${row}<>"完整",L${row}="",NOT(ISNUMBER(M${row})),AND(N${row}<>"实测",N${row}<>"估算"))`;
    if(r[8]){
      const positive=r[0].startsWith('new_product')||r[0].startsWith('top50')?'达到新手友好信号':r[0]==='amazon_retail_share'?'有利信号':'可接受';
      s.getRange(`K${row}`).formulas=[[`=IF(OR(${missing},NOT(ISNUMBER(E${row})),E${row}<0,E${row}>${r[4]==='家'?50:1}),"待验证",IF(E${row}${r[8]}${r[9]},"${positive}","未达到此项规则"))`]];
    }else{
      s.getRange(`K${row}`).formulas=[[`=IF(${missing},"待验证",${x.analysis?`"${safe(x.analysis).replaceAll('"','""')}"`:'"待分析方向性证据"'})`]];
    }
  });
  [18,27,28,31,34,14,42,52,14,42,32,48,17,14,58].forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}5:${String.fromCharCode(65+i)}${end}`).format.columnWidth=w);
  s.getRange(`A6:O${end}`).format.wrapText=true;s.getRange(`A6:O${end}`).format.rowHeight=60;
  s.getRange(`E6:I${end}`).format.fill='#FFF4D5';s.getRange(`L6:O${end}`).format.fill='#FFF4D5';s.getRange(`M6:M${end}`).setNumberFormat('yyyy-mm-dd');
  s.getRange(`I6:I${end}`).dataValidation={rule:{type:'list',values:['完整','部分','未知']}};s.getRange(`N6:N${end}`).dataValidation={rule:{type:'list',values:statuses}};
  s.tables.add(`A5:O${end}`,true,'CompetitionEvidence').showFilterButton=true;s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(2);
  const summary=wb.worksheets.getItem('类目判断');
  for(const [i,label,key,note]of [[55,'类目竞争结论','category_competition','Top100与Top50分别记录，至少一条可得路线'],[56,'关键词竞价结论','keyword_competition','后台建议竞价、实际CPC与利润承受力'],[57,'竞品店铺实力','shop_competition','商品评价、商标、地区、SKU、内容、站外'],[58,'竞争工具路径','competition_tool_route','Sorftime或Flapen＋ASINSIGHT及覆盖'],[59,'竞争证据缺口','competition_gaps','注明缺字段、样本、权限或统计定义']])summary.getRange(`A${i}:D${i}`).values=[[label,safe(p.decision?.[key]),note,'见竞争分析页与逐项来源']];
  summary.getRange('A55:D59').format.font={name:'Arial',size:11,color:'#243247'};summary.getRange('A55:D59').format.wrapText=true;summary.getRange('A55:D59').format.rowHeight=60;
  const prior=summary.getRange('B48').formulas[0][0];summary.getRange('B48').formulas=[[prior.replace('B32="",','B32="",B55="",B56="",B57="",')]];
}
