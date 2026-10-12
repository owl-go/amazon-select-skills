import fs from 'node:fs/promises';
import {addScreening} from './screening.mjs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

export const HEADERS=['排名','产品名称','类目','核心关键词','ASIN','价格','评论数','评分','竞争程度','变体数','上架时间','FBA/FBM','进货价','毛利润','毛利率','主要差评','是否有专利','是否A+','选品方法','商品链接','数据来源','采集日期','父ASIN','变体策略','评论口径','头程','平台佣金','履约费','包装及其他成本','成本状态','是否错配','广告成本','仓储','税费','退货损耗','净利润','净利率','利润判断'];
const REVIEW_HEADERS=['ASIN','星级','评论日期','原文短摘／摘要','问题分类','具体问题','使用场景','产品改进方向','样本内出现次数','采样范围','评论链接／ID','数据来源','采集日期','备注'];
const MARKET_HEADERS=['分析维度','关键词／指标','买家意图／定义','数值／观察','单位','统计周期','站点','趋势／季节性','竞争／相关性','差异化启示','来源','采集日期','数据状态','限制'];
const PATENTS=['待核查','发现相关专利','初步未发现','已确认相关风险'];
const CATEGORIES=['质量与耐用性','尺寸与适配','使用场景缺失','其他'];
const CONCLUSIONS=['待验证','继续研究','可打样','暂缓','淘汰'];
const col=n=>{let s='';for(++n;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const safe=v=>typeof v==='string'&&/^[=+@]/.test(v)?`'${v}`:v??null;
const date=v=>{if(v==null||v==='')return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error(`日期须为YYYY-MM-DD: ${v}`);const d=new Date(`${v}T00:00:00Z`);if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v)throw Error(`无效日期: ${v}`);return d;};

export function validate(p,template=false){
  const r=p.research??{},rows=p.competitors??[],reviews=p.reviews??[];
  date(r.collected_at);
  if(r.stage&&!['初筛','深度研究'].includes(r.stage))throw Error('stage须为初筛或深度研究');
  if(!template&&(!r.marketplace||!r.currency||!r.collected_at||!(r.category||r.keyword)))throw Error('研究模式需站点、币种、日期及类目或关键词');
  if(!Array.isArray(rows)||rows.length>20||!Array.isArray(reviews))throw Error('竞品最多20条，竞品及差评须为数组');
  const ranks=new Set(),asins=new Set(),parents=new Set(),reviewKeys=new Set(),candidateKeys=new Set();
  for(const x of rows){
    if(!Number.isInteger(x.rank)||x.rank<1||x.rank>20||ranks.has(x.rank))throw Error('排名须为唯一1–20');
    if(!x.product_name||(x.asin&&(!/^[A-Z0-9]{10}$/.test(x.asin)||asins.has(x.asin))))throw Error('竞品须有名称和唯一10位ASIN');
    if(!x.asin&&(r.stage!=='初筛'||!(x.product_url||x.source)))throw Error('深度研究需ASIN；初筛的外部候选需可追溯来源');
    const candidateKey=`${x.product_name}|${x.keyword??r.keyword??''}|${x.category??r.category??''}`;
    if(candidateKeys.has(candidateKey))throw Error('候选产品重复');candidateKeys.add(candidateKey);
    if(x.parent_asin&&(parents.has(x.parent_asin)||!/^[A-Z0-9]{10}$/.test(x.parent_asin)))throw Error('父ASIN无效或重复');
    ranks.add(x.rank);if(x.asin)asins.add(x.asin);if(x.parent_asin)parents.add(x.parent_asin);
    for(const k of ['price','review_count','rating','variant_count','purchase_price','inbound_cost','referral_fee','fulfillment_fee','other_cost','storage_cost','tax_cost','return_cost'])if(x[k]!=null&&(typeof x[k]!=='number'||!Number.isFinite(x[k])||x[k]<0))throw Error(`${k}须为非负数或null`);
    for(const k of ['review_count','variant_count'])if(x[k]!=null&&!Number.isInteger(x[k]))throw Error(`${k}须为整数`);
    if(x.rating>5||x.price===0)throw Error('星级最大5，售价须大于0');
    for(const k of ['listed_at','collected_at']){date(x[k]);if(x[k]&&r.collected_at&&x[k]>r.collected_at)throw Error(`${k}晚于研究日期`);}
    for(const [k,a] of [['patent_status',PATENTS],['has_aplus',['是','否','待核查']],['fulfillment',['FBA','FBM','混合','待核查']]])if(x[k]&&!a.includes(x[k]))throw Error(`${k}状态无效`);
  }
  for(const k of ['price_band_low','price_band_high','low_review_threshold','low_rating_threshold'])if(r[k]!=null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<=0))throw Error(`${k}须为正数`);
  for(const k of ['target_acos','margin_buffer'])if(r[k]!=null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1))throw Error(`${k}须为0–1小数`);
  if(r.low_rating_threshold>5||(r.low_review_threshold!=null&&!Number.isInteger(r.low_review_threshold)))throw Error('评价阈值无效');
  if(r.price_band_low!=null&&r.price_band_high!=null&&r.price_band_low>r.price_band_high)throw Error('主流价格带下界大于上界');
  for(const x of reviews){
    if(!asins.has(x.asin)||![1,2,3].includes(x.stars)||!CATEGORIES.includes(x.category)||!x.issue||!x.summary)throw Error('差评须属于已采集ASIN、1–3星、有分类和具体问题');
    date(x.reviewed_at);date(x.collected_at);
    if(x.reviewed_at&&r.collected_at&&x.reviewed_at>r.collected_at)throw Error('评论日期晚于研究日期');
    const key=x.review_url||`${x.asin}|${x.reviewed_at??''}|${x.summary}`;if(reviewKeys.has(key))throw Error('同一差评重复');reviewKeys.add(key);
  }
  if(p.decision?.conclusion&&!CONCLUSIONS.includes(p.decision.conclusion))throw Error('结论状态无效');
  if(p.decision?.reference_asin&&!asins.has(p.decision.reference_asin))throw Error('利润参考ASIN不属于竞品样本');
  if(p.decision?.patent_status&&!PATENTS.includes(p.decision.patent_status))throw Error('专利状态无效');
  if(p.market_evidence!=null&&!Array.isArray(p.market_evidence))throw Error('market_evidence须为数组');
}
function base(s,last,end,title,subtitle){
  s.showGridLines=false;const a=s.getRange(`A1:${last}${end}`);a.format.font={name:'Arial',size:11,color:'#243247'};a.format.verticalAlignment='center';a.format.rowHeight=28;a.format.columnWidth=16;
  s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#192E4A'};
  s.getRange('A3').values=[[subtitle]];s.getRange('A3').format.font={name:'Arial',size:11,italic:true,color:'#596675'};
}
function head(s,range){const a=s.getRange(range);a.format.fill='#263D59';a.format.font={name:'Arial',size:11,bold:true,color:'#FFFFFF'};a.format.wrapText=true;a.format.horizontalAlignment='center';a.format.rowHeight=38;a.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};}
function list(s,range,values){s.getRange(range).dataValidation={rule:{type:'list',values}};}
function num(s,range,type,low,high){s.dataValidations.add({range,rule:{type,operator:'between',formula1:low,formula2:high}});}
function table(s,range,name,freeze=1){s.tables.add(range,true,name).showFilterButton=true;s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(freeze);}
function widths(s,ws,end){ws.forEach((w,i)=>s.getRange(`${col(i)}5:${col(i)}${end}`).format.columnWidth=w);}

