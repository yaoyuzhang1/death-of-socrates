"""Extract Republic I-IV from the locally cached Perseus TEI, without notes.

Run from any directory:
    python scripts/extract-perseus.py

Download the TEI separately from the Perseus canonical-greekLit repository:
https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml
Save it as .local/sources/shorey-perseus.xml, or pass --source PATH.
The source SHA-256 is recorded in each generated comparison report.

Inputs book1-en.json through book4-en.json supply existing reading boundaries
and comparison wording. They are sought in --reading-dir (default: output
directory). Each is an array of {ref,english} objects. Without an input book,
its exact-milestone output is still generated, but alignment/comparison is
skipped. Use --output-dir PATH to select an output directory independently.

Input is never fetched or changed. Outputs are bookN-perseus-en.json,
bookN-aligned-en.json and comparison reports in the output directory. Existing
bookN-en/zh files are untouched. Aligned output uses only Perseus characters,
with boundaries mapped to the existing reading fragments by a token diff.
The milestone stream, not XML div numbers, determines Stephanus boundaries.
"""

from __future__ import annotations

import argparse
from collections import Counter
import difflib
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {1: (136, "327a", "354c"), 2: (132, "357a", "383c"),
            3: (156, "386a", "417b"), 4: (131, "419a", "445e")}
SKIP = {"note", "head", "fw"}
NS = "{http://www.tei-c.org/ns/1.0}"


