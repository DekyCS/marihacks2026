import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI


@pytest.fixture
def app():
    from vapi_llm import router
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


def make_chunk(text):
    mock = MagicMock()
    mock.text = text
    return mock


def test_chat_completions_streams_openai_format(client):
    chunks = [make_chunk("Hello"), make_chunk(" world")]

    with patch("vapi_llm.get_client") as mock_get_client:
        mock_genai_client = MagicMock()
        mock_get_client.return_value = mock_genai_client
        mock_genai_client.models.generate_content_stream.return_value = iter(chunks)

        response = client.post(
            "/vapi/llm/chat/completions",
            json={
                "messages": [
                    {"role": "system", "content": "You are helpful."},
                    {"role": "user", "content": "Hi"},
                ]
            },
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = [l for l in response.text.split("\n") if l.startswith("data:")]
    assert lines[-1] == "data: [DONE]"

    first_chunk = json.loads(lines[0][6:])
    assert first_chunk["choices"][0]["delta"]["content"] == "Hello"


def test_system_instruction_passed_to_gemma(client):
    with patch("vapi_llm.get_client") as mock_get_client:
        mock_genai_client = MagicMock()
        mock_get_client.return_value = mock_genai_client
        mock_genai_client.models.generate_content_stream.return_value = iter([make_chunk("ok")])

        client.post(
            "/vapi/llm/chat/completions",
            json={
                "messages": [
                    {"role": "system", "content": "Be brief."},
                    {"role": "user", "content": "Hello"},
                ]
            },
        )

    call_kwargs = mock_genai_client.models.generate_content_stream.call_args
    config = call_kwargs.kwargs["config"]
    assert config.system_instruction == "Be brief."


def test_assistant_role_mapped_to_model(client):
    with patch("vapi_llm.get_client") as mock_get_client:
        mock_genai_client = MagicMock()
        mock_get_client.return_value = mock_genai_client
        mock_genai_client.models.generate_content_stream.return_value = iter([make_chunk("ok")])

        client.post(
            "/vapi/llm/chat/completions",
            json={
                "messages": [
                    {"role": "user", "content": "Step 1?"},
                    {"role": "assistant", "content": "Attach legs."},
                    {"role": "user", "content": "Step 2?"},
                ]
            },
        )

    call_kwargs = mock_genai_client.models.generate_content_stream.call_args
    contents = call_kwargs.kwargs["contents"]
    assert contents[1]["role"] == "model"


def test_temperature_zero_not_replaced(client):
    with patch("vapi_llm.get_client") as mock_get_client:
        mock_genai_client = MagicMock()
        mock_get_client.return_value = mock_genai_client
        mock_genai_client.models.generate_content_stream.return_value = iter([make_chunk("ok")])

        client.post(
            "/vapi/llm/chat/completions",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "temperature": 0.0,
            },
        )

    call_kwargs = mock_genai_client.models.generate_content_stream.call_args
    config = call_kwargs.kwargs["config"]
    assert config.temperature == 0.0


def test_last_chunk_has_finish_reason_stop(client):
    with patch("vapi_llm.get_client") as mock_get_client:
        mock_genai_client = MagicMock()
        mock_get_client.return_value = mock_genai_client
        mock_genai_client.models.generate_content_stream.return_value = iter(
            [make_chunk("Hello"), make_chunk(" world")]
        )

        response = client.post(
            "/vapi/llm/chat/completions",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )

    lines = [l for l in response.text.split("\n") if l.startswith("data:") and l != "data: [DONE]"]
    last_chunk = json.loads(lines[-1][6:])
    assert last_chunk["choices"][0]["finish_reason"] == "stop"
