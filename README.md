# 亚马逊选品 Skills

按选品方法和工具发现候选产品，做有依据的加权初筛，再分析市场容量、市场竞争、利润、关键词和差异化。只有选品技能输出Excel选品表，并在网页端展示推荐商品和推荐理由；其他技能直接交付各自的网页分析报告。

## 内容

本仓库包含五个可独立使用的技能：

| 技能 | 用途 |
|---|---|
| [amazon-product-direction](skills/amazon-product-direction/SKILL.md) | 选品总入口：依次调用四项分析，汇总报告，输出Excel选品表＋网页推荐商品与理由 |
| [amazon-profit-analysis](skills/amazon-profit-analysis/SKILL.md) | 网页利润分析报告；必要输入缺失时要求用户补充，补齐后计算 |
| [amazon-category-analysis](skills/amazon-category-analysis/SKILL.md) | 网页类目分析报告；市场容量、Top100销量与Top100／Top50竞争门槛 |
| [amazon-keyword-analysis](skills/amazon-keyword-analysis/SKILL.md) | 网页研究核心词、长尾词、搜索量、竞争和CPC竞价，输出有来源的HTML报告 |
| [amazon-differentiation-analysis](skills/amazon-differentiation-analysis/SKILL.md) | 竞品与1–3星差评研究，输出差异化方案、增量成本和验证方式的网页报告 |

- 9种发现渠道及6个补充视角，分别记录对应工具、操作、优缺点和补验动作。
- 可调整的方法优先分和研究投入权重，以及独立的商品初筛得分。
- 前20竞品的评论壁垒、变体策略、新品机会、价格与评分错配分析。
- 三层竞争分析：BSR Top100新品／垄断／卖家类型／星级，Top50低评论卖家，核心词竞价与店铺实力。
- 有Sorftime key时优先使用；未提供则降级Flapen＋ASINSIGHT，按实际覆盖补证。Keepa历史辅助店铺分析，站外推广由网页链接核实。
- 类目容量按关键词需求、类目销量与单品销量交叉验证；Jungle Scout无key跳过反查，截图经验倍数与工具估算分别保存。
- 关键词分析直接使用网页，无需API key；建议竞价与实际CPC分列，查询不创建广告，缺项说明原因。
- 1–3星差评按质量与耐用性、尺寸与适配、使用场景缺失归类。
- 差异化方案关联真实评论和竞品覆盖缺口；持续单件增量与一次性投入分列，验证计划包含对照、指标及通过标准。
- 利润一票否决，缺失成本保持待验证。
- 采购价未提供时由agent按产品名称或图片自行查1688，核对对应SKU、包装件数和MOQ；混售起价只作线索，不能当完整采购价。
- 履约未指定时默认FBA，用户已指定的方式优先；FBA费用查Amazon官方计算器或费用资料，查询后仍缺必要条件必须让用户输入。
- [Excel选品表模板](skills/amazon-product-direction/assets/亚马逊选品表.xlsx)，包含七个工作表，商品实采区留空。

五个技能均含可直接打开的单文件HTML报告模板。类目、关键词、利润、差异化技能被选品流程调用时只返回报告与证据，由选品技能统一写入选品表；单独调用不会生成或更新选品表。网页／文件能力不足时交付完整可读报告并说明具体限制，不声称已完成网页展示。网页中的初筛推荐表示优先研究，完整进入仍受利润否决及其他证据约束。

完整选品只需调用amazon-product-direction：发现与初筛 → amazon-category-analysis → amazon-keyword-analysis → amazon-differentiation-analysis → amazon-profit-analysis → 选品表与推荐网页。总入口汇总四类独立网页报告，提供各阶段结论、执行状态、缺项和可打开的报告链接；分析技能只完成当前阶段，后续调用由总入口推进。实际可读报告与同范围证据可以复用，记录版本和核验，不重复采集。

未限定阶段时默认完整流程；仅明确要求初筛或模板时才在该阶段交付。利润计算缺必要输入必须让用户输入，补齐后重算；等待期间继续不依赖答案的工作，不能以“待验证”结束完整利润请求或给可做推荐。按拟推荐的自有方案核算，差异化增量成本纳入改进后的完整金额，未知费用不设0。

## 安装与使用

