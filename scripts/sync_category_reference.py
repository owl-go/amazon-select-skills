#!/usr/bin/env python3
"""Package the shared category rules into each independently installable skill."""
from pathlib import Path
import argparse
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "skills/amazon-category-analysis/references/category-competition.md"
TARGET = ROOT / "skills/amazon-product-direction/references/category-competition.md"


def main():
    parser = argparse.ArgumentParser(description="同步类目竞争规则到选品技能；源文件位于类目分析技能。")
    parser.add_argument("--check", action="store_true", help="仅检查两个独立技能包的规则是否一致")
    options = parser.parse_args()
    if options.check:
        if not TARGET.is_file() or TARGET.read_bytes() != SOURCE.read_bytes():
            raise SystemExit("类目规则未同步；运行 python3 scripts/sync_category_reference.py")
        print("类目规则一致")
    else:
        shutil.copyfile(SOURCE, TARGET)
        print("已同步类目竞争规则到选品技能")


if __name__ == "__main__":
    main()
