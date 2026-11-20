#!/usr/bin/env python3
"""Check all content files and rebuild each content/<subject>/<program>/index.json.

Run from the repository root after adding or editing questions or lessons:

    python3 tools/build_index.py

It stops with a list of problems if any question or lesson is malformed.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content"


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"{path}: invalid JSON ({e})")


def check_question(q, where, codes, papers, errors):
    qid = q.get("id")
    if not qid:
        errors.append(f"{where}: a question has no id")
        return
    w = f"{where} [{qid}]"
    if q.get("paper") not in papers:
        errors.append(f"{w}: paper must be one of {sorted(papers)}")
    subs = q.get("subtopics") or []
    if not subs:
        errors.append(f"{w}: needs at least one subtopic")
    for s in subs:
        if s not in codes:
            errors.append(f"{w}: unknown subtopic {s}")
    if q.get("level", "SL") not in ("SL", "HL"):
        errors.append(f"{w}: level must be SL or HL")
    if q.get("options"):
        letters = [chr(65 + i) for i in range(len(q["options"]))]
        if q.get("answer") not in letters:
            errors.append(f"{w}: answer must be one of {letters}")
    else:
        parts = q.get("parts") or []
        if not parts and not q.get("marks"):
            errors.append(f"{w}: needs options (multiple choice) or parts (structured)")
        for p in parts:
            if not isinstance(p.get("marks"), int) or p["marks"] < 1:
                errors.append(f"{w} part {p.get('label', '?')}: marks must be a whole number ≥ 1")
            if not p.get("markscheme"):
                errors.append(f"{w} part {p.get('label', '?')}: missing markscheme")


def build(program_dir, errors):
    syllabus = load(program_dir / "syllabus.json")
    codes = {s["code"] for t in syllabus["topics"] for s in t["subtopics"]}
    papers = {p["id"] for p in syllabus["papers"]}
    index = {"questions": {}, "revision": {}}
    seen = {}

    qdir = program_dir / "questions"
    for f in sorted(qdir.glob("*.json")) if qdir.exists() else []:
        if f.stem not in codes:
            errors.append(f"{f}: file name must be a subtopic code, e.g. A.2.json")
        data = load(f)
        if not isinstance(data, list):
            errors.append(f"{f}: must contain a list of questions")
            continue
        for q in data:
            check_question(q, f.relative_to(ROOT), codes, papers, errors)
            if q.get("id") in seen:
                errors.append(f"{f}: duplicate id {q['id']} (also in {seen[q['id']]})")
            seen[q.get("id")] = f.name
        if data:
            index["questions"][f.stem] = len(data)

    rdir = program_dir / "revision"
    for f in sorted(rdir.glob("*.json")) if rdir.exists() else []:
        lesson = load(f)
        if f.stem not in codes:
            errors.append(f"{f}: file name must be a subtopic code")
        if not lesson.get("steps"):
            errors.append(f"{f}: lesson has no steps")
            continue
        for i, s in enumerate(lesson["steps"], 1):
            c = s.get("check")
            if c and c.get("answer") not in [chr(65 + k) for k in range(len(c.get("options", [])))]:
                errors.append(f"{f} step {i}: quick-check answer does not match an option")
        index["revision"][f.stem] = {
            "title": lesson.get("title", f.stem),
            "steps": len(lesson["steps"]) + 1,  # +1 for the intro step
            "minutes": lesson.get("minutes", 15),
        }

    (program_dir / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    nq = sum(index["questions"].values())
    print(f"{program_dir.relative_to(ROOT)}: {nq} questions, {len(index['revision'])} lessons")


def main():
    errors = []
    for syl in sorted(ROOT.glob("*/*/syllabus.json")):
        build(syl.parent, errors)
    if errors:
        print("\nProblems found:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("All content is valid.")


if __name__ == "__main__":
    main()
