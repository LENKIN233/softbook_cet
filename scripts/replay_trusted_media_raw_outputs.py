#!/usr/bin/env python3
"""Independently replay retained trusted-media model responses."""

from __future__ import annotations

import argparse
import ast
import difflib
import json
import re
from pathlib import Path


GENERAL_BOOL_KEYS = (
    "matches_text",
    "target_signal_audible",
    "accurate_pronunciation",
    "suitable_speed",
    "natural_rhythm",
    "stress_pauses_do_not_mislead",
    "no_unwanted_noise_or_clipping",
)


def parse_object(text: str):
    candidate = re.sub(r"^```(?:json|python)?\s*|\s*```$", "", text.strip())
    try:
        value = json.loads(candidate)
    except json.JSONDecodeError:
        value = ast.literal_eval(candidate)
    if not isinstance(value, dict):
        raise ValueError("model result must be an object")
    return value


def exact(value, keys, label):
    if set(value) != set(keys):
        raise ValueError(f"{label} keys are invalid")


def parse_result(text: str, purpose: str):
    value = parse_object(text)
    if purpose == "blind_transcript":
        exact(value, {"transcript_heard"}, "blind result")
        if not isinstance(value["transcript_heard"], str) or not value["transcript_heard"].strip():
            raise ValueError("blind transcript is invalid")
    elif purpose == "pronunciation":
        exact(value, {"transcript_heard", "accurate_pronunciation", "specific_error"}, "pronunciation result")
        if (
            not isinstance(value["transcript_heard"], str)
            or not isinstance(value["accurate_pronunciation"], bool)
            or not isinstance(value["specific_error"], str)
            or (value["accurate_pronunciation"] and value["specific_error"].strip())
            or (not value["accurate_pronunciation"] and len(value["specific_error"].strip()) < 8)
        ):
            raise ValueError("pronunciation result is invalid")
    else:
        exact(value, {"transcript_heard", "notes", *GENERAL_BOOL_KEYS}, "general result")
        if (
            not isinstance(value["transcript_heard"], str)
            or not isinstance(value["notes"], str)
            or any(not isinstance(value[key], bool) for key in GENERAL_BOOL_KEYS)
        ):
            raise ValueError("general result is invalid")
    return value


def words(value: str):
    return re.findall(r"[a-z0-9]+", value.lower())


def similarity(expected: str, heard: str):
    left, right = words(expected), words(heard)
    if not left or not right:
        return 0.0
    return difflib.SequenceMatcher(None, left, right).ratio()


def replay(artifact_dir: Path, run_package_name: str, worklist_name: str):
    package = json.loads((artifact_dir / run_package_name).read_text(encoding="utf-8"))
    worklist = json.loads((artifact_dir / worklist_name).read_text(encoding="utf-8"))
    entries = {str(entry["card_id"]): entry for entry in worklist.get("entries", [])}
    count = 0
    for run in package.get("runs", []):
        run_path = (artifact_dir / run["path"]).resolve()
        if artifact_dir.resolve() not in run_path.parents or not run_path.is_file() or run_path.is_symlink():
            raise ValueError("unsafe raw run path")
        for line in run_path.read_text(encoding="utf-8").splitlines():
            if not line:
                continue
            record = json.loads(line)
            entry = entries.get(str(record.get("card_id")))
            if entry is None:
                raise ValueError("raw run record has no worklist entry")
            outputs = record.get("raw_outputs")
            if (
                not isinstance(outputs, list)
                or not 1 <= len(outputs) <= 2
                or any(not isinstance(raw, str) or not raw.strip() or len(raw) > 1024 * 1024 for raw in outputs)
            ):
                raise ValueError("raw outputs are invalid")
            parsed = parse_result(outputs[-1], run["purpose"])
            if run["purpose"] in {"full_perceptual", "adjudication"}:
                if all(parsed[key] for key in GENERAL_BOOL_KEYS):
                    parsed["notes"] = ""
                if similarity(entry["audio"]["transcript"], parsed["transcript_heard"]) < 0.85:
                    parsed["matches_text"] = False
            if parsed != record.get("result"):
                raise ValueError("packaged result does not replay retained raw output")
            count += 1
    return {"schema_version": "trusted-media-raw-replay.v1", "ok": True, "records": count}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", required=True, type=Path)
    parser.add_argument("--run-package", required=True)
    parser.add_argument("--worklist", required=True)
    args = parser.parse_args()
    print(json.dumps(replay(args.artifact_dir, args.run_package, args.worklist), sort_keys=True))


if __name__ == "__main__":
    main()
