import os

# Set env vars before importing the API module (it reads keys at import time).
# os.environ.setdefault("BACKEND_API_KEY", "test-backend-key")
# os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
# os.environ.setdefault("RATE_LIMIT_COUNT", "20")
# os.environ.setdefault("RATE_LIMIT_WINDOW_SEC", "60")

os.environ["BACKEND_API_KEY"] = "test-backend-key"
os.environ["GROQ_API_KEY"] = "test-groq-key"
os.environ["RATE_LIMIT_COUNT"] = "20"
os.environ["RATE_LIMIT_WINDOW_SEC"] = "60"

from fastapi.testclient import TestClient
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import api as api


client = TestClient(api.app)


def setup_function():
    api.histories.clear()
    api.request_log.clear()


def test_health_is_public():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_chat_requires_api_key():
    r = client.post("/chat", json={"message": "hi"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid API key"


def test_chat_with_valid_api_key_no_history(monkeypatch):
    monkeypatch.setattr(api, "generate_llm_reply", lambda session_id, user_text: "mocked reply")

    r = client.post(
        "/chat?include_history=false",
        json={"message": "hello"},
        headers={"x-api-key": "test-backend-key"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "mocked reply"
    assert "session_id" in body
    assert "history" not in body  # excluded because response_model_exclude_none=True


def test_chat_with_valid_api_key_with_history(monkeypatch):
    monkeypatch.setattr(api, "generate_llm_reply", lambda session_id, user_text: "mocked reply")

    r = client.post(
        "/chat?include_history=true",
        json={"message": "hello"},
        headers={"x-api-key": "test-backend-key"},
    )

    assert r.status_code == 200
    body = r.json()
    assert "history" in body
    assert len(body["history"]) == 2
    assert body["history"][0]["role"] == "user"
    assert body["history"][1]["role"] == "assistant"


def test_rate_limit(monkeypatch):
    monkeypatch.setattr(api, "generate_llm_reply", lambda session_id, user_text: "mocked reply")
    monkeypatch.setattr(api, "RATE_LIMIT_COUNT", 1)
    monkeypatch.setattr(api, "RATE_LIMIT_WINDOW_SEC", 60)

    headers = {"x-api-key": "test-backend-key"}

    r1 = client.post("/chat", json={"message": "first"}, headers=headers)
    r2 = client.post("/chat", json={"message": "second"}, headers=headers)

    assert r1.status_code == 200
    assert r2.status_code == 429
    assert r2.json()["detail"] == "Too many requests"