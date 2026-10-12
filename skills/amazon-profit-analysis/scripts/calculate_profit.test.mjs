import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyze} from './calculate_profit.mjs';

const money=amount=>({amount,currency:'USD',source:'用户确认的测试费用；零表示已确认不适用',status:'confirmed'});
function fixture() {
  return {
    context:{product_name:'测试商品',marketplace:'美国',currency:'USD',fulfillment:'FBA',unit:'1个',price_tax_basis:'不含税',cost_scope_confirmed:true},
    price:money(100),
    costs:{purchase:money(53),inbound:money(2),referral:money(5),fulfillment:money(3),packaging_other:money(2),storage:money(1),tax:money(1),returns:money(1),overhead:money(0)},
    advertising:{mode:'attributed_acos',acos:0.30,source:'同口径测试广告率',status:'confirmed'},
    policy:{target_acos:0.30,margin_buffer:0.05},fx:[]
  };
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('35%含边界，完整成本净利2，保本率32%，两个采购约束分别保留',()=>{
  const r=analyze(fixture());assert.equal(r.status,'calculated');assert.equal(r.decision,'利润门槛达标');
  close(r.metrics.gross_margin,.35);close(r.metrics.net_profit,2);close(r.metrics.break_even_ad_rate,.32);
  close(r.metrics.purchase_gross_max,53);close(r.metrics.purchase_net_boundary,55);
});
test('不得通过展示四舍五入把不足35%的结果放行',()=>{
  const p=fixture();p.costs.purchase.amount=53.0001;assert.match(analyze(p).decision,/毛利率不足/);
});
test('高于目标的ACoS提高毛利门槛，成本完整也不能抵消否决',()=>{
  const p=fixture();p.advertising.acos=.4;close(analyze(p).policy.minimum_gross_margin,.45);assert.match(analyze(p).decision,/否决/);
  p.costs.purchase.amount=43;assert.equal(analyze(p).decision,'利润门槛达标');
});
test('缺任何必要费用必须needs_input且完整结果为null',()=>{
  for(const k of Object.keys(fixture().costs)) {
    const p=fixture();delete p.costs[k];const r=analyze(p);assert.equal(r.status,'needs_input');assert.equal(r.metrics,null);assert.equal(r.decision,null);assert.ok(r.missing.some(x=>x.field===`costs.${k}`));
  }
  const p=fixture();p.costs.purchase.amount=null;assert.equal(analyze(p).status,'needs_input');
});
test('没有ASIN或销量不阻塞单件测算，零采购可计算，零费用缺依据则追问',()=>{
  const p=fixture();p.costs.purchase=money(0);assert.equal(analyze(p).status,'calculated');
  delete p.costs.overhead.source;assert.equal(analyze(p).status,'needs_input');
});
test('补齐一项不会隐藏其他仍缺的必要条件',()=>{
  const p=fixture();delete p.costs.storage;delete p.costs.returns;
  p.costs.storage=money(1);const r=analyze(p);assert.equal(r.status,'needs_input');assert.ok(r.missing.some(x=>x.field==='costs.returns'));assert.equal(r.metrics,null);
});
test('额外费用字段不可静默忽略',()=>{
  const p=fixture();p.costs.removal=money(5);const r=analyze(p);
  assert.equal(r.status,'needs_input');assert.ok(r.invalid.some(x=>x.field==='costs.removal'));assert.equal(r.metrics,null);
});
test('整批口径、税口径、费用覆盖、广告模式不清必须补充',()=>{
  for(const k of ['marketplace','currency','fulfillment','unit','price_tax_basis','cost_scope_confirmed']) {
    const p=fixture();delete p.context[k];assert.equal(analyze(p).status,'needs_input');
  }
  const p=fixture();delete p.advertising.mode;assert.equal(analyze(p).status,'needs_input');
});
test('净利等于0否决；零广告也亏损保留负的保本率',()=>{
  const p=fixture();p.costs.storage.amount=3;assert.match(analyze(p).decision,/净利不为正/);
  p.costs.storage.amount=40;assert.ok(analyze(p).metrics.break_even_ad_rate<0);
});
test('ACoS不能当全单广告率；销售额占比缺失追问，不能用订单比例字段替代',()=>{
  const p=fixture();p.advertising.mode='blended_acos';p.advertising.order_share=.5;
  assert.equal(analyze(p).status,'needs_input');p.advertising.revenue_share=.5;
  const r=analyze(p);close(r.metrics.advertising_cost,15);close(r.metrics.net_profit,17);close(r.metrics.blended_break_even_acos,.64);assert.equal(r.metrics.break_even_label,'保本TACoS');close(r.policy.minimum_gross_margin,.35);
});
test('整体TACoS模式可独立计算，未选广告分支的空参数不阻塞',()=>{
  const p=fixture();p.advertising={mode:'blended_tacos',tacos:.15,acos:null,revenue_share:null,source:'测试总销售额口径',status:'confirmed'};
  const r=analyze(p);assert.equal(r.status,'calculated');close(r.metrics.net_profit,17);close(r.policy.minimum_gross_margin,.35);
});
test('单件广告金额要确认范围；零广告要有依据',()=>{
  const p=fixture();p.advertising={mode:'unit_amount',unit_cost:money(30)};assert.equal(analyze(p).status,'needs_input');
  p.advertising.scope='all_orders';close(analyze(p).metrics.net_profit,2);
  p.advertising={mode:'attributed_acos',acos:0};assert.equal(analyze(p).status,'needs_input');
});
test('100%以上ACoS有效，广告销售额占比0需依据且不除零，占比超过1无效',()=>{
  const p=fixture();p.advertising.acos=1.2;assert.equal(analyze(p).status,'calculated');assert.match(analyze(p).decision,/否决/);
  p.advertising.mode='blended_acos';p.advertising.revenue_share=0;assert.equal(analyze(p).metrics.blended_break_even_acos,null);
  p.advertising.revenue_share=1.1;assert.equal(analyze(p).status,'needs_input');
});
test('跨币种缺汇率、反方向或重复汇率会阻塞；明确方向可正确转换',()=>{
  const p=fixture();p.costs.purchase={...money(371),currency:'CNY'};
  assert.equal(analyze(p).status,'needs_input');p.fx=[{from:'USD',to:'CNY',rate:7,source:'测试汇率',date:'2026-10-12'}];assert.equal(analyze(p).status,'needs_input');
  p.fx=[{from:'CNY',to:'USD',rate:1/7,source:'测试汇率',date:'2026-10-12'}];close(analyze(p).metrics.net_profit,2);
  p.fx.push({...p.fx[0]});assert.equal(analyze(p).status,'needs_input');
  p.fx=[{...p.fx[0],date:'2026-02-30'}];assert.equal(analyze(p).status,'needs_input');
});
test('外币真实零费用不需要无关汇率',()=>{
  const p=fixture();p.costs.overhead.currency='CNY';assert.equal(analyze(p).status,'calculated');
});
test('字符串金额、零售价和负成本不能算作有效数据；缺来源不能宣称已核验',()=>{
  for(const [k,value] of [['purchase','53'],['returns',-1]]) {const p=fixture();p.costs[k].amount=value;assert.equal(analyze(p).status,'needs_input');}
  const p=fixture();p.price.amount=0;assert.equal(analyze(p).status,'needs_input');
  p.price.amount=100;p.costs.purchase.status='estimate';assert.match(analyze(p).decision,/情景/);assert.equal(analyze(p).inputs_verified,false);
});
test('CLI: 未填写模板返回2和缺项，完整输入保存计算结果，不能覆盖输入',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'amazon-profit-test-'));
  const script=fileURLToPath(new URL('./calculate_profit.mjs',import.meta.url));
  const template=fileURLToPath(new URL('../assets/input-template.json',import.meta.url));
  try {
    const blocked=spawnSync(process.execPath,[script,'--input',template],{encoding:'utf8'});assert.equal(blocked.status,2);assert.equal(JSON.parse(blocked.stdout).metrics,null);
    const input=path.join(dir,'input.json'),output=path.join(dir,'result.json');await fs.writeFile(input,JSON.stringify(fixture()));
    execFileSync(process.execPath,[script,'--input',input,'--output',output]);assert.equal(JSON.parse(await fs.readFile(output,'utf8')).decision,'利润门槛达标');
    const same=spawnSync(process.execPath,[script,'--input',input,'--output',input],{encoding:'utf8'});assert.equal(same.status,1);assert.deepEqual(JSON.parse(await fs.readFile(input,'utf8')),fixture());
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});