export function buildWorkbook(p,{Workbook},template=false){
  validate(p,template);const r=p.research??{},d=p.decision??{},rows=[...(p.competitors??[])].sort((a,b)=>a.rank-b.rank),reviews=p.reviews??[],evidence=p.market_evidence??[];
  const wb=Workbook.create(),s=wb.worksheets.add('类目判断'),m=wb.worksheets.add('选品表'),market=wb.worksheets.add('市场与关键词'),v=wb.worksheets.add('差评分析');
  base(s,'D',49,'亚马逊选品判断','市场容量、市场竞争、利润、关键词、差异化；利润一票否决');s.tabColor='#263D59';
  s.getRange('A4:B18').values=[['站点',r.marketplace??null],['类目',r.category??null],['核心关键词',r.keyword??null],['金额币种',r.currency??null],['采集日期',date(r.collected_at)],['近一年起始日期',null],['低评论数阈值',r.low_review_threshold??1000],['低评分阈值',r.low_rating_threshold??4.3],['目标样本数',20],['主流价格带下界',r.price_band_low??null],['主流价格带上界',r.price_band_high??null],['利润参考ASIN',d.reference_asin??null],['目标ACoS',r.target_acos??0.30],['毛利安全余量',r.margin_buffer??0.05],['最低毛利率',null]];
  s.getRange('B9').formulas=[['=IF(ISNUMBER(B8),EDATE(B8,-12),"")']];s.getRange('B18').formulas=[['=IF(COUNT(B16:B17)=2,SUM(B16:B17),"")']];
  s.getRange('B8:B9').setNumberFormat('yyyy-mm-dd');s.getRange('B11').setNumberFormat('0.0');s.getRange('B13:B14').setNumberFormat('#,##0.00');s.getRange('B16:B18').setNumberFormat('0.0%');
  for(const range of ['B4:B8','B10:B11','B13:B17'])s.getRange(range).format.fill='#FFF4D5';
  s.getRange('D4:D5').values=[[safe(r.sample_scope||'待确定排名、配送地区与来源')],[safe(r.assumptions||(template?'模板：尚未采集商品数据':'缺失项保持待验证'))]];
  s.getRange('D9').values=[['采集日往前12个日历月，含首尾边界']];s.getRange('D13:D14').values=[[safe(r.price_band_basis||'待填写可比规格和主流带依据')],['排除尺寸、件数及优惠差异']];
  s.getRange('D15:D18').values=[['选取对应自有方案的参考竞品；成本不是竞品采购内幕'],[safe(r.acos_basis||'30%为用户广告情景，可修改；不是类目实测值')],['35%−30%推得5个百分点余量，可调整'],['毛利率须至少达到此值；ACoS按广告归因订单口径']];
  s.getRange('A19:B19').values=[['当前阶段',r.stage??'深度研究']];list(s,'B19',['初筛','深度研究']);s.getRange('D19').values=[['初筛可跨类目建候选池；前20分析需同站点、同关键词去重样本']];
  s.getRange('A20:D20').values=[['判断项','结果','规则／口径','依据与下一步']];head(s,'A20:D20');
  const q=c=>`'选品表'!$${c}$6:$${c}$25`,a=q('E');
  const f={21:`=COUNTA(${a})`,22:`=COUNT(${q('F')})`,23:`=COUNT(${q('G')})`,24:`=IF(B23=0,"",COUNTIFS(${a},"<>",${q('G')},">=0",${q('G')},"<"&$B$10))`,25:'=IF(B23<$B$12,"待补评论数",B24/$B$12)',26:`=IF(B23=0,"",COUNTIFS(${a},"<>",${q('G')},">10000"))`,27:'=IF(B23<$B$12,"待补评论数",B26/$B$12)',28:'=IF(B21<$B$12,"样本不足",IF(B23<$B$12,"待补评论数",IF(B26=$B$12,"高",IF(B24/$B$12>0.5,"较低","中，复核分布"))))',29:`=COUNT(${q('J')})`,30:`=IF(B29=0,"",COUNTIFS(${a},"<>",${q('J')},">1"))`,31:`=IF(B29=0,"",MAX(${q('J')}))`,33:`=COUNT(${q('K')})`,34:`=IF(OR(B33=0,NOT(ISNUMBER($B$8))),"",COUNTIFS(${a},"<>",${q('K')},">="&$B$9,${q('K')},"<="&$B$8))`,35:'=IF(B33<$B$12,"待补上架时间",IF(ISNUMBER(B34),B34/$B$12,"待填采集日期"))',36:'=IF(B21<$B$12,"样本不足",IF(B33<$B$12,"待补上架时间",IF(NOT(ISNUMBER(B35)),"待填采集日期",IF(B35>=0.5,"对新链接友好","新品进入较少"))))',37:`=IF(OR(B21=0,NOT(ISNUMBER($B$13))),"待验证",COUNTIFS(${q('AE')},"是"))`,38:`=IF(B21=0,"",COUNTIFS(${q('AE')},"待验证"))`};
  for(const [row,c]of [[43,'AJ'],[44,'AK'],[45,'AL']])f[row]=`=IF($B$15="","待选择利润方案",IF(COUNTIFS(${a},$B$15)=0,"ASIN未匹配",IF(INDEX(${q(c)},MATCH($B$15,${a},0))="","待补利润数据",INDEX(${q(c)},MATCH($B$15,${a},0)))))`;
  f[48]='=IF(LEFT(B45,2)="否决","淘汰（利润否决）",IF(OR(B47="淘汰",B47="暂缓"),B47,IF(B45<>"达标","待验证",IF(B46="已确认相关风险","暂缓（专利风险）",IF(OR(B21<>$B$12,B23<>$B$12,B33<>$B$12,B29<>$B$12,B32="",B39="",B40="",B41="",B42="",B46="待核查",B46="发现相关专利"),"待验证",B47)))))';
  const metrics=[['已采集竞品数','20个去重父体','不足20个不判断完整类目'],['价格有效数量','可比规格、同币种','补规格及价格口径'],['评论数有效数量','统一评价数量口径','缺失不计为零'],['低评论数竞品数','严格低于B10','阈值默认1000'],['低评论数占比','完整20个中超过一半','缺失时待验证'],['过万评论竞品数','严格超过10000','展示分布'],['过万评论占比','完整前20为分母','全20过万视为壁垒高'],['评论壁垒','全过万：高；多数低评论：较低','结合品牌及价格竞争'],['变体数有效数量','核实可售SKU','不以颜色×尺寸推算'],['多变体竞品数','变体数大于1','分析系列覆盖'],['最大变体数','已核实SKU数','数量不代替覆盖分析'],['SKU策略判断','尺寸、颜色与切入空间','填写具体策略'],['上架时间有效数量','首次可售日期代理值','核查父子体迁移'],['近一年新品数量','起始日至采集日，含边界','日期未知保持空白'],['近一年新品占比','完整前20为分母','不全时待验证'],['新品友好度','至少一半近一年上架','结合实际相关性'],['错配竞品数量','低价格＋低评论＋低评分','深查具体差评'],['错配数据缺失数量','价格／评论／评分／主流带缺失','已有数量仅为下限'],['市场容量结论','需求规模、趋势、季节性','引用市场与关键词数据'],['关键词结论','需求词、买家意图、相关性','搜索量不等于销量'],['主要差评需求','1–3星独立评论样本','记录频次及采样限制'],['差异化方案','需求对应改善、验证与成本','复核增量成本'],['参考方案净利润','单件，按广告订单情景','含广告、仓储、税费与退货'],['参考方案净利率','净利润÷售价','追溯对应成本'],['利润判断','毛利率≥ACoS＋安全余量，且净利润>0','不达标一票否决；缺成本待验证'],['专利核查状态','保留范围、编号与来源','初步未发现不等于无风险'],['初步进入结论','人工判断草案','不能覆盖利润否决'],['最终进入结论','受利润否决及数据完整性约束','其他优势不能抵消利润不达标'],['下一步','补数据或验证动作','明确需要取得的证据']];
  s.getRange('A21:D49').values=metrics.map(x=>[x[0],null,x[1],x[2]]);
  for(const [row,formula]of Object.entries(f))s.getRange(`B${row}`).formulas=[[formula]];
  for(const [row,key]of [[32,'sku_strategy'],[39,'market_capacity'],[40,'keywords'],[41,'main_pain'],[42,'differentiation'],[46,'patent_status'],[47,'conclusion'],[49,'next_step']]){s.getRange(`B${row}`).values=[[safe(d[key]??(row===46?'待核查':row===47?'待验证':null))]];s.getRange(`B${row}`).format.fill='#FFF4D5';}
  for(const row of [25,27,35,44])s.getRange(`B${row}`).setNumberFormat('0.0%');s.getRange('B43').setNumberFormat('#,##0.00');
  list(s,'B46',PATENTS);list(s,'B47',CONCLUSIONS);num(s,'B10','whole',1,10000000);num(s,'B11','decimal',0.1,5);num(s,'B16:B17','decimal',0,1);
  widths(s,[28,45,46,58],49);s.getRange('A4:D49').format.wrapText=true;s.getRange('A21:D49').format.rowHeight=48;
  s.getRange('B48').conditionalFormats.add('containsText',{text:'淘汰',format:{fill:'#FCE7E7',font:{color:'#9E3030',bold:true}}});

  base(m,'AL',25,'选品表','保留商品评价星级，记录发现方法、初筛依据与利润否决');
  m.getRange('A4').values=[[`币种：${r.currency||'待填写'}。毛利润扣采购、头程、佣金、履约、包装；广告、仓储、税费、退货另计入净利润。`]];
  m.getRange('A5:AL5').values=[HEADERS];head(m,'A5:AL5');
  const matrix=Array.from({length:20},(_,i)=>{const x=rows[i];if(!x)return Array.from({length:38},(_,j)=>j===0&&template?i+1:null);return[x.rank,x.product_name,x.category??r.category,x.keyword??r.keyword,x.asin,x.price,x.review_count,x.rating,x.competition,x.variant_count,date(x.listed_at),x.fulfillment,x.purchase_price,null,null,x.main_pain,x.patent_status??'待核查',x.has_aplus??'待核查',x.selection_method??r.selection_method??null,x.product_url,x.source,date(x.collected_at??r.collected_at),x.parent_asin,x.variant_strategy,x.review_scope,x.inbound_cost,x.referral_fee,x.fulfillment_fee,x.other_cost,null,null,null,x.storage_cost,x.tax_cost,x.return_cost,null,null,null].map(y=>y instanceof Date?y:safe(y));});
  m.getRange('A6:AL25').values=matrix;
  for(let row=6;row<=25;row++){
    m.getRange(`N${row}:O${row}`).formulas=[[`=IF(AND(ISNUMBER(F${row}),F${row}>0,ISNUMBER(M${row}),COUNT(Z${row}:AC${row})=4),F${row}-SUM(M${row},Z${row}:AC${row}),"")`,`=IF(AND(ISNUMBER(N${row}),ISNUMBER(F${row}),F${row}>0),N${row}/F${row},"")`]];
    m.getRange(`AD${row}:AF${row}`).formulas=[[`=IF(B${row}="","",IF(ISNUMBER(N${row}),"毛利成本齐","待补毛利成本"))`,`=IF(B${row}="","",IF(OR(COUNT(F${row}:H${row})<3,NOT(ISNUMBER('类目判断'!$B$13))),"待验证",IF(AND(F${row}<'类目判断'!$B$13,G${row}<'类目判断'!$B$10,H${row}<'类目判断'!$B$11),"是","否")))`,`=IF(AND(B${row}<>"",ISNUMBER(F${row}),ISNUMBER('类目判断'!$B$16)),F${row}*'类目判断'!$B$16,"")`]];
    m.getRange(`AJ${row}:AL${row}`).formulas=[[`=IF(AND(ISNUMBER(N${row}),COUNT(AF${row}:AI${row})=4),N${row}-SUM(AF${row}:AI${row}),"")`,`=IF(AND(ISNUMBER(AJ${row}),ISNUMBER(F${row}),F${row}>0),AJ${row}/F${row},"")`,`=IF(B${row}="","",IF(NOT(ISNUMBER(O${row})),"待补毛利成本",IF(NOT(ISNUMBER('类目判断'!$B$18)),"待填广告参数",IF(ROUND(O${row},10)<ROUND('类目判断'!$B$18,10),"否决：毛利率不足",IF(NOT(ISNUMBER(AJ${row})),"待补完整成本",IF(AJ${row}<=0,"否决：净利润不为正","达标"))))))`]];
  }
  widths(m,[8,32,20,28,16,13,13,10,28,11,17,14,13,13,13,40,21,13,25,36,52,17,16,40,36,13,13,13,20,26,15,13,13,13,13,13,13,26],25);
  for(const c of ['F','M','N','Z','AA','AB','AC','AF','AG','AH','AI','AJ'])m.getRange(`${c}6:${c}25`).setNumberFormat('#,##0.00');for(const c of ['O','AK'])m.getRange(`${c}6:${c}25`).setNumberFormat('0.0%');m.getRange('H6:H25').setNumberFormat('0.0');for(const c of ['K','V'])m.getRange(`${c}6:${c}25`).setNumberFormat('yyyy-mm-dd');
  m.getRange('A6:AL25').format.wrapText=true;m.getRange('A6:AL25').format.rowHeight=48;for(const range of ['M6:M25','Z6:AC25','AG6:AI25'])m.getRange(range).format.fill='#FFF4D5';
  list(m,'L6:L25',['FBA','FBM','混合','待核查']);list(m,'Q6:Q25',PATENTS);list(m,'R6:R25',['是','否','待核查']);for(const c of ['G','J'])num(m,`${c}6:${c}25`,'whole',0,10000000);num(m,'H6:H25','decimal',0,5);
  m.getRange('H6:H25').conditionalFormats.addCustom("AND(ISNUMBER(H6),H6<INDIRECT(\"'类目判断'!$B$11\"))",{fill:'#FFF0D8',font:{color:'#92580C'}});
  m.getRange('AL6:AL25').conditionalFormats.add('containsText',{text:'否决',format:{fill:'#FCE7E7',font:{color:'#9E3030'}}});m.freezePanes.freezeRows(5);m.freezePanes.freezeColumns(2);

  const me=Math.max(25,evidence.length+5);base(market,'N',me,'市场容量与关键词','指标注明周期、单位与来源；搜索量不等于销量');market.getRange('A5:N5').values=[MARKET_HEADERS];head(market,'A5:N5');
  if(evidence.length)market.getRange(`A6:N${evidence.length+5}`).values=evidence.map(x=>[x.dimension,x.metric,x.intent,x.value,x.unit,x.period,x.marketplace??r.marketplace,x.trend,x.competition,x.differentiation,x.source,date(x.collected_at??r.collected_at),x.status,x.limit].map(y=>y instanceof Date?y:safe(y)));
  widths(market,[18,32,36,28,14,23,14,35,35,40,48,17,16,44],me);market.getRange(`A6:N${me}`).format.wrapText=true;market.getRange(`A6:N${me}`).format.rowHeight=58;market.getRange(`L6:L${me}`).setNumberFormat('yyyy-mm-dd');list(market,`A6:A${me}`,['市场容量','关键词']);list(market,`M6:M${me}`,['实测','估算','假设','待采集']);table(market,`A5:N${me}`,'MarketEvidence');

  const ve=Math.max(25,reviews.length+5);base(v,'N',ve,'1–3星差评分析','每个独立评论一行，主要问题归类；次数仅代表样本');v.getRange('A5:N5').values=[REVIEW_HEADERS];head(v,'A5:N5');
  if(reviews.length)v.getRange(`A6:N${reviews.length+5}`).values=reviews.map(x=>[x.asin,x.stars,date(x.reviewed_at),x.summary,x.category,x.issue,x.scenario,x.improvement,null,x.sampling_scope,x.review_url,x.source,date(x.collected_at??r.collected_at),x.note].map(y=>y instanceof Date?y:safe(y)));
  for(let row=6;row<=ve;row++)v.getRange(`I${row}`).formulas=[[`=IF(OR(A${row}="",B${row}="",F${row}=""),"",COUNTIFS($E$6:$E$${ve},E${row},$F$6:$F$${ve},F${row},$A$6:$A$${ve},"<>"))`]];
  widths(v,[16,8,17,50,23,32,32,40,17,35,44,44,17,40],ve);v.getRange(`A6:N${ve}`).format.wrapText=true;v.getRange(`A6:N${ve}`).format.rowHeight=58;for(const c of ['C','M'])v.getRange(`${c}6:${c}${ve}`).setNumberFormat('yyyy-mm-dd');num(v,`B6:B${ve}`,'whole',1,3);list(v,`E6:E${ve}`,CATEGORIES);table(v,`A5:N${ve}`,'ReviewSamples');
  addScreening(wb,p);
  return wb;
}
export async function loadArtifact(moduleDir){if(!moduleDir)throw Error('需--module-dir指定工作区node_modules');const require=createRequire(path.join(path.resolve(moduleDir),'..','selection-loader.cjs'));return import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);}
async function main(){
  const args=process.argv.slice(2),o={};for(let i=0;i<args.length;i++){const k=args[i];if(['--template','--force'].includes(k))o[k]=true;else if(['--module-dir','--data','--output','--render-dir','--date'].includes(k)&&args[i+1])o[k]=args[++i];else throw Error(`无效参数: ${k}`);}
  if(!o['--output']||(!o['--template']&&!o['--data']))throw Error('需--output与--data，模板用--template --date YYYY-MM-DD');
  if(!o['--force']){try{await fs.access(o['--output']);throw Error('输出已存在：换路径或在授权更新时加--force');}catch(e){if(e.code!=='ENOENT')throw e;}}
  const p=o['--template']?{research:{stage:'初筛',collected_at:o['--date']??null},competitors:[],reviews:[]}:JSON.parse(await fs.readFile(o['--data'],'utf8'));
  const api=await loadArtifact(o['--module-dir']),wb=buildWorkbook(p,api,!!o['--template']);wb.recalculate();
  const scan=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:50},maxChars:4000});
  if(scan.ndjson&&/"error"|"address"/.test(scan.ndjson))throw Error(`检查公式错误: ${scan.ndjson}`);
  await fs.mkdir(path.dirname(path.resolve(o['--output'])),{recursive:true});const out=await api.SpreadsheetFile.exportXlsx(wb);await out.save(o['--output']);
  if(o['--render-dir']){await fs.mkdir(o['--render-dir'],{recursive:true});for(const [sheetName,range]of [['类目判断','A2:D25'],['类目判断','A26:D54'],['选品表','A2:H10'],['选品表','I5:S10'],['选品表','T5:AE10'],['选品表','AF5:AL10'],['选品表','AM5:AU10'],['选品方法','A2:I10'],['选品方法','J5:S10'],['选品方法','A11:I20'],['初筛规则','A2:F18'],['初筛规则','A20:B27'],['市场与关键词','A2:H10'],['市场与关键词','I5:N10'],['差评分析','A2:I10'],['差评分析','J5:N10']]){const img=await wb.render({sheetName,range,scale:1.2,format:'png'});await fs.writeFile(path.join(o['--render-dir'],`${sheetName}-${range.replace(':','-')}.png`),new Uint8Array(await img.arrayBuffer()));}}
  console.log(JSON.stringify({output:path.resolve(o['--output']),competitors:p.competitors?.length??0,reviews:p.reviews?.length??0,sheets:['类目判断','选品表','市场与关键词','差评分析','选品方法','初筛规则']}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
