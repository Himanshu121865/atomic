import time

import numpy as np
import pytest
from fastapi.testclient import TestClient

from atomic.analytic.hydrogen import energy, mean_radius
from atomic.constants import HARTREE_EV
from atomic.server.app import create_app
from atomic.systems import get_system

app = create_app()

H_MU = get_system("h").mu_ratio.value


def test_health():
    with TestClient(app) as client:
        data = client.get("/api/health").json()
    assert data == {"status": "ok", "version": "0.1.0"}


def test_systems_lists_hydrogenic_presets():
    with TestClient(app) as client:
        systems = client.get("/api/systems").json()["systems"]
    assert [s["key"] for s in systems] == ["h", "d", "t", "mu-h", "ps", "he+"]
    assert systems[0]["mu_ratio"]["unit"] == "m_e"
    assert systems[0]["nuclear_radius"]["unit"] == "bohr"
    assert systems[4]["nuclear_radius"] is None


def test_state_ground_state_values():
    with TestClient(app) as client:
        r = client.get("/api/state/1/0/0")
        assert r.status_code == 200
        body = r.json()
    assert body["energy"]["value"] == pytest.approx(energy(1, mu_ratio=H_MU).value)
    assert body["energy_ev"]["value"] == pytest.approx(
        energy(1, mu_ratio=H_MU).value * HARTREE_EV, abs=0.1
    )
    assert body["mean_radius"]["value"] == pytest.approx(
        mean_radius(1, 0, mu_ratio=H_MU).value
    )
    assert body["angular_momentum"]["value"] == pytest.approx(0.0)
    assert (body["radial_nodes"], body["angular_nodes"]) == (0, 0)
    assert body["system"]["key"] == "h"
    assert body["energy"]["provenance"]["fidelity"] == "exact"


def test_state_generic_ion():
    with TestClient(app) as client:
        body = client.get("/api/state/1/0/0", params={"system": "z3"}).json()
    assert body["energy"]["value"] == pytest.approx(-4.5)
    assert body["system"]["z"] == 3


def test_state_rejects_bad_quantum_numbers():
    with TestClient(app) as client:
        assert client.get("/api/state/0/0/0").status_code == 422
        assert client.get("/api/state/1/0/1").status_code == 422


def test_state_unknown_system_is_404():
    with TestClient(app) as client:
        r = client.get("/api/state/1/0/0", params={"system": "uranium"})
        assert r.status_code == 404


def test_levels_ladder():
    with TestClient(app) as client:
        body = client.get("/api/levels").json()
    assert [lv["n"] for lv in body["levels"]] == [1, 2, 3, 4, 5, 6]
    assert body["levels"][0]["energy"]["value"] == pytest.approx(
        energy(1, mu_ratio=H_MU).value
    )
    assert body["levels"][1]["degeneracy"] == 8
    with TestClient(app) as client:
        assert len(client.get("/api/levels", params={"n_max": 2}).json()["levels"]) == 2
        assert client.get("/api/levels", params={"n_max": 0}).status_code == 422
        assert client.get("/api/levels", params={"n_max": 21}).status_code == 422


def test_radial_shape_and_normalization():
    with TestClient(app) as client:
        body = client.get("/api/radial/1/0", params={"points": 2000}).json()
    assert len(body["r_wavefunction"]["values"]) == 2000
    assert len(body["r_wavefunction"]["grid"]) == 2000
    assert body["r_wavefunction"]["unit"] == "bohr^-3/2"
    grid = np.array(body["radial_probability"]["grid"])
    prob = np.array(body["radial_probability"]["values"])
    assert np.trapezoid(prob, grid) == pytest.approx(1.0, rel=1e-3)
    with TestClient(app) as client:
        assert client.get("/api/radial/1/0", params={"points": 10}).status_code == 422
        assert client.get("/api/radial/2/2").status_code == 422


def _wait_done(client, job_id, timeout=30.0):
    start = time.time()
    while time.time() - start < timeout:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.05)
    raise TimeoutError(f"job {job_id} not done after {timeout}s")


