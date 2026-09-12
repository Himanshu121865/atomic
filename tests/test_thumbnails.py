import pytest
from fastapi.testclient import TestClient

from atomic.server.app import create_app
from atomic.server.thumbnails import render_thumbnail

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def test_render_thumbnail_returns_png_bytes():
    render_thumbnail.cache_clear()
    png = render_thumbnail(2, 1, 0, "h", "complex", 64)
    assert isinstance(png, bytes)
    assert png[:8] == PNG_MAGIC


def test_render_thumbnail_caches():
    render_thumbnail.cache_clear()
    render_thumbnail(1, 0, 0, "h", "complex", 48)
    render_thumbnail(1, 0, 0, "h", "complex", 48)
    assert render_thumbnail.cache_info().hits == 1


def test_thumbnail_endpoint(client):
    r = client.get("/api/thumbnail/2/1/0?size=48")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert "max-age" in r.headers["cache-control"]
    assert r.content[:8] == PNG_MAGIC


def test_thumbnail_states_differ(client):
    a = client.get("/api/thumbnail/1/0/0?size=48").content
    b = client.get("/api/thumbnail/2/1/0?size=48").content
    assert a != b


def test_thumbnail_validation(client):
    assert client.get("/api/thumbnail/2/1/0?size=10").status_code == 422
    assert client.get("/api/thumbnail/2/1/0?size=999").status_code == 422
    assert client.get("/api/thumbnail/2/1/0?basis=cartoon").status_code == 422
    assert client.get("/api/thumbnail/1/1/0").status_code == 422
    assert client.get("/api/thumbnail/2/1/0?system=unobtainium").status_code == 422
