#!/usr/bin/env python3
import os
import sys

sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

from harness_validator.runner import main


if __name__ == "__main__":
    raise SystemExit(main())
