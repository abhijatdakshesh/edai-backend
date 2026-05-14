"""
Loads YAML call-script dialogue trees from the dialogue/ directory.
Scripts are cached in memory after first load.
"""

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

DIALOGUE_DIR = Path(__file__).parent.parent.parent / "dialogue"


@lru_cache(maxsize=32)
def load_script(call_type: str) -> dict[str, Any]:
    filename = f"{call_type.lower()}.yaml"
    path = DIALOGUE_DIR / filename
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def get_greeting(call_type: str, language: str, **kwargs: str) -> str:
    script = load_script(call_type)
    greeting_map: dict[str, str] = script.get("greeting", {})
    template = greeting_map.get(language, greeting_map.get("en", "Hello."))
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
