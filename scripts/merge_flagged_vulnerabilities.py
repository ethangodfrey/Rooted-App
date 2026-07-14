#!/usr/bin/env python3
"""Merge new security findings into flagged-vulnerabilities memory JSON."""
import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: merge_flagged_vulnerabilities.py <existing.json> <new.json> <out.json>", file=sys.stderr)
        return 1

    existing_path, new_path, out_path = map(Path, sys.argv[1:4])
    with existing_path.open() as f:
        data = json.load(f)
    with new_path.open() as f:
        new_findings = json.load(f)

    titles = {item["title"] for item in data.get("findings", [])}
    for item in new_findings:
        if item["title"] in titles:
            print(f"duplicate title: {item['title']}", file=sys.stderr)
            return 2
        titles.add(item["title"])

    data.setdefault("findings", []).extend(new_findings)
    with out_path.open("w") as f:
        json.dump(data, f, indent=4)

    print(len(data["findings"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