def test_sample_job_full_lifecycle():
    with TestClient(app) as client:
        posted = client.post(
            "/api/jobs/sample",
            json={"n": 1, "l": 0, "m": 0, "count": 1000, "seed": 7},
        )
        assert posted.status_code == 200
        job_id = posted.json()["id"]
        job = _wait_done(client, job_id)
        assert job["status"] == "done"
        assert job["progress"] == pytest.approx(1.0)

        meta = client.get(f"/api/jobs/{job_id}/meta").json()
        assert meta["kind"] == "sample"
        assert meta["count"] == 1000
        assert [c["name"] for c in meta["channels"]] == ["positions", "density", "phase"]
        assert meta["provenance"]["fidelity"] == "numerical"

        positions = client.get(f"/api/jobs/{job_id}/data").content
        assert len(positions) == 1000 * 3 * 4
        density = client.get(f"/api/jobs/{job_id}/data", params={"channel": "density"}).content
        assert len(density) == 1000 * 4
        phase = client.get(f"/api/jobs/{job_id}/data", params={"channel": "phase"}).content
        assert len(phase) == 1000 * 4
        bad = client.get(f"/api/jobs/{job_id}/data", params={"channel": "bogus"})
        assert bad.status_code == 422


def test_sample_job_real_basis_has_no_phase_channel():
    with TestClient(app) as client:
        job_id = client.post(
            "/api/jobs/sample",
            json={"n": 2, "l": 1, "m": 1, "count": 1000, "basis": "real"},
        ).json()["id"]
        _wait_done(client, job_id)
        meta = client.get(f"/api/jobs/{job_id}/meta").json()
        assert [c["name"] for c in meta["channels"]] == ["positions", "density"]
        r = client.get(f"/api/jobs/{job_id}/data", params={"channel": "phase"})
        assert r.status_code == 422


def test_sample_job_validates_before_creating():
    with TestClient(app) as client:
        r = client.post("/api/jobs/sample", json={"n": 1, "l": 0, "m": 1, "count": 1000})
        assert r.status_code == 422
        r = client.post("/api/jobs/sample", json={"n": 1, "l": 0, "m": 0, "count": 10})
        assert r.status_code == 422


def test_plane_job_lifecycle():
    with TestClient(app) as client:
        job_id = client.post(
            "/api/jobs/plane",
            json={"n": 3, "l": 1, "m": 0, "quantity": "density", "resolution": 32},
        ).json()["id"]
        job = _wait_done(client, job_id)
        assert job["status"] == "done"
        meta = client.get(f"/api/jobs/{job_id}/meta").json()
        assert meta["kind"] == "plane"
        assert meta["resolution"] == 32
        assert meta["half_extent"] > 0
        assert meta["unit"] == "bohr^-3"
        data = client.get(f"/api/jobs/{job_id}/data").content
        assert len(data) == 32 * 32 * 4
        assert client.get(
            f"/api/jobs/{job_id}/data", params={"channel": "density"}
        ).status_code == 422


def test_plane_job_psi_quantity():
    with TestClient(app) as client:
        job_id = client.post(
            "/api/jobs/plane",
            json={"n": 2, "l": 1, "m": 0, "quantity": "psi", "resolution": 16},
        ).json()["id"]
        _wait_done(client, job_id)
        meta = client.get(f"/api/jobs/{job_id}/meta").json()
        assert meta["quantity"] == "psi"
        assert meta["unit"] == "bohr^-3/2"


def test_plane_job_validates():
    with TestClient(app) as client:
        assert client.post(
            "/api/jobs/plane", json={"n": 1, "l": 0, "m": 0, "resolution": 8}
        ).status_code == 422
        assert client.post(
            "/api/jobs/plane", json={"n": 1, "l": 0, "m": 0, "quantity": "bogus"}
        ).status_code == 422
        assert client.post(
            "/api/jobs/plane", json={"n": 1, "l": 1, "m": 0}
        ).status_code == 422


def test_unknown_job_is_404_and_unfinished_meta_is_409():
    with TestClient(app) as client:
        assert client.get("/api/jobs/nope").status_code == 404
        assert client.get("/api/jobs/nope/meta").status_code == 404
        job_id = client.post(
            "/api/jobs/sample",
            json={"n": 1, "l": 0, "m": 0, "count": 1000000},
        ).json()["id"]
        assert client.get(f"/api/jobs/{job_id}/meta").status_code == 409


def test_websocket_streams_progress_to_done():
    with TestClient(app) as client:
        job_id = client.post(
            "/api/jobs/sample",
            json={"n": 1, "l": 0, "m": 0, "count": 1000},
        ).json()["id"]
        with client.websocket_connect(f"/ws/jobs/{job_id}") as ws:
            last = None
            for _ in range(200):
                last = ws.receive_json()
                if last["status"] in ("done", "error"):
                    break
        assert last["status"] == "done"
        assert last["progress"] == pytest.approx(1.0)
