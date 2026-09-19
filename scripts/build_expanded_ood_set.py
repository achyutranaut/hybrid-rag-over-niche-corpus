#!/usr/bin/env python3
"""
Builds the expanded Out-Of-Distribution (OOD) / Abstention Benchmark (70 queries: 50 dev, 20 test)
independently of model outputs, strictly bound to frozen corpus hash sha256:cdcc7258098ffa61.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.validate_eval_set import compute_raw_corpus_hash

CORPUS_HASH = compute_raw_corpus_hash()

OOD_QUERIES = [
    # -------------------------------------------------------------------------
    # 1. Nonexistent CVEs (8 queries: 6 dev, 2 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0001", "query": "CVE-2099-00001", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0002", "query": "Tell me about CVE-2025-99999", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0003", "query": "What is the severity score for CVE-2026-11111?", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0004", "query": "CVE-1991-00001 vulnerability details", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0005", "query": "Has CVE-2030-44444 been patched yet?", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0006", "query": "CVE-2025-00002 advisory", "subtype": "nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0007", "query": "What software is affected by CVE-2098-76543?", "subtype": "nonexistent_cve", "split": "test"},
    {"query_id": "ood-0008", "query": "CVE-2027-13370 mitigation steps", "subtype": "nonexistent_cve", "split": "test"},

    # -------------------------------------------------------------------------
    # 2. Nonexistent ATT&CK IDs (8 queries: 6 dev, 2 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0009", "query": "Explain MITRE ATT&CK technique T9999", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0010", "query": "T1999.001 sub-technique details", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0011", "query": "How do adversaries execute T8888.002?", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0012", "query": "What tactics does T7777 belong to?", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0013", "query": "Detection recommendations for T9001.005", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0014", "query": "T8008 execution flow", "subtype": "nonexistent_attack_id", "split": "dev"},
    {"query_id": "ood-0015", "query": "Mitigations against attack pattern T6666", "subtype": "nonexistent_attack_id", "split": "test"},
    {"query_id": "ood-0016", "query": "Describe sub-technique T9555.001 in enterprise matrices", "subtype": "nonexistent_attack_id", "split": "test"},

    # -------------------------------------------------------------------------
    # 3. Plausible Fake Identifiers with Security Phrasing (9 queries: 6 dev, 3 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0017", "query": "How do adversaries exploit CVE-2024-88888 to execute arbitrary code?", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0018", "query": "Defense mitigations against adversary persistence technique T1988.001", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0019", "query": "Tell me how threat actors weaponize CVE-2025-77712 via spearphishing", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0020", "query": "Privilege escalation procedures associated with technique T9412", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0021", "query": "Exploitation of CVE-2026-55410 in web applications", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0022", "query": "What data sources detect unauthorized access under technique T8920?", "subtype": "plausible_fake_id_with_security_phrasing", "split": "dev"},
    {"query_id": "ood-0023", "query": "How does an attacker bypass endpoint security using CVE-2025-41999?", "subtype": "plausible_fake_id_with_security_phrasing", "split": "test"},
    {"query_id": "ood-0024", "query": "Adversary lateral movement using SMB named pipes under T9823", "subtype": "plausible_fake_id_with_security_phrasing", "split": "test"},
    {"query_id": "ood-0025", "query": "Remote code execution proof of concept for CVE-2027-88123", "subtype": "plausible_fake_id_with_security_phrasing", "split": "test"},

    # -------------------------------------------------------------------------
    # 4. Real Vulnerability Terms + Nonexistent CVEs (9 queries: 6 dev, 3 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0026", "query": "Heap-based buffer overflow in glibc malloc via CVE-2024-99881", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0027", "query": "Authentication bypass vulnerability in OpenSSH PAM module CVE-2025-0101", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0028", "query": "Zero-day remote code execution in BIND9 DNS resolver CVE-2026-33991", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0029", "query": "Use-after-free flaw in Linux kernel eBPF subsystem CVE-2025-66772", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0030", "query": "Cross-site scripting vulnerability in WordPress Core CVE-2026-12884", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0031", "query": "SQL injection vulnerability affecting Cisco ASA WebVPN CVE-2025-44910", "subtype": "real_vuln_terms_nonexistent_cve", "split": "dev"},
    {"query_id": "ood-0032", "query": "Format string vulnerability in sudo utility CVE-2026-90114", "subtype": "real_vuln_terms_nonexistent_cve", "split": "test"},
    {"query_id": "ood-0033", "query": "Directory traversal vulnerability in Apache Tomcat AJP connector CVE-2025-33120", "subtype": "real_vuln_terms_nonexistent_cve", "split": "test"},
    {"query_id": "ood-0034", "query": "Denial of service flaw in Nginx HTTP/2 parser CVE-2026-78441", "subtype": "real_vuln_terms_nonexistent_cve", "split": "test"},

    # -------------------------------------------------------------------------
    # 5. Real Technique Terms + Nonexistent IDs (9 queries: 7 dev, 2 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0035", "query": "Abusing Windows COM objects for privilege escalation under technique T9123", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0036", "query": "Kerberos golden ticket forging and ticket-granting ticket abuse via T8442", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0037", "query": "DNS tunneling protocol exfiltration technique T9301.002", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0038", "query": "Password spraying against Active Directory Federation Services via T9761", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0039", "query": "Reflective DLL injection directly into remote memory under T8119.004", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0040", "query": "Disabling Windows Defender antivirus via registry modification under T9550", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0041", "query": "Dumping LSA secrets using native PowerShell cmdlets under T8331", "subtype": "real_technique_terms_nonexistent_id", "split": "dev"},
    {"query_id": "ood-0042", "query": "Adversary discovery of domain trust relationships cataloged under T9640", "subtype": "real_technique_terms_nonexistent_id", "split": "test"},
    {"query_id": "ood-0043", "query": "Exfiltration over encrypted HTTPS webhooks using technique T9215", "subtype": "real_technique_terms_nonexistent_id", "split": "test"},

    # -------------------------------------------------------------------------
    # 6. Unrelated Technical Topics (9 queries: 6 dev, 3 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0044", "query": "How to configure PostgreSQL streaming replication with Patroni and etcd", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0045", "query": "Explain the React 19 Server Components rendering lifecycle in Next.js", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0046", "query": "Comparing Cilium eBPF and Calico CNI plugins in Kubernetes clusters", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0047", "query": "How do LLVM compiler optimization passes perform auto-vectorization on ARM64 NEON?", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0048", "query": "Configuring BGP EVPN with VXLAN overlays on Arista EOS switches", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0049", "query": "Implementing Raft consensus algorithm leader election in Rust", "subtype": "unrelated_technical_topic", "split": "dev"},
    {"query_id": "ood-0050", "query": "Writing custom Prometheus metrics collectors in Go using the client library", "subtype": "unrelated_technical_topic", "split": "test"},
    {"query_id": "ood-0051", "query": "Configuring Apache Kafka partition rebalancing with cooperative sticky assignors", "subtype": "unrelated_technical_topic", "split": "test"},
    {"query_id": "ood-0052", "query": "Building cross-platform graphical user interfaces with Flutter desktop", "subtype": "unrelated_technical_topic", "split": "test"},

    # -------------------------------------------------------------------------
    # 7. Unrelated Everyday / General Knowledge Topics (9 queries: 6 dev, 3 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0053", "query": "What is the optimal water hydration percentage for baking sourdough bread?", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0054", "query": "Explain the structural civil engineering of the Roman aqueduct in Segovia", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0055", "query": "FIDE official tournament rules for threefold repetition in chess games", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0056", "query": "How do chloroplasts convert solar photons into chemical energy during photosynthesis?", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0057", "query": "What is the capital city of Australia and what is its population?", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0058", "query": "Techniques for oil painting landscape lighting and atmospheric perspective", "subtype": "unrelated_everyday_topic", "split": "dev"},
    {"query_id": "ood-0059", "query": "History of the construction of the Panama Canal and the locks system", "subtype": "unrelated_everyday_topic", "split": "test"},
    {"query_id": "ood-0060", "query": "How do acoustic guitars produce different timbre compared to classical guitars?", "subtype": "unrelated_everyday_topic", "split": "test"},
    {"query_id": "ood-0061", "query": "Training guidelines for running a marathon in under four hours", "subtype": "unrelated_everyday_topic", "split": "test"},

    # -------------------------------------------------------------------------
    # 8. Security Questions Strictly Outside Corpus Scope (9 queries: 7 dev, 2 test)
    # -------------------------------------------------------------------------
    {"query_id": "ood-0062", "query": "Explain the Rowhammer electrical disturbance attack on DDR4 DRAM memory cells", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0063", "query": "Exploiting smart contract reentrancy vulnerabilities in Solidity ERC-20 tokens", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0064", "query": "Side-channel timing attacks on AES cryptographic cache lines and S-box lookups", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0065", "query": "Electromagnetic fault injection (EMFI) against microcontroller hardware cryptographic engines", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0066", "query": "How do quantum computers execute Shor's algorithm to factor large prime numbers?", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0067", "query": "Acoustic side-channel attacks for recovering keystrokes from smartphone microphones", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0068", "query": "Attacking automotive CAN bus networks via physical OBD-II diagnostic interfaces", "subtype": "security_outside_corpus", "split": "dev"},
    {"query_id": "ood-0069", "query": "Exploiting satellite communication uplink signals via software-defined radio", "subtype": "security_outside_corpus", "split": "test"},
    {"query_id": "ood-0070", "query": "Optical side-channel attacks analyzing LED blinking patterns to exfiltrate air-gapped data", "subtype": "security_outside_corpus", "split": "test"},
]

def main():
    formatted = []
    for item in OOD_QUERIES:
        formatted.append({
            "query_id": item["query_id"],
            "query": item["query"],
            "category": "out_of_corpus",
            "subtype": item["subtype"],
            "split": item["split"],
            "provenance": "analyst_phrasing",
            "corpus_version": CORPUS_HASH,
            "expect_abstain": True,
            "expected_doc_ids": [],
            "relevance": {},
            "notes": f"Expanded OOD benchmark query ({item['subtype']}). Must trigger abstention."
        })

    out_path = Path("eval_data/ood_eval_set.json")
    with open(out_path, "w") as f:
        json.dump(formatted, f, indent=2)

    dev_count = sum(1 for q in formatted if q["split"] == "dev")
    test_count = sum(1 for q in formatted if q["split"] == "test")
    print(f"Created {len(formatted)} OOD queries in {out_path}:")
    print(f"  DEV split : {dev_count} queries")
    print(f"  TEST split: {test_count} queries (FROZEN - not evaluated now)")

if __name__ == "__main__":
    main()
