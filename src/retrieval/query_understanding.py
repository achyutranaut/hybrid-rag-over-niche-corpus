"""
Query understanding: light, targeted preprocessing before retrieval.

Deliberately NOT a general query-rewriting LLM call for every query -- that
adds latency and can introduce noise (an expanded query can drift from user
intent, especially when the user already used a precise technical term).
This module does two narrow, high-confidence things instead:

1. Identifier detection: recognize CVE / ATT&CK technique / CWE ids in the
   raw query so the API layer can offer them as payload-filter candidates
   (see src/retrieval/context.py and API section of ARCHITECTURE.md) rather
   than relying on retrieval alone to surface an exact-id query.

2. Acronym expansion: a small, curated domain glossary. Expansion is
   ADDITIVE (appended to the query, original terms kept) rather than
   REPLACING the user's terms, specifically to avoid the failure mode in
   the handoff brief: expanding every query and drowning a precise query in
   noise. Only fires for terms actually in the curated list, not general NLP.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

CVE_RE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)
TECHNIQUE_RE = re.compile(r"\bT\d{4}(?:\.\d{3})?\b")
CWE_RE = re.compile(r"\bCWE-\d+\b", re.IGNORECASE)

# Small, curated -- NOT an attempt at a general acronym dictionary. Every
# entry here was chosen because it's a term likely to appear in user
# questions but phrased differently than the corpus text (e.g. a user says
# "credential dumping", the corpus also says LSASS/SAM/NTDS).
ACRONYM_GLOSSARY: dict[str, list[str]] = {
    "credential dumping": ["LSASS", "SAM", "NTDS", "OS Credential Dumping"],
    "rce": ["remote code execution"],
    "lpe": ["local privilege escalation", "privilege escalation"],
    "sqli": ["SQL injection"],
    "xss": ["cross-site scripting"],
    "mitm": ["man-in-the-middle", "adversary-in-the-middle"],
    "c2": ["command and control"],
    "ttps": ["tactics, techniques, and procedures"],
    "iam": ["identity and access management"],
    "edr": ["endpoint detection and response"],
}


@dataclass
class QueryAnalysis:
    raw_query: str
    expanded_query: str
    detected_cves: list[str]
    detected_technique_ids: list[str]
    detected_cwes: list[str]
    expansion_terms: list[str]


def analyze_query(query: str, enable_acronym_expansion: bool = True) -> QueryAnalysis:
    detected_cves = [m.group(0).upper() for m in CVE_RE.finditer(query)]
    detected_techniques = [m.group(0).upper() for m in TECHNIQUE_RE.finditer(query)]
    detected_cwes = [m.group(0).upper() for m in CWE_RE.finditer(query)]

    expansion_terms: list[str] = []
    if enable_acronym_expansion:
        q_lower = query.lower()
        for key, expansions in ACRONYM_GLOSSARY.items():
            if key in q_lower:
                expansion_terms.extend(expansions)

    expanded_query = query
    if expansion_terms:
        expanded_query = f"{query} ({' '.join(expansion_terms)})"

    return QueryAnalysis(
        raw_query=query,
        expanded_query=expanded_query,
        detected_cves=detected_cves,
        detected_technique_ids=detected_techniques,
        detected_cwes=detected_cwes,
        expansion_terms=expansion_terms,
    )
