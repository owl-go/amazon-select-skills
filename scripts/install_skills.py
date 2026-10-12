#!/usr/bin/env python3
"""Install local Agent Skills packages without third-party Python dependencies."""
import argparse
import hashlib
from pathlib import Path
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from uuid import uuid4

REPO_ROOT = Path(__file__).resolve().parents[1]
AGENTS = ("agents", "codex", "claude", "cursor", "opencode")


def target_dir(agent, scope, project=None, home=None):
    home = Path.home() if home is None else Path(home)
    if scope == "project":
        if project is None:
            raise ValueError("项目安装必须提供 --project-dir")
        base = Path(project).expanduser().resolve()
        if not base.is_dir():
            raise ValueError("--project-dir 必须是已有项目目录")
        folder = {"agents": ".agents", "codex": ".agents", "claude": ".claude", "cursor": ".cursor", "opencode": ".opencode"}[agent]
        return base / folder / "skills"
    if agent in ("agents", "codex"):
        return home / ".agents" / "skills"
    if agent == "opencode":
        return home / ".config" / "opencode" / "skills"
    return home / (".claude" if agent == "claude" else ".cursor") / "skills"


def available_skills(source):
    return sorted(p.name for p in source.iterdir() if p.is_dir() and (p / "SKILL.md").is_file())


def check_package(package):
    doc = (package / "SKILL.md").read_text(encoding="utf-8")
    header = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", doc, re.S)
    if not header:
        raise ValueError(f"缺少 SKILL.md frontmatter: {package.name}")
    name = re.search(r"^name:\s*['\"]?([a-z0-9-]+)['\"]?\s*$", header.group(1), re.M)
    if not name or name.group(1) != package.name:
        raise ValueError(f"技能 name 与目录不一致: {package.name}")
    if not re.search(r"^description:\s*\S", header.group(1), re.M):
        raise ValueError(f"技能缺少 description: {package.name}")
    if package.is_symlink() or any(p.is_symlink() for p in package.rglob("*")):
        raise ValueError(f"技能包包含符号链接，拒绝递归复制: {package.name}")


def signature(folder):
    entries = []
    for p in sorted(folder.rglob("*")):
        if p.is_symlink():
            return None
        relative = p.relative_to(folder).as_posix()
        if p.is_file():
            entries.append((relative, hashlib.sha256(p.read_bytes()).hexdigest()))
        elif p.is_dir():
            entries.append((relative + "/", ""))
        else:
            return None
    return entries


def overlaps(first, second):
    a, b = first.resolve(), second.resolve()
    return a == b or a in b.parents or b in a.parents


def build_plan(source, names, targets, force=False):
    plan = []
    for name in names:
        check_package(source / name)
    for root in targets:
        ancestor = root
        while not ancestor.exists() and ancestor != ancestor.parent:
            ancestor = ancestor.parent
        if not ancestor.is_dir():
            raise ValueError(f"目标父路径不是目录: {ancestor}")
        for name in names:
            src, dst = source / name, root / name
            if overlaps(src, dst):
                raise ValueError(f"安装目标与源技能重叠: {dst}")
            if dst.is_symlink():
                raise ValueError(f"目标为符号链接，拒绝替换: {dst}")
            exists = dst.exists()
            if exists and not dst.is_dir():
                raise ValueError(f"目标已存在且不是目录: {dst}")
            same = exists and signature(src) == signature(dst)
            if exists and not same and not force:
                raise ValueError(f"已有不同内容: {dst}\n更新请加 --force；会先备份旧版本")
            plan.append((src, dst, "skip" if same else "update" if exists else "install"))
    return plan


def apply_plan(plan, dry_run=False):
    for src, dst, action in plan:
        print(f"{'DRY-RUN ' if dry_run else ''}{action.upper()}: {dst}")
        if dry_run or action == "skip":
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        # Stage outside skills/ so clients cannot discover a half-copied skill.
        stage = Path(tempfile.mkdtemp(prefix=".amazon-skills-stage-", dir=dst.parent.parent))
        backup = None
        try:
            staged = stage / src.name
            shutil.copytree(src, staged)
            if action == "update":
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
                backup = dst.parent.parent / "amazon-select-skills-backups" / stamp / dst.name
                backup.parent.mkdir(parents=True, exist_ok=True)
                dst.rename(backup)
                print(f"BACKUP: {backup}")
            elif dst.exists() or dst.is_symlink():
                raise ValueError(f"目标在检查后出现，请重新检查: {dst}")
            try:
                staged.rename(dst)
            except Exception:
                if backup is not None and not dst.exists():
                    backup.rename(dst)
                raise
        finally:
            shutil.rmtree(stage)


def main(argv=None):
    parser = argparse.ArgumentParser(description="安装亚马逊选品/利润分析 Agent Skills。默认全局安装到 ~/.agents/skills。")
    parser.add_argument("--agent", action="append", choices=(*AGENTS, "all"), help="可重复指定；all安装到Codex、Claude Code、Cursor、OpenCode各自目录")
    parser.add_argument("--skill", action="append", help="技能名称，可重复或逗号分隔；默认all")
    parser.add_argument("--scope", choices=("global", "project"), default="global")
    parser.add_argument("--project-dir", help="项目安装的已有项目路径")
    parser.add_argument("--dest", help="自定义skills父目录；用于其他agent或旧版路径，不与--agent/项目模式混用")
    parser.add_argument("--force", action="store_true", help="备份后更新已有不同版本")
    parser.add_argument("--dry-run", action="store_true", help="仅检查及显示计划，不创建目录或复制文件")
    parser.add_argument("--list", action="store_true", help="列出可安装技能")
    options = parser.parse_args(argv)
    source = REPO_ROOT / "skills"
    known = available_skills(source)
    if options.list:
        print("\n".join(known))
        return 0
    names = [part.strip() for item in (options.skill or ["all"]) for part in item.split(",")]
    if "all" in names:
        if len(names) != 1:
            raise ValueError("--skill all 不能与具体技能混用")
        names = known
    if not names or any(name not in known for name in names):
        raise ValueError("未知技能；可选: " + ", ".join(known))
    names = list(dict.fromkeys(names))
    if options.dest:
        if options.agent or options.scope != "global" or options.project_dir:
            raise ValueError("--dest不能与--agent、项目模式或--project-dir混用")
        targets = [Path(options.dest).expanduser().resolve()]
    else:
        if options.scope == "global" and options.project_dir:
            raise ValueError("--project-dir须同时使用--scope project")
        agents = options.agent or ["agents"]
        if "all" in agents:
            agents = ["codex", "claude", "cursor", "opencode"]
        targets = list(dict.fromkeys(target_dir(agent, options.scope, options.project_dir).resolve() for agent in agents))
    plan = build_plan(source, names, targets, options.force)
    apply_plan(plan, options.dry_run)
    if not options.dry_run:
        print("完成。请在agent中刷新技能列表；若未发现技能，重新开启会话。安装不包含Node、Excel工具或第三方账号。")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError) as error:
        print(f"安装失败: {error}", file=sys.stderr)
        sys.exit(1)
