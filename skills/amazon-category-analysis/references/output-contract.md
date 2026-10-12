# 类目分析输出

本技能只输出类目网页分析报告。复制[report-template.html](../assets/report-template.html)，填写真实数据，保存为用户指定路径或amazon-category-report-<站点>-<日期>.html，在可用的网页／报告预览端打开，并在对话中给出报告链接及核心结论。单文件HTML、内联CSS、无外部依赖；外部文本按HTML转义，来源链接保留实际URL。模板请求保持实采区为空。

独立调用或被选品流程调用时，本技能均不生成、填充或更新.xlsx选品表。衔接选品仅返回报告与证据，由amazon-product-direction统一写入选品表并形成商品推荐。网页或文件能力缺失时交付完整可读报告并说明具体限制，不宣称已完成网页展示；预览受限时核验文件结构并说明未进行视觉检查，不绕过浏览器限制。

## 报告表

1. 研究范围：站点、配送地区、细分类目节点／核心词、样本规则、采集日、销量／搜索量起止日、币种。
2. 工具状态：工具、分析用途、使用状态、跳过／缺项原因、实际取得字段。Jungle Scout无key写“未提供key，跳过反查”；提供的导出写“读取提供数据”。Sorftime无key写清Flapen＋ASINSIGHT降级路径及覆盖。
3. 市场容量：指标、数值／区间、单位、周期、方法、定义、有效样本、来源、采集日、状态、限制。搜索量、已知样本销量、完整Top100销量、类目工具总量、2–5倍经验情景、目标排名销量分别列示。未知数字空白，结论待验证，不用0代替。
4. 关键词明细：词、买家意图、相关性、关联ASIN、精准／广泛量、周期、搜索频率排名、自然／广告位置、趋势、来源、变体范围与缺项。相同词跨ASIN命中不重复累计需求；搜索频率排名和商品BSR使用不同列。
5. 榜单／产品明细：榜单范围与排名、ASIN、父体、品牌、seller ID、日期、评价数、星级、自营与履约、A+／视频、估算销量／销售额、统计周期、去重及来源；Top50可从完整Top100同一快照取前50，仍各自报告覆盖和分母。
6. 类目竞争：两种方法各指标的数值、覆盖、规则、结果与证据；结论、冲突、切入空间及缺项。
7. 进入研究建议：容量是否足以继续研究、竞争空间、待补数据与验证动作。利润未验证时不能判商品可做，不能把类目容量或经验销量写成新品经营承诺。

比例以0–1数值保存并显示百分比，星级单独保存，计数为非负整数。时间、月／30天、订单／件数、父／子／卖家共享口径保持可追溯。Top100缺销量时展示已知合计与有效量，2–5倍类目情景空白；竞争必要字段缺失时对应信号保持待验证。

## 与选品输入兼容

选品技能需要结构化证据时，可返回以下顶层字段供其汇总；这些是内部交接数据，网页报告仍是本技能的用户交付物。选品工作簿仅由选品技能生成或更新。这里只放证据，不制造一个ASIN竞品池去承载整个Top100。

```json
{
  "research": {
    "marketplace": null,
    "category": null,
    "keyword": null,
    "currency": null,
    "collected_at": null
  },
  "market_evidence": [],
  "competition_evidence": [],
  "decision": {
    "market_capacity": null,
    "category_competition": null,
    "competition_tool_route": null,
    "competition_gaps": null,
    "next_step": null,
    "conclusion": "待验证"
  }
}
```

market_evidence每项可含dimension（市场容量／关键词）、metric、intent（定义）、value、unit、period、marketplace、trend、competition、differentiation、source、collected_at、status（实测／估算／假设／待采集）、limit。工具估算写估算，经验倍数推算写假设，用户明确的真实销量报表才按其覆盖记实测。

competition_evidence每项含metric、subject、value、sample_scope、definition、coverage（完整／部分／未知）、analysis、source、collected_at、status、limit。类目指标键：new_product_3m、new_product_6m、listing_distribution、review_time_distribution、review_count_distribution、brand_monopoly、store_monopoly、amazon_retail_share、fbm_share、aplus_video_share、overall_rating、top50_low_review_sellers。阈值判断先核实样本及原定义；兼容现有选品表的公式，不手动写“达标”绕开缺项。

类目容量与竞争可以单独交付，不会填造keyword_competition、shop_competition或利润数据来让整体选品结论通过。完整选品流程继续验证这几项。