def tag(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def clean_space(text: str) -> str:
    # Preserve intentional paragraph and verse line breaks; XML source wraps
    # are normalized to spaces before rendering, not mistaken for verse lines.
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class BookExtractor:
    def __init__(self) -> None:
        self.rows: list[dict[str, str]] = []
        self.current_ref: str | None = None
        self.parts: list[str] = []
        self.skipped: Counter[str] = Counter()
        self.quote_depth = 0
        self.poem_lines = 0
        self.retained_bibl_titles = 0
        self.metadata_cleanup: list[dict[str, str]] = []

    def append(self, text: str | None, *, literal: bool = False) -> None:
        if text:
            self.parts.append(text if literal else re.sub(r"\s+", " ", text))

    def flush(self) -> None:
        body = clean_space("".join(self.parts))
        if self.current_ref is None:
            if body:
                raise ValueError(f"Unassigned text before first milestone: {body[:80]!r}")
        else:
            if not body:
                raise ValueError(f"Empty Stephanus fragment: {self.current_ref}")
            self.rows.append({"ref": self.current_ref, "english": body})
        self.parts = []

    def walk(self, element: ET.Element) -> None:
        name = tag(element)
        if name in SKIP:
            self.skipped[name] += 1
            return  # The parent still emits this element's tail.
        if name == "bibl":
            # This source also uses <bibl> for the spoken book title in
            # "the beginning of the Iliad in which ..." (392e). Unlike a
            # numbered source citation, the title is part of the dialogue.
            if self.current_ref == "392e" and "".join(element.itertext()).strip() == "Iliad":
                self.retained_bibl_titles += 1
            else:
                self.skipped["bibl"] += 1
                return
        if name == "milestone":
            if element.get("resp") == "Stephanus" and element.get("unit") == "section":
                reference = element.get("n", "")
                if not re.fullmatch(r"\d+[a-e]", reference):
                    raise ValueError(f"Unexpected Stephanus section: {reference!r}")
                self.flush()
                self.current_ref = reference
            elif element.get("unit") == "para":
                self.append("\n\n", literal=True)
            # Page numbers, editorial paragraph numbers, and all milestone
            # attributes are metadata. None are emitted as body characters.
            return

        is_quote = name in {"q", "quote"}
        if name == "p":
            self.append("\n\n", literal=True)
        elif name == "l":
            self.poem_lines += 1
            self.append("\n", literal=True)
        elif name in {"lb", "pb"}:
            self.append("\n", literal=True)

        # TEI encodes quotation marks structurally. Reconstitute them without
        # adding words. A merged quote continues a previous section's speech.
        if is_quote:
            if element.get("rend") != "merge":
                previous = "".join(self.parts)
                if previous and (previous[-1].isalnum() or previous[-1] in "”’"):
                    self.append(" ")
                self.append("“" if self.quote_depth % 2 == 0 else "‘")
            self.quote_depth += 1

        self.append(element.text)
        for child in element:
            self.walk(child)
            tail = child.tail
            # One editorial citation leaks outside its <bibl> in the XML.
            # Remove only this documented exact suffix, retaining the next
            # spoken clause. No broad numeral/parenthesis regex is applied.
            if (tag(child) == "bibl" and self.current_ref == "365c"
                    and "".join(child.itertext()).strip() == "Simonides, Fr. 76 Bergk"):
                suffix = ", and Eur. Orest. 236"
                if not tail or not tail.startswith(suffix):
                    raise ValueError("The documented 365c citation suffix changed")
                tail = tail[len(suffix):]
                self.metadata_cleanup.append({"ref": "365c", "removed": suffix,
                                              "reason": "editorial citation outside bibl element"})
            self.append(tail)

        if is_quote:
            self.quote_depth -= 1
            self.append("”" if self.quote_depth % 2 == 0 else "’")
        if name == "p":
            self.append("\n", literal=True)


def tokens(text: str) -> list[str]:
    """Case, whitespace and punctuation independent word/number comparison."""
    normalized = unicodedata.normalize("NFKC", text).casefold().replace("ʼ", "'")
    return re.findall(r"[^\W_]+", normalized)


def differences(old: list[str], new: list[str]) -> list[dict[str, object]]:
    matcher = difflib.SequenceMatcher(None, old, new, autojunk=False)
    return [{"operation": op, "old": " ".join(old[a:b]), "new": " ".join(new[c:d]),
             "oldTokenRange": [a, b], "newTokenRange": [c, d]}
            for op, a, b, c, d in matcher.get_opcodes() if op != "equal"]


def compare(old_rows: list[dict[str, str]], new_rows: list[dict[str, str]]) -> dict:
    old_refs = [row["ref"] for row in old_rows]
    new_refs = [row["ref"] for row in new_rows]
    if old_refs != new_refs:
        raise ValueError("Existing and extracted Stephanus references differ in order or count")
    changed = []
    for old, new in zip(old_rows, new_rows):
        edits = differences(tokens(old["english"]), tokens(new["english"]))
        if edits:
            changed.append({"ref": old["ref"], "changes": edits})
    old_all = tokens(" ".join(row["english"] for row in old_rows))
    new_all = tokens(" ".join(row["english"] for row in new_rows))
    edits = differences(old_all, new_all)
    old_ref_map = [row["ref"] for row in old_rows for _ in tokens(row["english"])]
    new_ref_map = [row["ref"] for row in new_rows for _ in tokens(row["english"])]
    for edit in edits:
        for prefix, ref_map in (("old", old_ref_map), ("new", new_ref_map)):
            start, end = edit[prefix + "TokenRange"]
            positions = range(start, end) if end > start else [min(start, len(ref_map) - 1)]
            edit[prefix + "Refs"] = list(dict.fromkeys(ref_map[i] for i in positions))
    return {"sameNormalizedFragments": len(new_rows) - len(changed),
            "changedNormalizedFragments": len(changed),
            "oldTokenCount": len(old_all), "newTokenCount": len(new_all),
            "wholeBookChanges": edits, "fragmentChanges": changed}


def align_to_reading_boundaries(old_rows: list[dict[str, str]],
                               perseus_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Re-segment the Perseus character stream at corresponding old boundaries.

    No characters from the old website text are retained. Deleted headings,
    bracketed glosses and bibliographic/footnote material cannot leak through.
    Boundary positions inside deleted ranges map to the deletion position;
    inside replacement ranges they map proportionately to the replacement.
    """
    # A Stephanus cut is often inside a sentence, not a paragraph. Do not turn
    # the exact-milestone files' JSON item boundaries into artificial breaks.
    new_text = " ".join(row["english"] for row in perseus_rows)
    old_lengths = [len(tokens(row["english"])) for row in old_rows]
    old_words = tokens(" ".join(row["english"] for row in old_rows))
    new_words = tokens(new_text)
    spans = list(re.finditer(r"[^\W_]+", new_text.replace("ʼ", "'")))
    if len(spans) != len(new_words):
        raise ValueError("Unicode normalization changed token boundaries")
    operations = difflib.SequenceMatcher(None, old_words, new_words, autojunk=False).get_opcodes()

    def map_boundary(position: int) -> int:
        for kind, a, b, c, d in operations:
            if a <= position <= b and b > a:
                if kind == "equal":
                    return c + position - a
                return c + ((position - a) * (d - c) // (b - a))
        if position == len(old_words):
            return len(new_words)
        raise ValueError(f"No matching token boundary: {position}")

    cuts = [0]
    old_position = 0
    for length in old_lengths[:-1]:
        old_position += length
        new_position = map_boundary(old_position)
        if new_position >= len(spans):
            character = len(new_text)
        else:
            character = spans[new_position].start()
            # Opening punctuation belongs with the following word. Closing
            # quote punctuation remains with the preceding reading fragment.
            while character and new_text[character - 1] in "“‘([{":
                character -= 1
        if character <= cuts[-1]:
            raise ValueError("Mapped boundaries would create an empty reading fragment")
        cuts.append(character)
    cuts.append(len(new_text))
    aligned = [{"ref": old["ref"], "english": new_text[cuts[i]:cuts[i + 1]].strip()}
               for i, old in enumerate(old_rows)]
    aligned_text = "\n\n".join(row["english"] for row in aligned)
    if tokens(aligned_text) != new_words:
        raise ValueError("Aligned output changed the Perseus word stream")
    if re.sub(r"\s+", "", aligned_text) != re.sub(r"\s+", "", new_text):
        raise ValueError("Aligned output changed Perseus punctuation or other characters")
    return aligned


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / ".local/sources/shorey-perseus.xml")
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".local/sources")
    parser.add_argument("--reading-dir", type=Path,
                        help="directory containing existing bookN-en.json boundaries (default: output directory)")
    args = parser.parse_args()
    source = args.source.resolve()
    target = args.output_dir.resolve()
    reading_dir = args.reading_dir.resolve() if args.reading_dir else target
    target.mkdir(parents=True, exist_ok=True)
    root = ET.parse(source).getroot()
    books = [node for node in root.iter(NS + "div")
             if node.get("subtype") == "book" and node.get("n") in {"1", "2", "3", "4"}]
    if [int(book.get("n", "0")) for book in books] != [1, 2, 3, 4]:
        raise ValueError("Source must have Books I-IV exactly once in order")
    report = {"sourceFile": source.name,
              "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "method": "TEI section milestones with resp=Stephanus; exclude note/head/fw and bibliographic citations, retain the spoken Iliad title at 392e; remove the documented stray citation suffix at 365c; retain other tails, verse lines and inline corrections; reconstruct quote marks; ignore editorial numbers",
              "normalization": "NFKC, casefold, Unicode word/number tokens; ignore punctuation/whitespace only",
              "books": []}
    for book in books:
        number = int(book.get("n", "0"))
        extractor = BookExtractor()
        extractor.walk(book)
        extractor.flush()
        rows = extractor.rows
        count, first, last = EXPECTED[number]
        if (len(rows), rows[0]["ref"], rows[-1]["ref"]) != (count, first, last):
            raise ValueError(f"Unexpected book {number} coverage")
        if len({row["ref"] for row in rows}) != count:
            raise ValueError(f"Duplicate references in book {number}")
        output = target / f"book{number}-perseus-en.json"
        output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        old_path = reading_dir / f"book{number}-en.json"
        info = {"book": number, "fragments": count, "first": first, "last": last,
                "skippedElements": dict(extractor.skipped), "retainedVerseLines": extractor.poem_lines,
                "retainedSpokenBiblTitles": extractor.retained_bibl_titles,
                "metadataCleanup": extractor.metadata_cleanup,
                "outputFile": output.name}
        if old_path.exists():
            old_rows = json.loads(old_path.read_text(encoding="utf-8"))
            info.update(compare(old_rows, rows))
            aligned = align_to_reading_boundaries(old_rows, rows)
            aligned_output = target / f"book{number}-aligned-en.json"
            aligned_output.write_text(json.dumps(aligned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            info["alignedOutputFile"] = aligned_output.name
            info["alignedPerseusWordStreamEqual"] = True
            info["alignedPerseusNonWhitespaceCharactersEqual"] = True
            aligned_comparison = compare(old_rows, aligned)
            info["alignedChangedFragments"] = aligned_comparison["changedNormalizedFragments"]
            info["alignedFragmentChanges"] = aligned_comparison["fragmentChanges"]
        report["books"].append(info)
        print(json.dumps({key: value for key, value in info.items()
                          if key not in {"wholeBookChanges", "fragmentChanges", "alignedFragmentChanges"}}, ensure_ascii=True))
    report["totalFragments"] = sum(book["fragments"] for book in report["books"])
    if report["totalFragments"] != 555:
        raise ValueError("Expected 555 total fragments")
    (target / "perseus-comparison.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Perseus source comparison", "",
             "Reproduce: `python scripts/extract-perseus.py`", "",
             "Inputs: download [the Perseus TEI](https://raw.githubusercontent.com/PerseusDL/canonical-greekLit/master/data/tlg0059/tlg030/tlg0059.tlg030.perseus-eng2.xml) "
             "to `.local/sources/shorey-perseus.xml`, and place existing `book1-en.json` through `book4-en.json` "
             "reading fragments beside it. Optional arguments: `--source PATH --reading-dir DIRECTORY --output-dir DIRECTORY`. "
             "Reading inputs are arrays of `{ref,english}` objects; they supply the segment boundaries and comparison wording. "
             "Without a reading input, the exact-milestone extraction is still generated but alignment/comparison for that book is skipped. "
             "The script never downloads its input. Public English files generated here can also supply the same reading boundaries.", "",
             f"Source: `{source.name}`; SHA-256 `{report['sourceSha256']}`.", "",
             "Extraction follows actual Stephanus section milestones, not the surrounding XML div numbers. "
             "It excludes complete note/head/fw subtrees, bibliographic citations and all editorial milestone numbers, preserves following tails, "
             "retains verse and inline textual corrections, and reconstructs quotation punctuation. "
             "Inline bibliographic citations are omitted because they are editorial source references, not spoken dialogue. "
             "The quoted verse itself is retained. The spoken title `Iliad` at 392e is preserved even though TEI marks it as bibl. "
             "The exact editorial suffix `, and Eur. Orest. 236` outside bibl at 365c is also removed; these two "
             "source-specific cases are explicitly guarded and documented in the script.", "",
             "The bookN-aligned-en.json files contain the same complete Perseus character stream, re-segmented to match "
             "the existing Chinese reading fragments. Boundaries are mapped by a normalized token diff. "
             "Both normalized words and every non-whitespace character are verified identical to the exact-milestone Perseus output. "
             "Only the existing reference identifiers and boundary positions are reused; none of the old website wording is copied.", "",
             "Existing bookN-en.json, Chinese translations, and question cards are not changed.", "",
             "| Book | Refs | Same normalized fragments | Different fragments | Removed notes | Preserved verse lines |",
             "| --- | ---: | ---: | ---: | ---: | ---: |"]
    for info in report["books"]:
        lines.append(f"| {info['book']} | {info['fragments']} | {info.get('sameNormalizedFragments', '-')} | "
                     f"{info.get('changedNormalizedFragments', '-')} | {info['skippedElements'].get('note', 0)} | "
                     f"{info['retainedVerseLines']} |")
    lines.extend(["", "The fragment comparison includes words moved across adjacent Stephanus boundaries. "
                  "The whole-book comparison below removes that boundary effect. "
                  "It ignores case, whitespace, and punctuation, but deliberately retains numbers and words so that leaked notes remain visible.", "",
                  "| Book | Old ref | Existing text | Perseus text |", "| --- | --- | --- | --- |"])
    for info in report["books"]:
        for edit in info.get("wholeBookChanges", []):
            old = edit["old"].replace("|", "\\|") or "(absent)"
            new = edit["new"].replace("|", "\\|") or "(absent)"
            lines.append(f"| {info['book']} | {', '.join(edit['oldRefs'])} | {old} | {new} |")
    lines.extend(["", "Interpretation: the whole-book changes are narrator/editor headings, removed footnote "
                  "numbers, bibliographic fields, spelling (`Weil` / `Well`) and a possessive (`justice’` / `justice’s`). "
                  "The bibliographic/source-reference metadata such as `unknown` at 390e and `Fr` at 391e is not narrative and is omitted. "
                  "This also omits the XML's misplaced `Hom. Il. 2.1` after the Thetis introduction at 383b, "
                  "while retaining all of the surrounding quoted poem.", "",
                  "Full token operations and every changed fragment are in `perseus-comparison.json`. "
                  "Licensing assessment is separate from this extraction and content comparison.", ""])
    (target / "perseus-comparison.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
