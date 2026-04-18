import pytest
from gemma_client import to_gemma_contents, GEMMA_MODEL


def test_model_constant():
    assert GEMMA_MODEL == "gemma-4-31b-it"


def test_user_message_only():
    messages = [{"role": "user", "content": "Hello"}]
    system, contents = to_gemma_contents(messages)
    assert system is None
    assert contents == [{"role": "user", "parts": [{"text": "Hello"}]}]


def test_system_extracted():
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hi"},
    ]
    system, contents = to_gemma_contents(messages)
    assert system == "You are a helpful assistant."
    assert contents == [{"role": "user", "parts": [{"text": "Hi"}]}]


def test_assistant_mapped_to_model():
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
        {"role": "user", "content": "How are you?"},
    ]
    system, contents = to_gemma_contents(messages)
    assert system is None
    assert contents[1] == {"role": "model", "parts": [{"text": "Hi there"}]}


def test_multi_turn_with_system():
    messages = [
        {"role": "system", "content": "Be concise."},
        {"role": "user", "content": "Step 1?"},
        {"role": "assistant", "content": "Attach the legs."},
        {"role": "user", "content": "Step 2?"},
    ]
    system, contents = to_gemma_contents(messages)
    assert system == "Be concise."
    assert len(contents) == 3
    assert contents[0] == {"role": "user", "parts": [{"text": "Step 1?"}]}
    assert contents[1] == {"role": "model", "parts": [{"text": "Attach the legs."}]}
    assert contents[2] == {"role": "user", "parts": [{"text": "Step 2?"}]}


def test_get_client_returns_client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from google import genai
    from gemma_client import get_client
    client = get_client()
    assert isinstance(client, genai.Client)


def test_get_client_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from gemma_client import get_client
    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        get_client()
