"""Small, testable policy helpers shared by the office playtest gate."""

import re

MIN_FPS = 45.0
VISUAL_RULES = (
    'stylized-realistic look',
    'no billboard trees',
    'no bare poles',
    'real lamps',
    'nothing floating',
    'no pointless animation',
)


def http_error(status, url, method, resource_type):
    """Return evidence for a failed HTTP response, or None for a success."""
    if int(status) < 400:
        return None
    return {
        'status': int(status),
        'url': url.split('?', 1)[0],
        'method': method,
        'type': resource_type,
    }


def meets_perf_floor(fps):
    """Fail closed when the FPS sample is missing, invalid, or below target."""
    try:
        return float(fps) >= MIN_FPS
    except (TypeError, ValueError):
        return False


def is_pve_mini_3070(renderer):
    """Require a positively identified RTX 3070 before applying that tier's FPS result."""
    return bool(re.search(r'\b(?:NVIDIA\s+)?(?:GeForce\s+)?RTX\s*3070\b', str(renderer or ''), re.I))