本仓库使用通用[Agent Skills格式](https://agentskills.io/specification)。五个技能的SKILL.md、规则、输入和资源可供支持该格式的agent读取；agents/openai.yaml是可选的Codex/ChatGPT UI元数据。提问采用当前agent的输入工具或直接对话，必要计算输入缺失时必须追问；Jungle Scout无key属于明确跳过的工具路径，不阻塞其他类目分析。

### 安装脚本

需要Python 3.8或以上；脚本仅用标准库，不需要pip包。先克隆仓库：

```bash
git clone https://github.com/owl-go/amazon-select-skills.git
cd amazon-select-skills
```

macOS / Linux：

```bash
# Claude Code：全局安装全部技能
sh install.sh --agent claude

# Codex：全局安装全部技能
sh install.sh --agent codex

# 同时安装到Codex、Claude Code、Cursor、OpenCode
sh install.sh --agent all

# 只安装利润分析
sh install.sh --agent cursor --skill amazon-profit-analysis

# 只安装类目分析；已有技能更新时加--force
sh install.sh --agent claude --skill amazon-category-analysis

# 只安装关键词分析，含独立HTML报告模板
sh install.sh --agent claude --skill amazon-keyword-analysis

# 只安装差异化分析，含独立网页报告模板
sh install.sh --agent claude --skill amazon-differentiation-analysis

# 指定项目目录安装
sh install.sh --agent claude --scope project --project-dir /path/to/project

# 先预览安装计划；更新已有不同版本时先备份再替换
sh install.sh --agent claude --dry-run
sh install.sh --agent claude --force
```

Windows PowerShell：

```powershell
.\install.ps1 --agent claude
.\install.ps1 --agent all
# 也可直接运行通用Python入口，无须执行PowerShell脚本
py -3 scripts/install_skills.py --agent codex
```

其他agent或自定义目录：

```bash
python3 scripts/install_skills.py --dest /path/to/agent/skills
python3 scripts/install_skills.py --list
```

默认不带参数安装到用户的`~/.agents/skills`。`--agent`和`--skill`可重复指定；`--skill`也接受逗号分隔的名称。相同文件版本自动跳过，不同内容默认拒绝覆盖；`--force`把旧目录移动到skills目录外的`amazon-select-skills-backups/<时间-标识>/<技能名>`再更新。备份目录不会位于技能扫描根目录内，便于恢复。`--dry-run`不创建目录或复制文件。安装不修改agent设置、不安装运行时，也不触及未选中的技能。

### 安装目录

| agent参数 | 全局目录 | 项目目录 | 官方说明 |
|---|---|---|---|
| codex | ~/.agents/skills | .agents/skills | [Codex](https://learn.chatgpt.com/docs/build-skills) |
| claude | ~/.claude/skills | .claude/skills | [Claude Code](https://code.claude.com/docs/en/skills) |
| cursor | ~/.cursor/skills | .cursor/skills | [Cursor](https://cursor.com/docs/skills) |
| opencode | ~/.config/opencode/skills | .opencode/skills | [OpenCode](https://opencode.ai/docs/skills/) |
| agents（默认） | ~/.agents/skills | .agents/skills | 通用目录，按agent实际发现机制确认 |

目录按2026-10-12官方文档核对。旧环境若从`~/.codex/skills`或`$CODEX_HOME/skills`发现技能，可用`--dest`指定该目录。请选择一个安装位置，避免在多个被同一agent扫描的目录中保留同名技能。项目安装需要明确的已有项目目录；全局安装仅影响当前机器，云端agent需要把技能部署到它能读取的项目/运行环境。

完整总入口建议不带--skill安装全部五个技能。单独安装选品技能不自动安装依赖；总入口会查找实际可用的四个分析技能，缺失时说明安装方式，不能冒称调用或完整报告已完成。不同agent可用原生技能调用，或在同一会话中依次读取四个SKILL.md并执行，不需要专用多agent工具。

### 调用与工具能力

Codex可用`$amazon-product-direction`、`$amazon-category-analysis`、`$amazon-profit-analysis`、`$amazon-keyword-analysis`、`$amazon-differentiation-analysis`；Claude Code可用对应的`/amazon-product-direction`、`/amazon-category-analysis`、`/amazon-profit-analysis`、`/amazon-keyword-analysis`、`/amazon-differentiation-analysis`。其他agent使用其技能选择器或自然语言要求使用对应技能。

```text
使用amazon-product-direction作为总入口，为美国站厨房收纳发现与初筛候选，依次调用类目、关键词、差异化和利润分析，汇总各自网页报告，最终输出Excel选品表与推荐网页；利润计算缺必要条件时必须让我输入。
```

```text
使用amazon-profit-analysis，测算这个商品的利润；必要条件缺失先向我询问，补齐后在网页端输出毛利、净利和保本广告率分析报告。
```

```text
使用amazon-category-analysis，在网页端输出美国站目标类目的市场容量和竞争报告；有Jungle Scout key时做ASIN反查，无key跳过，保留工具来源与经验情景的区别。
```

```text
使用amazon-keyword-analysis，通过网页分析美国站目标产品的核心词、长尾词、搜索量、竞争程度和CPC竞价，输出HTML分析报告；不可得的数据标缺项，建议竞价与实际CPC分别列出。
```

```text
使用amazon-differentiation-analysis，通过竞品和1–3星差评分析质量与耐用性、尺寸与适配、使用场景缺失，给出差异化方案、增量成本和验证方式，直接在网页端输出分析报告。
```

差异化技能按独立评论去重，区分主分类和次要标签，保留实际样本、父体／变体及版本；评论频次只代表本次样本。方案关联需求和竞品覆盖，成本保留自有基线、改进金额、单位、币种、报价来源、持续费用与一次性投入。成本无法计算时索取实际必要输入，其余研究继续；验证计划与已完成测试分开，缺报价不填0，未经实测不宣称改进有效。改进方案仍受完整利润复核和否决约束。

关键词技能按Amazon、ASINSIGHT、Sif等实际可访问网页发现词并核验，公开页面不足时可读取已有授权的后台或用户报表。报告是无需外部依赖、可直接打开的单文件HTML，并在对话中给出结论与来源链接；没有文件能力时交付完整对话报告。搜索量保留站点、周期及估算状态，自然竞争与广告竞争分别判断；查询后台不创建或启动广告。CPC承受力需要广告归因订单CVR和每单收入等必要条件，阻塞计算时要求用户补充，不以长尾词或建议竞价推断真实转化和利润。

类目分析包含两部分：容量按关键词反查、同周期Top100销量、目标排名和单品估算交叉验证；竞争沿用Top100新品、评论、品牌／店铺垄断、卖家类型、内容与星级，以及Top50低评论去重卖家规则。截图中的Top100销量×2–5、评价数×20–30属于经验情景；搜索排名不直接换算本次搜索量，“历史销量÷上架天数”先得到日均，再换算目标月份。普通网页会员与API权限分别核验，密钥不写入报告。

利润JSON计算器可在支持Node的任何终端运行，推荐Node18或以上，只依赖内置库：

```bash
node skills/amazon-profit-analysis/scripts/calculate_profit.mjs \
  --input /path/to/input.json --output /path/to/profit-result.json
```

参考[输入模板](skills/amazon-profit-analysis/assets/input-template.json)和[必要条件](skills/amazon-profit-analysis/references/input-contract.md)。缺项返回码2及`needs_input`，完整净利为空；agent据此向用户追问。没有终端的agent按同一模型用可靠计算工具核算，仍须执行缺项关卡。

选品Excel通用路径为复制模板，再用agent可用的表格工具或通用xlsx库填入数据并重算/核验。保留字段、公式、来源与缺失值规则，不要求安装名为spreadsheets的技能。仓库的`write_selection.mjs`是可选增强生成器，需已有的`@oai/artifact-tool`；该特定工具不是通用安装依赖，也不是公开npm安装步骤。未具备xlsx编辑/重算能力时，说明实际缺失的工具能力，不能声称已生成或验证最终表。

选品网页推荐引用重算后的同一批产品／自有方案、评分与利润状态，推荐理由关联市场、竞争、关键词和差异化证据。成本缺失只列优先研究及待验证；利润失败列淘汰，不能进入积极推荐。没有可打样商品时如实说明，不凑推荐数量。

安装脚本已在临时目录测试复制、重复安装、冲突、备份恢复、路径含空格、多目标与项目安装，不会为测试写入真实agent目录。Windows入口共用同一Python实现；未在本次macOS环境执行PowerShell或逐个启动所有agent验证发现，客户端加载仍受版本和自身权限影响。

## 默认评分与利润规则

| 评分对象 | 维度与权重 |
|---|---|
| 方法优先级 | 需求证据35%、差异化发现25%、执行效率20%、资源匹配10%、获取成本10% |
| 候选商品初筛 | 市场容量30%、市场竞争25%、关键词20%、差异化25% |

各维度按1–5分评估，乘权重后换算为100分。方法分用于分配研究投入；商品分按实际证据计算。同一产品经多个渠道发现时合并来源，不重复加分。默认初筛75分及以上优先深挖，60–74.9分保留观察，低于60分暂缓。权重与分档均可调整；评分表示研究优先级。

利润独立判断：默认毛利率至少达到目标ACoS加5个百分点安全余量，即ACoS为30%时最低毛利率为35%。完整成本下净利润还须大于0。已知利润不达标直接淘汰，其他高分无法抵消；初筛未进入利润阶段可保持待验证，完整流程利润缺必要输入必须追问并补齐后重算。广告成本按广告归因订单情景计算，ACoS与TACoS的口径分别保留。

## 选品表

前18列保持以下顺序，第19列增加“选品方法”：

```text
排名｜产品名称｜类目｜核心关键词｜ASIN｜价格｜评论数｜评分｜竞争程度｜变体数｜上架时间｜FBA/FBM｜进货价｜毛利润｜毛利率｜主要差评｜是否有专利｜是否A+｜选品方法
```

“评分”是商品评价星级，满分5星；“初筛得分”是右侧独立的百分制字段。右侧还包括来源、辅助方法、评分依据与覆盖率，以及完整成本、净利和利润判断。

七个工作表：类目判断、选品表、市场与关键词、差评分析、选品方法、初筛规则、竞争分析。竞争页保存独立样本、统计定义、来源和缺项，阈值产生单项信号，综合进入仍受完整证据及利润否决约束。

## 参考与生成器

- [总入口调用流程、四报告交接与利润输入关卡](skills/amazon-product-direction/references/workflow.md)
- [方法、工具与初筛规则](skills/amazon-product-direction/references/selection-methods.md)
- [市场、竞争与利润研究方法](skills/amazon-product-direction/references/research-method.md)
- [三层竞争分析、阈值与工具降级](skills/amazon-product-direction/references/competition-analysis.md)
- [类目市场容量方法](skills/amazon-category-analysis/references/market-capacity.md)
- [类目竞争规则](skills/amazon-category-analysis/references/category-competition.md)
- [类目网页报告与证据交接](skills/amazon-category-analysis/references/output-contract.md)
- [关键词网页研究与CPC关卡](skills/amazon-keyword-analysis/references/web-research.md)
- [关键词网页报告与证据交接](skills/amazon-keyword-analysis/references/output-contract.md)
- [关键词HTML报告空模板](skills/amazon-keyword-analysis/assets/report-template.html)
- [Excel字段、JSON输入与生成命令](skills/amazon-product-direction/references/workbook-schema.md)
- [方法与工具数据源](skills/amazon-product-direction/assets/methods.json)
- [利润模型与官方工具](skills/amazon-profit-analysis/references/profit-model.md)
- [利润网页报告与证据交接](skills/amazon-profit-analysis/references/output-contract.md)
- [选品网页推荐与理由规则](skills/amazon-product-direction/references/web-report.md)
- [差异化竞品与差评研究](skills/amazon-differentiation-analysis/references/review-research.md)
- [差异化增量成本与验证](skills/amazon-differentiation-analysis/references/cost-and-validation.md)
- [差异化网页报告与证据交接](skills/amazon-differentiation-analysis/references/output-contract.md)
- [差异化HTML报告空模板](skills/amazon-differentiation-analysis/assets/report-template.html)
- [利润计算器测试](skills/amazon-profit-analysis/scripts/calculate_profit.test.mjs)：运行`node --test skills/amazon-profit-analysis/scripts/calculate_profit.test.mjs`

类目竞争规则的维护源为类目分析技能的references/category-competition.md。选品技能带同内容的本地副本，保证单独安装后仍可读取；修改维护源后运行`python3 scripts/sync_category_reference.py`，使用`--check`检查一致性。安装器自动发现skills下的技能，默认all会安装五个技能，现有macOS／Linux及Windows入口无需变更。
