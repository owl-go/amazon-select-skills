# Excel与JSON结构

## 执行

工作簿仅由amazon-product-direction生成或更新。类目、关键词、利润技能返回网页报告和证据，本技能统一汇总到下列结构；同时按[web-report.md](web-report.md)输出推荐网页，推荐、评分、利润和缺项必须与工作簿一致。

默认七表：类目判断、选品表、市场与关键词、差评分析、选品方法、初筛规则、竞争分析。初筛允许跨类目候选池；深度研究每份仅一组前20。类目Top100／Top50证据另存竞争分析，不能塞进前20竞争行。生成器默认第6–25行20个槽位，更多初筛记录可按同一结构扩展或分批。模板：assets/亚马逊选品表.xlsx。

通用路径：复制assets/亚马逊选品表.xlsx为输出文件，用当前agent的表格工具或Python openpyxl等通用xlsx库按下列JSON字段填入；保留已有公式、表头、验证和样式。日期写可排序的日期值，所有未知金额留空。使用不计算公式的库时，通过Excel/LibreOffice或可用计算引擎重算后再验证结果；未重算前不宣称公式已验证。

可选增强路径：已有@oai/artifact-tool时使用下列Node生成器。它依赖该特定运行时，不能把私有包当公开npm依赖安装；其他agent可直接填写模板。Codex环境可通过load_workspace_dependencies定位运行时，其他环境用实际可用的依赖路径。执行：

```bash
<node> /path/to/amazon-product-direction/scripts/write_selection.mjs \
  --module-dir /path/to/working/node_modules \
  --data /path/to/research.json \
  --output /path/to/outputs/亚马逊选品_关键词_YYYYMMDD.xlsx \
  --render-dir /path/to/working/previews
```

模板用 --template --date YYYY-MM-DD，省略--data。默认拒绝覆盖；用户已授权更新或修正本次生成结果时可加--force。脚本使用@oai/artifact-tool，负责重算、错误扫描、导出和可选渲染，网页采集由agent完成。检查保存文件及各表渲染。

## JSON

```json
{
  "research": {
    "marketplace": "美国",
    "category": "用户指定类目",
    "keyword": "用户指定关键词",
    "currency": "USD",
    "stage": "初筛",
    "collected_at": "YYYY-MM-DD",
    "sample_scope": "自然搜索前20，父体去重；配送地区与来源",
    "price_band_low": null,
    "price_band_high": null,
    "price_band_basis": "同规格主流聚集区的依据",
    "low_review_threshold": 1000,
    "low_rating_threshold": 4.3,
    "assumptions": "假设与采集缺口",
    "target_acos": 0.30,
    "margin_buffer": 0.05,
    "acos_basis": "用户广告订单情景，非类目实测"
  },
  "competitors": [],
  "reviews": [],
  "market_evidence": [],
  "competition_evidence": [],
  "decision": {
    "sku_strategy": "尺寸、颜色覆盖与切入空间",
    "main_pain": "重复问题",
    "market_capacity": "需求规模、趋势及限制",
    "keywords": "需求词、买家意图及相关性",
    "differentiation": "改善、验证方式与增量成本",
    "reference_asin": null,
    "patent_status": "待核查",
    "conclusion": "待验证",
    "next_step": "补数据或验证动作",
    "category_competition": null,
    "keyword_competition": null,
    "shop_competition": null,
    "competition_tool_route": null,
    "competition_gaps": null
  }
}
```

研究需marketplace、currency、collected_at，以及category或keyword。stage为初筛或深度研究，未指定时默认深度研究。缺失数字写null或省略，不用字符串，不以0替代。rank为唯一1–20；深度研究要求唯一ASIN与已知父体去重。初筛没有ASIN时需商品链接或可追溯来源，不能因此编造ASIN。日期为YYYY-MM-DD或null。

research可配置screening_weights四个小数（市场容量、竞争、关键词、差异化，默认0.30、0.25、0.20、0.25），method_weights五个小数（需求证据、差异化发现、效率、资源匹配、获取成本，默认0.35、0.25、0.20、0.10、0.10），各组须合计1。

### competition_evidence每项

独立于competitors前20。竞争分析页A:O依次为层级、分析方法、对象、指标、观察／数值、单位、样本范围、定义、覆盖、规则、信号／分析、来源、日期、状态、缺口。详细规则见[competition-analysis.md](competition-analysis.md)。

```json
{
  "metric": "new_product_3m",
  "subject": "类目节点或关键词或seller ID",
  "value": null,
  "unit": null,
  "sample_scope": "站点、配送地区、榜单或关键词范围、样本量、有效量",
  "definition": "分子／分母、周期、去重、原工具统计定义",
  "coverage": "未知",
  "analysis": null,
  "source": null,
  "collected_at": null,
  "status": "待采集",
  "limit": "具体未查字段与补证动作"
}
```

metric可用：new_product_3m、new_product_6m、listing_distribution、review_time_distribution、review_count_distribution、brand_monopoly、store_monopoly、amazon_retail_share、fbm_share、aplus_video_share、overall_rating、top50_low_review_sellers、keyword_bid、shop_reviews、shop_trademark、shop_location、shop_catalog、shop_listing、shop_external_promotion。可按不同关键词／卖家追加同类指标行。

