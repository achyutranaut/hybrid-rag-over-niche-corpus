"""
Parses the MITRE ATT&CK Enterprise STIX 2.1 bundle into normalized
`RawDocument` records.

Source: https://github.com/mitre-attack/attack-stix-data (Enterprise matrix)
We keep only `attack-pattern` (techniques/sub-techniques) objects for v1 --
tactics, mitigations, groups, and software are natural Phase-2 additions and
are called out in ARCHITECTURE.md rather than silently added here.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RawDocument:
    doc_id: str                 # stable, deterministic id (see ingestion/ids.py)
    source: str                 # "mitre_attack" | "cve_nvd"
    document_type: str          # "attack-technique" | "vulnerability"
    title: str
    text: str                   # normalized full text, ready for chunking
    url: str
    metadata: dict[str, Any] = field(default_factory=dict)


def _external_id(obj: dict) -> str | None:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("external_id")
    return None


def _external_url(obj: dict) -> str | None:
    for ref in obj.get("external_references", []):
        if ref.get("source_name") == "mitre-attack":
            return ref.get("url")
    return None


def _strip_markdown_citations(text: str) -> str:
    # ATT&CK descriptions use STIX-style footnote markers like (Citation: Foo)
    return re.sub(r"\(Citation:[^)]*\)", "", text or "").strip()


def parse_attack_bundle(path: str, limit: int | None = None) -> list[RawDocument]:
    import os
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"MITRE ATT&CK STIX bundle not found at '{path}'. "
            "This 53MB file is an externally supplied prerequisite. "
            "Download it via: curl -s -o data/raw/enterprise-attack.json "
            "'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json'"
        )
    with open(path, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    objects = bundle["objects"]

    tactic_lookup = {
        o["x_mitre_shortname"]: o["name"]
        for o in objects
        if o.get("type") == "x-mitre-tactic" and "x_mitre_shortname" in o
    }

    docs: list[RawDocument] = []
    for obj in objects:
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue

        technique_id = _external_id(obj)
        if not technique_id:
            continue

        name = obj.get("name", "")
        description = _strip_markdown_citations(obj.get("description", ""))
        platforms = obj.get("x_mitre_platforms", [])
        tactics = [
            tactic_lookup.get(phase["phase_name"], phase["phase_name"])
            for phase in obj.get("kill_chain_phases", [])
            if phase.get("kill_chain_name") == "mitre-attack"
        ]
        data_sources = obj.get("x_mitre_data_sources", [])
        is_subtechnique = obj.get("x_mitre_is_subtechnique", False)
        permissions_required = obj.get("x_mitre_permissions_required", [])
        detection = _strip_markdown_citations(obj.get("x_mitre_detection", ""))

        parts = [f"# {technique_id}: {name}", "", description]
        if tactics:
            parts += ["", f"**Tactics:** {', '.join(tactics)}"]
        if platforms:
            parts += ["", f"**Platforms:** {', '.join(platforms)}"]
        if permissions_required:
            parts += ["", f"**Permissions required:** {', '.join(permissions_required)}"]
        if detection:
            parts += ["", "## Detection", detection]

        text = "\n".join(parts).strip()

        docs.append(
            RawDocument(
                doc_id=f"attack:{technique_id}",
                source="mitre_attack",
                document_type="attack-technique",
                title=f"{technique_id}: {name}",
                text=text,
                url=_external_url(obj) or "",
                metadata={
                    "technique_id": technique_id,
                    "is_subtechnique": is_subtechnique,
                    "tactics": tactics,
                    "platforms": platforms,
                    "data_sources": data_sources,
                    "stix_id": obj.get("id"),
                    "modified": obj.get("modified"),
                },
            )
        )
        if limit and len(docs) >= limit:
            break

    return docs
