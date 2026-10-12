# 亚马逊选品 Skills

按选品方法和工具发现候选产品，做有依据的加权初筛，再分析市场容量、市场竞争、利润、关键词和差异化，最终输出 Excel 选品表。

## 内容

本仓库包含一个技能：[amazon-product-direction](skills/amazon-product-direction/SKILL.md)。

- 9种发现渠道及6个补充视角，分别记录对应工具、操作、优缺点和补验动作。
- 可调整的方法优先分和研究投入权重，以及独立的商品初筛得分。
- 前20竞品的评论壁垒、变体策略、新品机会、价格与评分错配分析。
- 1–3星差评按质量与耐用性、尺寸与适配、使用场景缺失归类。
- 利润一票否决，缺失成本保持待验证。
- [Excel选品表模板](skills/amazon-product-direction/assets/亚马逊选品表.xlsx)，包含六个工作表，商品实采区留空。

## 安装与使用

克隆仓库后，将整个技能目录复制到 Codex 的个人 skills 目录。默认路径是 `~/.codex/skills`；设置了 `CODEX_HOME` 时使用该目录下的 `skills`。已有同名技能时先检查并备份旧目录，再更新。

```bash
git clone https://github.com/owl-go/amazon-select-skills.git
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R amazon-select-skills/skills/amazon-product-direction "${CODEX_HOME:-$HOME/.codex}/skills/"
```

调用示例：

```text
$amazon-product-direction 为美国站厨房收纳类目建立候选池，记录选品方法、来源和初筛依据，输出选品表。
```

```text
$amazon-product-direction 对指定关键词的前20竞品做深度研究，按目标ACoS 30%、最低毛利率35%验证利润，输出完整选品表。
```

技能可自动选用。模板也可直接下载后在 Excel 中填写；自动生成工作簿需要 Codex 工作区的 Node 运行时和 `@oai/artifact-tool`，并使用 spreadsheets 技能。生成脚本本身负责工作簿计算与导出，商品采集由 agent 执行；第三方工具的账号权限按实际可用情况确认。

## 默认评分与利润规则

| 评分对象 | 维度与权重 |
|---|---|
| 方法优先级 | 需求证据35%、差异化发现25%、执行效率20%、资源匹配10%、获取成本10% |
| 候选商品初筛 | 市场容量30%、市场竞争25%、关键词20%、差异化25% |

各维度按1–5分评估，乘权重后换算为100分。方法分用于分配研究投入；商品分按实际证据计算。同一产品经多个渠道发现时合并来源，不重复加分。默认初筛75分及以上优先深挖，60–74.9分保留观察，低于60分暂缓。权重与分档均可调整；评分表示研究优先级。

利润独立判断：默认毛利率至少达到目标ACoS加5个百分点安全余量，即ACoS为30%时最低毛利率为35%。完整成本下净利润还须大于0。已知利润不达标直接淘汰，其他高分无法抵消；缺成本保持待验证。广告成本按广告归因订单情景计算，ACoS与TACoS的口径分别保留。

## 选品表

前18列保持以下顺序，第19列增加“选品方法”：

```text
排名｜产品名称｜类目｜核心关键词｜ASIN｜价格｜评论数｜评分｜竞争程度｜变体数｜上架时间｜FBA/FBM｜进货价｜毛利润｜毛利率｜主要差评｜是否有专利｜是否A+｜选品方法
```

“评分”是商品评价星级，满分5星；“初筛得分”是右侧独立的百分制字段。右侧还包括来源、辅助方法、评分依据与覆盖率，以及完整成本、净利和利润判断。

六个工作表：类目判断、选品表、市场与关键词、差评分析、选品方法、初筛规则。

## 参考与生成器

- [方法、工具与初筛规则](skills/amazon-product-direction/references/selection-methods.md)
- [市场、竞争与利润研究方法](skills/amazon-product-direction/references/research-method.md)
- [Excel字段、JSON输入与生成命令](skills/amazon-product-direction/references/workbook-schema.md)
- [方法与工具数据源](skills/amazon-product-direction/assets/methods.json)