比例输入0–1小数并显示百分比；overall_rating为0–5数值，top50_low_review_sellers为0–50整数，rating数量<1000后按seller ID去重。keyword_bid用数值和币种，建议区间、匹配类型与实际CPC周期写definition，可分行记录。其他观察可用文字；analysis保存方向性分析。coverage为完整／部分／未知：完整指本行所声明且符合该指标要求的样本及字段全部取得，不能以少量样本自称完整Top100／Top50。status为实测／估算／假设／待采集。

新品、垄断、自营和Top50阈值由Excel公式判断，需有值、范围、定义、完整覆盖、来源、日期以及实测／估算状态；缺项或假设保持待验证。品牌／店铺指标的原定义须先核实，代理指标保留为文字观察，不能冒充垄断率输入。其他指标需agent写分析，无自动通过线。模板均留空，不包含实采结论。

decision新增category_competition、keyword_competition、shop_competition、competition_tool_route、competition_gaps，分别写入类目判断B55:B59。深度研究缺前三层结论时最终进入保持待验证；单项友好信号不会自动使最终进入通过，利润否决仍优先。

### competitors每项

| JSON键 | 列名／含义 |
|---|---|
| rank, product_name | 排名、产品名称 |
| category, keyword | 类目、核心关键词，缺省沿用research |
| asin | 10位文本ASIN |
| price, review_count, rating | 价格、评论数、商品星级，星级满分5 |
| competition, variant_count | 竞争程度文字及原因、核实的变体数 |
| listed_at, fulfillment | 上架日期、FBA／FBM／混合／待核查 |
| purchase_price | 已转换为销售币种的进货价 |
| main_pain, patent_status, has_aplus | 差评摘要、专利状态、A+是／否／待核查 |
| selection_method, auxiliary_methods | 主选品方法（名称取assets/methods.json）、辅助方法文字 |
| product_url, source, collected_at | 商品链接、数据来源与口径、采集日 |
| parent_asin, variant_strategy, review_scope | 父ASIN、尺寸／颜色覆盖、评论数量定义及共享情况 |
| inbound_cost, referral_fee, fulfillment_fee, other_cost | 单件头程、佣金、履约、包装及其他成本，销售币种金额 |
| storage_cost, tax_cost, return_cost | 单件仓储、税费、退货损耗；未知保持null，确实无该费用时填有依据的0 |
| screening_scores | market_capacity、competition、keywords、differentiation四个1–5整数；缺证据留null |
| screening_basis | 对应分数的具体证据、来源或分析理由，有分数时必填 |

毛利润、毛利率、成本状态、是否错配、广告成本、净利润、净利率、利润判断由公式生成。价格、进货价和四项基础费用完整才算毛利；广告为售价×目标ACoS，另有仓储、税费、退货才算净利。进货及费用是对应自有方案测算，不是竞品内部数据。缺成本不阻碍其他字段输出。

### market_evidence每项

dimension（市场容量／关键词）、metric、intent、value、unit、period、marketplace、trend、competition、differentiation、source、collected_at、status（实测／估算／假设／待采集）、limit。数字value写数值，单位另列。搜索量、销量及需求代理指标保留各自定义和统计周期，不混加成市场规模。

### reviews每项

asin、stars（1–3）、reviewed_at、summary、category、issue、scenario、improvement、sampling_scope、review_url、source、collected_at、note。category为三类之一或“其他”，issue命名统一。每条独立评论一行，有review_url时据此去重；无链接时source提供评论ID或可核实的采集范围。次数按category＋issue统计，为样本频次。

## 表格逻辑

- 类目判断B4:B18记录范围、日期及阈值；B9为前12个月，B13/B14为主流带；B15是利润参考ASIN，对应自有方案成本；B16目标ACoS、B17安全余量、B18为二者之和；B19为阶段。B50:B54链接参考方案初筛分、覆盖率、状态、主方法、辅助方法。
- 选品表A:R为18列，S新增选品方法；T:AE为商品链接、来源、采集日、父ASIN、变体策略、评论口径、头程、佣金、履约、包装及其他成本、成本状态、是否错配；AF:AL为广告成本、仓储、税费、退货、净利润、净利率、利润判断。
- AM:AU为辅助方法、初筛得分、评分覆盖率、初筛状态、市场容量分、竞争分、关键词分、差异化分、初筛依据。全部同一Excel表，排序随行移动；商品评价星级仍为H列。
- 类目判断B47是人工初步结论，B48是最终结论。参考方案利润否决时B48强制淘汰；缺成本时待验证。毛利率35%、ACoS30%、安全余量5个百分点属于达到广告门槛，仍需净利润>0及其他分析数据完整。
- 金额统一币种，数量为整数，星级一位小数，毛利率百分比，日期可排序。空白计算表示缺输入。
- 前20未齐或评论／日期缺失，类目结论保持待验证。未知错配项单独显示，已有错配数仅为实采下限。
- 初筛池不混算类目壁垒和新品友好度；阶段为初筛时这两项显示待前20验证。仅缺利润不自动淘汰，但已知毛利不达标会在初筛状态直接否决。
- 冻结表头及产品名称、启用筛选和分类下拉。模板不含虚构商品。
