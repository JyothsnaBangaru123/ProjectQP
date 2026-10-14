import re
import math
import random
from typing import List, Dict, Any, Tuple, Optional

class RAGService:
    """
    Retrieval-Augmented Generation (RAG) Service for syllabus and document processing.
    Handles semantic chunking, unit-level concept extraction, automatic Course Outcome (CO) extraction,
    and grounded candidate question generation aligned strictly with Bloom's Taxonomy and COs.
    """

    BLOOM_ACTION_VERBS = {
        'Remember': ['Define', 'State', 'List', 'Name', 'Recall', 'Identify', 'Outline'],
        'Understand': ['Explain', 'Describe', 'Discuss', 'Distinguish between', 'Summarize', 'Illustrate', 'Interpret'],
        'Apply': ['Apply', 'Demonstrate', 'Solve', 'Calculate', 'Implement', 'Execute', 'Determine'],
        'Analyze': ['Analyze', 'Compare and contrast', 'Categorize', 'Differentiate', 'Examine', 'Investigate'],
        'Evaluate': ['Evaluate', 'Assess', 'Justify', 'Critique', 'Verify', 'Recommend', 'Defend'],
        'Create': ['Design', 'Construct', 'Formulate', 'Develop', 'Propose', 'Synthesize', 'Compose']
    }

    CO_BLOOM_MAP = {
        'CO1': ['Remember', 'Understand'],
        'CO2': ['Understand', 'Apply'],
        'CO3': ['Apply', 'Analyze'],
        'CO4': ['Analyze', 'Evaluate'],
        'CO5': ['Evaluate', 'Create'],
        'CO6': ['Evaluate', 'Create']
    }

    # --- Diverse, Grammatically Rigorous Human-Crafted Short Answer Patterns ---
    SHORT_ANSWER_PATTERNS = [
        lambda t1, t2, c: f"Define {t1}. State its primary objective and practical significance in {c}.",
        lambda t1, t2, c: f"Explain the working mechanism and operational role of {t1} in brief.",
        lambda t1, t2, c: f"State the core principles behind {t1}. Mention two key practical benefits.",
        lambda t1, t2, c: f"Write the syntax and outline a brief code snippet demonstrating {t1}.",
        lambda t1, t2, c: f"Why is {t1} preferred over conventional approaches in {c}? Justify briefly.",
        lambda t1, t2, c: f"Compare {t1} and {t2} across syntax, execution behavior, and practical use cases.",
        lambda t1, t2, c: f"List the fundamental rules, keywords, and constraints associated with {t1}.",
        lambda t1, t2, c: f"What happens when {t1} encounters invalid input, boundary conditions, or runtime exceptions?",
        lambda t1, t2, c: f"In what practical scenarios is {t1} recommended? Provide a concise real-world use case.",
        lambda t1, t2, c: f"Briefly describe the lifecycle states, key methods, and transitions involved in {t1}.",
        lambda t1, t2, c: f"How does {t1} facilitate code reusability, loose coupling, and modularity in {c}?",
        lambda t1, t2, c: f"Differentiate between {t1} and {t2}, highlighting two critical architectural distinctions.",
        lambda t1, t2, c: f"Explain how {t1} ensures data integrity, thread safety, or resource cleanup during execution.",
        lambda t1, t2, c: f"Outline the step-by-step procedure to declare, initialize, and execute {t1} effectively.",
        lambda t1, t2, c: f"Analyze the runtime behavior and memory overhead associated with {t1} in {c}."
    ]

    # --- Diverse, Grammatically Flawless Long Answer Patterns ---
    LONG_ANSWER_PATTERNS = [
        # Pattern 0
        (
            lambda t1, t2, t3, t4: (
                f"a) Explain the fundamental architecture, operational mechanics, and core principles of {t1} with neat sketches. [{{p1}}M]\n\n"
                f"b) Write a complete, well-commented program demonstrating {t2}, detailing the role of each key construct. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) Distinguish between {t3} and {t4} across execution efficiency, memory footprint, and practical use cases. [{{p1}}M]\n\n"
                f"b) How does {t1} ensure fault tolerance and error recovery? Illustrate with a comprehensive scenario. [{{p2}}M]"
            ),
            lambda t1, t2: f"Elaborate on the theoretical foundations, internal architecture, and practical implementation of {t1}. Illustrate with neat structural schematics and evaluate its design trade-offs compared to {t2}."
        ),
        # Pattern 1
        (
            lambda t1, t2, t3, t4: (
                f"a) Discuss the class hierarchy, interfaces, and core methods provided in {t1} with appropriate diagrams. [{{p1}}M]\n\n"
                f"b) Develop an end-to-end implementation showcasing the practical application and benefits of {t2}. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) Analyze the role of {t3} in modern software systems. What are its primary design constraints? [{{p1}}M]\n\n"
                f"b) Detail the step-by-step lifecycle and state transitions associated with {t4} using illustrative sketches. [{{p2}}M]"
            ),
            lambda t1, t2: f"Discuss the design principles, component interactions, and execution workflow of {t1}. Provide diagrams and analyze its operational complexity and performance characteristics."
        ),
        # Pattern 2
        (
            lambda t1, t2, t3, t4: (
                f"a) Compare and contrast {t1} with {t2}. Under what operational conditions is {t1} preferred? [{{p1}}M]\n\n"
                f"b) Illustrate how {t3} is configured and deployed to optimize system throughput and reliability. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) Elaborate on the underlying algorithms, data structures, and invariants governing {t4}. [{{p1}}M]\n\n"
                f"b) Formulate an implementation strategy for {t1} that ensures modularity and loose coupling. [{{p2}}M]"
            ),
            lambda t1, t2: f"Critically analyze the role of {t1} in building scalable systems. Compare it with {t2} across performance, memory footprint, and fault tolerance."
        ),
        # Pattern 3
        (
            lambda t1, t2, t3, t4: (
                f"a) What is {t1}? Explain its internal mechanics, memory model, and runtime behavior in detail. [{{p1}}M]\n\n"
                f"b) Write an end-to-end implementation for {t2}, explaining parameter passing, return types, and state management. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) Critically evaluate the performance trade-offs between {t3} and {t4} with relevant benchmarks. [{{p1}}M]\n\n"
                f"b) Design a clean solution demonstrating how {t1} interacts with underlying system resources. [{{p2}}M]"
            ),
            lambda t1, t2: f"Formulate a complete architectural design utilizing {t1}. Trace its execution lifecycle and explain how edge cases and state invariants are preserved."
        ),
        # Pattern 4
        (
            lambda t1, t2, t3, t4: (
                f"a) Examine the key features, advantages, and execution lifecycle associated with {t1}. [{{p1}}M]\n\n"
                f"b) Demonstrate the practical application of {t2} with a complete, well-commented code example. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) What core problem does {t3} solve? Explain its architectural role with suitable diagrams. [{{p1}}M]\n\n"
                f"b) Formulate a robust error-handling and synchronization strategy when working with {t4}. [{{p2}}M]"
            ),
            lambda t1, t2: f"Explain the internal mechanisms and state transitions involved in {t1}. Detail the error-handling, safety checks, and recovery strategies applied during execution."
        ),
        # Pattern 5
        (
            lambda t1, t2, t3, t4: (
                f"a) Describe how {t1} implements standard design patterns and ensures loose coupling in systems. [{{p1}}M]\n\n"
                f"b) Provide a detailed code walkthrough showing how {t2} is applied to solve practical computational problems. [{{p2}}M]"
            ),
            lambda t1, t2, t3, t4: (
                f"a) Evaluate the memory management and garbage collection impact when utilizing {t3}. [{{p1}}M]\n\n"
                f"b) Construct a modular framework that integrates {t1} and {t4} seamlessly. [{{p2}}M]"
            ),
            lambda t1, t2: f"Provide an in-depth analysis of {t1}. Describe its class hierarchy, built-in interfaces, and step-by-step workflow with suitable diagrams."
        )
    ]

    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'\r\n|\r', '\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        return text.strip()

    @classmethod
    def extract_course_outcomes(cls, text: str) -> List[Dict[str, Any]]:
        """
        Scans document text for Course Outcomes (COs).
        Returns a list of extracted COs: [{'id': 'CO1', 'description': '...', 'bloom_level': 'Understand', 'unit': 'Unit 1'}, ...]
        If no COs are found in the text, returns an empty list [].
        """
        cleaned = cls.clean_text(text)
        if not cleaned:
            return []

        outcomes = []
        lines = cleaned.split('\n')
        
        # 1. Look for explicit CO1:, CO2:, CO 1 -, CO-1 patterns
        co_pattern = re.compile(r'^(CO\s*[-–—\.]?\s*[0-9]+)\s*[:\.\-–—\)]\s*(.+)', re.IGNORECASE)
        for line in lines:
            line_s = line.strip()
            if not line_s:
                continue
            match = co_pattern.match(line_s)
            if match:
                raw_id = match.group(1).upper().replace(' ', '').replace('-', '').replace('.', '')
                desc = match.group(2).strip()
                # Clean description
                desc = re.sub(r'^[0-9\.\-\s]+', '', desc).strip()
                if len(desc) >= 8:
                    co_num = re.findall(r'[0-9]+', raw_id)
                    num_val = int(co_num[0]) if co_num else len(outcomes) + 1
                    formatted_id = f"CO{num_val}"
                    
                    # Infer Bloom level from initial action verb
                    first_word = desc.split()[0].capitalize() if desc.split() else 'Understand'
                    inferred_bloom = 'Understand'
                    for b_level, verbs in cls.BLOOM_ACTION_VERBS.items():
                        if any(first_word.lower() == v.lower() for v in verbs):
                            inferred_bloom = b_level
                            break

                    outcomes.append({
                        'id': formatted_id,
                        'description': desc,
                        'bloom_level': inferred_bloom,
                        'unit': f"Unit {min(5, num_val)}"
                    })

        # 2. If explicit CO1: wasn't found, check for a "Course Outcomes" section with bullet points/numbers
        if not outcomes:
            co_section_active = False
            co_counter = 1
            for line in lines:
                line_s = line.strip()
                if not line_s:
                    continue

                if re.search(r'^(course\s+outcomes?|course\s+learning\s+outcomes?|expected\s+outcomes?|cos?)\s*[:\.\-–—]?$', line_s, re.IGNORECASE):
                    co_section_active = True
                    continue
                elif re.search(r'^(syllabus|unit\s*[1-5ivx]|module\s*[1-5ivx]|course\s+content|text\s*books|references)', line_s, re.IGNORECASE):
                    if co_section_active and outcomes:
                        break
                    co_section_active = False

                if co_section_active:
                    # Match numbered or bulleted list under Course Outcomes section
                    bullet_match = re.match(r'^([0-9]+[\.\)]|[•\*\-\–])\s*(.+)', line_s)
                    desc_candidate = bullet_match.group(2).strip() if bullet_match else line_s
                    if len(desc_candidate) >= 15 and not desc_candidate.lower().startswith(('the student will', 'upon completion', 'hours', 'credits')):
                        first_word = desc_candidate.split()[0].capitalize() if desc_candidate.split() else 'Understand'
                        inferred_bloom = 'Understand'
                        for b_level, verbs in cls.BLOOM_ACTION_VERBS.items():
                            if any(first_word.lower() == v.lower() for v in verbs):
                                inferred_bloom = b_level
                                break

                        outcomes.append({
                            'id': f"CO{co_counter}",
                            'description': desc_candidate,
                            'bloom_level': inferred_bloom,
                            'unit': f"Unit {min(5, co_counter)}"
                        })
                        co_counter += 1
                        if co_counter > 6:
                            break

        return outcomes

    @classmethod
    def chunk_document(cls, text: str, chunk_size: int = 350, overlap: int = 60) -> List[Dict[str, Any]]:
        cleaned = cls.clean_text(text)
        if not cleaned:
            return []

        lines = cleaned.split('\n')
        chunks = []
        current_unit = "Unit I"
        current_chunk_lines = []
        current_word_count = 0
        chunk_id = 1

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            unit_match = re.search(r'^(unit|module|chapter|part)\s*[-–—:\s]*([0-9]+|[IVXLCDMivxlcdm]+)[:\.\-\s]*(.*)', line_str, re.IGNORECASE)
            if unit_match:
                if current_chunk_lines and current_word_count >= 50:
                    chunk_text = " ".join(current_chunk_lines).strip()
                    chunks.append({
                        'id': f"chunk_{chunk_id}",
                        'unit': current_unit,
                        'text': chunk_text,
                        'word_count': len(chunk_text.split()),
                        'keywords': cls.extract_keywords(chunk_text)
                    })
                    chunk_id += 1
                    current_chunk_lines = []
                    current_word_count = 0
                
                u_num = unit_match.group(2).upper()
                u_title = unit_match.group(3).strip()[:50]
                current_unit = f"Unit {u_num}" + (f": {u_title}" if u_title else "")

            words_in_line = len(line_str.split())
            current_chunk_lines.append(line_str)
            current_word_count += words_in_line

            if current_word_count >= chunk_size:
                chunk_text = " ".join(current_chunk_lines).strip()
                chunks.append({
                    'id': f"chunk_{chunk_id}",
                    'unit': current_unit,
                    'text': chunk_text,
                    'word_count': len(chunk_text.split()),
                    'keywords': cls.extract_keywords(chunk_text)
                })
                chunk_id += 1
                
                overlap_lines = []
                overlap_count = 0
                for prev_line in reversed(current_chunk_lines):
                    w_count = len(prev_line.split())
                    if overlap_count + w_count <= overlap:
                        overlap_lines.insert(0, prev_line)
                        overlap_count += w_count
                    else:
                        break
                current_chunk_lines = overlap_lines
                current_word_count = overlap_count

        if current_chunk_lines:
            chunk_text = " ".join(current_chunk_lines).strip()
            if len(chunk_text.split()) >= 10 or not chunks:
                chunks.append({
                    'id': f"chunk_{chunk_id}",
                    'unit': current_unit,
                    'text': chunk_text,
                    'word_count': len(chunk_text.split()),
                    'keywords': cls.extract_keywords(chunk_text)
                })

        return chunks

    # Exhaustive set of metadata terms, document headers, and academic boilerplate to ignore as topics
    METADATA_STOPWORDS = {
        'syllabus', 'course syllabus', 'detailed syllabus', 'syllabus content', 'syllabus contents',
        'curriculum', 'course curriculum', 'objective', 'objectives', 'course objective', 'course objectives',
        'program objectives', 'program educational objectives', 'peo', 'peos', 'outcome', 'outcomes',
        'course outcome', 'course outcomes', 'program outcome', 'program outcomes', 'learning outcome',
        'learning outcomes', 'program specific outcome', 'program specific outcomes', 'co', 'cos', 'po',
        'pos', 'pso', 'psos', 'co1', 'co2', 'co3', 'co4', 'co5', 'co6', 'textbook', 'textbooks', 'text book',
        'text books', 'reference', 'references', 'reference book', 'reference books', 'prescribed books',
        'prescribed textbooks', 'recommended books', 'suggested reading', 'suggested readings', 'web resources',
        'online resources', 'e-books', 'journals', 'prerequisite', 'prerequisites', 'prerequisite courses',
        'course prerequisite', 'course prerequisites', 'course code', 'course title', 'course name',
        'course structure', 'scheme of instruction', 'scheme of examination', 'evaluation scheme',
        'assessment scheme', 'examination scheme', 'academic year', 'regulation', 'regulations', 'semester',
        'department', 'branch', 'faculty', 'degree', 'program', 'programme', 'credits', 'credit', 'hours',
        'total hours', 'lecture hours', 'tutorial hours', 'practical hours', 'marks', 'max marks',
        'maximum marks', 'internal marks', 'external marks', 'total marks', 'ltpc', 'l-t-p-c', 'l t p c',
        'model question paper', 'question paper pattern', 'question paper', 'end semester examination',
        'mid semester examination', 'continuous assessment', 'continuous internal evaluation', 'cie', 'see',
        'internal assessment', 'bloom', 'blooms', 'blooms taxonomy', "bloom's taxonomy", 'cognitive level',
        'introduction', 'overview', 'basics', 'fundamentals', 'conclusion', 'summary', 'notes', 'appendix',
        'index', 'contents', 'table of contents', 'author', 'authors', 'edition', 'publisher', 'publishers',
        'publication', 'publications', 'press', 'pearson', 'pearson education', 'mcgraw hill',
        'tata mcgraw hill', 'wiley', 'prentice hall', 'o\'reilly', 'oreilly', 'oxford', 'cambridge',
        'herbert schildt', 'balagurusamy', 'e balagurusamy', 'kathy sierra', 'bert bates', 'deitel',
        'cay horstmann', 'isbn', 'issn', 'doi', 'page', 'pages', 'vol', 'volume', 'unit', 'module',
        'chapter', 'part', 'section', 'topics', 'sub topics', 'subtopics', 'unit 1', 'unit 2', 'unit 3',
        'unit 4', 'unit 5', 'module 1', 'module 2', 'module 3', 'module 4', 'module 5'
    }

    @classmethod
    def clean_concept_name(cls, concept: str, course_name: str = "") -> str:
        """
        Cleans topic name by removing section noise, unit prefixes, hour counts, and enrich domain concepts.
        Strictly filters out structural document keywords (e.g. Syllabus, Objectives, Text Books).
        Ensures proper capitalization and no fragmented phrases remain.
        """
        if not concept:
            return ""
        c = concept.strip()
        
        # Strip unit/module/chapter prefixes
        c = re.sub(r'^(unit|module|chapter|part|section)\s*[-–—:\s]*([0-9]+|[IVXLCDMivxlcdm]+)[:\.\-\s]*', '', c, flags=re.IGNORECASE).strip()
        # Strip hours/credits/marks markers
        c = re.sub(r'^[0-9]+\s*(hours|hrs|credits|marks)\s*[:\.\-]?\s*', '', c, flags=re.IGNORECASE).strip()
        # Strip introductory boilerplates
        c = re.sub(r'^(overview\s+of|introduction\s+to|basics\s+of|fundamentals\s+of|importance\s+of|concept\s+of|usage\s+of|study\s+of|principles\s+of|syllabus\s+for|syllabus\s+of|detailed\s+syllabus\s+of)\s+', '', c, flags=re.IGNORECASE).strip()
        # Strip leading/trailing numbering, bullets or symbols
        c = re.sub(r'^[0-9\.\*\#\s\(\)\:\-\[\]\>]+', '', c).strip()
        c = re.sub(r'[:\.\-,\;\s\[\]\>]+$', '', c).strip()

        # Remove leading/trailing conjunctions and prepositions
        c = re.sub(r'^(and|or|with|for|in|of|by|to|etc)\s+', '', c, flags=re.IGNORECASE).strip()
        c = re.sub(r'\s+(and|or|with|for|in|of|by|to|etc)$', '', c, flags=re.IGNORECASE).strip()

        if not c or len(c) < 3 or len(c) > 90:
            return ""

        c_low = c.lower().strip()

        # Direct blocklist match
        if c_low in cls.METADATA_STOPWORDS:
            return ""

        # Substring/Regex check for metadata keywords (e.g., "Syllabus Content", "Text Books", "Reference Books")
        if re.search(r'\b(syllabus|curriculum|text\s*books?|reference\s*books?|course\s*outcomes?|course\s*objectives?|prerequisites?|credits?|lecture\s*hours?|edition|isbn|publisher|publishers|publication|author|authors|academic\s*year|regulation)\b', c_low):
            return ""

        # Author / publisher specific checks
        if re.search(r'\b(herbert\s+schildt|balagurusamy|kathy\s+sierra|pearson|mcgraw\s*hill|wiley|prentice\s+hall|oxford|tata\s+mcgraw|deitel)\b', c_low):
            return ""

        # URL / file / page citations
        if c_low.startswith(('http', 'www', 'ftp', 'page', 'vol', 'isbn', 'doi', 'pp.')):
            return ""

        c_name_lower = (course_name or "").lower().strip()
        if c_name_lower and (c_low == c_name_lower or c_low == f"{c_name_lower} syllabus" or c_low == f"{c_name_lower} course"):
            return ""

        # Human-like domain enrichments & standardizations
        if c_low in ["java to the internet", "importance of java to the internet"]:
            return "Java Internet Architecture & Web Capabilities"
        if c_low in ["jdk", "java development kit"]:
            return "Java Development Kit (JDK) & Tools"
        if c_low in ["byte code", "bytecode"]:
            return "JVM Architecture & Bytecode Execution"
        if c_low in ["garbage collection"]:
            return "Garbage Collection & Memory Management"
        if c_low in ["inheritance: basics", "basics", "inheritance basics"]:
            return "Inheritance Hierarchies & Code Reusability"
        if c_low in ["try", "catch", "throw", "throws", "finally", "usage of try", "try and catch"]:
            return "Try, Catch, Throw, Throws and Finally Blocks"
        if "user defined exception" in c_low or "built-in and user defined" in c_low:
            return "Built-in and User-Defined Exceptions"
        if c_low in ["multithreading", "thread model", "java thread model"]:
            return "Java Multithreading & Thread Lifecycle"
        if c_low in ["synchronization", "thread synchronization"]:
            return "Thread Synchronization & Inter-Thread Communication"
        if c_low in ["inter-thread communication", "inter thread communication"]:
            return "Inter-Thread Communication & Thread States"
        if c_low in ["thread priorities"]:
            return "Thread Priorities & CPU Scheduling"
        if c_low in ["exception types", "types of exceptions"]:
            return "Checked and Unchecked Exception Types"
        if c_low in ["list", "set", "map"]:
            return f"{c.capitalize()} Interface & Implementations"

        # Apply Title Case if all lowercase
        if c.islower():
            c = " ".join([w.capitalize() if w.lower() not in ['and', 'of', 'in', 'to', 'for', 'with', 'the', 'a', 'an'] else w.lower() for w in c.split()])
            if c:
                c = c[0].upper() + c[1:]

        return c

    @classmethod
    def get_domain_fallback_concepts(cls, course_name: str) -> Dict[str, List[str]]:
        """
        Provides rich, authentic syllabus topics when extracted document text is sparse or missing.
        """
        c_low = (course_name or '').lower()
        if 'java' in c_low:
            return {
                'Unit 1': ['JVM Architecture & Bytecode Execution', 'Java Environment & JDK Tools', 'Object-Oriented Programming Principles in Java', 'Data Types, Operators & Control Statements'],
                'Unit 2': ['Classes, Objects, Methods & Constructors', 'Inheritance Hierarchies & Dynamic Method Dispatch', 'Packages & Access Protection', 'Interfaces & Multiple Inheritance Semantics'],
                'Unit 3': ['Exception Handling (Try, Catch, Throw, Throws & Finally)', 'Built-in and User-Defined Exceptions', 'Java I/O Streams & Serialization', 'String Handling & Memory Model'],
                'Unit 4': ['Java Multithreading & Thread Lifecycle', 'Thread Synchronization & Inter-Thread Communication', 'Thread Priorities & Daemon Threads', 'Deadlock Detection and Prevention'],
                'Unit 5': ['Java Collections Framework (List, Set, Map)', 'Generics & Type Safety', 'Event Handling & GUI Components', 'Lambda Expressions & Stream API']
            }
        elif 'python' in c_low:
            return {
                'Unit 1': ['Python Syntax, Data Types & Control Structures', 'Functions, Scoping & Lambda Expressions', 'List Comprehensions & Built-in Modules'],
                'Unit 2': ['Object-Oriented Programming (Classes & Inheritance)', 'Dunder Methods & Operator Overloading', 'Modules & Package Architecture'],
                'Unit 3': ['Exception Handling & Custom Exceptions', 'File I/O Operations & Context Managers', 'Iterators, Generators & Decorators'],
                'Unit 4': ['Data Structures (Lists, Tuples, Dicts, Sets)', 'NumPy Arrays & Vectorized Computations', 'Pandas Series & DataFrames'],
                'Unit 5': ['Multithreading & Multiprocessing in Python', 'Socket Programming & Web APIs', 'Unit Testing & Code Optimization']
            }
        elif 'data structure' in c_low or 'dsa' in c_low:
            return {
                'Unit 1': ['Asymptotic Notation & Complexity Analysis', 'Arrays, Stacks & Queue Implementations', 'Applications of Stacks (Infix to Postfix)'],
                'Unit 2': ['Singly, Doubly and Circular Linked Lists', 'Binary Trees & Binary Search Trees (BST)', 'Tree Traversals (Inorder, Preorder, Postorder)'],
                'Unit 3': ['Balanced Trees (AVL & Red-Black Trees)', 'B-Trees & B+ Trees', 'Priority Queues & Binary Heaps'],
                'Unit 4': ['Graph Representations (Adjacency Matrix & List)', 'Graph Traversals (BFS & DFS)', 'Shortest Path Algorithms (Dijkstra & Bellman-Ford)'],
                'Unit 5': ['Hashing Techniques & Collision Resolution', 'Sorting Algorithms (Quick, Merge, Heap Sort)', 'Disjoint Set Data Structures']
            }
        elif 'database' in c_low or 'dbms' in c_low or 'sql' in c_low:
            return {
                'Unit 1': ['Database System Architecture & Data Independence', 'Entity-Relationship (ER) Modeling', 'Relational Data Model & Relational Algebra'],
                'Unit 2': ['SQL DDL, DML & Complex Queries', 'Joins, Subqueries & Aggregate Functions', 'Integrity Constraints & Triggers'],
                'Unit 3': ['Functional Dependencies & Normalization (1NF, 2NF, 3NF, BCNF)', 'Multi-valued Dependencies (4NF)', 'Database Schema Refinement'],
                'Unit 4': ['Transaction Management & ACID Properties', 'Concurrency Control & Two-Phase Locking', 'Deadlock Detection & Prevention in Databases'],
                'Unit 5': ['Indexing Techniques (B+ Trees & Hashing)', 'Query Processing & Optimization', 'Database Crash Recovery & Logging']
            }
        elif 'operating system' in c_low or 'os' in c_low:
            return {
                'Unit 1': ['Operating System Architecture & System Calls', 'Process Management, PCB & Context Switching', 'Inter-Process Communication (IPC)'],
                'Unit 2': ['CPU Scheduling Algorithms & Metrics', 'Process Synchronization & Critical Section Problem', 'Semaphores & Monitors'],
                'Unit 3': ['Deadlock Characterization, Prevention & Banker\'s Algorithm', 'Memory Management, Paging & Segmentation'],
                'Unit 4': ['Virtual Memory, Demand Paging & Page Replacement Algorithms', 'File System Architecture & Directory Structures'],
                'Unit 5': ['Disk Scheduling Algorithms & I/O Systems', 'System Protection, Security & Access Matrix']
            }
        elif 'network' in c_low:
            return {
                'Unit 1': ['OSI and TCP/IP Reference Models', 'Physical Layer & Transmission Media', 'Data Link Layer & Framing Techniques'],
                'Unit 2': ['Error Detection & Correction (CRC, Hamming Code)', 'Flow Control Protocols (Sliding Window, Go-Back-N)', 'Medium Access Control (CSMA/CD, CSMA/CA)'],
                'Unit 3': ['Network Layer & IP Addressing (IPv4, IPv6, Subnetting)', 'Routing Algorithms (Distance Vector, Link State, OSPF, BGP)'],
                'Unit 4': ['Transport Layer Protocols (TCP vs UDP)', 'TCP Congestion Control & Flow Control Mechanics', 'Socket Programming'],
                'Unit 5': ['Application Layer Protocols (HTTP, DNS, SMTP, FTP)', 'Network Security, Cryptography & Firewalls']
            }
        else:
            return {
                'Unit 1': [f'{course_name} Theoretical Foundations', f'{course_name} Core Principles', f'{course_name} Structural Architecture'],
                'Unit 2': [f'{course_name} Primary Constructs & Components', f'{course_name} Implementation Patterns', f'{course_name} Design Models'],
                'Unit 3': [f'{course_name} Advanced Operational Mechanics', f'{course_name} State Management', f'{course_name} Error Handling'],
                'Unit 4': [f'{course_name} Performance Optimization', f'{course_name} Integration & System Behavior', f'{course_name} Concurrency Protocols'],
                'Unit 5': [f'{course_name} Scalable Architectures', f'{course_name} Evaluation Metrics', f'{course_name} Practical Engineering Solutions']
            }

    @classmethod
    def extract_unit_concepts(cls, text: str, course_name: str = "") -> Dict[str, List[str]]:
        """
        Parses document text into 5 Unit/Module buckets with pristine, grammatically sound technical topics.
        Intelligently strips Unit prefixes, skips headers/references/CO boilerplate, and ignores metadata words.
        """
        cleaned = cls.clean_text(text)
        unit_buckets = {
            'Unit 1': [],
            'Unit 2': [],
            'Unit 3': [],
            'Unit 4': [],
            'Unit 5': []
        }

        domain_defaults = cls.get_domain_fallback_concepts(course_name)

        if not cleaned:
            return domain_defaults

        lines = cleaned.split('\n')
        current_unit_key = 'Unit 1'
        roman_map = {'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5', 'vi': '1'}
        in_co_or_ref_section = False

        for line in lines:
            line_str = line.strip()
            if not line_str or len(line_str) < 3:
                continue

            # Check if entering Course Outcomes, Text Books, References, Objectives, Evaluation, etc.
            if re.search(r'^(course\s+outcomes?|course\s+objectives?|learning\s+outcomes?|text\s*books?|references?|prescribed\s+books?|recommended\s+books?|prerequisites?|scheme\s+of|evaluation|assessment|grading)', line_str, re.IGNORECASE):
                in_co_or_ref_section = True
                continue

            # Check for Unit/Module header
            unit_match = re.search(r'^(unit|module|chapter|part)\s*[-–—:\s]*([0-9]+|[IVXLCDMivxlcdm]+)[:\.\-\s]*(.*)', line_str, re.IGNORECASE)
            if unit_match:
                in_co_or_ref_section = False
                raw_num = unit_match.group(2).lower()
                mapped_num = roman_map.get(raw_num, raw_num if raw_num in ['1', '2', '3', '4', '5'] else '1')
                current_unit_key = f"Unit {mapped_num}"
                # Process the remainder of the line after the Unit prefix
                line_str = unit_match.group(3).strip()
                if not line_str:
                    continue

            if in_co_or_ref_section:
                continue

            # Skip standalone Syllabus / Course Structure / Meta headers
            if re.match(r'^(detailed\s+)?syllabus\s*[:\.\-]?\s*$', line_str, re.IGNORECASE) or re.match(r'^course\s+(content|structure|syllabus)\s*[:\.\-]?\s*$', line_str, re.IGNORECASE):
                continue

            if re.search(r'^(syllabus|curriculum|credits|hours|marks|l-t-p-c|ltpc|semester|academic\s+year|regulation|cie|see)', line_str, re.IGNORECASE):
                continue
            if re.search(r'^[0-9]+\s*(hours|hrs|credits|marks|syllabus)', line_str, re.IGNORECASE):
                continue
            if re.search(r'^(co\s*[0-9]|outcome\s*[0-9]|po\s*[0-9]|unit\s*[0-9]+\s*:?\s*$)', line_str, re.IGNORECASE):
                continue

            # First split line on major sentence/paragraph boundaries (period followed by space and capital letter or digit)
            sentence_parts = re.split(r'\.\s+(?=[A-Z0-9])', line_str)
            for sent in sentence_parts:
                sent_clean = sent.strip()
                if not sent_clean:
                    continue

                # Check if sentence has colon (Category: Subtopics)
                if ':' in sent_clean:
                    colon_parts = sent_clean.split(':', 1)
                    cat_header = colon_parts[0].strip()
                    rest = colon_parts[1].strip()
                    
                    clean_cat = cls.clean_concept_name(cat_header, course_name)
                    if clean_cat and len(clean_cat) >= 4 and clean_cat not in unit_buckets[current_unit_key]:
                        unit_buckets[current_unit_key].append(clean_cat)

                    sub_parts = re.split(r'[,;•\t]\s*', rest)
                    for sp in sub_parts:
                        cleaned_sp = cls.clean_concept_name(sp, course_name)
                        if cleaned_sp and len(cleaned_sp) >= 3 and cleaned_sp not in unit_buckets[current_unit_key]:
                            unit_buckets[current_unit_key].append(cleaned_sp)
                else:
                    sub_parts = re.split(r'[,;•\t]\s*', sent_clean)
                    for sp in sub_parts:
                        cleaned_sp = cls.clean_concept_name(sp, course_name)
                        if cleaned_sp and len(cleaned_sp) >= 3 and cleaned_sp not in unit_buckets[current_unit_key]:
                            unit_buckets[current_unit_key].append(cleaned_sp)

        # Fallback distribution if some units are empty
        for key in unit_buckets.keys():
            if not unit_buckets[key]:
                unit_buckets[key] = domain_defaults.get(key, domain_defaults.get('Unit 1', ['Core Principles', 'Architectural Models']))

        return unit_buckets

    @classmethod
    def get_bloom_verbs(cls, bloom_name: str) -> List[str]:
        if not bloom_name:
            return ['Explain', 'Analyze', 'Describe', 'Formulate']
        b_str = str(bloom_name).strip()
        if b_str in cls.BLOOM_ACTION_VERBS:
            return cls.BLOOM_ACTION_VERBS[b_str]
        b_lower = b_str.lower()
        for key, verbs in cls.BLOOM_ACTION_VERBS.items():
            if key.lower() in b_lower:
                return verbs
        return ['Explain', 'Analyze', 'Describe', 'Formulate']

    @classmethod
    def generate_rag_grounded_candidate_pool(
        cls,
        course_name: str,
        document_text: str,
        blooms_list: List[str],
        user_outcomes: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Synthesizes categorized candidate pools strictly aligned with Course Outcomes (COs) and Syllabus:
          - 'Short Answer' (concise, direct 2M/4M questions with rich human phrasing)
          - 'Long Answer' (comprehensive analytical questions with dynamic mark splitting & diverse pair structures)
          - 'MCQ' (multiple choice questions with 4 distinct options)
        """
        unit_concepts = cls.extract_unit_concepts(document_text, course_name)
        
        pools = {
            'Short Answer': [],
            'Long Answer': [],
            'MCQ': [],
            'Numerical': []
        }

        # Build CO-to-Unit list from user outcomes if provided, or default CO1-CO5
        co_list = []
        if user_outcomes and len(user_outcomes) > 0:
            for idx, uco in enumerate(user_outcomes):
                co_id = uco.get('id') or f"CO{idx + 1}"
                co_desc = uco.get('description') or f"Course Outcome {co_id}"
                co_unit = uco.get('unit') or f"Unit {min(5, (idx % 5) + 1)}"
                co_bloom = uco.get('bloom_level')
                co_list.append({
                    'id': co_id,
                    'description': co_desc,
                    'unit': co_unit,
                    'bloom_level': co_bloom
                })
        else:
            co_list = [
                {'id': 'CO1', 'description': 'Understand core principles and foundational architectures', 'unit': 'Unit 1', 'bloom_level': 'Remember'},
                {'id': 'CO2', 'description': 'Apply fundamental concepts and algorithmic paradigms', 'unit': 'Unit 2', 'bloom_level': 'Understand'},
                {'id': 'CO3', 'description': 'Analyze component interactions and design trade-offs', 'unit': 'Unit 3', 'bloom_level': 'Apply'},
                {'id': 'CO4', 'description': 'Evaluate system models, error handling, and performance', 'unit': 'Unit 4', 'bloom_level': 'Analyze'},
                {'id': 'CO5', 'description': 'Design modular solutions for complex technical specifications', 'unit': 'Unit 5', 'bloom_level': 'Evaluate'}
            ]

        for u_idx, co_info in enumerate(co_list):
            co_id = co_info['id']
            co_desc = co_info['description']
            unit_key = co_info['unit']
            
            # Retrieve concepts for this unit
            concepts = unit_concepts.get(unit_key, [])
            if not concepts:
                # Fallback to general concepts
                concepts = [f"{course_name} Fundamentals", f"{course_name} Practical Applications"]

            co_blooms = cls.CO_BLOOM_MAP.get(co_id, blooms_list)
            if co_info.get('bloom_level') and co_info['bloom_level'] in cls.BLOOM_ACTION_VERBS:
                co_blooms = [co_info['bloom_level']] + co_blooms

            for i in range(len(concepts)):
                t1 = concepts[i]
                t2 = concepts[(i + 1) % len(concepts)]
                t3 = concepts[(i + 2) % len(concepts)]
                t4 = concepts[(i + 3) % len(concepts)]

                bloom = co_blooms[i % len(co_blooms)]
                diff = 'Easy' if i % 3 == 0 else ('Medium' if i % 3 == 1 else 'Hard')

                # 1. Short Answer Candidate
                sa_pattern_idx = (u_idx * 3 + i) % len(cls.SHORT_ANSWER_PATTERNS)
                sa_fn = cls.SHORT_ANSWER_PATTERNS[sa_pattern_idx]
                sa_text = sa_fn(t1, t2, course_name)

                pools['Short Answer'].append({
                    'pattern_id': sa_pattern_idx,
                    'question_template': sa_text,
                    'type': 'Short Answer',
                    'unit': unit_key,
                    'co': co_id,
                    'co_description': co_desc,
                    'bloom_level': bloom,
                    'difficulty': diff,
                    'topic': t1,
                    'grounded': True
                })

                # 2. MCQ Candidate
                mcq_text = (
                    f"Which of the following statements accurately characterizes {t1} in {course_name}?\n"
                    f"A) It establishes foundational bounds and operational semantics for {t1}.\n"
                    f"B) It overrides runtime state constraints without preserving encapsulation.\n"
                    f"C) It provides modular optimization to minimize memory and execution overhead.\n"
                    f"D) It eliminates dependency resolution across concurrent execution pipelines."
                )
                pools['MCQ'].append({
                    'pattern_id': i % 4,
                    'question_template': mcq_text,
                    'type': 'MCQ',
                    'unit': unit_key,
                    'co': co_id,
                    'co_description': co_desc,
                    'bloom_level': bloom,
                    'difficulty': diff,
                    'topic': t1,
                    'grounded': True
                })

                # 3. Long Answer Candidate
                la_pattern_idx = (u_idx * 2 + i) % len(cls.LONG_ANSWER_PATTERNS)
                p_sub_fn, p_or_fn, p_single_fn = cls.LONG_ANSWER_PATTERNS[la_pattern_idx]

                la_single = p_single_fn(t1, t2)
                la_sub = p_sub_fn(t1, t2, t3, t4)
                la_choice = f"{p_sub_fn(t1, t2, t3, t4)}\n\n                                    [OR]\n\n{p_or_fn(t1, t2, t3, t4)}"

                pools['Long Answer'].append({
                    'pattern_id': la_pattern_idx,
                    'single_template': la_single,
                    'sub_template': la_sub,
                    'choice_template': la_choice,
                    'type': 'Long Answer',
                    'unit': unit_key,
                    'co': co_id,
                    'co_description': co_desc,
                    'bloom_level': bloom,
                    'difficulty': diff,
                    'topic': f"{t1}",
                    'grounded': True
                })

        return pools

    @classmethod
    def extract_keywords(cls, text: str, max_keywords: int = 12) -> List[str]:
        stopwords = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'with', 'for', 'of',
            'to', 'from', 'by', 'as', 'it', 'its', 'be', 'are', 'this', 'that', 'these', 'those',
            'can', 'all', 'any', 'each', 'such', 'into', 'than', 'then', 'has', 'have', 'had',
            'will', 'would', 'should', 'could', 'course', 'syllabus', 'hours', 'credits', 'unit',
            'module', 'topics', 'outcome', 'outcomes', 'marks', 'paper', 'exam', 'examination'
        }
        words = re.findall(r'\b[a-zA-Z]{3,25}\b', text.lower())
        word_freq = {}
        for w in words:
            if w not in stopwords:
                word_freq[w] = word_freq.get(w, 0) + 1
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [w[0] for w in sorted_words[:max_keywords]]

    @classmethod
    def compute_similarity(cls, query: str, chunk_text: str) -> float:
        query_words = set(re.findall(r'\b[a-zA-Z]{3,25}\b', query.lower()))
        chunk_words = re.findall(r'\b[a-zA-Z]{3,25}\b', chunk_text.lower())
        if not query_words or not chunk_words:
            return 0.0
        chunk_freq = {}
        for w in chunk_words:
            chunk_freq[w] = chunk_freq.get(w, 0) + 1
        score = 0.0
        for qw in query_words:
            if qw in chunk_freq:
                score += 1.0 + math.log(chunk_freq[qw])
        norm = math.sqrt(len(chunk_words))
        return score / max(1.0, norm)

    @classmethod
    def retrieve_relevant_chunks(
        cls,
        chunks: List[Dict[str, Any]],
        query: str,
        target_unit: str = None,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        if not chunks:
            return []
        scored_chunks = []
        for ch in chunks:
            sim_score = cls.compute_similarity(query, ch['text'])
            if target_unit and target_unit.lower() in ch.get('unit', '').lower():
                sim_score *= 1.5
            query_lower = query.lower()
            keyword_matches = sum(1 for kw in ch.get('keywords', []) if kw in query_lower)
            sim_score += (keyword_matches * 0.2)
            scored_chunks.append((sim_score, ch))
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored_chunks[:top_k]]

    @staticmethod
    def calculate_jaccard_similarity(text1: str, text2: str) -> float:
        words1 = set(re.findall(r'\b[a-zA-Z]{3,}\b', text1.lower()))
        words2 = set(re.findall(r'\b[a-zA-Z]{3,}\b', text2.lower()))
        if not words1 or not words2:
            return 0.0
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        return intersection / max(1, union)

    @classmethod
    def deduplicate_questions(cls, questions: List[Dict[str, Any]], threshold: float = 0.70) -> List[Dict[str, Any]]:
        unique_questions = []
        for q in questions:
            q_text = q.get('question', '')
            is_duplicate = False
            for uq in unique_questions:
                sim = cls.calculate_jaccard_similarity(q_text, uq.get('question', ''))
                if sim >= threshold:
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_questions.append(q)
        return unique_questions
