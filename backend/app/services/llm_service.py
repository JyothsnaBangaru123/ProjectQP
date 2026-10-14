import os
import json
import re
import math
import random
import requests
from typing import Dict, Any, List, Optional
from app.services.rag_service import RAGService

class LLMService:
    """
    LLM Interface for RAG-grounded Examination Question Generation.
    Supports Google Gemini (via official SDK and REST API), OpenAI, and Local RAG Fallback.
    """

    @classmethod
    def get_api_key(cls, request_key: Optional[str] = None) -> Optional[str]:
        return request_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY') or os.getenv('OPENAI_API_KEY')

    @classmethod
    def is_available(cls, api_key: Optional[str] = None) -> bool:
        key = cls.get_api_key(api_key)
        return bool(key and key.strip())

    @classmethod
    def call_gemini_rest_api(cls, prompt: str, system_instruction: str, api_key: str) -> Optional[str]:
        """
        Calls Google Gemini API using direct HTTPS REST request.
        """
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "generationConfig": {
                "temperature": 0.4,
                "topP": 0.9,
                "responseMimeType": "application/json"
            }
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
            else:
                print(f"[Gemini REST API Warning] Status {resp.status_code}: {resp.text}")
        except Exception as err:
            print(f"[Gemini REST API Error] {err}")

        return None

    @classmethod
    def generate_question_with_llm(
        cls,
        course_name: str,
        section_type: str,
        marks: int,
        target_topic: str,
        context_chunks: List[Dict[str, Any]],
        co: str,
        co_description: Optional[str] = None,
        bloom_level: str = "Understand",
        difficulty: str = "Medium",
        choice_mode: str = "none",
        sub_division: str = "none",
        q_no: str = "1",
        api_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Synthesizes an examination question grounded strictly in RAG context and aligned directly with Course Outcome (CO).
        """
        key = cls.get_api_key(api_key)
        if not key:
            return None

        # Build grounded syllabus context
        grounded_context = "\n---\n".join([f"[{c.get('unit', 'Syllabus')}]: {c.get('text', '')}" for c in context_chunks])
        if not grounded_context.strip():
            grounded_context = f"Course: {course_name}. Target Topic: {target_topic}."

        system_instruction = (
            "You are a distinguished university examination setter and academic evaluator. "
            "You generate authentic, academically rigorous examination questions strictly aligned with Outcome-Based Education (OBE), "
            "Bloom's Taxonomy, and university examination standards. "
            "Ensure the question is grammatically flawless, natural, clear, and directly assesses the designated Course Outcome without awkward phrase concatenation."
        )

        co_display = f"{co}: {co_description}" if co_description else co

        prompt = f"""
Syllabus Context (RAG Retrieved Materials):
{grounded_context}

Course: {course_name}
Target Topic: {target_topic}
Question Type: {section_type}
Marks: {marks} Marks
Course Outcome (CO) Aligned: {co_display}
Bloom's Taxonomy Cognitive Level: {bloom_level}
Difficulty Level: {difficulty}
Question Number: {q_no}
Choice Mode: {choice_mode}
Sub-division: {sub_division}

Instructions:
1. Generate the examination question text grounded directly in the syllabus context and strictly aligned to the Course Outcome.
2. The question MUST read naturally and professionally. Never concatenate multiple syllabus topic fragments into a broken sentence.
3. For MCQs: Provide the question stem followed by 4 distinct options labeled A), B), C), D).
4. For Short Answers ({marks}M): Generate a concise, direct question testing conceptual clarity or syntax.
5. For Long Answers ({marks}M):
   - If sub_division is 'two_subquestions': Split into part a) and part b) with individual marks labeled (e.g. {math.ceil(marks/2)}M + {marks - math.ceil(marks/2)}M).
   - If choice_mode is 'internal_choice': Provide question 1, followed by '[OR]', followed by question 2.
6. Return strictly a JSON object with this exact structure:
{{
  "question_text": "<full formatted question text>",
  "key_concepts_tested": ["concept1", "concept2"],
  "model_answer_outline": "<brief 2-sentence key points expected in the answer>"
}}
"""

        # 1. Attempt Direct REST API
        raw_json_str = cls.call_gemini_rest_api(prompt, system_instruction, key)
        
        # 2. Attempt Google Generative AI SDK fallback if REST was unsuccessful
        if not raw_json_str:
            try:
                import google.generativeai as genai
                genai.configure(api_key=key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                res = model.generate_content(prompt)
                if res and res.text:
                    raw_json_str = res.text.strip()
            except Exception as e:
                print(f"[LLM SDK Fallback Warning] {e}")

        if raw_json_str:
            try:
                resp_clean = raw_json_str.strip()
                if resp_clean.startswith("```json"):
                    resp_clean = resp_clean[7:]
                if resp_clean.startswith("```"):
                    resp_clean = resp_clean[3:]
                if resp_clean.endswith("```"):
                    resp_clean = resp_clean[:-3]

                parsed = json.loads(resp_clean.strip())
                return {
                    'question': parsed.get('question_text', ''),
                    'key_concepts': parsed.get('key_concepts_tested', [target_topic]),
                    'answer_outline': parsed.get('model_answer_outline', '')
                }
            except Exception as parse_err:
                print(f"[LLM JSON Parse Error] {parse_err}")

        return None
