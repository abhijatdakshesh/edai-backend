"""Basic smoke tests for the AI Engine service."""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_tts_synthesise():
    response = client.post("/tts/synthesise", json={"text": "Hello", "language": "en"})
    assert response.status_code == 200
    data = response.json()
    assert "audio_base64" in data
    assert data["format"] == "wav"


def test_nmt_translate():
    response = client.post("/nmt/translate", json={"text": "Hello", "source_lang": "en", "target_lang": "kn"})
    assert response.status_code == 200
    data = response.json()
    assert "translation" in data


def test_llm_chat():
    response = client.post("/llm/chat", json={
        "user_role": "STUDENT",
        "student_context": {"name": "Arjun", "class_name": "10-A"},
        "conversation_history": [],
        "message": "Explain Newton's first law",
        "language": "en",
    })
    assert response.status_code == 200
    assert "response" in response.json()


def test_classify_incident():
    response = client.post("/llm/classify-incident", json={
        "description": "Student was disruptive during class",
        "incident_type": "DISRUPTION",
        "student_history": {"incident_count": 1},
    })
    assert response.status_code == 200
    data = response.json()
    assert data["severity"] in {"LOW", "MEDIUM", "HIGH"}
