
import os

import pytest


@pytest.fixture(autouse=True, scope="session")
def _disable_rate_limit_for_the_suite():
    previous = os.environ.get("ATOMIC_RATE_LIMIT")
    os.environ["ATOMIC_RATE_LIMIT"] = "off"
    yield
    if previous is None:
        del os.environ["ATOMIC_RATE_LIMIT"]
    else:
        os.environ["ATOMIC_RATE_LIMIT"] = previous
