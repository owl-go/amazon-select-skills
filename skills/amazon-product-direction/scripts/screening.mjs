import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('../assets/methods.json',import.meta.url),'utf8'));
const methodNames=catalog.methods.map(x=>x.name);
const extras=['辅助选品方法','初筛得分','评分覆盖率','初筛状态','市场容量分','市场竞争分','关键词分','差异化分','初筛依据'];
const keys=['market_capacity','competition','keywords','differentiation'];
const safe=x=>typeof x==='string'&&/^[=+@]/.test(x)?`'${x}`:x??null;
const col=n=>{let s='';for(++n;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function header(s,range){const r=s.getRange(range);r.format.fill='#263D59';r.format.font={name:'Arial',size:11,bold:true,color:'#FFFFFF'};r.format.horizontalAlignment='center';r.format.wrapText=true;r.format.rowHeight=42;r.format.borders={insideVertical:{style:'thin',color:'#FFFFFF'}};}
function setup(s,last,end,title,subtitle){s.showGridLines=false;const r=s.getRange(`A1:${last}${end}`);r.format.font={name:'Arial',size:11,color:'#243247'};r.format.verticalAlignment='center';r.format.rowHeight=30;r.format.columnWidth=18;s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#192E4A'};s.getRange('A3').values=[[subtitle]];s.getRange('A3').format.font={name:'Arial',size:11,italic:true,color:'#596675'};}
function validation(s,range,values){s.getRange(range).dataValidation={rule:{type:'list',values}};}
function weights(values,count){if(!Array.isArray(values)||values.length!==count||values.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('权重须为指定数量的非负小数且合计1');return values;}

export function addScreening(wb,p){
  const main=wb.worksheets.getItem('选品表'),summary=wb.worksheets.getItem('类目判断'),rules=wb.worksheets.add('初筛规则'),method=wb.worksheets.add('选品方法'),r=p.research??{};
  const productWeights=weights(r.screening_weights??[.30,.25,.20,.25],4),methodWeights=weights(r.method_weights??[.35,.25,.20,.10,.10],5);
  const rows=[...(p.competitors??[])].sort((a,b)=>a.rank-b.rank);
  for(const cell of ['B28','B36']){const prior=summary.getRange(cell).formulas[0][0];summary.getRange(cell).formulas=[[`=IF($B$19="初筛","初筛阶段，待前20验证",${prior.slice(1)})`]];}
  for(const x of rows){
    const name=x.selection_method??r.selection_method;if(name&&!methodNames.includes(name))throw Error(`选品方法不在目录中: ${name}`);
    for(const k of keys)if(x.screening_scores?.[k]!=null&&(!Number.isInteger(x.screening_scores[k])||x.screening_scores[k]<1||x.screening_scores[k]>5))throw Error('初筛维度须为1–5整数或null');
    if(keys.some(k=>x.screening_scores?.[k]!=null)&&!x.screening_basis)throw Error('初筛评分需填写证据依据');
  }
  setup(rules,'F',27,'初筛评分规则','初筛决定研究顺序；利润独立否决，不参与加权抵消');
  rules.getRange('A4:F4').values=[['候选权重',...productWeights,null]];rules.getRange('B4:E4').setNumberFormat('0%');rules.getRange('B4:E4').format.fill='#FFF4D5';
  rules.getRange('A5:F5').values=[['维度','市场容量','市场竞争','关键词','差异化','合计']];header(rules,'A5:F5');rules.getRange('F4').formulas=[['=SUM(B4:E4)']];rules.getRange('F4').setNumberFormat('0%');
  rules.getRange('A7:F10').values=[['市场容量','30%默认','1：目标市场线索弱','3：有相关需求与趋势线索','5：多来源持续需求、规模有支撑','搜索量非销量；未知留空'],['市场竞争','25%默认','1：集中、自营、评论或SKU壁垒明显','3：部分类目信号友好，词或店铺空间待验证','5：类目机会、广告承受力、店铺／SKU空间有证据','初筛注明限制；深度看三层竞争及前20'],['关键词','20%默认','1：意图模糊或不匹配','3：核心词与用途匹配、有长尾','5：购买意图与需求证据清楚、可触达','过滤品牌及资讯词'],['差异化','25%默认','1：同款比价，无明确改进','3：具体痛点或场景，方案待验证','5：重复需求、可实现改善与验证计划','缺证据不凭想象打分']];
  rules.getRange('A12:D14').values=[['初筛分档','最低分','用途','利润约束'],['优先深挖',75,'决定下一阶段研究顺序','利润未验证仍不能判可做'],['保留观察',60,'补齐较弱证据再研究','利润否决时直接排除']];header(rules,'A12:D12');rules.getRange('B13:B14').format.fill='#FFF4D5';
  rules.getRange('A16').values=[['方法优先级权重']];rules.getRange('A17:F17').values=[['维度','需求证据','差异化发现','执行效率','资源匹配','获取成本']];header(rules,'A17:F17');rules.getRange('B18:F18').values=[methodWeights];rules.getRange('B18:F18').setNumberFormat('0%');rules.getRange('B18:F18').format.fill='#FFF4D5';
  rules.getRange('A20:B25').values=[['评分方向','各项1–5，越高越好；获取成本高分表示更容易／成本更低'],['候选计算','四项分数×各自权重×20，满分100，四项齐全才显示总分'],['方法计算','五项分数×权重×20；启用渠道按优先分归一为建议投入权重'],['重复证据','同一商品被多个方法发现，不重复加分；同源工具不是独立证据'],['评分依据','方法默认分为分析建议，非官方统计或成功率；资源未知暂中性3分'],['利润规则','毛利率≥目标ACoS＋安全余量；默认30%＋5%=35%，完整成本净利润>0']];
  rules.getRange('A27:B27').values=[['来源',`“${catalog.provenance.thread_title}”会话；工具官方资料核查${catalog.provenance.updated_at}`]];
  [22,42,45,47,47,46].forEach((w,i)=>rules.getRange(`${col(i)}4:${col(i)}27`).format.columnWidth=w);rules.getRange('A7:F27').format.wrapText=true;rules.getRange('A7:F10').format.rowHeight=76;rules.getRange('A20:B25').format.rowHeight=50;

  setup(method,'S',20,'选品方法与工具','九个发现渠道与六个补充视角；评分是可调整的研究优先级建议');
  method.getRange('A5:S5').values=[['选品方法','类型','对应工具／渠道','初筛动作','优点','缺点','补验动作','适用场景','启用渠道','需求证据分','差异化分','执行效率分','资源匹配分','获取成本分','方法优先分','建议投入权重','评分依据','工具来源','核查日期']];header(method,'A5:S5');
  method.getRange('A6:S20').values=catalog.methods.map(x=>[x.name,x.type,x.tools,x.steps,x.pros,x.cons,x.verification,x.scenario,x.enabled,...x.scores,null,null,x.score_basis,x.sources.join('\n'),new Date(`${x.checked_at}T00:00:00Z`)]);
  for(let row=6;row<=20;row++){
    method.getRange(`O${row}:P${row}`).formulas=[[`=IF(OR(COUNT(J${row}:N${row})<5,ABS(SUM('初筛规则'!$B$18:$F$18)-1)>0.000001),"",SUMPRODUCT(J${row}:N${row},'初筛规则'!$B$18:$F$18)*20)`,`=IF(OR(I${row}<>"是",NOT(ISNUMBER(O${row})),SUMIFS($O$6:$O$20,$I$6:$I$20,"是")=0),"",O${row}/SUMIFS($O$6:$O$20,$I$6:$I$20,"是"))`]];
  }
  validation(method,'I6:I20',['是','否']);method.getRange('I6:N20').format.fill='#FFF4D5';method.dataValidations.add({range:'J6:N20',rule:{type:'whole',operator:'between',formula1:1,formula2:5}});method.getRange('O6:O20').setNumberFormat('0');method.getRange('P6:P20').setNumberFormat('0.0%');method.getRange('S6:S20').setNumberFormat('yyyy-mm-dd');
  [27,16,48,45,38,44,44,38,13,14,14,14,14,14,17,18,50,52,17].forEach((w,i)=>method.getRange(`${col(i)}5:${col(i)}20`).format.columnWidth=w);method.getRange('A6:S20').format.wrapText=true;method.getRange('A6:S20').format.rowHeight=110;method.tables.add('A5:S20',true,'SelectionMethods').showFilterButton=true;method.freezePanes.freezeRows(5);method.freezePanes.freezeColumns(1);
  for(const row of [7,9,20])method.getRange(`A${row}:S${row}`).format.autofitRows();

  main.getRange('AM5:AU5').values=[extras];header(main,'AM5:AU5');main.getRange('AM6:AU25').format.font={name:'Arial',size:11,color:'#243247'};main.getRange('AM6:AU25').format.verticalAlignment='center';main.getRange('AM6:AU25').format.wrapText=true;
  for(let row=6;row<=25;row++){
    const x=rows[row-6];if(x){main.getRange(`AM${row}`).values=[[safe(x.auxiliary_methods)]];main.getRange(`AQ${row}:AT${row}`).values=[keys.map(k=>x.screening_scores?.[k]??null)];main.getRange(`AU${row}`).values=[[safe(x.screening_basis)]];}
    main.getRange(`AN${row}:AP${row}`).formulas=[[`=IF(B${row}="","",IF(ABS(SUM('初筛规则'!$B$4:$E$4)-1)>0.000001,"权重未归一",IF(COUNT(AQ${row}:AT${row})<4,"",SUMPRODUCT(AQ${row}:AT${row},'初筛规则'!$B$4:$E$4)*20)))`,`=IF(B${row}="","",IF(ABS(SUM('初筛规则'!$B$4:$E$4)-1)>0.000001,"",SUM(IF(ISNUMBER(AQ${row}),'初筛规则'!$B$4,0),IF(ISNUMBER(AR${row}),'初筛规则'!$C$4,0),IF(ISNUMBER(AS${row}),'初筛规则'!$D$4,0),IF(ISNUMBER(AT${row}),'初筛规则'!$E$4,0))))`,`=IF(B${row}="","",IF(LEFT(AL${row},2)="否决","淘汰（利润否决）",IF(OR(S${row}="",AU${row}=""),"待补方法与依据",IF(NOT(ISNUMBER(AN${row})),"待补初筛证据",IF(AN${row}<'初筛规则'!$B$14,"初筛暂缓",IF(AN${row}>='初筛规则'!$B$13,IF(AL${row}="达标","优先深挖","优先深挖（利润待验证）"),"保留观察"))))))`]];
  }
  validation(main,'S6:S25',methodNames);main.dataValidations.add({range:'AQ6:AT25',rule:{type:'whole',operator:'between',formula1:1,formula2:5}});main.getRange('AQ6:AT25').format.fill='#FFF4D5';main.getRange('AN6:AN25').setNumberFormat('0.0');main.getRange('AO6:AO25').setNumberFormat('0%');
  [34,15,17,36,17,17,15,15,58].forEach((w,i)=>main.getRange(`${col(i+38)}5:${col(i+38)}25`).format.columnWidth=w);main.tables.add('A5:AU25',true,'Competitors').showFilterButton=true;
  for(const [row,c,label]of [[50,'AN','参考方案初筛得分'],[51,'AO','参考方案评分覆盖率'],[52,'AP','参考方案初筛状态'],[53,'S','主选品方法'],[54,'AM','辅助选品方法']]){
    summary.getRange(`A${row}:D${row}`).values=[[label,null,row===51?'已评分维度的权重占比':'对应利润参考ASIN','追溯选品方法与评分依据']];summary.getRange(`B${row}`).formulas=[[`=IF($B$15="","待选择参考方案",IF(COUNTIFS('选品表'!$E$6:$E$25,$B$15)=0,"ASIN未匹配",IF(INDEX('选品表'!$${c}$6:$${c}$25,MATCH($B$15,'选品表'!$E$6:$E$25,0))="","待补初筛数据",INDEX('选品表'!$${c}$6:$${c}$25,MATCH($B$15,'选品表'!$E$6:$E$25,0)))))`]];
  }
  summary.getRange('A50:D54').format.font={name:'Arial',size:11,color:'#243247'};summary.getRange('A50:D54').format.wrapText=true;summary.getRange('A50:D54').format.rowHeight=48;summary.getRange('B50').setNumberFormat('0.0');summary.getRange('B51').setNumberFormat('0%');
  summary.getRange('B48').formulas=[['=IF(LEFT(B45,2)="否决","淘汰（利润否决）",IF(OR(B47="淘汰",B47="暂缓"),B47,IF($B$19="初筛","仅初筛，待深度验证",IF(B45<>"达标","待验证",IF(NOT(ISNUMBER(B50)),"待验证",IF(B50<\'初筛规则\'!$B$14,"暂缓（初筛）",IF(B46="已确认相关风险","暂缓（专利风险）",IF(OR(B21<>$B$12,B23<>$B$12,B33<>$B$12,B29<>$B$12,B32="",B39="",B40="",B41="",B42="",B53="待补初筛数据",B52="待补方法与依据",B46="待核查",B46="发现相关专利"),"待验证",B47))))))))']];
}
