"""
Parses CVE Record Format 5.x JSON (CVEProject/cvelistV5) into normalized
`RawDocument` records.

Real-world CVE records are inconsistent: CVSS metrics come from different
CNAs (Apache, Microsoft, GitHub...) in different shapes, `problemTypes`
sometimes has structured CWE ids and sometimes free text. Every field access
below is defensive on purpose -- an ingestion pipeline over a heterogeneous
corpus that assumes a clean schema will silently drop or crash on real data.
"""
from __future__ import annotations

import json
import glob
from typing import Any

from .attack_parser import RawDocument


def _first_en_description(descriptions: list[dict]) -> str:
    for d in descriptions:
        if d.get("lang", "en").startswith("en"):
            return d.get("value", "")
    return descriptions[0].get("value", "") if descriptions else ""


def _extract_cwe_ids(problem_types: list[dict]) -> list[str]:
    ids = []
    for pt in problem_types:
        for d in pt.get("descriptions", []):
            cwe_id = d.get("cweId")
            if cwe_id:
                ids.append(cwe_id)
    return ids


def _extract_cvss(metrics: list[dict]) -> dict[str, Any]:
    """CVSS shape differs by version (cvssV3_1, cvssV3_0, cvssV4_0) and some
    CNAs only report a qualitative "other" severity. Return whatever we can
    find, structured, rather than assuming CVSS v3.1 always exists."""
    for m in metrics:
        for key in ("cvssV4_0", "cvssV3_1", "cvssV3_0", "cvssV2_0"):
            if key in m:
                c = m[key]
                return {
                    "version": key,
                    "baseScore": c.get("baseScore"),
                    "baseSeverity": c.get("baseSeverity"),
                    "vectorString": c.get("vectorString"),
                }
        if "other" in m:
            return {"version": "qualitative", "baseSeverity": m["other"].get("content", {}).get("other")}
    return {}


def _affected_products(affected: list[dict]) -> list[str]:
    out = []
    for a in affected:
        vendor = a.get("vendor", "")
        product = a.get("product", "")
        if vendor or product:
            out.append(f"{vendor} {product}".strip())
    return out


def parse_cve_record(path: str) -> RawDocument | None:
    with open(path, "r", encoding="utf-8") as f:
        d = json.load(f)

    if d.get("cveMetadata", {}).get("state") != "PUBLISHED":
        return None

    cve_id = d["cveMetadata"]["cveId"]
    cna = d.get("containers", {}).get("cna", {})

    title = cna.get("title") or cve_id
    description = _first_en_description(cna.get("descriptions", []))
    if not description:
        return None

    cwe_ids = _extract_cwe_ids(cna.get("problemTypes", []))
    adps = d.get("containers", {}).get("adp", [])
    if not cwe_ids:
        for a in adps:
            cwe_ids.extend(_extract_cwe_ids(a.get("problemTypes", [])))
        cwe_ids = list(dict.fromkeys(cwe_ids))

    cvss = _extract_cvss(cna.get("metrics", []))
    if not cvss.get("baseScore"):
        for a in adps:
            adp_cvss = _extract_cvss(a.get("metrics", []))
            if adp_cvss.get("baseScore"):
                cvss = adp_cvss
                break
            elif not cvss.get("baseSeverity") and adp_cvss.get("baseSeverity"):
                cvss = adp_cvss

    affected = _affected_products(cna.get("affected", []))
    published = d["cveMetadata"].get("datePublished")

    parts = [f"# {cve_id}: {title}", "", description]
    if affected:
        parts += ["", f"**Affected products:** {', '.join(affected[:8])}"]
    if cwe_ids:
        parts += ["", f"**Weakness type(s):** {', '.join(cwe_ids)}"]
    if cvss.get("baseScore") is not None:
        parts += ["", f"**CVSS:** {cvss['baseScore']} ({cvss.get('baseSeverity', 'unknown')}, {cvss.get('version')})"]
    elif cvss.get("baseSeverity"):
        parts += ["", f"**Severity:** {cvss['baseSeverity']}"]

    text = "\n".join(parts).strip()

    return RawDocument(
        doc_id=f"cve:{cve_id}",
        source="cve_nvd",
        document_type="vulnerability",
        title=f"{cve_id}: {title}",
        text=text,
        url=f"https://www.cve.org/CVERecord?id={cve_id}",
        metadata={
            "cve_id": cve_id,
            "cwe_ids": cwe_ids,
            "cvss_score": cvss.get("baseScore"),
            "cvss_severity": cvss.get("baseSeverity"),
            "affected_products": affected,
            "published": published,
        },
    )


def parse_cve_directory(dir_path: str) -> list[RawDocument]:
    docs = []
    for path in sorted(glob.glob(f"{dir_path}/*.json")):
        doc = parse_cve_record(path)
        if doc:
            docs.append(doc)
    return docs
