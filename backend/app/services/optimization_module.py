import math
import re
import random
from typing import List, Dict, Any, Tuple, Optional
from app.services.rag_service import RAGService

class OptimizationModule:
    """
    Optimization Module for Examination Question Paper Generation.
    Selects and balances generated candidate questions across sections according to:
      1. Unit-wise weightage (Units 1 to 5)
      2. Dynamic marks formatting per section (e.g. 2M Short Answer vs 14M/10M Long Answer)
      3. Course Outcomes (CO1 - CO6) dynamic alignment
      4. Bloom's Taxonomy cognitive level distribution
      5. Difficulty level balance (Easy, Medium, Hard)
      6. Cross-section topic deduplication (Short and Long answers test distinct concepts)
      7. Phrasing pattern diversity (No robotic repetition of question stems or keywords)
    """

    @classmethod
    def _normalize_for_dedup(cls, text: str) -> str:
        """
        Normalizes a question text for deduplication:
        Strips question prefix (a), b), Q1., etc.), punctuation, case, and redundant whitespace.
        """
        cleaned = re.sub(r'^[a-zA-Z0-9\.\)\-\s]+[\)\.\:]\s*', '', (text or '').strip())
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', cleaned.lower())
        return ' '.join(cleaned.split())

    @classmethod
    def _get_unique_sub_variant(
        cls,
        sub_part: str,
        topic: str,
        bloom: str,
        co_id: str,
        pattern_seed: int,
        used_texts_global: set
    ) -> str:
        """
        Selects a unique phrasing variant for subquestion (a or b) that has not been used anywhere in the paper.
        If all predefined variants are exhausted, dynamically synthesizes distinct cognitive variants.
        """
        st = RAGService.classify_topic_semantic_type(topic)
        norm_t = RAGService.normalize_topic_for_question(topic)
        bn = (bloom or 'Understand').capitalize()
        if bn.lower() in ['remember', 'remembering']:
            bn = 'Remember'

        if sub_part.lower() == 'a':
            variants = RAGService.get_semantic_sub_a_variants(st, norm_t, bn)
        else:
            variants = RAGService.get_semantic_sub_b_variants(st, norm_t, bn)

        num_v = len(variants)
        for offset in range(num_v):
            cand = variants[(pattern_seed + offset) % num_v]
            norm_cand = cls._normalize_for_dedup(cand)
            if norm_cand not in used_texts_global:
                used_texts_global.add(norm_cand)
                return cand

        prefix = f"{sub_part}) "
        is_sub_a = (sub_part.lower() == 'a')

        if is_sub_a:
            dynamic_templates = {
                'Remember': [
                    f"{prefix}Define {norm_t} and list its primary characteristics and components.",
                    f"{prefix}State the foundational concepts and primary rules governing {norm_t}.",
                    f"{prefix}List the essential features and standard specifications associated with {norm_t}."
                ],
                'Understand': [
                    f"{prefix}Explain the concept and significance of {norm_t} with suitable illustrations.",
                    f"{prefix}Describe the working and characteristics of {norm_t} with relevant examples.",
                    f"{prefix}Discuss the importance, types, and operational flow of {norm_t} in detail.",
                    f"{prefix}Explain {norm_t} in detail with the help of a neat diagram or example.",
                    f"{prefix}Distinguish between the various aspects and usage scenarios of {norm_t}.",
                    f"{prefix}Elaborate on the principles and practical significance of {norm_t}."
                ],
                'Apply': [
                    f"{prefix}Demonstrate the application of {norm_t} with a suitable code example or practical scenario.",
                    f"{prefix}Write an illustrative program or procedure demonstrating the practical use of {norm_t}.",
                    f"{prefix}Show how {norm_t} is implemented to solve a practical computational problem with syntax and explanation.",
                    f"{prefix}Develop a structured solution utilizing {norm_t} with necessary syntax and logic.",
                    f"{prefix}Illustrate how {norm_t} can be effectively applied in program design with examples."
                ],
                'Analyze': [
                    f"{prefix}Analyze the operational behavior, trade-offs, and design considerations of {norm_t}.",
                    f"{prefix}Compare and contrast {norm_t} with alternative approaches, highlighting key differences.",
                    f"{prefix}Critically examine the advantages, limitations, and performance factors of {norm_t}."
                ],
                'Evaluate': [
                    f"{prefix}Evaluate the efficiency, reliability, and computational overhead of {norm_t}.",
                    f"{prefix}Critically assess the suitability of {norm_t} for modern software engineering systems."
                ],
                'Create': [
                    f"{prefix}Design a modular system architecture or component incorporating {norm_t}.",
                    f"{prefix}Formulate a novel structured model leveraging {norm_t} for practical application."
                ]
            }
        else:
            dynamic_templates = {
                'Remember': [
                    f"{prefix}State the purpose, syntax, and essential terminology of {norm_t}.",
                    f"{prefix}Identify the key components and usage rules governing {norm_t}.",
                    f"{prefix}List the primary features and basic variations of {norm_t}."
                ],
                'Understand': [
                    f"{prefix}Illustrate the working and practical significance of {norm_t} with an example.",
                    f"{prefix}Explain the different types and features of {norm_t} with suitable code or diagrams.",
                    f"{prefix}Discuss the importance, advantages, and applications of {norm_t} in detail.",
                    f"{prefix}Describe the syntax, usage, and execution rules governing {norm_t}.",
                    f"{prefix}Differentiate {norm_t} from related concepts with suitable illustrations."
                ],
                'Apply': [
                    f"{prefix}Write a code snippet or example demonstrating the practical use of {norm_t}.",
                    f"{prefix}Illustrate how {norm_t} is utilized to solve a programming problem with syntax and explanation.",
                    f"{prefix}Demonstrate the procedural application of {norm_t} with appropriate syntax and logic.",
                    f"{prefix}Show how {norm_t} is implemented in practice with an illustrative example."
                ],
                'Analyze': [
                    f"{prefix}Analyze how {norm_t} handles complex conditions and edge cases in software execution.",
                    f"{prefix}Compare the execution efficiency and memory footprint of {norm_t} against standard methods."
                ],
                'Evaluate': [
                    f"{prefix}Assess the practical limitations and design trade-offs associated with {norm_t}.",
                    f"{prefix}Justify the choice of {norm_t} in developing reliable software solutions."
                ],
                'Create': [
                    f"{prefix}Construct a working module or algorithm incorporating {norm_t}.",
                    f"{prefix}Formulate a comprehensive implementation blueprint utilizing {norm_t}."
                ]
            }

        templates = dynamic_templates.get(bn, dynamic_templates['Understand'])
        num_t = len(templates)
        for offset in range(num_t):
            dt = templates[(pattern_seed + offset) % num_t]
            norm_dt = cls._normalize_for_dedup(dt)
            if norm_dt not in used_texts_global:
                used_texts_global.add(norm_dt)
                return dt

        fallback = f"{prefix}Explain the practical concepts, implementation, and advantages of {norm_t} in detail."
        used_texts_global.add(cls._normalize_for_dedup(fallback))
        return fallback

    @classmethod
    def _get_unique_single_long_answer(
        cls,
        topic_a: str,
        topic_b: str,
        bloom: str,
        co_id: str,
        pattern_seed: int,
        used_texts_global: set
    ) -> str:
        bn = (bloom or 'Understand').capitalize()
        if bn.lower() in ['remember', 'remembering']:
            bn = 'Remember'

        for offset in range(8):
            cand = RAGService.generate_semantic_long_answer_single(
                topic_a, topic_b, bloom_level=bn, co_id=co_id, pattern_idx=pattern_seed + offset
            ).strip()
            norm = cls._normalize_for_dedup(cand)
            if norm not in used_texts_global:
                used_texts_global.add(norm)
                return cand

        norm_t = RAGService.normalize_topic_for_question(topic_a)
        fallback = f"Examine the core technical architecture, design trade-offs, and practical engineering application of {norm_t} in detail."
        used_texts_global.add(cls._normalize_for_dedup(fallback))
        return fallback

    @classmethod
    def _get_unique_short_answer(
        cls,
        topic_a: str,
        topic_b: str,
        bloom: str,
        pattern_seed: int,
        used_texts_global: set
    ) -> str:
        bn = (bloom or 'Understand').capitalize()
        if bn.lower() in ['remember', 'remembering']:
            bn = 'Remember'

        for offset in range(8):
            cand = RAGService.generate_semantic_short_answer(
                topic_a, topic_b, bloom_level=bn, pattern_idx=pattern_seed + offset
            ).strip()
            norm = cls._normalize_for_dedup(cand)
            if norm not in used_texts_global:
                used_texts_global.add(norm)
                return cand

        norm_t = RAGService.normalize_topic_for_question(topic_a)
        dynamic_fallbacks = {
            'Remember': [
                f"Define {norm_t} and state its primary significance.",
                f"State any two key features or characteristics of {norm_t}.",
                f"What is {norm_t}? Mention its primary application.",
                f"List the fundamental components or types of {norm_t}.",
                f"State the primary purpose and declaration syntax of {norm_t}.",
                f"Differentiate {norm_t} from related foundational concepts.",
                f"Identify the essential rules or conventions governing {norm_t}.",
                f"Briefly describe the role of {norm_t} in program execution.",
                f"Mention the advantages of using {norm_t}."
            ],
            'Understand': [
                f"Explain the basic principle and working of {norm_t}.",
                f"Illustrate why {norm_t} is important with a brief example.",
                f"Differentiate between {norm_t} and alternative techniques.",
                f"Describe the sequential steps or stages involved in {norm_t}.",
                f"Discuss the primary role and function of {norm_t}.",
                f"Summarize the key advantages and limitations of {norm_t}."
            ],
            'Apply': [
                f"Write a short code snippet or syntax illustrating {norm_t}.",
                f"Demonstrate how {norm_t} is applied with a concise example.",
                f"Show how {norm_t} is utilized to handle a typical programming scenario.",
                f"Illustrate the practical use of {norm_t} with syntax."
            ],
            'Analyze': [
                f"Differentiate between {norm_t} and related concepts with an example.",
                f"Analyze the primary trade-offs associated with {norm_t}.",
                f"Compare the behavior of {norm_t} under different execution scenarios."
            ],
            'Evaluate': [
                f"Assess the significance of {norm_t} in modern software development.",
                f"Justify why {norm_t} is preferred over manual alternatives."
            ],
            'Create': [
                f"Formulate a basic specification or model for {norm_t}.",
                f"Design a simple schema or outline utilizing {norm_t}."
            ]
        }
        stem_list = dynamic_fallbacks.get(bn, dynamic_fallbacks['Remember'])
        num_stems = len(stem_list)
        for off in range(num_stems):
            cand = stem_list[(pattern_seed + off) % num_stems]
            norm = cls._normalize_for_dedup(cand)
            if norm not in used_texts_global:
                used_texts_global.add(norm)
                return cand

        cand = f"Explain the role and significance of {norm_t} with a brief example."
        used_texts_global.add(cls._normalize_for_dedup(cand))
        return cand

    @classmethod
    def optimize_section_questions(
        cls,
        candidate_pool: List[Dict[str, Any]],
        required_count: int,
        marks_per_q: int,
        section_type: str,
        choice_mode: str,
        sub_division_mode: str,
        per_q_sub_divs: List[str],
        difficulty_targets: List[str],
        blooms_targets: List[str],
        used_topics_global: set,
        user_outcomes: Optional[List[Dict[str, Any]]] = None,
        per_q_cos: Optional[List[Any]] = None,
        per_q_sub_marks: Optional[List[Any]] = None,
        start_q_index: int = 1,
        per_q_blooms: Optional[List[Any]] = None,
        used_question_texts_global: Optional[set] = None,
        is_section_1_subquestions: bool = False,
        random_seed_offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Optimizes question selection for a single section with dynamic mark formatting and distinct topic & phrasing selection.
        """
        selected_questions = []
        used_local_indices = set()
        used_patterns_local = set()
        curr_q_index = start_q_index
        if not random_seed_offset:
            random_seed_offset = random.randint(1, 1000000)
        if used_question_texts_global is None:
            used_question_texts_global = set()

        co_keys = [o.get('id', f'CO{i+1}') for i, o in enumerate(user_outcomes)] if user_outcomes else ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']
        if not co_keys:
            co_keys = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']

        for q_slot in range(required_count):
            is_choice = (choice_mode == 'internal_choice')
            raw_slot = per_q_cos[q_slot] if per_q_cos and q_slot < len(per_q_cos) else None
            raw_bloom_slot = per_q_blooms[q_slot] if per_q_blooms and q_slot < len(per_q_blooms) else None

            # Determine Target COs for Q1 (and Q2 if internal choice), including sub-questions a & b
            slot_co_q1 = None
            slot_co_q2 = None
            slot_co_q1_a = None
            slot_co_q1_b = None
            slot_co_q2_a = None
            slot_co_q2_b = None

            if isinstance(raw_slot, dict):
                r1a = str(raw_slot.get('q1_a') or (raw_slot.get('q1') if isinstance(raw_slot.get('q1'), dict) else {}).get('a') or '').strip()
                r1b = str(raw_slot.get('q1_b') or (raw_slot.get('q1') if isinstance(raw_slot.get('q1'), dict) else {}).get('b') or '').strip()
                r2a = str(raw_slot.get('q2_a') or (raw_slot.get('q2') if isinstance(raw_slot.get('q2'), dict) else {}).get('a') or '').strip()
                r2b = str(raw_slot.get('q2_b') or (raw_slot.get('q2') if isinstance(raw_slot.get('q2'), dict) else {}).get('b') or '').strip()

                if r1a and r1a.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1_a = r1a
                if r1b and r1b.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1_b = r1b
                if r2a and r2a.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q2_a = r2a
                if r2b and r2b.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q2_b = r2b

                raw_1 = str(raw_slot.get('q1') or raw_slot.get('q1_co') or '').strip() if not isinstance(raw_slot.get('q1'), dict) else ''
                raw_2 = str(raw_slot.get('q2') or raw_slot.get('q2_co') or '').strip() if not isinstance(raw_slot.get('q2'), dict) else ''
                if raw_1 and raw_1.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1 = raw_1
                if raw_2 and raw_2.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q2 = raw_2
            elif isinstance(raw_slot, str):
                raw_str = raw_slot.strip()
                if raw_str and raw_str.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1 = raw_str
                    slot_co_q2 = raw_str

            if not slot_co_q1:
                slot_co_q1 = slot_co_q1_a or slot_co_q1_b
            if not slot_co_q2:
                slot_co_q2 = slot_co_q2_a or slot_co_q2_b or slot_co_q1

            target_co_q1 = slot_co_q1 if slot_co_q1 else co_keys[(q_slot * (2 if is_choice else 1)) % len(co_keys)]
            target_co_q2 = slot_co_q2 if slot_co_q2 else (target_co_q1 if is_choice else (co_keys[(q_slot * 2 + 1) % len(co_keys)] if is_choice else target_co_q1))

            target_co_q1_a = slot_co_q1_a if slot_co_q1_a else target_co_q1
            target_co_q1_b = slot_co_q1_b if slot_co_q1_b else (co_keys[(co_keys.index(target_co_q1) + 1) % len(co_keys)] if target_co_q1 in co_keys else target_co_q1)
            target_co_q2_a = slot_co_q2_a if slot_co_q2_a else (slot_co_q2 or target_co_q1_a)
            target_co_q2_b = slot_co_q2_b if slot_co_q2_b else (slot_co_q2 or target_co_q1_b)

            # Determine Target Bloom's levels per question & sub-questions
            slot_bloom_q1 = None
            slot_bloom_q2 = None
            slot_bloom_q1_a = None
            slot_bloom_q1_b = None
            slot_bloom_q2_a = None
            slot_bloom_q2_b = None

            if isinstance(raw_bloom_slot, dict):
                b1a = str(raw_bloom_slot.get('q1_a') or (raw_bloom_slot.get('q1') if isinstance(raw_bloom_slot.get('q1'), dict) else {}).get('a') or '').strip()
                b1b = str(raw_bloom_slot.get('q1_b') or (raw_bloom_slot.get('q1') if isinstance(raw_bloom_slot.get('q1'), dict) else {}).get('b') or '').strip()
                b2a = str(raw_bloom_slot.get('q2_a') or (raw_bloom_slot.get('q2') if isinstance(raw_bloom_slot.get('q2'), dict) else {}).get('a') or '').strip()
                b2b = str(raw_bloom_slot.get('q2_b') or (raw_bloom_slot.get('q2') if isinstance(raw_bloom_slot.get('q2'), dict) else {}).get('b') or '').strip()

                if b1a and b1a.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q1_a = b1a
                if b1b and b1b.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q1_b = b1b
                if b2a and b2a.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q2_a = b2a
                if b2b and b2b.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q2_b = b2b

                raw_b1 = str(raw_bloom_slot.get('q1') or raw_bloom_slot.get('q1_bloom') or '').strip() if not isinstance(raw_bloom_slot.get('q1'), dict) else ''
                raw_b2 = str(raw_bloom_slot.get('q2') or raw_bloom_slot.get('q2_bloom') or '').strip() if not isinstance(raw_bloom_slot.get('q2'), dict) else ''
                if raw_b1 and raw_b1.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q1 = raw_b1
                if raw_b2 and raw_b2.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q2 = raw_b2
            elif isinstance(raw_bloom_slot, str):
                raw_str_b = raw_bloom_slot.strip()
                if raw_str_b and raw_str_b.lower() not in ['auto', 'none', '', 'all']:
                    slot_bloom_q1 = raw_str_b
                    slot_bloom_q2 = raw_str_b

            default_slot_bloom = blooms_targets[q_slot % len(blooms_targets)] if blooms_targets else 'Understand'
            target_bloom_q1 = slot_bloom_q1 or slot_bloom_q1_a or default_slot_bloom
            target_bloom_q2 = slot_bloom_q2 or slot_bloom_q2_a or (target_bloom_q1 if is_choice else (blooms_targets[(q_slot + 1) % len(blooms_targets)] if blooms_targets else target_bloom_q1))

            target_bloom_q1_a = slot_bloom_q1_a or target_bloom_q1
            target_bloom_q1_b = slot_bloom_q1_b or target_bloom_q1
            target_bloom_q2_a = slot_bloom_q2_a or (slot_bloom_q2 or target_bloom_q1_a)
            target_bloom_q2_b = slot_bloom_q2_b or (slot_bloom_q2 or target_bloom_q1_b)

            # Normalize any lingering 'Remembering' to standard 'Remember'
            if target_bloom_q1.lower() in ['remember', 'remembering']:
                target_bloom_q1 = 'Remember'
            if target_bloom_q2.lower() in ['remember', 'remembering']:
                target_bloom_q2 = 'Remember'
            if target_bloom_q1_a.lower() in ['remember', 'remembering']:
                target_bloom_q1_a = 'Remember'
            if target_bloom_q1_b.lower() in ['remember', 'remembering']:
                target_bloom_q1_b = 'Remember'
            if target_bloom_q2_a.lower() in ['remember', 'remembering']:
                target_bloom_q2_a = 'Remember'
            if target_bloom_q2_b.lower() in ['remember', 'remembering']:
                target_bloom_q2_b = 'Remember'

            # Resolve target units dynamically
            available_units = []
            if user_outcomes:
                for o in user_outcomes:
                    u_str = o.get('unit')
                    if u_str and u_str not in available_units:
                        available_units.append(u_str)
            if not available_units:
                for cand in candidate_pool:
                    u_str = cand.get('unit')
                    if u_str and u_str not in available_units:
                        available_units.append(u_str)
            if not available_units:
                available_units = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']
            num_u = len(available_units)

            target_unit_q1 = available_units[(q_slot * (2 if is_choice else 1)) % num_u]
            target_unit_q2 = available_units[(q_slot * 2 + 1) % num_u] if is_choice else target_unit_q1
            if user_outcomes:
                matched_oc1 = next((o for o in user_outcomes if o.get('id') == target_co_q1), None)
                if matched_oc1 and matched_oc1.get('unit'):
                    target_unit_q1 = matched_oc1.get('unit')
                matched_oc2 = next((o for o in user_outcomes if o.get('id') == target_co_q2), None)
                if matched_oc2 and matched_oc2.get('unit'):
                    target_unit_q2 = matched_oc2.get('unit')

            target_diff = difficulty_targets[q_slot % len(difficulty_targets)] if difficulty_targets else 'Medium'

            # Helper to find best candidate for a given target CO, Unit, and Bloom with randomized top-tier tie breaking
            def find_best_candidate(t_co, t_unit, t_bloom=None):
                scored_candidates = []
                for idx, cand in enumerate(candidate_pool):
                    if idx in used_local_indices:
                        continue
                    topic = cand.get('topic', '')
                    pattern_id = cand.get('pattern_id', -1)
                    fit = 100.0
                    if cand.get('unit', '') == t_unit:
                        fit += 45.0
                    if cand.get('co', '') == t_co:
                        fit += 40.0
                    if t_bloom and cand.get('bloom_level', '').lower() == t_bloom.lower():
                        fit += 35.0
                    elif cand.get('bloom_level', '') == target_bloom_q1:
                        fit += 15.0
                    if cand.get('difficulty', '') == target_diff:
                        fit += 15.0
                    if pattern_id in used_patterns_local:
                        fit -= 70.0
                    if topic in used_topics_global:
                        fit -= 85.0
                    scored_candidates.append((cand, idx, fit))

                if scored_candidates:
                    scored_candidates.sort(key=lambda x: x[2], reverse=True)
                    best_score = scored_candidates[0][2]
                    # Select from top-tier candidates within 12 points of highest fit
                    top_tier = [c for c in scored_candidates if c[2] >= best_score - 12.0]
                    chosen = random.choice(top_tier)
                    return chosen[0], chosen[1]

                if candidate_pool:
                    available = [idx for idx in range(len(candidate_pool)) if idx not in used_local_indices]
                    if available:
                        chosen_idx = random.choice(available)
                        return candidate_pool[chosen_idx], chosen_idx
                    return candidate_pool[random.randint(0, len(candidate_pool) - 1)], 0

                return None, -1

            def register_candidate(cand, idx):
                if idx >= 0:
                    used_local_indices.add(idx)
                if cand:
                    if cand.get('pattern_id', -1) != -1:
                        used_patterns_local.add(cand['pattern_id'])
                    if cand.get('topic'):
                        used_topics_global.add(cand['topic'])

            # Determine question sub-division style
            q_sub_div = sub_division_mode
            if per_q_sub_divs and q_slot < len(per_q_sub_divs):
                q_sub_div = per_q_sub_divs[q_slot]

            marks_cfg = per_q_sub_marks[q_slot] if per_q_sub_marks and q_slot < len(per_q_sub_marks) else {}
            if isinstance(marks_cfg, dict):
                p1_val = marks_cfg.get('q1_a') or (marks_cfg.get('q1') if isinstance(marks_cfg.get('q1'), dict) else {}).get('a')
                p2_val = marks_cfg.get('q1_b') or (marks_cfg.get('q1') if isinstance(marks_cfg.get('q1'), dict) else {}).get('b')
                single_m = marks_cfg.get('q1') if not isinstance(marks_cfg.get('q1'), dict) else None
            else:
                p1_val = None
                p2_val = None
                single_m = marks_cfg

            if q_sub_div == 'two_subquestions':
                if p1_val is not None and p2_val is not None:
                    p1 = int(p1_val)
                    p2 = int(p2_val)
                elif marks_per_q == 14:
                    p1 = 8
                    p2 = 6
                else:
                    p1 = (marks_per_q + 1) // 2
                    p2 = marks_per_q - p1
                effective_marks = p1 + p2
            else:
                p1 = int(single_m) if single_m else marks_per_q
                p2 = 0
                effective_marks = p1

            if is_choice:
                q1_no = curr_q_index
                q2_no = curr_q_index + 1
                q_no_label = f"{q1_no} or {q2_no}"
                curr_q_index += 2

                if q_sub_div == 'two_subquestions':
                    # Select 4 independent candidates for the 4 distinct subquestions (q1_a, q1_b, q2_a, q2_b)
                    cand1_a, idx1_a = find_best_candidate(target_co_q1_a, target_unit_q1, target_bloom_q1_a)
                    register_candidate(cand1_a, idx1_a)

                    cand1_b, idx1_b = find_best_candidate(target_co_q1_b, target_unit_q1, target_bloom_q1_b)
                    register_candidate(cand1_b, idx1_b)

                    cand2_a, idx2_a = find_best_candidate(target_co_q2_a, target_unit_q2, target_bloom_q2_a)
                    register_candidate(cand2_a, idx2_a)

                    cand2_b, idx2_b = find_best_candidate(target_co_q2_b, target_unit_q2, target_bloom_q2_b)
                    register_candidate(cand2_b, idx2_b)

                    topic1_a = cand1_a.get('topic', '') if cand1_a else ''
                    topic1_b = cand1_b.get('topic', '') if cand1_b else ''
                    topic2_a = cand2_a.get('topic', '') if cand2_a else ''
                    topic2_b = cand2_b.get('topic', '') if cand2_b else ''

                    q1_sub_a = cls._get_unique_sub_variant('a', topic1_a, target_bloom_q1_a, target_co_q1_a, pattern_seed=random_seed_offset + q_slot * 4, used_texts_global=used_question_texts_global)
                    q1_sub_b = cls._get_unique_sub_variant('b', topic1_b, target_bloom_q1_b, target_co_q1_b, pattern_seed=random_seed_offset + q_slot * 4 + 1, used_texts_global=used_question_texts_global)
                    t1 = f"{q1_sub_a}\n\n{q1_sub_b}"

                    q2_sub_a = cls._get_unique_sub_variant('a', topic2_a, target_bloom_q2_a, target_co_q2_a, pattern_seed=random_seed_offset + q_slot * 4 + 2, used_texts_global=used_question_texts_global)
                    q2_sub_b = cls._get_unique_sub_variant('b', topic2_b, target_bloom_q2_b, target_co_q2_b, pattern_seed=random_seed_offset + q_slot * 4 + 3, used_texts_global=used_question_texts_global)
                    t2 = f"{q2_sub_a}\n\n{q2_sub_b}"

                    t1 = t1.replace('{p1}', str(p1)).replace('{p2}', str(p2))
                    t2 = t2.replace('{p1}', str(p1)).replace('{p2}', str(p2))
                    formatted_text = f"{t1}\n\n                                    [OR]\n\n{t2}"

                    primary_cand1 = cand1_a or cand1_b
                    primary_cand2 = cand2_a or cand2_b
                else:
                    cand1, idx1 = find_best_candidate(target_co_q1, target_unit_q1, target_bloom_q1)
                    register_candidate(cand1, idx1)

                    cand2, idx2 = find_best_candidate(target_co_q2, target_unit_q2, target_bloom_q2)
                    register_candidate(cand2, idx2)

                    topic1 = cand1.get('topic', '') if cand1 else ''
                    topic2 = cand2.get('topic', '') if cand2 else ''

                    t1 = cls._get_unique_single_long_answer(topic1, cand1.get('topic_b', '') if cand1 else '', target_bloom_q1, target_co_q1, pattern_seed=random_seed_offset + q_slot * 2, used_texts_global=used_question_texts_global)
                    t2 = cls._get_unique_single_long_answer(topic2, cand2.get('topic_b', '') if cand2 else '', target_bloom_q2, target_co_q2, pattern_seed=random_seed_offset + q_slot * 2 + 1, used_texts_global=used_question_texts_global)
                    formatted_text = f"{t1}\n\n                                    [OR]\n\n{t2}"

                    primary_cand1 = cand1
                    primary_cand2 = cand2

                selected_questions.append({
                    'q_no': q_no_label,
                    'q1_no': q1_no,
                    'q2_no': q2_no,
                    'has_internal_choice': True,
                    'question': formatted_text,
                    'type': section_type,
                    'marks': effective_marks,
                    'p1_marks': p1 if q_sub_div != 'none' else None,
                    'p2_marks': p2 if q_sub_div != 'none' else None,
                    'sub_division': 'two_subquestions' if q_sub_div != 'none' else 'none',
                    'unit': target_unit_q1,
                    'co': target_co_q1,
                    'q1_co': target_co_q1,
                    'q2_co': target_co_q2,
                    'q1_co_a': target_co_q1_a,
                    'q1_co_b': target_co_q1_b,
                    'q2_co_a': target_co_q2_a,
                    'q2_co_b': target_co_q2_b,
                    'co_description': primary_cand1.get('co_description', '') if primary_cand1 else '',
                    'bloom_level': target_bloom_q1,
                    'q1_bloom': target_bloom_q1,
                    'q2_bloom': target_bloom_q2,
                    'q1_bloom_a': target_bloom_q1_a,
                    'q1_bloom_b': target_bloom_q1_b,
                    'q2_bloom_a': target_bloom_q2_a,
                    'q2_bloom_b': target_bloom_q2_b,
                    'difficulty': target_diff,
                    'topic': primary_cand1.get('topic', '') if primary_cand1 else '',
                    'choice': None,
                    'grounded': True
                })
            else:
                if is_section_1_subquestions:
                    sub_char = chr(97 + q_slot) if q_slot < 26 else f"q{q_slot+1}"
                    q1_no = 1
                    q_no_label = sub_char
                else:
                    q1_no = curr_q_index
                    q_no_label = f"{curr_q_index}"
                    curr_q_index += 1

                if 'MCQ' in section_type:
                    cand1, idx1 = find_best_candidate(target_co_q1, target_unit_q1, target_bloom_q1)
                    register_candidate(cand1, idx1)
                    formatted_text = cand1.get('question_template') or cand1.get('question', '') if cand1 else ''
                    used_question_texts_global.add(cls._normalize_for_dedup(formatted_text))
                    primary_cand1 = cand1
                elif 'Short' in section_type or marks_per_q <= 5:
                    cand1, idx1 = find_best_candidate(target_co_q1, target_unit_q1, target_bloom_q1)
                    register_candidate(cand1, idx1)
                    topic_a = cand1.get('topic', '') if cand1 else ''
                    topic_b = cand1.get('topic_b', '') if cand1 else ''
                    formatted_text = cls._get_unique_short_answer(topic_a, topic_b, target_bloom_q1, pattern_seed=random_seed_offset + q_slot, used_texts_global=used_question_texts_global)
                    primary_cand1 = cand1
                elif q_sub_div == 'none':
                    cand1, idx1 = find_best_candidate(target_co_q1, target_unit_q1, target_bloom_q1)
                    register_candidate(cand1, idx1)
                    topic_a = cand1.get('topic', '') if cand1 else ''
                    formatted_text = cls._get_unique_single_long_answer(topic_a, cand1.get('topic_b', '') if cand1 else '', target_bloom_q1, target_co_q1, pattern_seed=random_seed_offset + q_slot, used_texts_global=used_question_texts_global)
                    primary_cand1 = cand1
                else:
                    cand1_a, idx1_a = find_best_candidate(target_co_q1_a, target_unit_q1, target_bloom_q1_a)
                    register_candidate(cand1_a, idx1_a)
                    cand1_b, idx1_b = find_best_candidate(target_co_q1_b, target_unit_q1, target_bloom_q1_b)
                    register_candidate(cand1_b, idx1_b)
                    topic1_a = cand1_a.get('topic', '') if cand1_a else ''
                    topic1_b = cand1_b.get('topic', '') if cand1_b else ''
                    q1_sub_a = cls._get_unique_sub_variant('a', topic1_a, target_bloom_q1_a, target_co_q1_a, pattern_seed=random_seed_offset + q_slot * 2, used_texts_global=used_question_texts_global)
                    q1_sub_b = cls._get_unique_sub_variant('b', topic1_b, target_bloom_q1_b, target_co_q1_b, pattern_seed=random_seed_offset + q_slot * 2 + 1, used_texts_global=used_question_texts_global)
                    formatted_text = f"{q1_sub_a}\n\n{q1_sub_b}"
                    formatted_text = formatted_text.replace('{p1}', str(p1)).replace('{p2}', str(p2))
                    primary_cand1 = cand1_a or cand1_b

                selected_questions.append({
                    'q_no': q_no_label,
                    'q1_no': q1_no,
                    'q2_no': None,
                    'has_internal_choice': False,
                    'question': formatted_text,
                    'type': section_type,
                    'marks': effective_marks,
                    'p1_marks': p1 if q_sub_div != 'none' else None,
                    'p2_marks': p2 if q_sub_div != 'none' else None,
                    'sub_division': 'two_subquestions' if q_sub_div != 'none' else 'none',
                    'unit': target_unit_q1,
                    'co': target_co_q1,
                    'q1_co': target_co_q1,
                    'q2_co': None,
                    'q1_co_a': target_co_q1_a,
                    'q1_co_b': target_co_q1_b,
                    'q2_co_a': None,
                    'q2_co_b': None,
                    'co_description': primary_cand1.get('co_description', '') if primary_cand1 else '',
                    'bloom_level': target_bloom_q1,
                    'q1_bloom': target_bloom_q1,
                    'q2_bloom': None,
                    'q1_bloom_a': target_bloom_q1_a,
                    'q1_bloom_b': target_bloom_q1_b,
                    'q2_bloom_a': None,
                    'q2_bloom_b': None,
                    'difficulty': target_diff,
                    'topic': primary_cand1.get('topic', '') if primary_cand1 else '',
                    'choice': None,
                    'grounded': True
                })

        if is_section_1_subquestions:
            next_q_idx = start_q_index + 1
        else:
            next_q_idx = curr_q_index
        return selected_questions, next_q_idx

    @classmethod
    def optimize_examination_blueprint(
        cls,
        pools_by_type: Dict[str, List[Dict[str, Any]]],
        sections_config: List[Dict[str, Any]],
        difficulty_config: Dict[str, Any],
        blooms_list: List[str],
        user_outcomes: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes full examination paper optimization across all sections without duplicating questions, patterns or topics.
        """
        easy_pct = int(difficulty_config.get('easy', 40)) if isinstance(difficulty_config, dict) else 40
        med_pct = int(difficulty_config.get('medium', 40)) if isinstance(difficulty_config, dict) else 40
        hard_pct = int(difficulty_config.get('hard', 20)) if isinstance(difficulty_config, dict) else 20
        diff_array = ['Easy'] * easy_pct + ['Medium'] * med_pct + ['Hard'] * hard_pct
        if not diff_array:
            diff_array = ['Easy', 'Medium', 'Hard']

        if not blooms_list:
            blooms_list = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']
        else:
            cleaned_blooms = []
            for b in blooms_list:
                b_str = str(b).strip()
                if b_str.lower() in ['remember', 'remembering']:
                    if 'Remember' not in cleaned_blooms:
                        cleaned_blooms.append('Remember')
                elif b_str not in cleaned_blooms:
                    cleaned_blooms.append(b_str)
            blooms_list = cleaned_blooms if cleaned_blooms else ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create']

        optimized_sections = []
        session_seed = random.randint(1, 1000000)
        global_q_idx = 1
        total_calculated_marks = 0
        active_sec_idx = 0
        used_topics_global = set()
        used_question_texts_global = set()

        for sec in sections_config:
            sec_type = sec.get('type') or 'Short Answer'
            if sec_type == 'None':
                continue

            roman_numerals = ['I', 'II', 'III', 'IV', 'V', 'VI']
            sec_roman = roman_numerals[active_sec_idx] if active_sec_idx < len(roman_numerals) else chr(65 + active_sec_idx)
            sec_name = sec.get('name') or f"SECTION-{sec_roman}"

            num_q = int(sec.get('questions') or 5)
            marks_per_q = int(sec.get('marks_per_q') or 2)
            choice_mode = sec.get('choice_mode') or ('internal_choice' if sec.get('has_choice') else 'none')
            sub_division = sec.get('sub_division') or ('two_subquestions' if 'Long' in sec_type else 'none')
            per_q_sub_divs = sec.get('question_sub_divisions') or []
            per_q_sub_marks = sec.get('question_sub_marks') or []
            per_q_cos = sec.get('question_cos') or []
            per_q_blooms = sec.get('question_blooms') or []

            remaining_active_secs = [s for s in sections_config[active_sec_idx + 1:] if s.get('type') != 'None']
            is_sec1_subs = (active_sec_idx == 0 and choice_mode != 'internal_choice' and ('Short' in sec_type or num_q <= 10) and len(remaining_active_secs) > 0)

            active_sec_idx += 1

            # Get candidate pool strictly matching the section type
            if 'Short' in sec_type:
                candidate_pool = pools_by_type.get('Short Answer', [])
            elif 'MCQ' in sec_type:
                candidate_pool = pools_by_type.get('MCQ', [])
            elif 'Long' in sec_type:
                candidate_pool = pools_by_type.get('Long Answer', [])
            else:
                candidate_pool = pools_by_type.get('Short Answer', [])

            # Run section optimization
            section_questions, next_q_idx = cls.optimize_section_questions(
                candidate_pool=candidate_pool,
                required_count=num_q,
                marks_per_q=marks_per_q,
                section_type=sec_type,
                choice_mode=choice_mode,
                sub_division_mode=sub_division,
                per_q_sub_divs=per_q_sub_divs,
                difficulty_targets=diff_array,
                blooms_targets=blooms_list,
                used_topics_global=used_topics_global,
                user_outcomes=user_outcomes,
                per_q_cos=per_q_cos,
                per_q_sub_marks=per_q_sub_marks,
                start_q_index=global_q_idx,
                per_q_blooms=per_q_blooms,
                used_question_texts_global=used_question_texts_global,
                is_section_1_subquestions=is_sec1_subs,
                random_seed_offset=session_seed + (active_sec_idx * 100)
            )
            global_q_idx = next_q_idx

            sec_subtotal = sum(q.get('marks', marks_per_q) for q in section_questions)
            total_calculated_marks += sec_subtotal

            default_inst = f"Answer all {num_q} questions. Each carries {marks_per_q} marks."
            if 'MCQ' in sec_type:
                default_inst = f"Select the correct option for all {num_q} questions. [{marks_per_q}M each]"
            elif 'Long' in sec_type:
                if choice_mode == 'internal_choice':
                    default_inst = f"Answer all questions. Each carries {marks_per_q} marks with internal choice."
                else:
                    default_inst = f"Answer all {num_q} questions. Each carries {marks_per_q} marks."

            optimized_sections.append({
                'section_name': sec_name,
                'section_type': sec_type,
                'instruction': sec.get('instruction') or default_inst,
                'section_marks': sec_subtotal,
                'questions': section_questions
            })

        return {
            'sections': optimized_sections,
            'total_calculated_marks': total_calculated_marks,
            'total_questions_count': global_q_idx - 1,
            'status': 'optimized'
        }
