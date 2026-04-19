from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "ai-platform"


def test_tts_synthesize():
    response = client.post("/tts/synthesize", json={"text": "ನಮಸ್ಕಾರ", "language": "kn"})
    assert response.status_code == 200
    data = response.json()
    assert "audio_url" in data


def test_nmt_translate():
    response = client.post("/nmt/translate", json={"text": "Hello", "source_language": "en", "target_language": "kn"})
    assert response.status_code == 200
    assert "translated_text" in response.json()


def test_llm_orchestrate():
    response = client.post(
        "/llm/orchestrate",
        json={"context": "absent 3 days", "student_id": "s-1", "language": "kn"},
    )
    assert response.status_code == 200
    assert "script" in response.json()
