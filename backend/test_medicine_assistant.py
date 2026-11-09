"""Offline tests: no real tokens, patient data, Supabase or Gemini calls."""
import asyncio
import os
import unittest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from services import medicine_assistant as service

USER = "11111111-1111-4111-8111-111111111111"


class AssistantTests(unittest.TestCase):
    def setUp(self):
        service._requests.clear()
        self.env = patch.dict(os.environ, {"SUPABASE_URL": "https://example.invalid", "SUPABASE_ANON_KEY": "test-public-key"})
        self.env.start()
        app = FastAPI()
        app.include_router(service.router)
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.env.stop()

    def request(self, **kwargs):
        return self.client.post("/ask-medicine", headers={"Authorization": "Bearer test-token"}, json={"question": "What are medicine precautions?", **kwargs})

    def test_missing_token_denied(self):
        self.assertEqual(self.client.post("/ask-medicine", json={"question": "Hello"}).status_code, 401)

    def test_configuration_diagnostic_never_logs_values(self):
        values = {"GEMINI_API_KEY": "synthetic-secret-marker",
                  "SUPABASE_URL": "https://synthetic-project.invalid",
                  "SUPABASE_PUBLISHABLE_KEY": "", "SUPABASE_ANON_KEY": "synthetic-public-marker"}
        with patch.dict(os.environ, values, clear=True), self.assertLogs("uvicorn.error", level="INFO") as logs:
            service.log_configuration_presence()
        logged = "\n".join(logs.output)
        for value in values.values():
            if value:
                self.assertNotIn(value, logged)
        self.assertIn('"GEMINI_API_KEY": true', logged)
        self.assertIn('"SUPABASE_PUBLISHABLE_KEY": false', logged)

    def test_all_exact_configuration_error_conditions(self):
        for values in (
            {"SUPABASE_URL": "", "SUPABASE_ANON_KEY": "synthetic"},
            {"SUPABASE_URL": "http://example.invalid", "SUPABASE_ANON_KEY": "synthetic"},
            {"SUPABASE_URL": "https://example.invalid"},
        ):
            with patch.dict(os.environ, values, clear=True), patch.object(service, "authenticated_user", AsyncMock()) as auth:
                response = self.request()
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json()["detail"], "The assistant is not configured. Please contact support.")
                auth.assert_not_called()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(service.HTTPException) as raised:
                asyncio.run(service.generate_answer(service.Question(question="Uses?"), {}))
            self.assertEqual(raised.exception.status_code, 503)
            self.assertEqual(raised.exception.detail, "The assistant is not configured. Please contact support.")

    def test_both_render_public_key_names_supported(self):
        for name in ("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"):
            with patch.dict(os.environ, {"SUPABASE_URL": "https://example.invalid", name: "synthetic"}, clear=True), \
                    patch.object(service, "authenticated_user", AsyncMock(return_value=USER)), \
                    patch.object(service, "generate_answer", AsyncMock(return_value="Education")):
                self.assertEqual(self.request().status_code, 200)

    def test_invalid_inputs_and_spoofed_identity_rejected(self):
        for body in ({"question": " "}, {"question": "x" * 1501}, {"question": "Hi", "patient_id": USER}, {"question": "Hi", "language": "invalid"}):
            self.assertEqual(self.client.post("/ask-medicine", json=body).status_code, 422)

    def test_invalid_token_never_calls_gemini(self):
        with patch.object(service, "authenticated_user", AsyncMock(side_effect=service.HTTPException(401, "Sign in"))), patch.object(service, "generate_answer", AsyncMock()) as generate:
            self.assertEqual(self.request().status_code, 401)
            generate.assert_not_called()

    def test_general_question_without_medications(self):
        with patch.object(service, "authenticated_user", AsyncMock(return_value=USER)), patch.object(service, "medication_context", AsyncMock()) as context, patch.object(service, "generate_answer", AsyncMock(return_value="Educational answer")):
            response = self.request(language="hinglish")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["medication_context_status"], "not_requested")
            context.assert_not_called()

    def test_context_failure_explicit(self):
        with patch.object(service, "authenticated_user", AsyncMock(return_value=USER)), patch.object(service, "medication_context", AsyncMock(return_value={"status": "unavailable", "records": []})), patch.object(service, "generate_answer", AsyncMock(return_value="I cannot access your records.")) as generate:
            response = self.request(include_medications=True)
            self.assertEqual(response.json()["medication_context_status"], "unavailable")
            self.assertEqual(generate.call_args.args[1]["records"], [])

    def test_rate_limit_prevents_eleventh_generation(self):
        with patch.object(service, "authenticated_user", AsyncMock(return_value=USER)), patch.object(service, "generate_answer", AsyncMock(return_value="Education")) as generate:
            for _ in range(10):
                self.assertEqual(self.request().status_code, 200)
            response = self.request()
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers["retry-after"], "60")
            self.assertEqual(generate.await_count, 10)

    def test_failure_and_timeout_are_sanitized(self):
        for error, expected in ((RuntimeError("private upstream detail"), 503), (asyncio.TimeoutError(), 504)):
            with patch.object(service, "authenticated_user", AsyncMock(return_value=USER)), patch.object(service, "generate_answer", AsyncMock(side_effect=error)):
                response = self.request()
                self.assertEqual(response.status_code, expected)
                self.assertNotIn("private", response.text)

    def test_auth_and_record_requests_use_user_token_and_filter(self):
        async def run():
            def handler(request):
                self.assertEqual(request.headers["authorization"], "Bearer test-token")
                if request.url.path == "/auth/v1/user":
                    return httpx.Response(200, json={"id": USER})
                self.assertEqual(request.url.params["patient_id"], f"eq.{USER}")
                self.assertNotIn("*", request.url.params["select"])
                return httpx.Response(200, json=[])
            async with httpx.AsyncClient(base_url="https://example.invalid", headers={"Authorization": "Bearer test-token"}, transport=httpx.MockTransport(handler)) as client:
                self.assertEqual(await service.authenticated_user(client), USER)
                self.assertEqual((await service.medication_context(client, USER))["records"], [])
        asyncio.run(run())

    def test_supabase_rejects_token(self):
        async def run():
            async with httpx.AsyncClient(base_url="https://example.invalid", transport=httpx.MockTransport(lambda request: httpx.Response(401))) as client:
                with self.assertRaises(service.HTTPException) as raised:
                    await service.authenticated_user(client)
                self.assertEqual(raised.exception.status_code, 401)
        asyncio.run(run())

    def test_gemini_bounds_safety_instructions_and_incomplete_response(self):
        async def run():
            generate = AsyncMock(return_value=SimpleNamespace(
                candidates=[SimpleNamespace(finish_reason="STOP")], text="Educational answer"))
            client = AsyncMock()
            client.__aenter__.return_value.models.generate_content = generate
            with patch.dict(os.environ, {"GEMINI_API_KEY": "offline-test"}), patch.object(service.genai, "Client") as factory:
                factory.return_value.aio = client
                self.assertEqual(await service.generate_answer(service.Question(question="Uses?"), {"status": "not_requested"}), "Educational answer")
                config = generate.call_args.kwargs["config"]
                self.assertEqual(config["max_output_tokens"], 1000)
                self.assertIn("Do not diagnose", config["system_instruction"])
                self.assertIn("immediate local emergency care", config["system_instruction"])
                for reason, text in (("MAX_TOKENS", "Cut off"), ("STOP", ""), ("STOP", "x" * 5001)):
                    generate.return_value = SimpleNamespace(candidates=[SimpleNamespace(finish_reason=reason)], text=text)
                    with self.assertRaises(ValueError):
                        await service.generate_answer(service.Question(question="Uses?"), {})
        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
