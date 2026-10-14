import math
import re
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
        per_q_cos: Optional[List[str]] = None,
        start_q_index: int = 1
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Optimizes question selection for a single section with dynamic mark formatting and distinct topic & phrasing selection.
        """
        selected_questions = []
        used_local_indices = set()
        used_patterns_local = set()
        curr_q_index = start_q_index

        co_keys = [o.get('id', f'CO{i+1}') for i, o in enumerate(user_outcomes)] if user_outcomes else ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']
        if not co_keys:
            co_keys = ['CO1', 'CO2', 'CO3', 'CO4', 'CO5']

        for q_slot in range(required_count):
            is_choice = (choice_mode == 'internal_choice')
            raw_slot = per_q_cos[q_slot] if per_q_cos and q_slot < len(per_q_cos) else None

            # Determine Target COs for Q1 (and Q2 if internal choice)
            slot_co_q1 = None
            slot_co_q2 = None
            if isinstance(raw_slot, dict):
                raw_1 = str(raw_slot.get('q1') or raw_slot.get('q1_co') or '').strip()
                raw_2 = str(raw_slot.get('q2') or raw_slot.get('q2_co') or '').strip()
                if raw_1 and raw_1.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1 = raw_1
                if raw_2 and raw_2.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q2 = raw_2
            elif isinstance(raw_slot, str):
                raw_str = raw_slot.strip()
                if raw_str and raw_str.lower() not in ['auto', 'none', '', 'all']:
                    slot_co_q1 = raw_str
                    slot_co_q2 = raw_str

            if is_choice:
                target_co_q1 = slot_co_q1 if slot_co_q1 else co_keys[(q_slot * 2) % len(co_keys)]
                target_co_q2 = slot_co_q2 if slot_co_q2 else co_keys[(q_slot * 2 + 1) % len(co_keys)]
            else:
                target_co_q1 = slot_co_q1 if slot_co_q1 else co_keys[q_slot % len(co_keys)]
                target_co_q2 = target_co_q1

            # Resolve target units
            target_unit_q1 = f"Unit {(((q_slot * (2 if is_choice else 1)) % 5) + 1)}"
            target_unit_q2 = f"Unit {(((q_slot * 2 + 1) % 5) + 1)}" if is_choice else target_unit_q1
            if user_outcomes:
                matched_oc1 = next((o for o in user_outcomes if o.get('id') == target_co_q1), None)
                if matched_oc1 and matched_oc1.get('unit'):
                    target_unit_q1 = matched_oc1.get('unit')
                matched_oc2 = next((o for o in user_outcomes if o.get('id') == target_co_q2), None)
                if matched_oc2 and matched_oc2.get('unit'):
                    target_unit_q2 = matched_oc2.get('unit')

            target_diff = difficulty_targets[q_slot % len(difficulty_targets)] if difficulty_targets else 'Medium'
            target_bloom = blooms_targets[q_slot % len(blooms_targets)] if blooms_targets else 'Understand'

            # Helper to find best candidate for a given target CO and target Unit
            def find_best_candidate(t_co, t_unit):
                b_cand, b_idx, b_fit = None, -1, -float('inf')
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
                    if cand.get('difficulty', '') == target_diff:
                        fit += 15.0
                    if cand.get('bloom_level', '') == target_bloom:
                        fit += 15.0
                    if pattern_id in used_patterns_local:
                        fit -= 70.0
                    if topic in used_topics_global:
                        fit -= 85.0
                    if fit > b_fit:
                        b_fit = fit
                        b_cand = cand
                        b_idx = idx
                if not b_cand and candidate_pool:
                    for idx, cand in enumerate(candidate_pool):
                        if idx not in used_local_indices:
                            b_cand = cand
                            b_idx = idx
                            break
                    if not b_cand:
                        b_idx = q_slot % len(candidate_pool)
                        b_cand = candidate_pool[b_idx]
                return b_cand, b_idx

            # Find Candidate 1
            cand1, idx1 = find_best_candidate(target_co_q1, target_unit_q1)
            if cand1:
                used_local_indices.add(idx1)
                if cand1.get('pattern_id', -1) != -1:
                    used_patterns_local.add(cand1['pattern_id'])
                if cand1.get('topic'):
                    used_topics_global.add(cand1['topic'])

            # Determine question sub-division style
            q_sub_div = sub_division_mode
            if per_q_sub_divs and q_slot < len(per_q_sub_divs):
                q_sub_div = per_q_sub_divs[q_slot]

            p1 = (marks_per_q + 1) // 2
            p2 = marks_per_q - p1

            if is_choice:
                # Find Candidate 2 for the internal choice alternative
                cand2, idx2 = find_best_candidate(target_co_q2, target_unit_q2)
                if cand2:
                    used_local_indices.add(idx2)
                    if cand2.get('pattern_id', -1) != -1:
                        used_patterns_local.add(cand2['pattern_id'])
                    if cand2.get('topic'):
                        used_topics_global.add(cand2['topic'])
                else:
                    cand2 = cand1

                q1_no = curr_q_index
                q2_no = curr_q_index + 1
                q_no_label = f"{q1_no} or {q2_no}"
                curr_q_index += 2

                if q_sub_div == 'none':
                    t1 = (cand1.get('single_template') or cand1.get('question_template') or cand1.get('question', '')).strip()
                    t2 = (cand2.get('single_template') or cand2.get('question_template') or cand2.get('question', '')).strip()
                    formatted_text = f"{t1} [{marks_per_q}M]\n\n                                    [OR]\n\n{t2} [{marks_per_q}M]"
                else:
                    t1 = cand1.get('sub_template', '').replace('{p1}', str(p1)).replace('{p2}', str(p2)) if cand1.get('sub_template') else (cand1.get('choice_template', '').replace('{p1}', str(p1)).replace('{p2}', str(p2)) or cand1.get('question', ''))
                    t2 = cand2.get('sub_template', '').replace('{p1}', str(p1)).replace('{p2}', str(p2)) if cand2.get('sub_template') else (cand2.get('choice_template', '').replace('{p1}', str(p1)).replace('{p2}', str(p2)) or cand2.get('question', ''))
                    formatted_text = f"{t1}\n\n                                    [OR]\n\n{t2}"

                selected_questions.append({
                    'q_no': q_no_label,
                    'q1_no': q1_no,
                    'q2_no': q2_no,
                    'has_internal_choice': True,
                    'question': formatted_text,
                    'type': section_type,
                    'marks': marks_per_q,
                    'unit': target_unit_q1,
                    'co': target_co_q1,
                    'q1_co': target_co_q1,
                    'q2_co': target_co_q2,
                    'co_description': cand1.get('co_description', ''),
                    'bloom_level': cand1.get('bloom_level', target_bloom),
                    'q1_bloom': cand1.get('bloom_level', target_bloom),
                    'q2_bloom': cand2.get('bloom_level', target_bloom),
                    'difficulty': target_diff,
                    'topic': cand1.get('topic', ''),
                    'choice': None,
                    'grounded': True
                })
            else:
                q1_no = curr_q_index
                q_no_label = f"{curr_q_index}"
                curr_q_index += 1

                if 'Short' in section_type or 'MCQ' in section_type or marks_per_q <= 4:
                    formatted_text = cand1.get('question_template') or cand1.get('question', '')
                elif q_sub_div == 'none':
                    formatted_text = cand1.get('single_template') or cand1.get('question_template') or cand1.get('question', '')
                else:
                    template = cand1.get('sub_template', '')
                    formatted_text = template.replace('{p1}', str(p1)).replace('{p2}', str(p2)) if template else (cand1.get('question_template') or cand1.get('question', ''))

                selected_questions.append({
                    'q_no': q_no_label,
                    'q1_no': q1_no,
                    'q2_no': None,
                    'has_internal_choice': False,
                    'question': formatted_text,
                    'type': section_type,
                    'marks': marks_per_q,
                    'unit': target_unit_q1,
                    'co': target_co_q1,
                    'q1_co': target_co_q1,
                    'q2_co': None,
                    'co_description': cand1.get('co_description', ''),
                    'bloom_level': cand1.get('bloom_level', target_bloom),
                    'q1_bloom': cand1.get('bloom_level', target_bloom),
                    'q2_bloom': None,
                    'difficulty': target_diff,
                    'topic': cand1.get('topic', ''),
                    'choice': None,
                    'grounded': True
                })

        return selected_questions, curr_q_index

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

        optimized_sections = []
        global_q_idx = 1
        total_calculated_marks = 0
        active_sec_idx = 0
        used_topics_global = set()

        for sec in sections_config:
            sec_type = sec.get('type') or 'Short Answer'
            if sec_type == 'None':
                continue

            sec_letter = chr(65 + active_sec_idx)
            sec_name = f"Section {sec_letter}"
            active_sec_idx += 1

            num_q = int(sec.get('questions') or 5)
            marks_per_q = int(sec.get('marks_per_q') or 2)
            choice_mode = sec.get('choice_mode') or ('internal_choice' if sec.get('has_choice') else 'none')
            sub_division = sec.get('sub_division') or ('two_subquestions' if 'Long' in sec_type else 'none')
            per_q_sub_divs = sec.get('question_sub_divisions') or []
            per_q_cos = sec.get('question_cos') or []

            sec_subtotal = num_q * marks_per_q
            total_calculated_marks += sec_subtotal

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
                start_q_index=global_q_idx
            )
            global_q_idx = next_q_idx

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
