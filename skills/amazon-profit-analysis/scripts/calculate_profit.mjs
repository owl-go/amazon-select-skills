import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const COST_LABELS = {
  purchase:'采购', inbound:'头程', referral:'平台佣金', fulfillment:'履约',
  packaging_other:'包装及其他基础成本', storage:'仓储', tax:'尚需扣税费',
  returns:'退货损耗', overhead:'运营分摊'
};
const BASE = ['purchase','inbound','referral','fulfillment','packaging_other'];
const EXTRA = ['storage','tax','returns','overhead'];
const MODES = ['attributed_acos','blended_acos','blended_tacos','unit_amount'];
const STATES = ['confirmed','estimate','scenario'];
const EPS = 1e-12;
const text = x => typeof x === 'string' && x.trim().length > 0;
const num = x => typeof x === 'number' && Number.isFinite(x);
const currency = x => typeof x === 'string' && /^[A-Z]{3}$/.test(x);
const validDate = x => {
  if(typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === x;
};

export function analyze(p) {
  const missing = [], invalid = [], evidence = [];
  const need = (field, label, reason) => { if(!missing.some(x=>x.field===field)) missing.push({field,label,reason}); };
  const bad = (field, label, reason) => invalid.push({field,label,reason});
  const c = p?.context ?? {}, a = p?.advertising ?? {}, policy = p?.policy ?? {};
  const requiredText = (field, value, label) => { if(!text(value)) need(field,label,'请补充明确口径'); };
  requiredText('context.marketplace',c.marketplace,'站点');
  requiredText('context.unit',c.unit,'销售单位/规格');
  if(!currency(c.currency)) need('context.currency','销售币种','需3位大写币种代码，且与输出口径一致');
  if(!['FBA','FBM'].includes(c.fulfillment)) need('context.fulfillment','履约方式','请选择FBA或FBM；混合方式分别测算');
  if(!['含税','不含税'].includes(c.price_tax_basis)) need('context.price_tax_basis','售价含税口径','须与税费金额匹配');
  if(c.cost_scope_confirmed !== true) need('context.cost_scope_confirmed','适用费用范围确认','请确认必要费用已完整覆盖，排除项及重复归属有说明');
  const target = policy.target_acos ?? 0.30, buffer = policy.margin_buffer ?? 0.05;
  if(!num(target) || target < 0) bad('policy.target_acos','目标ACoS','须为非负小数，30%写0.30');
  if(!num(buffer) || buffer < 0 || buffer > 1) bad('policy.margin_buffer','安全余量','须为0–1小数，5个百分点写0.05');
  if(p?.fx != null && !Array.isArray(p.fx)) bad('fx','汇率列表','须为数组');
  const fx = Array.isArray(p?.fx) ? p.fx : [];
  function money(o, field, label, positive=false) {
    if(o == null || typeof o !== 'object' || Array.isArray(o)) { need(field,label,'请提供金额、币种；确实为0需说明依据'); return null; }
    let ok = true;
    if(o.amount == null || o.amount === '') { need(`${field}.amount`,label,'金额未知，不能按0计算'); ok=false; }
    else if(!num(o.amount) || o.amount < 0 || (positive && o.amount === 0)) { bad(`${field}.amount`,label,positive?'须为大于0的数值':'须为非负数值'); ok=false; }
    if(!currency(o.currency)) { need(`${field}.currency`,`${label}币种`,'需明确币种，不能混币种相加'); ok=false; }
    if(o.amount === 0 && !text(o.source)) { need(`${field}.source`,`${label}零费用依据`,'请确认无该费用或说明已归入哪项'); ok=false; }
    if(o.status != null && !STATES.includes(o.status)) { bad(`${field}.status`,`${label}数据状态`,'须为confirmed、estimate或scenario'); ok=false; }
    let factor = 1, exchange = null;
    if(o.amount !== 0 && currency(o.currency) && currency(c.currency) && o.currency !== c.currency) {
      const matches = fx.filter(x=>x?.from===o.currency && x?.to===c.currency);
      if(matches.length === 0) { need(`fx.${o.currency}_${c.currency}`,`${label}汇率`,'需直接方向、正汇率、日期和来源'); ok=false; }
      else if(matches.length !== 1) { bad(`fx.${o.currency}_${c.currency}`,`${label}汇率`,'同方向汇率重复，请明确本次使用值'); ok=false; }
      else {
        exchange = matches[0];
        if(!num(exchange.rate) || exchange.rate <= 0 || !validDate(exchange.date) || !text(exchange.source)) { need(`fx.${o.currency}_${c.currency}`,`${label}汇率依据`,'需正汇率、真实YYYY-MM-DD日期及来源'); ok=false; }
        else factor = exchange.rate;
      }
    }
    evidence.push({field,label,amount:o.amount??null,currency:o.currency??null,source:o.source||'未提供来源',status:o.status??'unverified',fx:exchange});
    if(ok && !num(o.amount*factor)) { bad(field,label,'转换后金额超出有效数值范围'); ok=false; }
    return ok ? o.amount*factor : null;
  }
  const price = money(p?.price,'price','优惠后销售收入',true);
  if(p?.costs && typeof p.costs === 'object') for(const key of Object.keys(p.costs)) {
    if(!(key in COST_LABELS)) bad(`costs.${key}`,'未归属费用','请将该费用明确归入已定义成本项，或扩展模型后计算；不能忽略额外费用');
  }
  const costs = Object.fromEntries(Object.entries(COST_LABELS).map(([k,label])=>[k,money(p?.costs?.[k],`costs.${k}`,label)]));
  function rate(field, value, label, max=Infinity) {
    if(value == null || value === '') { need(field,label,'请提供明确小数；未知不能默认为0'); return null; }
    if(!num(value) || value < 0 || value > max) { bad(field,label,max===1?'须在0–1之间':'须为非负小数，30%写0.30'); return null; }
    return value;
  }
  let adRate = null, adAmount = null, scope = null, acos = null, share = null;
  if(!MODES.includes(a.mode)) need('advertising.mode','广告分母/计算模式','请选择广告归因ACoS、整体ACoS×销售额占比、整体TACoS或明确单件广告金额');
  else if(a.mode === 'attributed_acos' || a.mode === 'blended_acos') {
    acos = rate('advertising.acos',a.acos,'测算ACoS');
    share = a.mode === 'blended_acos' ? rate('advertising.revenue_share',a.revenue_share,'广告归因销售额占比',1) : 1;
    if(acos != null && share != null) adRate=acos*share;
    scope=a.mode==='attributed_acos'?'attributed':'all_orders';
  } else if(a.mode === 'blended_tacos') { adRate=rate('advertising.tacos',a.tacos,'整体TACoS'); scope='all_orders'; }
  else {
    if(!['attributed','all_orders'].includes(a.scope)) need('advertising.scope','单件广告金额适用范围','须明确广告归因订单或全部订单');
    scope=a.scope; adAmount=money(a.unit_cost,'advertising.unit_cost','单件广告金额');
  }
  if(a.status != null && !STATES.includes(a.status)) bad('advertising.status','广告数据状态','须为confirmed、estimate或scenario');
  if(adRate === 0 && !text(a.source)) need('advertising.source','零广告成本依据','请确认无广告或说明零销售额占比的情景依据');
  if(a.mode !== 'unit_amount') evidence.push({field:'advertising',label:'广告参数',mode:a.mode,acos:a.acos??null,tacos:a.tacos??null,revenue_share:a.revenue_share??null,source:a.source||'未提供来源',status:a.status??'unverified'});
  if(missing.length || invalid.length) return {status:'needs_input',missing,invalid,metrics:null,decision:null,question:'请补充或修正列出的必要条件；金额按同一销售单位提供，0需说明依据。'};
  if(adAmount == null) adAmount=price*adRate;
  adRate=adAmount/price;
  const sum = keys => keys.reduce((n,k)=>n+costs[k],0);
  const baseCost=sum(BASE), extraCost=sum(EXTRA), gross=price-baseCost, margin=gross/price;
  const afterAds=gross-adAmount, net=afterAds-extraCost, beforeAds=gross-extraCost;
  const minMargin=Math.max(target,acos??target)+buffer;
  const grossFailed=margin+EPS<minMargin, netFailed=net<=EPS*price;
  const inputsVerified=evidence.every(x=>x.status==='confirmed' && x.source!=='未提供来源');
  const decision=grossFailed?'否决：毛利率不足':netFailed?'否决：完整成本净利不为正':inputsVerified?'利润门槛达标':'情景利润门槛达标（输入待核验）';
  return {
    status:'calculated', context:{...c}, advertising:{mode:a.mode,scope,effective_rate:adRate,acos, revenue_share:share},
    policy:{target_acos:target,margin_buffer:buffer,minimum_gross_margin:minMargin,basis:'既定用户广告门槛；整体订单情景仍保留目标ACoS门槛'},
    normalized:{currency:c.currency,price,costs},
    metrics:{base_cost:baseCost,gross_profit:gross,gross_margin:margin,advertising_cost:adAmount,after_advertising_profit:afterAds,extra_cost:extraCost,net_profit:net,net_margin:net/price,pre_advertising_profit:beforeAds,break_even_ad_rate:beforeAds/price,break_even_label:scope==='attributed'?'保本ACoS':'保本TACoS',blended_break_even_acos:a.mode==='blended_acos' && share>0?beforeAds/price/share:null,purchase_gross_max:price*(1-minMargin)-(baseCost-costs.purchase),purchase_net_boundary:price-(baseCost-costs.purchase)-adAmount-extraCost},
    decision, gates:{gross_margin_pass:!grossFailed,positive_net_pass:!netFailed},inputs_verified:inputsVerified,
    constraints:['采购≤毛利门槛采购上限，且采购严格小于净利为正的采购边界','盈亏平衡与采购约束只适用于当前售价、规格和已给费用','单件净利为所列成本口径，不等于公司会计净利润'],evidence
  };
}

async function main() {
  const args=process.argv.slice(2), options={};
  for(let i=0;i<args.length;i++) {
    if(!['--input','--output'].includes(args[i]) || !args[i+1]) throw Error('用法: node calculate_profit.mjs --input input.json [--output result.json]');
    options[args[i]]=args[++i];
  }
  if(!options['--input']) throw Error('必须提供--input');
  const input=JSON.parse(await fs.readFile(options['--input'],'utf8'));
  if(!input || typeof input!=='object' || Array.isArray(input)) throw Error('输入须为JSON对象');
  const result=analyze(input), output=JSON.stringify(result,null,2)+'\n';
  if(options['--output']) {
    if(path.resolve(options['--input'])===path.resolve(options['--output'])) throw Error('输出不能覆盖输入');
    await fs.mkdir(path.dirname(path.resolve(options['--output'])),{recursive:true});
    await fs.writeFile(options['--output'],output);
  }
  process.stdout.write(output);
  if(result.status==='needs_input') process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
