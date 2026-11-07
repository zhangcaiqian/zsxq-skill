#!/usr/bin/env python3
"""列出当前 Cookie 可访问的知识星球，并生成 config.json 的 channels 片段。

用法:
    python3 scripts/channels.py            # 人类可读表格 + 可直接粘贴的 JSON
    python3 scripts/channels.py --json     # 只输出 JSON
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from utils import load_config
from zsxq_api import ZsxqClient


def suggest_key(name: str, group_id: str) -> str:
    """由星球名生成一个 kebab-case 的频道 key；纯中文名回退到 group-<尾号>。"""
    ascii_part = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    ascii_part = re.sub(r"-{2,}", "-", ascii_part)
    return ascii_part or f"group-{str(group_id)[-4:]}"


def build_channels(groups: list[dict]) -> tuple[dict, list[tuple[str, str, str]]]:
    """把 /v2/groups 的返回整理成 channels 配置与展示行。"""
    channels: dict = {}
    rows: list[tuple[str, str, str]] = []
    for item in groups:
        info = item.get("group", item) if isinstance(item, dict) else {}
        name = str(info.get("name") or "").strip()
        group_id = str(info.get("group_id") or "").strip()
        if not group_id:
            continue
        key = suggest_key(name, group_id)
        base, suffix = key, 2
        while key in channels:
            key = f"{base}-{suffix}"
            suffix += 1
        channels[key] = {"name": name, "group_id": group_id, "default_scope": "digests"}
        rows.append((key, name, group_id))
    return channels, rows


def main() -> None:
    parser = argparse.ArgumentParser(description="列出可访问的知识星球并生成 channels 配置")
    parser.add_argument("--json", action="store_true", help="只输出 JSON 片段")
    args = parser.parse_args()

    config = load_config()
    try:
        groups = ZsxqClient(config["zsxq_cookie"]).get_groups()
    except Exception as error:  # noqa: BLE001 - 面向用户的诊断信息
        print(f"❌ 获取星球列表失败：{error}")
        print("   401 = Cookie 失效，请重新获取；其它错误见 reference/api-reference.md")
        sys.exit(1)

    channels, rows = build_channels(groups)
    if args.json:
        print(json.dumps({"channels": channels}, ensure_ascii=False, indent=2))
        return
    if not rows:
        print("当前 Cookie 没有可访问的星球。")
        return

    print(f"可访问 {len(rows)} 个星球：\n")
    print(f"{'key':28s} {'group_id':16s} 名称")
    print("-" * 80)
    for key, name, group_id in rows:
        print(f"{key:28s} {group_id:16s} {name}")

    print("\n把下面这段合并进 config.json 的 channels，删掉不需要同步的条目：\n")
    print(json.dumps({"channels": channels}, ensure_ascii=False, indent=2))
    print("\n之后即可：python3 scripts/sync.py --channel <key> --today")


if __name__ == "__main__":
    main()
