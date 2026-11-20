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
        'CO1': ['Understand', 'Apply'],
        'CO2': ['Understand', 'Apply'],
        'CO3': ['Apply', 'Analyze'],
        'CO4': ['Analyze', 'Evaluate'],
        'CO5': ['Evaluate', 'Create'],
        'CO6': ['Evaluate', 'Create']
    }

    @classmethod
    def split_respecting_parentheses(cls, text: str) -> List[str]:
        """
        Splits text on commas, semicolons, and bullets without breaking parenthetical groups like (a, b, c).
        """
        if not text:
            return []
        parts = []
        current = []
        depth = 0
        for char in text:
            if char in '([{':
                depth += 1
                current.append(char)
            elif char in ')]}':
                if depth > 0:
                    depth -= 1
                current.append(char)
            elif char in [',', ';', '•', '\n'] and depth == 0:
                p = "".join(current).strip()
                if p:
                    parts.append(p)
                current = []
            else:
                current.append(char)
        if current:
            p = "".join(current).strip()
            if p:
                parts.append(p)
        return parts

    @classmethod
    def normalize_topic_for_question(cls, topic: str) -> str:
        """
        Cleans topic phrasing so it fits naturally into academic question sentences.
        Strips noise, fixes unbalanced parentheses, and standardizes syllabus terms.
        """
        if not topic:
            return "the specified topic"
        t = topic.strip()

        # Strip leading/trailing numbering, bullets or symbols
        t = re.sub(r'^[0-9\.\*\#\s\(\)\:\-\[\]\>•]+', '', t).strip()
        t = re.sub(r'[:\.\-,\;\s\[\]\>\(\)•]+$', '', t).strip()

        # Fix unbalanced parentheses (e.g. "Iteration)" or "Examples (sequence")
        if t.count('(') > t.count(')'):
            t = re.sub(r'\s*\([^)]*$', '', t).strip()
        elif t.count(')') > t.count('('):
            t = re.sub(r'^[^()]*\)\s*', '', t).strip()

        if not t:
            return "the specified topic"

        tl = t.lower()

        # Dedicated topic normalizers for academic syllabus topics
        if tl in ["hardware and software", "computer hardware and software", "hardware & software"]:
            return "Computer hardware and software"
        if tl in ["keywords", "keyword"]:
            return "Keywords"
        if tl in ["algorithms", "algorithm"]:
            return "Algorithms"
        if tl in ["pseudocode"]:
            return "Pseudocode"
        if tl in ["symbols", "flowchart symbols"]:
            return "Flowchart symbols"
        if tl in ["desk checking", "desk-checking"]:
            return "Desk-checking"
        if tl in ["phases of problem solving", "problem solving phases"]:
            return "Phases of Problem Solving"
        if tl in ["decision", "decision making"]:
            return "Decision-making statements"
        if tl in ["rules"]:
            return "Syntax rules and precedence conventions"
        if tl in ["iteration", "looping", "iteration structures"]:
            return "Iterative control structures (loops)"
        if tl in ["arithmetic", "arithmetic operators"]:
            return "Arithmetic operators and expressions"
        if tl in ["variables", "variable"]:
            return "Variables and data types"
        if tl in ["null and generic pointers", "null and void pointers"]:
            return "NULL and generic (void) pointers"
        if tl in ["categories of functions", "categories of function"]:
            return "Categories of Functions"
        if tl in ["self-referential structures", "self referential structures"]:
            return "Self-referential Structures"
        if tl in ["typedef"]:
            return "the 'typedef' keyword"
        if tl in ["testing", "program testing"]:
            return "Program Testing and Debugging"
        if tl in ["evolution of programming languages and translators", "evolution of programming languages & translators"]:
            return "Evolution of Programming Languages and Translators"
        if tl.startswith("examples (sequence"):
            return "Control structures (Sequence, Selection, and Iteration)"

        # Handle 'Using XYZ'
        if tl.startswith("using "):
            keyword = t[6:].strip()
            if keyword.lower() in ['super', 'this', 'final', 'finally', 'static', 'throws', 'throw']:
                return f"the '{keyword}' keyword"
            return f"the usage of {keyword}"

        # Handle 'Throws and Finally' or similar keyword pairs
        if "throws and finally" in tl or "throw and throws" in tl:
            return "the 'throws' and 'finally' keywords in exception handling"
        if "try and catch" in tl or "try catch" in tl:
            return "try-catch blocks in exception handling"

        # Handle 'Definition and Characteristics of ...'
        if tl.startswith("definition and characteristics of "):
            return t[34:].strip()

        # Handle '... Representation Techniques'
        if tl.endswith(" representation techniques"):
            return "algorithmic representation techniques (flowcharts and pseudocode)"

        # Handle 'Life Cycle of XYZ'
        if tl.startswith("life cycle of "):
            return f"the {t}"

        # Handle 'Architecture & Web Capabilities'
        if "java internet architecture" in tl:
            return "Java Internet Architecture and its web capabilities"

        return t

    @classmethod
    def classify_topic_semantic_type(cls, topic: str) -> str:
        """
        Classifies a syllabus topic into its core semantic category to ensure
        appropriate academic question phrasing aligned with Bloom's Taxonomy.
        """
        if not topic:
            return "GENERAL_TECHNICAL"
        tl = topic.lower().strip()

        # 1. Problem Solving & Algorithms
        if any(w in tl for w in ["problem solving", "phases of problem solving", "desk checking", "desk-checking", "trace table"]):
            return "PROBLEM_SOLVING"
        if any(w in tl for w in ["pseudocode", "flowchart", "symbols", "representation technique"]):
            return "ALGORITHMS_REPRESENTATION"
        if tl in ["algorithm", "algorithms"] or any(w in tl for w in ["definition of algorithm", "characteristics of algorithm"]):
            return "ALGORITHMS_REPRESENTATION"

        # 2. Programming Fundamentals & Hardware/Software/Translators
        if any(w in tl for w in ["hardware and software", "hardware", "software", "translator", "compiler", "interpreter", "assembler", "evolution of programming"]):
            return "COMPUTER_FUNDAMENTALS"
        if any(w in tl for w in ["keyword", "token", "variable", "identifier", "constant", "data type", "datatype"]):
            return "LANGUAGE_FUNDAMENTALS"
        if any(w in tl for w in ["arithmetic", "operator", "expression", "precedence", "associativity"]):
            return "OPERATORS_EXPRESSIONS"

        # 3. Control Structures
        if any(w in tl for w in ["decision", "selection", "rules", "if-else", "switch", "iteration", "loop", "while", "do-while", "for loop", "sequence"]):
            return "CONTROL_STRUCTURES"

        # 4. Modularity & Functions
        if any(w in tl for w in ["categories of function", "function", "recursion", "recursive", "parameter passing", "call by value", "call by reference"]):
            return "FUNCTIONS_MODULARITY"

        # 5. User-Defined Types
        if any(w in tl for w in ["self-referential", "typedef", "structure", "union", "enum"]):
            return "USER_DEFINED_TYPES"

        # 6. Pointers & Memory
        if any(w in tl for w in ["pointer", "null pointer", "generic pointer", "void pointer", "malloc", "dynamic memory"]):
            return "POINTERS_MEMORY"

        # 7. Software Testing
        if any(w in tl for w in ["testing", "debugging", "verification", "validation", "test case"]):
            return "SOFTWARE_TESTING"

        # 8. Web & Frameworks
        if tl.startswith("definition and characteristics of"):
            return "DEFINITION_CHARACTERISTICS"
        if tl.endswith("representation techniques"):
            return "REPRESENTATION"
        if any(w in tl for w in ["asymptotic", "big o", "omega", "theta", "time complexity", "space complexity"]):
            return "ASYMPTOTIC_NOTATIONS"
        if any(w in tl for w in ["applet", "life cycle of an applet", "awt", "swing", "event handling", "delegation event", "actionlistener", "layout manager"]):
            return "APPLET_GUI"
        if any(w in tl for w in ["jdbc", "hibernate", "spring framework", "spring", "orm", "database connectivity", "preparedstatement", "resultset", "database driver", "jdbc driver"]):
            return "DATABASE_CONNECTIVITY"
        if any(w in tl for w in ["throws and finally", "throw and throws", "try catch", "exception handling", "checked exception", "unchecked exception", "user defined exception", "exception", "throw", "throws"]):
            return "EXCEPTION_HANDLING"
        if any(w in tl for w in ["using super", "super keyword", "this keyword", "final keyword", "static keyword", "access specifier", "access modifier", "packages and interfaces", "garbage collection", "jvm architecture", "bytecode"]):
            return "LANGUAGE_KEYWORDS"
        if any(w in tl for w in ["multithreading", "thread lifecycle", "thread", "synchronization", "concurrency", "inter-thread", "runnable", "blocking a thread"]):
            return "MULTITHREADING"
        if any(w in tl for w in ["object oriented", "oop", "encapsulation", "inheritance", "polymorphism", "abstraction", "overloading", "overriding", "abstract class", "interfaces", "class", "classes", "method", "methods", "constructor", "multidimensional array", "array", "matrix addition", "student details", "package"]):
            return "OOP_CONCEPTS"
        if any(w in tl for w in ["collections framework", "arraylist", "hashmap", "linkedlist", "stack", "queue", "binary tree", "bst", "heap", "graph", "trie"]):
            return "COLLECTIONS_DATA_STRUCT"
        if any(w in tl for w in ["divide and conquer", "binary search", "merge sort", "quick sort", "sorting", "searching", "greedy", "dynamic programming", "backtracking", "branch and bound"]):
            return "ALGORITHMS_DESIGN"
        if any(w in tl for w in ["relational data", "relational model", "data model", "entity relationship", "er model", "erd", "normalization", "normal form", "functional dependency", "relational algebra", "integrity constraint", "schema design"]):
            return "RELATIONAL_DATA_MODELING"
        if any(w in tl for w in ["crud", "query and update", "operators", "commands & shell", "collection management"]):
            return "DATABASE_CRUD"
        if any(w in tl for w in ["transaction", "acid", "constraint", "trigger", "stored procedure", "privilege", "auto increment", "concurrency control", "deadlock"]):
            return "DATABASE_TRANSACTIONS"
        if any(w in tl for w in ["session", "cookie", "state tracking"]):
            return "STATE_MANAGEMENT"
        if any(w in tl for w in ["request methods", "response status", "json", "web requests", "message headers"]):
            return "WEB_REQUESTS_HTTP"
        if any(w in tl for w in ["gateway", "cgi", "web database", "client-side and server-side", "database-independent apis", "native database apis", "template-driven", "web server", "application tier", "connection pool", "java internet architecture"]):
            return "WEB_DATABASE_ARCH"
        if any(w in tl for w in ["nosql", "rdbms", "cassandra", "mongodb", "graphql", "relational database", "mysql and sqlite", "challenges of structured", "challenges of unstructured"]):
            return "DATABASE_COMPARISON"
        return "GENERAL_TECHNICAL"

    @classmethod
    def generate_semantic_short_answer(
        cls,
        t1: str,
        t2: str = "",
        course_name: str = "",
        bloom_level: str = "Understand",
        pattern_idx: int = 0
    ) -> str:
        """
        Generates authentic, diverse short-answer questions strictly aligned with
        the designated Bloom's Taxonomy cognitive level and topic semantic type.
        """
        st1 = cls.classify_topic_semantic_type(t1)
        norm_t1 = cls.normalize_topic_for_question(t1)
        norm_t2 = cls.normalize_topic_for_question(t2) if t2 else "alternative techniques"
        bn = (bloom_level or 'Understand').capitalize()

        # 1. Specialized Questions for Specific Technical Types
        if st1 == "COMPUTER_FUNDAMENTALS":
            if bn == "Remember":
                variants = [
                    "Define computer hardware and software. Differentiate between system and application software.",
                    "What is a language translator? Differentiate between a compiler and an interpreter.",
                    "State the primary role of an assembler in converting assembly language to machine code.",
                    "List the major generational milestones in the evolution of programming languages.",
                    f"State the primary function and significance of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain the difference between compiled and interpreted execution models with examples.",
                    "Describe the stages involved in executing a high-level program on hardware.",
                    f"Explain the foundational role and operational significance of {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "LANGUAGE_FUNDAMENTALS":
            if bn == "Remember":
                variants = [
                    "What are keywords in programming? State any two examples.",
                    "Define an identifier. State two valid rules for naming identifiers.",
                    "Differentiate between a variable and a constant with suitable examples.",
                    "List the primary fundamental data types available in programming.",
                    f"State the syntax rules and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain the role of data types in memory allocation and program correctness.",
                    "Describe the difference between variable declaration and variable initialization.",
                    f"Explain the significance and practical application of {norm_t1} with an example."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "ALGORITHMS_REPRESENTATION":
            if bn == "Remember":
                variants = [
                    "Define an Algorithm. State any two essential characteristics of a good algorithm.",
                    "What is Pseudocode? State its primary advantages over flowcharts.",
                    "Draw the standard flowchart symbols used for Decision and Input/Output.",
                    "List the common techniques used to represent algorithms.",
                    f"State the essential characteristics and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain the advantages of using flowcharts in algorithm design.",
                    "Differentiate between an Algorithm and Pseudocode with an example.",
                    f"Explain how {norm_t1} is utilized in structured program design."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "PROBLEM_SOLVING":
            if bn == "Remember":
                variants = [
                    "List the primary phases involved in the problem solving process on a computer.",
                    "What is desk-checking? Why is it performed before coding an algorithm?",
                    "Define problem analysis and algorithm specification in problem solving.",
                    f"State the primary objective and importance of {norm_t1}."
                ]
            else:
                variants = [
                    "Describe the role of desk-checking in identifying logical errors in algorithms.",
                    "Explain the significance of the problem definition phase in software development.",
                    f"Explain the systematic methodology and practical significance of {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "CONTROL_STRUCTURES":
            if bn == "Remember":
                variants = [
                    "What are decision-making statements in programming? Give an example.",
                    "Give the general syntax of a switch-case statement.",
                    "Differentiate between entry-controlled (while) and exit-controlled (do-while) loops.",
                    "State the purpose of break and continue statements in loops.",
                    f"State the syntax and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Differentiate between while and do-while loops with suitable examples.",
                    "Explain how nested if-else structures work in complex decision making.",
                    f"Explain the control flow and operational mechanism of {norm_t1} with an illustration."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "FUNCTIONS_MODULARITY":
            if bn == "Remember":
                variants = [
                    "Define a function prototype. Why is it necessary in modular programming?",
                    "Differentiate between actual parameters and formal parameters with an example.",
                    "What is recursion? State the essential base condition for a recursive function.",
                    "List the four categories of functions based on arguments and return values.",
                    f"State the declaration syntax and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain call by value and call by reference parameter passing mechanisms.",
                    "Describe the difference between iterative and recursive execution models.",
                    f"Explain the working mechanism and advantages of {norm_t1} with an example."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "USER_DEFINED_TYPES":
            if bn == "Remember":
                variants = [
                    "Define a Structure. How does it differ syntactically from an Array?",
                    "What is a self-referential structure? Give an illustrative example.",
                    "What is the purpose of the typedef keyword in programming?",
                    "Differentiate between a Structure and a Union.",
                    f"State the definition syntax and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain how memory is allocated for a structure compared to a union.",
                    "Illustrate how typedef simplifies complex type declarations with an example.",
                    f"Explain the memory layout and operational significance of {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "POINTERS_MEMORY":
            if bn == "Remember":
                variants = [
                    "What is a NULL pointer? How is it different from an uninitialized pointer?",
                    "Define a generic (void) pointer. What is its primary advantage?",
                    "State the purpose of the address-of (&) and dereference (*) operators in pointers.",
                    "What is dynamic memory allocation? Name any two functions used for it.",
                    f"State the declaration syntax and purpose of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain how pointer arithmetic differs from standard arithmetic with an example.",
                    "Differentiate between a NULL pointer and a void pointer with suitable code.",
                    f"Explain the memory addressing mechanism and usage of {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "OPERATORS_EXPRESSIONS":
            if bn == "Remember":
                variants = [
                    "List the various types of arithmetic operators available in programming.",
                    "Define operator precedence and associativity with an example.",
                    "What is implicit type conversion (type promotion) in arithmetic expressions?",
                    f"State the purpose and syntax of {norm_t1}."
                ]
            else:
                variants = [
                    "Explain how relational and logical operators are evaluated in conditional expressions.",
                    "Illustrate operator precedence with an example evaluation of an expression.",
                    f"Explain the evaluation rules and operational mechanics of {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "SOFTWARE_TESTING":
            if bn == "Remember":
                variants = [
                    "What is the primary difference between testing and debugging?",
                    "Define a test case. What are its essential components?",
                    "List the major levels of software testing.",
                    f"State the primary goal and importance of {norm_t1}."
                ]
            else:
                variants = [
                    "Differentiate between black-box testing and white-box testing.",
                    "Explain the role of boundary value analysis in test case design.",
                    f"Explain the workflow and significance of {norm_t1} in software quality assurance."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "LANGUAGE_KEYWORDS":
            if bn == "Remember":
                variants = [
                    "Identify the keyword in Java that refers to the current object.",
                    "State the purpose of the 'super' keyword in Java.",
                    "State the purpose of the 'final' keyword when applied to a variable, method, and class.",
                    "Define a static method and explain how it is called without creating an instance.",
                    "List the access specifiers available in Java in order of visibility.",
                    f"State the primary syntax and purpose of {norm_t1}."
                ]
            elif bn == "Understand":
                variants = [
                    "Illustrate the advantage of using the super keyword in Java.",
                    "Explain the use of the final keyword in Java.",
                    "Differentiate between the 'this' and 'super' keywords in Java with suitable examples.",
                    "Explain the significance of the JVM and bytecode execution in platform independence.",
                    f"Explain the working mechanism and usage of {norm_t1} with a suitable code example."
                ]
            elif bn == "Apply":
                variants = [
                    "Write a code snippet showing how to invoke a superclass constructor using the super keyword.",
                    "Demonstrate how a final method prevents overriding in a subclass with a code example.",
                    f"Write a short code snippet demonstrating how {norm_t1} is utilized in practice."
                ]
            elif bn == "Analyze":
                variants = [
                    "Differentiate between the usage of 'final', 'finally', and 'finalize' in Java.",
                    "Analyze what happens if the super() constructor call is not placed on the first line of a subclass constructor.",
                    f"Differentiate between the usage of {norm_t1} and its counterparts with illustrative examples."
                ]
            elif bn == "Evaluate":
                variants = [
                    "Evaluate why Java does not support operator overloading while allowing method overloading.",
                    "Assess the architectural significance of using access specifiers for encapsulation."
                ]
            else:  # Create
                variants = [
                    f"Design a modular class hierarchy demonstrating the effective application of {norm_t1}.",
                    f"Formulate a code pattern utilizing {norm_t1} to achieve clean architectural reuse."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "EXCEPTION_HANDLING":
            if bn == "Remember":
                variants = [
                    "What is the main benefit of exception handling in Java?",
                    "Differentiate the keywords throw and throws.",
                    "What is the difference between checked and unchecked exceptions in Java?",
                    "State the purpose of the finally block in Java exception handling.",
                    f"State the syntax and purpose of {norm_t1}."
                ]
            elif bn == "Understand":
                variants = [
                    "Explain the execution flow of try, catch, and finally blocks when an exception occurs.",
                    "Illustrate a user-defined exception in Java with an example.",
                    "Explain why runtime exceptions do not require mandatory try-catch blocks.",
                    f"Describe how exception propagation works along the call stack in {norm_t1}."
                ]
            elif bn == "Apply":
                variants = [
                    "Write a short program demonstrating how to create and throw a custom user-defined exception.",
                    "Demonstrate how multiple catch blocks are ordered to handle specific and general exceptions.",
                    f"Write a short program demonstrating how {norm_t1} handles an unexpected runtime error."
                ]
            elif bn == "Analyze":
                variants = [
                    "Differentiate between the keywords throw and throws with illustrative code examples.",
                    "Analyze what happens when a return statement is placed inside both try and finally blocks.",
                    f"Analyze how {norm_t1} influences program control flow and call stack unwinding."
                ]
            elif bn == "Evaluate":
                variants = [
                    f"Evaluate the importance of {norm_t1} in building resilient, fault-tolerant applications.",
                    "Assess the performance overhead of exception handling versus proactive conditional validation."
                ]
            else:  # Create
                variants = [
                    f"Design a custom exception handling routine incorporating {norm_t1} for a banking or transaction system.",
                    f"Formulate a structured error management policy utilizing {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "MULTITHREADING":
            if bn == "Remember":
                variants = [
                    "Illustrate why thread synchronization is needed.",
                    "State the two ways of creating a thread in Java.",
                    "What is the purpose of the sleep() and join() methods in Java threads?",
                    "Define thread deadlock and state the condition under which it occurs."
                ]
            elif bn == "Understand":
                variants = [
                    "Draw and explain the lifecycle of thread.",
                    "Illustrate inter-thread communication in Java with an example (wait, notify, notifyAll).",
                    "Explain the difference between preemptive scheduling and time-slicing in Java multithreading.",
                    "Discuss the importance of the synchronized keyword in preventing race conditions."
                ]
            elif bn == "Apply":
                variants = [
                    "Design a Java program that showcases the concept of blocking a thread using sleep() or wait().",
                    "Write a Java program to create a thread by implementing the Runnable interface.",
                    "Demonstrate synchronized block execution with a sample banking or counter example."
                ]
            elif bn == "Analyze":
                variants = [
                    "Differentiate between the Thread class and the Runnable interface for multi-threaded programming.",
                    "Analyze the difference between synchronous method execution and synchronized statement blocks in Java."
                ]
            elif bn == "Evaluate":
                variants = [
                    "Evaluate the advantages and limitations of thread synchronization in concurrent applications.",
                    "Assess the risk of starvation and deadlock in multi-threaded Java applications."
                ]
            else:  # Create
                variants = [
                    "Design a multi-threaded producer-consumer system incorporating thread synchronization in Java.",
                    "Formulate a thread pool management routine for concurrent task execution."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "DATABASE_CONNECTIVITY":
            if bn == "Remember":
                variants = [
                    "What is the main purpose of JDBC in Java?",
                    "Describe the different types of JDBC drivers.",
                    "List the core interfaces of JDBC (Connection, Statement, PreparedStatement, ResultSet).",
                    "What is the difference between Statement and PreparedStatement in JDBC?"
                ]
            elif bn == "Understand":
                variants = [
                    "Describe the architecture of Hibernate framework and explain the role of each component in detail.",
                    "Describe the key features and benefits of the Spring Framework.",
                    "Explain the step-by-step process of connecting a Java application to a database using JDBC.",
                    "Discuss the role of Object-Relational Mapping (ORM) in enterprise Java applications."
                ]
            elif bn == "Apply":
                variants = [
                    "Write a code snippet to establish a database connection and execute a SELECT query using JDBC.",
                    "Demonstrate how parameterized queries are executed safely using PreparedStatement in JDBC."
                ]
            elif bn == "Analyze":
                variants = [
                    "Compare Type-1, Type-2, Type-3, and Type-4 JDBC drivers in terms of performance and platform independence.",
                    "Differentiate between JDBC and Hibernate ORM framework for enterprise data persistence."
                ]
            elif bn == "Evaluate":
                variants = [
                    "Evaluate the benefits of connection pooling versus establishing direct database connections in web applications.",
                    "Assess why ORM frameworks like Hibernate improve developer productivity over plain JDBC."
                ]
            else:  # Create
                variants = [
                    "Design an enterprise database persistence layer using Hibernate ORM and Spring Framework in Java.",
                    "Formulate an end-to-end database connectivity architecture incorporating connection pooling."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "APPLET_GUI":
            if bn == "Remember":
                variants = [
                    f"List the major milestone methods in {norm_t1} in order of execution.",
                    f"State the primary role and runtime execution environment of {norm_t1}.",
                    f"Identify the lifecycle phases that execute only once versus repeatedly in {norm_t1}."
                ]
            elif bn == "Understand":
                variants = [
                    f"Explain the sequential stages in {norm_t1} with a neat flow diagram.",
                    f"Describe the operational difference between the start(), stop(), and destroy() methods in {norm_t1}.",
                    f"Discuss the role of the paint() method in rendering graphics within {norm_t1}."
                ]
            elif bn == "Apply":
                variants = [
                    f"Write a skeleton code demonstrating how {norm_t1} initializes resources and paints output.",
                    f"Demonstrate how {norm_t1} handles event callbacks during execution with a short snippet.",
                    f"Show how parameter tags are read during the initialization phase of {norm_t1}."
                ]
            elif bn == "Analyze":
                variants = [
                    f"Analyze the differences between the execution of start() and paint() in {norm_t1}.",
                    f"Examine how browser state changes trigger lifecycle transitions in {norm_t1}.",
                    f"Compare {norm_t1} with standard standalone application execution models."
                ]
            elif bn == "Evaluate":
                variants = [
                    f"Evaluate the security sandbox constraints and execution limitations of {norm_t1}.",
                    f"Assess the modern alternatives to {norm_t1} in browser-based client application development."
                ]
            else:  # Create
                variants = [
                    f"Design an Applet class implementing {norm_t1} that displays a real-time digital clock or banner.",
                    f"Formulate a complete GUI workflow demonstrating event management in {norm_t1}."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "OOP_CONCEPTS":
            if bn == "Remember":
                variants = [
                    "Define Encapsulation.",
                    "Identify the keyword in Java that refers to the current object.",
                    "Differentiate between a class and an interface.",
                    "What is an abstract method in Java?",
                    "Define Constructor Chaining in Java.",
                    "State the purpose of the garbage collector in Java.",
                    "State the four fundamental pillars of Object-Oriented Programming.",
                    "Define a Package in Java and state its advantage."
                ]
            elif bn == "Understand":
                variants = [
                    "Differentiate between method overloading and method overriding.",
                    "Illustrate the advantage of using the super keyword in Java.",
                    "Explain the significance of dynamic method dispatch in Java.",
                    "Describe how encapsulation protects object state from unauthorized modification.",
                    "Explain the difference between a class and an interface.",
                    "Describe garbage collection in Java and its role."
                ]
            elif bn == "Apply":
                variants = [
                    "Write a short code snippet to demonstrate constructor overloading in Java.",
                    "Demonstrate how the 'this' keyword resolves variable shadowing in a constructor.",
                    "Write a Java code snippet demonstrating dynamic polymorphism with class inheritance.",
                    "Demonstrate how to create and implement an interface with an example program."
                ]
            elif bn == "Analyze":
                variants = [
                    "Differentiate between abstract classes and interfaces in terms of method implementation and multiple inheritance.",
                    "Analyze the difference between compile-time polymorphism and runtime polymorphism in Java.",
                    "Compare class inheritance with interface implementation in Java."
                ]
            elif bn == "Evaluate":
                variants = [
                    "Evaluate the advantages and limitations of multiple inheritance through interfaces in Java.",
                    "Assess why Java uses garbage collection instead of manual memory deallocation."
                ]
            else:  # Create
                variants = [
                    "Design a class hierarchy demonstrating encapsulation, inheritance, and polymorphism for a student information system.",
                    "Formulate an interface-based design to achieve loose coupling between components."
                ]
            return variants[pattern_idx % len(variants)]

        if st1 == "ASYMPTOTIC_NOTATIONS":
            if bn == "Remember":
                return "Define Asymptotic Notations (Big O, Big Omega, Big Theta) and state their mathematical bounds."
            elif bn == "Understand":
                return "Explain the mathematical formulation and graphical meaning of Big O, Omega, and Theta notations."
            elif bn == "Apply":
                return "Demonstrate how to determine the Big O time complexity of a nested loop code segment."
            else:
                return "Compare Big O, Big Omega, and Big Theta notations with respect to worst-case, best-case, and tight bounds."

        if st1 == "ALGORITHMS_DESIGN":
            if bn in ["Remember", "Understand"]:
                vars_algo = [
                    f"Explain the algorithmic working principle, strategy, and complexity of {norm_t1}.",
                    f"Describe the divide-and-conquer strategy and recurrence relation governing {norm_t1}.",
                    f"Discuss the primary operational steps and termination conditions in {norm_t1}."
                ]
            elif bn == "Apply":
                vars_algo = [
                    f"Demonstrate the step-by-step execution of {norm_t1} on a sample input dataset.",
                    f"Apply {norm_t1} to compute the sorted or searched result for a list of elements.",
                    f"Trace the partitioning and swap operations performed by {norm_t1} on sample inputs."
                ]
            elif bn in ["Analyze", "Evaluate"]:
                vars_algo = [
                    f"Analyze the best-case, average-case, and worst-case time complexities of {norm_t1}.",
                    f"Differentiate between {norm_t1} and related algorithms in terms of runtime and space requirements.",
                    f"Examine the recursion depth and auxiliary space overhead incurred by {norm_t1}."
                ]
            else:
                vars_algo = [
                    f"Evaluate the computational efficiency and space trade-offs of {norm_t1} against alternative algorithms.",
                    f"Assess under what input distribution {norm_t1} achieves optimal asymptotic performance."
                ]
            return vars_algo[pattern_idx % len(vars_algo)]

        if st1 == "DATABASE_CRUD":
            if bn in ["Remember", "Understand"]:
                vars_crud = [
                    f"Explain the primary query syntax and operational execution of {norm_t1} with an example.",
                    f"Describe the format and filtering conditions supported in {norm_t1} queries.",
                    f"Discuss how data insertion, updating, and retrieval commands operate in {norm_t1}."
                ]
            elif bn == "Apply":
                vars_crud = [
                    f"Formulate representative SQL/NoSQL queries demonstrating how {norm_t1} is executed on a dataset.",
                    f"Demonstrate the use of projection and filtering operators in {norm_t1} with sample code.",
                    f"Write a structured query executing multi-field conditional updates in {norm_t1}."
                ]
            elif bn in ["Analyze", "Evaluate"]:
                vars_crud = [
                    f"Analyze the indexing requirements, execution plan, and performance factors governing {norm_t1}.",
                    f"Evaluate the performance impact of unindexed searches versus indexed lookups in {norm_t1}.",
                    f"Examine how aggregation pipelines optimize data processing compared to client-side filtering in {norm_t1}."
                ]
            else:
                vars_crud = [
                    f"Design an optimized data retrieval query utilizing indexing strategies in {norm_t1}.",
                    f"Formulate a batch processing command sequence for bulk data manipulation in {norm_t1}."
                ]
            return vars_crud[pattern_idx % len(vars_crud)]

        if st1 == "DATABASE_TRANSACTIONS":
            if bn in ["Remember", "Understand"]:
                vars_tx = [
                    f"Explain how {norm_t1} ensures data consistency, isolation, and durability under concurrent workloads.",
                    f"Describe the ACID properties and transaction states preserved during execution of {norm_t1}.",
                    f"Discuss the purpose of commit, rollback, and savepoint commands in transaction management for {norm_t1}."
                ]
            elif bn == "Apply":
                vars_tx = [
                    f"Illustrate how {norm_t1} prevents dirty reads and non-repeatable reads with a transaction trace.",
                    f"Demonstrate how savepoint rollbacks are implemented in {norm_t1} during partial failure scenarios.",
                    f"Show how two-phase locking protocols coordinate concurrent transactions in {norm_t1}."
                ]
            elif bn in ["Analyze", "Evaluate"]:
                vars_tx = [
                    f"Analyze the concurrency control mechanisms and locking protocols utilized in {norm_t1}.",
                    f"Examine how transaction isolation levels balance consistency against system throughput in {norm_t1}.",
                    f"Differentiate between pessimistic and optimistic concurrency control mechanisms in {norm_t1}."
                ]
            else:
                vars_tx = [
                    f"Evaluate transaction recovery mechanisms (WAL, checkpoints) following abrupt power loss in {norm_t1}.",
                    f"Design a deadlock detection and resolution workflow for concurrent transactions in {norm_t1}."
                ]
            return vars_tx[pattern_idx % len(vars_tx)]

        if st1 == "STATE_MANAGEMENT":
            if bn in ["Remember", "Understand"]:
                vars_sm = [
                    "Explain how session management and cookies track user state across stateless HTTP connections.",
                    "Describe the lifecycle of a web session from creation to timeout or invalidation.",
                    "Discuss the differences between client-side cookies and server-side session attributes."
                ]
            elif bn == "Apply":
                vars_sm = [
                    "Demonstrate how session identifiers are generated, stored in cookies, and validated on the server.",
                    "Show how cookie attributes (HttpOnly, Secure, SameSite) are set to protect session tokens.",
                    "Illustrate how URL rewriting maintains session tracking when client cookies are disabled."
                ]
            elif bn in ["Analyze", "Evaluate"]:
                vars_sm = [
                    "Analyze common session vulnerabilities (session hijacking, fixation) and explain mitigation strategies.",
                    "Compare server-side session stores with stateless JWT authentication for scalability.",
                    "Examine memory consumption and replication overhead of sessions in a clustered web server farm."
                ]
            else:
                vars_sm = [
                    "Formulate a distributed session tracking architecture utilizing centralized in-memory caching.",
                    "Design a secure token revocation and renewal strategy for stateless web sessions."
                ]
            return vars_sm[pattern_idx % len(vars_sm)]

        if st1 == "WEB_REQUESTS_HTTP":
            if "request methods" in norm_t1.lower():
                vars_wr = [
                    "Differentiate between HTTP GET, POST, PUT, and DELETE methods with respect to idempotence and payload safety.",
                    "Explain why HTTP GET must remain idempotent and compare its caching behavior against HTTP POST.",
                    "Describe the differences in request formatting and URL encoding between GET and POST methods."
                ]
            elif "status code" in norm_t1.lower():
                vars_wr = [
                    "Explain the significance of HTTP status codes across 2xx, 4xx, and 5xx series with practical examples.",
                    "Differentiate between 401 Unauthorized and 403 Forbidden status codes in web API authentication.",
                    "Describe the role of redirect status codes (301 Moved Permanently vs 302 Found) in web traffic management."
                ]
            else:
                vars_wr = [
                    f"Describe the structure, message headers, and communication role of {norm_t1} in web applications.",
                    f"Explain how HTTP request and response message headers govern content negotiation in {norm_t1}.",
                    f"Analyze the role of JSON formatting in payload transmission and API communication for {norm_t1}."
                ]
            return vars_wr[pattern_idx % len(vars_wr)]

        if st1 == "RELATIONAL_DATA_MODELING":
            if bn in ["Remember", "Understand"]:
                vars_rel = [
                    "Define primary key, foreign key, and candidate key in relational databases with suitable examples.",
                    "Explain the purpose and enforcement of entity integrity and referential integrity constraints.",
                    "Describe the differences between conceptual Entity-Relationship models and physical relational schemas."
                ]
            elif bn == "Apply":
                vars_rel = [
                    "Show how a 1:M relationship between two entity sets is mapped into relational tables.",
                    "Illustrate how composite and multivalued attributes are mapped to relational schemas.",
                    "Formulate a relational algebra expression to perform selection and projection on sample relations."
                ]
            elif bn in ["Analyze", "Evaluate"]:
                vars_rel = [
                    "Differentiate between 2NF and 3NF, explaining how transitive dependencies are eliminated.",
                    "Analyze the consequences of insertion, deletion, and update anomalies in unnormalized relations.",
                    "Compare Boyce-Codd Normal Form (BCNF) with 3NF with respect to functional dependency preservation."
                ]
            else:
                vars_rel = [
                    "Evaluate the trade-offs of database denormalization in high-read analytical applications.",
                    "Assess how surrogate keys affect relational index performance compared to natural composite keys."
                ]
            return vars_rel[pattern_idx % len(vars_rel)]

        # 2. General Technical Fallback Aligned with Bloom's Taxonomy
        if bn == "Remember":
            variants = [
                f"Define {norm_t1}.",
                f"State the foundational purpose and key characteristics of {norm_t1}.",
                f"List the essential features and primary rules governing {norm_t1}.",
                f"Identify the core concept and primary role of {norm_t1}.",
                f"State the syntax or declaration requirements for {norm_t1}.",
                f"What is {norm_t1}? Mention its primary application.",
                f"State any two advantages or uses of {norm_t1}.",
                f"Outline the basic purpose and scope of {norm_t1}.",
                f"Differentiate {norm_t1} from related basic concepts.",
                f"Mention the key components or types associated with {norm_t1}."
            ]
        elif bn == "Understand":
            variants = [
                f"Differentiate between {norm_t1} and {norm_t2 if t2 else 'alternative mechanisms'}.",
                f"Explain the core concept and operational mechanism of {norm_t1} with an example.",
                f"Describe {norm_t1} and explain its role in software design.",
                f"Discuss the primary purpose of {norm_t1} and illustrate why it is essential.",
                f"Explain the basic principle and working of {norm_t1} with an illustration.",
                f"Illustrate why {norm_t1} is required in software development with an example.",
                f"Summarize the key advantages and practical applications of {norm_t1}.",
                f"Describe the execution workflow or phases associated with {norm_t1}."
            ]
        elif bn == "Apply":
            variants = [
                f"Write a short program to demonstrate the application of {norm_t1}.",
                f"Demonstrate the practical implementation of {norm_t1} with a simple code snippet.",
                f"Illustrate how {norm_t1} is utilized in real-world software development.",
                f"Apply the principles of {norm_t1} to handle a typical practical scenario."
            ]
        elif bn == "Analyze":
            if t2:
                variants = [
                    f"Compare and contrast {norm_t1} and {norm_t2} in terms of architecture, performance, and use cases.",
                    f"Differentiate between {norm_t1} and {norm_t2}, highlighting key engineering trade-offs."
                ]
            else:
                variants = [
                    f"Analyze the internal architecture, runtime behavior, and resource utilization of {norm_t1}.",
                    f"Examine the performance bottlenecks, design constraints, and trade-offs associated with {norm_t1}.",
                    f"Differentiate between {norm_t1} and alternative techniques, explaining key differences in behavior."
                ]
        elif bn == "Evaluate":
            variants = [
                f"Evaluate the advantages, limitations, and performance implications of {norm_t1}.",
                f"Assess the architectural trade-offs involved in adopting {norm_t1} in production systems.",
                f"Justify the adoption of {norm_t1} over competing methods in modern engineering practice."
            ]
        else:  # Create
            variants = [
                f"Design a modular architectural specification or component incorporating {norm_t1}.",
                f"Formulate a practical implementation blueprint leveraging {norm_t1} to meet complex requirements.",
                f"Develop a complete functional strategy incorporating {norm_t1} for robust system execution."
            ]

        return variants[pattern_idx % len(variants)]


    @classmethod
    def generate_semantic_long_answer_single(cls, t1: str, t2: str, course_name: str = "", bloom_level: str = "Understand", co_id: str = "CO1", pattern_idx: int = 0) -> str:
        st1 = cls.classify_topic_semantic_type(t1)
        norm_t1 = cls.normalize_topic_for_question(t1)
        norm_t2 = cls.normalize_topic_for_question(t2) if t2 else ""
        bloom_norm = (bloom_level or 'Understand').capitalize()

        if st1 == "LANGUAGE_KEYWORDS":
            if bloom_norm in ['Remember', 'Understand']:
                return (
                    f"Explain the purpose, declaration syntax, and execution semantics of {norm_t1}. "
                    f"Discuss how it operates within class hierarchies and constructor chaining, illustrating your answer with neat code examples."
                )
            elif bloom_norm in ['Apply']:
                return (
                    f"Demonstrate the practical implementation of {norm_t1} in a multi-tier object-oriented application. "
                    f"Provide complete, compilable class definitions showing member access, method overriding, and constructor resolution."
                )
            elif bloom_norm in ['Analyze', 'Evaluate']:
                return (
                    f"Critically analyze the role of {norm_t1} in ensuring runtime correctness and preventing design ambiguities. "
                    f"Differentiate its behavior from related language constructs and evaluate common pitfalls encountered in production code."
                )
            else:
                return (
                    f"Design a robust object-oriented component demonstrating the advanced usage of {norm_t1}. "
                    f"Provide complete class hierarchies, interface contracts, and justify your design decisions."
                )

        elif st1 == "EXCEPTION_HANDLING":
            if bloom_norm in ['Remember', 'Understand']:
                return (
                    f"Explain the comprehensive architecture of Exception Handling in modern programming. "
                    f"Describe the roles of try, catch, finally, throw, and throws clauses, detailing how the runtime manages call stack unwinding."
                )
            elif bloom_norm in ['Apply']:
                return (
                    f"Demonstrate how to design and implement a robust Exception Handling framework incorporating {norm_t1}. "
                    f"Write a program showing custom exception classes, exception propagation, and guaranteed resource cleanup using finally blocks."
                )
            elif bloom_norm in ['Analyze', 'Evaluate']:
                return (
                    f"Analyze the performance and architectural trade-offs between checked and unchecked exceptions. "
                    f"Evaluate how {norm_t1} ensures data integrity during partial transaction failures and multi-threaded exceptions."
                )
            else:
                return (
                    f"Design an enterprise-level error management subsystem leveraging {norm_t1}. "
                    f"Formulate logging strategies, custom exception hierarchies, and graceful degradation protocols."
                )

        elif st1 == "APPLET_GUI":
            if bloom_norm in ['Remember', 'Understand']:
                return (
                    f"Explain the architectural foundations and complete Life Cycle of an Applet. "
                    f"Detail the initialization, execution, display, and destruction stages (init, start, paint, stop, destroy) with neat diagrams."
                )
            elif bloom_norm in ['Apply']:
                return (
                    f"Develop a complete Applet application demonstrating event handling and GUI component interaction. "
                    f"Illustrate how event listener interfaces and adapter classes process user actions in real-time."
                )
            elif bloom_norm in ['Analyze', 'Evaluate']:
                return (
                    f"Analyze the security architecture, sandbox restrictions, and lifecycle state transitions in {norm_t1}. "
                    f"Contrast client-side applet execution against modern web component standards."
                )
            else:
                return (
                    f"Design a comprehensive interactive graphical application utilizing {norm_t1}. "
                    f"Provide component layout blueprints, event dispatch workflows, and lifecycle state management."
                )

        elif st1 == "OOP_CONCEPTS":
            if bloom_norm in ['Remember', 'Understand']:
                return (
                    f"Explain the four foundational principles of Object-Oriented Programming (Encapsulation, Abstraction, Inheritance, and Polymorphism). "
                    f"Discuss how these paradigms reduce coupling, increase cohesion, and improve software maintainability with neat schematics."
                )
            elif bloom_norm in ['Apply']:
                return (
                    f"Demonstrate how to model and implement an enterprise domain using {norm_t1}. "
                    f"Provide class diagrams, interface abstractions, and code snippets demonstrating dynamic method dispatch."
                )
            elif bloom_norm in ['Analyze', 'Evaluate']:
                return (
                    f"Analyze the architectural trade-offs between class inheritance and interface-based composition in {norm_t1}. "
                    f"Evaluate how polymorphism and dynamic binding impact runtime performance and memory footprint."
                )
            else:
                return (
                    f"Design an end-to-end modular software architecture applying {norm_t1}. "
                    f"Formulate design patterns (such as Factory, Strategy, or Observer) and justify how they satisfy non-functional requirements."
                )

        elif st1 == "DEFINITION_CHARACTERISTICS":
            subj = norm_t1
            def_vars = [
                f"Elaborate on the formal definition, essential characteristics, and core principles of {subj}. Provide neat diagrams and discuss how it addresses fundamental computational requirements.",
                f"State the formal definition of {subj}. Describe its structural properties, functional scope, and primary operational constraints with illustrative examples.",
                f"Discuss the foundational theory, terminology, and key characteristics of {subj}. Explain how it is evaluated and applied in real-world engineering systems."
            ]
            return def_vars[pattern_idx % len(def_vars)]

        elif st1 == "REPRESENTATION":
            subj = norm_t1
            rep_vars = [
                f"Discuss the primary representation techniques utilized for {subj}, highlighting their relative advantages, expressive power, and practical engineering trade-offs.",
                f"Compare different structural and logical representation models for {subj}. Explain how each model balances clarity, storage efficiency, and computational complexity.",
                f"Illustrate the formal representation strategies for {subj} with neat schematics, detailing how components and relationships are mapped."
            ]
            return rep_vars[pattern_idx % len(rep_vars)]

        elif st1 == "ASYMPTOTIC_NOTATIONS":
            asymp_vars = [
                "Formulate an in-depth technical analysis of Asymptotic Notations (Big O, Big Omega, Big Theta). Provide mathematical definitions, graphical plots, and evaluate their significance in algorithm complexity analysis.",
                "Explain how Big O, Big Omega, and Big Theta notations characterize algorithmic behavior in worst-case, best-case, and average-case scenarios with neat mathematical proofs and graphical curves.",
                "Discuss the mathematical foundations of asymptotic analysis. Explain how algorithm growth rates are classified and contrast standard complexity classes with practical examples."
            ]
            return asymp_vars[pattern_idx % len(asymp_vars)]

        elif st1 == "ALGORITHMS_DESIGN":
            algo_vars = [
                f"Provide a comprehensive technical evaluation of {norm_t1}. Discuss its algorithmic foundations, recurrence relations, best-case and worst-case time complexities, and trace its execution on sample datasets.",
                f"Explain the divide-and-conquer strategy, recurrence formulation, and operational mechanics of {norm_t1} with neat trace diagrams and complexity derivations.",
                f"Analyze the design paradigm, partitioning strategy, and space-time efficiency of {norm_t1}. Discuss techniques to mitigate worst-case performance degradation."
            ]
            return algo_vars[pattern_idx % len(algo_vars)]

        elif st1 == "RELATIONAL_DATA_MODELING":
            if co_id in ['CO1'] or bloom_norm in ['Remember', 'Understand']:
                rel_vars = [
                    f"Explain the fundamental concepts and mathematical principles of Relational Data Modeling. Discuss entity-relationship mapping, primary/foreign key definitions, and relational integrity constraints (entity, referential, and domain) with neat structural schemas and illustrative examples.",
                    f"Describe the structural components of the Relational Model. Explain how conceptual ER diagrams are systematically transformed into normalized relation schemas with suitable enterprise examples.",
                    f"Discuss the conceptual framework of {norm_t1}. Detail entity integrity, referential integrity, and domain constraints, illustrating how key constraints prevent data anomalies."
                ]
            elif co_id in ['CO2', 'CO3'] or bloom_norm in ['Apply']:
                rel_vars = [
                    f"Demonstrate the practical implementation of {norm_t1} in designing an enterprise database schema. Formulate ER constructs, reduce them to relational tables, and specify primary and foreign key constraints.",
                    f"Construct an Entity-Relationship (ER) diagram for a practical business scenario and illustrate its step-by-step reduction into a set of normalized relational tables in {norm_t1}.",
                    f"Apply relational mapping algorithms to convert complex ER schemas containing weak entity sets, aggregation, and recursive relationships into relational tables."
                ]
            elif bloom_norm in ['Analyze', 'Evaluate']:
                rel_vars = [
                    f"Analyze the role of Functional Dependencies and Schema Decomposition in Relational Data Modeling. Explain how progressive normalization (1NF, 2NF, 3NF, BCNF) eliminates data redundancy, insertion, deletion, and update anomalies with step-by-step schema transformation examples.",
                    f"Examine the mathematical criteria for lossless-join decomposition and dependency preservation during schema normalization in {norm_t1}. Prove whether given decompositions satisfy BCNF.",
                    f"Critically evaluate schema normalization trade-offs in {norm_t1}, contrasting normalized schemas against denormalized structures for high-performance read-intensive workloads."
                ]
            else:
                rel_vars = [
                    f"Design a comprehensive Relational Data Model for an enterprise database system. Develop the conceptual ER model, map it to normalized relation schemas in 3NF/BCNF, and formulate relational algebra expressions to enforce complex business rules and data retrieval operations.",
                    f"Synthesize an end-to-end relational schema architecture for {norm_t1}, formulating domain constraints, view definitions, and indexing strategies to optimize transaction throughput."
                ]
            return rel_vars[pattern_idx % len(rel_vars)]

        elif st1 == "WEB_DATABASE_ARCH":
            if co_id in ['CO1'] or bloom_norm in ['Remember', 'Understand']:
                wda_vars = [
                    f"Explain the architectural foundations of Web Database Systems (2-tier and 3-tier models). Describe the structural roles and interaction flow between client interfaces, web servers, application servers, database engines, and gateway connectivity with neat architectural schematics.",
                    f"Describe client-side and server-side web database programming models in {norm_t1}. Detail the interaction sequence from user request dispatch to database query execution and dynamic page generation.",
                    f"Compare 2-tier and 3-tier Web Database Architectures. Explain the roles of web servers, application servers, and database engines with neat schematics."
                ]
            elif co_id in ['CO2', 'CO3'] or bloom_norm in ['Apply']:
                wda_vars = [
                    f"Illustrate the step-by-step implementation of database connectivity (ODBC/JDBC) in a multi-tier web application utilizing {norm_t1}.",
                    f"Demonstrate how connection pooling and prepared statements are configured in a web database architecture to service concurrent user requests safely.",
                    f"Construct an end-to-end web database application workflow showing how server-side scripts process client requests, query the database, and format JSON payloads."
                ]
            elif bloom_norm in ['Analyze', 'Evaluate']:
                wda_vars = [
                    f"Analyze the execution mechanics, data interchange protocols, and connection pooling strategies in Web Database Architectures. Critically examine how database-independent APIs (ODBC/JDBC) and server-side scripts manage concurrent client sessions and preserve transactional consistency under high-traffic workloads.",
                    f"Evaluate modern Web Database Architectures with respect to scalability, security vulnerabilities (SQL injection, session hijacking), and network latency in {norm_t1}.",
                    f"Analyze the performance bottlenecks and resource exhaustion issues in web application connection pools under sudden peak loads, proposing mitigation strategies."
                ]
            else:
                wda_vars = [
                    f"Critically evaluate modern Web Database Architectures with respect to scalability, security vulnerabilities (SQL injection, session hijacking), and network latency. Propose an end-to-end multi-tier architectural blueprint incorporating connection pooling and distributed caching.",
                    f"Design a high-availability, fault-tolerant web database system specification incorporating read replicas, load balancing, and connection pool clustering for {norm_t1}."
                ]
            return wda_vars[pattern_idx % len(wda_vars)]

        elif st1 == "DATABASE_CRUD":
            crud_vars = [
                f"Elaborate on the implementation details and query mechanics of {norm_t1}. Discuss schema design, execution plans, indexing strategies, and provide structured SQL/NoSQL query examples.",
                f"Explain the operational syntax and execution workflow of data insertion, modification, and aggregation in {norm_t1} with comprehensive query examples.",
                f"Analyze query execution plans, indexing strategies, and performance considerations for {norm_t1} on large-scale datasets, detailing index scan optimization."
            ]
            return crud_vars[pattern_idx % len(crud_vars)]

        elif st1 == "DATABASE_TRANSACTIONS":
            tx_vars = [
                f"Provide an in-depth analysis of {norm_t1}. Explain how ACID guarantees, lock management, isolation levels, and recovery mechanisms ensure system integrity under concurrent workloads.",
                f"Describe transaction lifecycle states and concurrency control mechanisms in {norm_t1}. Detail how two-phase locking (2PL) and write-ahead logging (WAL) prevent data anomalies.",
                f"Analyze the concurrency anomalies (dirty reads, non-repeatable reads, phantom reads) that occur under different transaction isolation levels in {norm_t1}, illustrating with transaction schedules."
            ]
            return tx_vars[pattern_idx % len(tx_vars)]

        elif st1 == "STATE_MANAGEMENT":
            sm_vars = [
                f"Explain the end-to-end lifecycle, architecture, and state tracking mechanisms in {norm_t1}. Contrast client-side cookies with server-side session stores, evaluating security vulnerabilities and mitigation strategies.",
                f"Describe the mechanisms used for web session tracking in {norm_t1}. Explain session token generation, cookie attributes (HttpOnly, Secure, SameSite), and URL rewriting with neat request header diagrams.",
                f"Analyze session security vulnerabilities (session fixation, session hijacking, cross-site scripting) and evaluate mitigation techniques in {norm_t1} across clustered server architectures."
            ]
            return sm_vars[pattern_idx % len(sm_vars)]

        elif st1 == "WEB_REQUESTS_HTTP":
            wr_vars = [
                f"Detail the structural architecture of web requests and client-server protocols in {norm_t1}. Explain request headers, status codes, and JSON serialization formats with neat message trace diagrams.",
                f"Analyze the structure of web requests and HTTP message headers during client-server communication with neat diagrams, contrasting idempotent and non-idempotent methods.",
                f"Explain how HTTP persistent connections, caching headers (Cache-Control, ETag), and content negotiation optimize network communication efficiency in {norm_t1}."
            ]
            return wr_vars[pattern_idx % len(wr_vars)]

        elif st1 == "DATABASE_COMPARISON":
            comp_vars = [
                f"Critically analyze the architectural distinctions, query semantics, and scalability models between {norm_t1} and {norm_t2}. Evaluate when to adopt structured relational systems versus unstructured NoSQL alternatives.",
                f"Compare and contrast {norm_t1} and {norm_t2} across data models, transaction guarantees (ACID vs BASE), consistency models, and horizontal scaling capabilities.",
                f"Evaluate the performance, schema flexibility, and operational overhead of structured relational engines versus document-oriented databases in {norm_t1}."
            ]
            return comp_vars[pattern_idx % len(comp_vars)]
        else:
            # Dynamically diverse, Bloom-aligned questions based on Bloom's level and pattern index
            if co_id in ['CO1'] or bloom_norm in ['Remember', 'Understand']:
                co1_variants = [
                    f"Explain the foundational principles, core architecture, and operational mechanisms of {norm_t1}. Describe how its primary components interact using neat schematics and illustrative examples.",
                    f"Discuss the theoretical framework, classification, and execution workflow of {norm_t1}. Elaborate on its primary design objectives, functional lifecycle, and practical significance.",
                    f"Describe the structural organization, terminology, and operational characteristics of {norm_t1}. Illustrate its key functional modules and component interactions with neat diagrams."
                ]
                return co1_variants[pattern_idx % len(co1_variants)]
            elif co_id in ['CO2'] or bloom_norm in ['Apply']:
                co2_variants = [
                    f"Demonstrate the practical implementation and execution workflow of {norm_t1}. Analyze how it is applied to resolve domain-specific computational challenges with step-by-step illustrations.",
                    f"Analyze the procedural execution and practical application of {norm_t1}. Explain how input parameters, configurations, and runtime constraints govern its operational outcome with illustrative examples.",
                    f"Explain the deployment guidelines, configuration strategies, and implementation methodologies for {norm_t1}. Trace its functional execution on a representative scenario."
                ]
                return co2_variants[pattern_idx % len(co2_variants)]
            elif co_id in ['CO3', 'CO4'] or bloom_norm in ['Analyze', 'Evaluate']:
                co3_variants = [
                    f"Critically examine the architectural trade-offs, performance bottlenecks, and design constraints associated with {norm_t1}. Contrast its operational efficiency against alternative approaches under varying workload conditions.",
                    f"Investigate the internal mechanics and runtime behavior of {norm_t1}. Examine how concurrency, resource allocation, and scalability challenges are addressed with neat diagrams.",
                    f"Formulate a rigorous technical evaluation of {norm_t1}. Analyze its resilience, resource consumption, and behavior under high-load conditions with neat comparative models."
                ]
                return co3_variants[pattern_idx % len(co3_variants)]
            else:
                co5_variants = [
                    f"Design a comprehensive technical solution and architectural blueprint incorporating {norm_t1}. Detail the end-to-end processing pipeline, data contracts, and error mitigation strategies with neat schematics.",
                    f"Formulate an advanced engineering framework utilizing {norm_t1} to meet complex system specifications. Justify your architectural design choices and provide complete structural specifications."
                ]
                return co5_variants[pattern_idx % len(co5_variants)]

    @classmethod
    def get_semantic_sub_a_variants(cls, st: str, norm_t: str, bn: str) -> List[str]:
        """Returns diverse Bloom-aligned academic question variants for sub-question (a)."""
        if st == "LANGUAGE_KEYWORDS":
            if bn in ['Remember', 'Understand']:
                return [
                    "a) Explain the purpose, declaration syntax, and operational role of the super keyword with an illustrative code example.",
                    "a) Describe how the 'this' keyword is used for current object reference and constructor chaining with examples.",
                    f"a) Explain the purpose, declaration syntax, and operational role of {norm_t} with an illustrative code example.",
                    f"a) Describe how {norm_t} operates within class hierarchies and constructor chaining with examples."
                ]
            elif bn == 'Apply':
                return [
                    "a) Write a Java program demonstrating constructor chaining using this() and super() invocations.",
                    "a) Write a program to demonstrate access specifiers (public, private, protected, default) across packages.",
                    f"a) Demonstrate the practical application of {norm_t} with a neat, compilable code snippet.",
                    f"a) Implement a program illustrating member access, method overriding, and constructor resolution using {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the execution semantics and inheritance rules governing {norm_t} with comparative examples.",
                    f"a) Critically examine common design pitfalls and compiler enforcement mechanisms related to {norm_t}.",
                    f"a) Differentiate the behavior of {norm_t} from related keywords and evaluate its runtime performance."
                ]
            else:
                return [
                    f"a) Design an enterprise component leveraging {norm_t} to enforce strict encapsulation and interface contracts.",
                    f"a) Formulate a robust architectural blueprint incorporating {norm_t} for modular code reusability."
                ]

        elif st == "EXCEPTION_HANDLING":
            if bn in ['Remember', 'Understand']:
                return [
                    "a) Differentiate the keywords throw and throws.",
                    "a) Explain how try, catch, and finally blocks coordinate error handling and resource safety in Java.",
                    f"a) Explain how {norm_t} operates during runtime exception handling and call stack unwinding with examples.",
                    f"a) Describe the comprehensive architecture of exception propagation and resource cleanup in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    "a) Illustrate a user-defined exception in Java with an example.",
                    "a) Write a program demonstrating nested try-catch blocks and custom exception propagation.",
                    f"a) Write a code snippet demonstrating how {norm_t} is implemented for safe runtime error handling.",
                    f"a) Implement custom exception classes and demonstrate exception propagation using {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    "a) Differentiate between throw and throws and analyze the role of exception propagation in failure recovery.",
                    f"a) Analyze performance overhead and design trade-offs between checked and unchecked exceptions in {norm_t}.",
                    f"a) Critically examine how {norm_t} maintains transactional state integrity during partial execution failures."
                ]
            else:
                return [
                    f"a) Design an enterprise-grade error handling subsystem incorporating custom exceptions and logging in {norm_t}.",
                    f"a) Formulate an automated fault-tolerance and error notification architecture leveraging {norm_t}."
                ]

        elif st == "MULTITHREADING":
            if bn in ['Remember', 'Understand']:
                return [
                    "a) Draw and explain the lifecycle of thread.",
                    "a) Explain the two ways of creating threads in Java (extending Thread class vs implementing Runnable interface) with programs.",
                    "a) Discuss thread priorities, synchronization, and the purpose of the synchronized keyword in Java."
                ]
            elif bn == 'Apply':
                return [
                    "a) Design a Java program that showcases the concept of blocking a thread and illustrating how to control the execution flow and coordination between multiple threads in a controlled manner using thread synchronization.",
                    "a) Write a Java program to implement inter-thread communication using wait(), notify(), and notifyAll() methods.",
                    "a) Write a program demonstrating thread synchronization using synchronized methods to prevent race conditions."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    "a) Differentiate between the Thread class and the Runnable interface for multi-threaded programming.",
                    "a) Analyze the difference between synchronous method execution and synchronized statement blocks in Java.",
                    "a) Critically examine deadlock conditions and discuss techniques to prevent deadlocks in Java."
                ]
            else:
                return [
                    "a) Design a multi-threaded producer-consumer system incorporating thread synchronization and thread blocking in Java.",
                    "a) Formulate a high-throughput thread pool architecture in Java for concurrent task execution."
                ]

        elif st == "DATABASE_CONNECTIVITY":
            if bn in ['Remember', 'Understand']:
                return [
                    "a) Describe the different types of JDBC drivers.",
                    "a) Describe the key features and benefits of the Spring Framework.",
                    "a) Explain the step-by-step process of connecting a Java application to a database using JDBC.",
                    "a) Discuss the role and components of Hibernate framework in Java enterprise applications."
                ]
            elif bn == 'Apply':
                return [
                    "a) Write a Java program to connect to a relational database using JDBC and retrieve employee records.",
                    "a) Write a program demonstrating the use of PreparedStatement for parameterized database queries in Java.",
                    "a) Demonstrate how database transactions (commit and rollback) are executed using JDBC."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    "a) Compare Type-1, Type-2, Type-3, and Type-4 JDBC drivers in terms of performance and platform independence.",
                    "a) Differentiate between JDBC and Hibernate ORM framework for enterprise data persistence."
                ]
            else:
                return [
                    "a) Design an enterprise database persistence layer using Hibernate ORM and Spring Framework in Java.",
                    "a) Formulate an end-to-end database connectivity architecture incorporating connection pooling."
                ]

        elif st == "APPLET_GUI":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Describe the sequential lifecycle stages and execution environment of {norm_t} with a neat flow diagram.",
                    f"a) Explain the fundamental architecture and event dispatch mechanism of {norm_t} with neat diagrams.",
                    f"a) Discuss the sandbox security model and browser execution constraints governing {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Write a skeleton application demonstrating how initialization, display, and user interaction are handled in {norm_t}.",
                    f"a) Implement event listeners and adapter classes to process asynchronous user inputs in {norm_t}.",
                    f"a) Develop a GUI layout applying layout managers and graphical components in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the differences between lifecycle methods and event listeners in {norm_t}.",
                    f"a) Evaluate the performance and sandbox restrictions of client-side execution in {norm_t} compared to modern standards.",
                    f"a) Compare event delegation models and GUI repainting overhead in {norm_t}."
                ]
            else:
                return [
                    f"a) Design a comprehensive interactive graphical user interface application utilizing {norm_t}.",
                    f"a) Synthesize an event-driven user interface architecture incorporating asynchronous handlers in {norm_t}."
                ]

        elif st == "OOP_CONCEPTS":
            if bn in ['Remember', 'Understand']:
                return [
                    "a) Describe garbage collection in Java and its role.",
                    "a) Explain the principles of Object-Oriented Programming (Encapsulation, Inheritance, Polymorphism, Abstraction) with suitable Java class examples.",
                    "a) Describe how inheritance promotes code reusability and dynamic polymorphism in Java.",
                    f"a) Explain the core principles of {norm_t} with neat structural schematics and practical examples.",
                    f"a) Describe how {norm_t} promotes loose coupling, high cohesion, and code maintainability in software engineering."
                ]
            elif bn == 'Apply':
                return [
                    "a) Write a program to implement matrix addition using multidimensional arrays.",
                    "a) Write a program for creating one base class for student personal details and inherit those details into the sub class of student educational details to display complete student information.",
                    "a) Write a program to create a package which has classes and methods to read Student admission details.",
                    "a) Write a Java program demonstrating method overriding and dynamic method dispatch.",
                    f"a) Demonstrate how {norm_t} is applied to model real-world enterprise entities using classes and interfaces."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the architectural differences between procedural programming and {norm_t}.",
                    f"a) Critically evaluate class inheritance versus interface composition in {norm_t} with respect to flexibility.",
                    f"a) Examine the runtime memory layout, virtual method tables (vtable), and dispatch overhead of {norm_t}."
                ]
            else:
                return [
                    f"a) Design a modular enterprise software architecture applying {norm_t} and appropriate design patterns.",
                    f"a) Formulate an extensible object model utilizing abstract factories and dependency injection based on {norm_t}."
                ]

        elif st == "RELATIONAL_DATA_MODELING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain entity-relationship modeling concepts and illustrate the mapping of ER constructs (entities, attributes, relationships) to relational schemas with suitable examples.",
                    f"a) Describe the relational model integrity rules (entity, referential, and domain integrity) and explain how key constraints maintain schema consistency with examples.",
                    f"a) Explain the conceptual foundations of {norm_t}. Discuss how cardinality ratios, participation constraints, and weak entity sets are represented in ER diagrams.",
                    f"a) Discuss the principles of relational database schema design. Explain how specialization, generalization, and attribute inheritance are modeled in relational schemas."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Construct an Entity-Relationship (ER) diagram for a practical enterprise application and illustrate its step-by-step reduction into a set of normalized relational tables.",
                    f"a) Demonstrate the procedural application of {norm_t} in designing an enterprise schema, detailing primary, candidate, and foreign key mappings.",
                    f"a) Apply relational mapping algorithms to convert complex ER schemas containing weak entity sets and recursive relationships into relational tables.",
                    f"a) Illustrate the step-by-step mapping of ternary relationships and aggregation constructs into relational tables with sample records."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the anomalies (insertion, deletion, update) that occur in unnormalized relational schemas and evaluate how functional dependencies guide decomposition.",
                    f"a) Compare and evaluate Boyce-Codd Normal Form (BCNF) versus Third Normal Form (3NF) with respect to dependency preservation and lossless-join properties.",
                    f"a) Critically evaluate schema normalization trade-offs in {norm_t}, contrasting normalized schemas against denormalized structures for query performance."
                ]
            else:
                return [
                    f"a) Design a comprehensive Relational Schema for an enterprise domain from informal requirements. Formulate the ER model, specify constraints, and verify 3NF compliance.",
                    f"a) Synthesize an end-to-end database schema blueprint for {norm_t}, specifying attribute data types, referential integrity rules, and indexing strategies."
                ]

        elif st == "WEB_DATABASE_ARCH":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Compare 2-tier and 3-tier Web Database Architectures. Explain the roles of web servers, application servers, and database engines with neat schematics.",
                    f"a) Describe client-side and server-side web database programming models. Explain how connection pooling optimizes concurrent database access with a neat diagram.",
                    f"a) Explain the architectural tiers of {norm_t}. Detail the interaction flow between the client browser, middle-tier application server, and enterprise database."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Illustrate the step-by-step implementation of database connectivity (ODBC/JDBC) in a multi-tier web application utilizing {norm_t}.",
                    f"a) Demonstrate how connection pooling and prepared statements are configured in a web database architecture to service concurrent user requests safely.",
                    f"a) Construct a multi-tier connectivity workflow connecting an application server to a backend database engine in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the performance bottlenecks, latency overhead, and scalability constraints in {norm_t} under high concurrent user traffic.",
                    f"a) Evaluate the security vulnerabilities (such as SQL injection and session tampering) in multi-tier web database architectures and analyze prevention strategies.",
                    f"a) Contrast synchronous versus asynchronous database querying models in web database architectures with respect to throughput."
                ]
            else:
                return [
                    f"a) Design an end-to-end multi-tier web database architecture for an enterprise system, specifying caching layers, load balancers, and connection pooling protocols.",
                    f"a) Formulate a scalable distributed database connectivity blueprint for high-traffic web applications utilizing {norm_t}."
                ]

        elif st == "DATABASE_CRUD":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Discuss the syntax, operational workflow, and execution semantics for {norm_t} with practical query examples.",
                    f"a) Explain how data retrieval, filtering, and aggregation pipelines are executed in {norm_t} with illustrative examples.",
                    f"a) Describe the query structure, projection methods, and indexing rules governing {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Formulate structured queries or commands demonstrating insert, update, delete, and complex lookup operations in {norm_t}.",
                    f"a) Demonstrate the practical implementation of {norm_t} on a sample dataset with appropriate syntax and verification steps.",
                    f"a) Write queries demonstrating conditional filtering, multi-field sorting, and aggregation grouping in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze query execution plans, indexing strategies, and performance considerations for {norm_t} on large-scale datasets.",
                    f"a) Evaluate the computational cost and optimization techniques for complex joins, subqueries, and aggregations in {norm_t}.",
                    f"a) Compare table scans against index scans in {norm_t}, assessing the impact of index selectivity on query response times."
                ]
            else:
                return [
                    f"a) Design an end-to-end data manipulation and validation workflow implementing robust CRUD pipelines in {norm_t}.",
                    f"a) Formulate an optimized data access layer specifying query structures and transaction boundaries for {norm_t}."
                ]

        elif st == "DATABASE_TRANSACTIONS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Describe how ACID properties and concurrency control are preserved during transaction execution in {norm_t} with neat state diagrams.",
                    f"a) Explain transaction lifecycle states (active, partially committed, committed, failed, aborted) and discuss the role of transaction logs in {norm_t}.",
                    f"a) Discuss the purpose of commit, rollback, and savepoint mechanisms in maintaining database consistency for {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Illustrate how two-phase locking (2PL) and timestamp-based concurrency protocols prevent conflicts in {norm_t} with a sample transaction schedule.",
                    f"a) Demonstrate how savepoints and rollback commands are implemented in {norm_t} to maintain consistency during partial failures.",
                    f"a) Trace the execution of concurrent transactions under strict 2PL, showing how read-write conflicts are serialized."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the concurrency anomalies (dirty reads, non-repeatable reads, phantom reads) that occur under different transaction isolation levels in {norm_t}.",
                    f"a) Evaluate deadlock prevention, detection, and recovery mechanisms in concurrent database environments with neat transaction wait-for graphs.",
                    f"a) Compare optimistic versus pessimistic locking strategies in high-concurrency transactional databases for {norm_t}."
                ]
            else:
                return [
                    f"a) Design a robust transactional integrity architecture for an enterprise application, specifying isolation levels, lock escalation policies, and recovery mechanisms in {norm_t}.",
                    f"a) Formulate a distributed transaction coordination framework enforcing two-phase commit (2PC) protocol across multiple databases."
                ]

        elif st == "STATE_MANAGEMENT":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Describe the end-to-end lifecycle of a web session, from cookie issuance to expiration, with neat request-response header diagrams.",
                    f"a) Explain the fundamental mechanisms used for state tracking in web applications (cookies, URL rewriting, hidden form fields, and server-side sessions).",
                    f"a) Discuss how stateless HTTP communication is reconciled with stateful user sessions in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Demonstrate the procedural implementation of session tracking and cookie manipulation in {norm_t} with neat code snippets.",
                    f"a) Illustrate how secure session tokens are generated, transmitted, and validated across stateless HTTP requests in {norm_t}.",
                    f"a) Implement session expiration, renewal, and logout workflows for web applications in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze session security vulnerabilities (session fixation, session hijacking, cross-site scripting) and evaluate mitigation techniques (HttpOnly, Secure, SameSite flags) in {norm_t}.",
                    f"a) Compare client-side cookie storage against server-side session stores with respect to memory overhead, latency, and scalability in distributed systems.",
                    f"a) Evaluate token-based authentication (JWT) versus server-side session management for high-concurrency web systems."
                ]
            else:
                return [
                    f"a) Design a distributed state tracking architecture for a cluster of web servers, incorporating distributed caches and secure session renewal policies in {norm_t}.",
                    f"a) Synthesize an enterprise single sign-on (SSO) and stateless token authorization pipeline utilizing {norm_t}."
                ]

        elif st == "WEB_REQUESTS_HTTP":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Analyze the structure of web requests and HTTP message headers during client-server communication with neat diagrams.",
                    f"a) Explain the HTTP request-response cycle. Describe the format and role of request methods, response status codes, and entity headers in {norm_t}.",
                    f"a) Discuss the communication flow between client agents, proxy caches, and origin web servers in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Illustrate the construction of HTTP POST/PUT request payloads containing JSON or multipart form data in {norm_t} with an example.",
                    f"a) Demonstrate how client-server communication is handled in RESTful APIs using standard HTTP verbs and status codes for {norm_t}.",
                    f"a) Write a program demonstrating asynchronous HTTP client request dispatch and payload parsing in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Differentiate between idempotent and non-idempotent HTTP methods, evaluating their impact on retry logic and payload safety in {norm_t}.",
                    f"a) Analyze how caching headers (Cache-Control, ETag, If-Modified-Since) and CORS policies govern web communication efficiency and security in {norm_t}.",
                    f"a) Examine the performance and multiplexing benefits of HTTP/2 and HTTP/3 compared to HTTP/1.1 in {norm_t}."
                ]
            else:
                return [
                    f"a) Design a RESTful API communication specification for an enterprise web application, defining endpoints, request headers, JSON payloads, and error codes in {norm_t}.",
                    f"a) Formulate an API gateway architecture specifying request routing, rate limiting, and header transformation for {norm_t}."
                ]

        elif st == "ASYMPTOTIC_NOTATIONS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Formulate the formal mathematical definitions of Big O, Big Omega, and Big Theta notations with neat graphical plots.",
                    f"a) Explain the significance of asymptotic analysis in evaluating algorithmic performance, and describe the behavior of standard complexity classes with neat curves.",
                    f"a) Describe how tight asymptotic bounds (Theta notation) provide a comprehensive picture of algorithm growth compared to Big O."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Determine the tight asymptotic bound (Big Theta) for given recurrence relations or iterative loops using mathematical definitions.",
                    f"a) Demonstrate how Big O notation is computed for nested loops and recursive algorithms with step-by-step mathematical derivation.",
                    f"a) Apply the Master Theorem to solve recurrence relations of divide-and-conquer algorithms, detailing case criteria."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the difference between worst-case, best-case, and average-case complexity in algorithms, illustrating how asymptotic notation captures each.",
                    f"a) Compare the asymptotic growth rates of common complexity functions (logarithmic, polynomial, exponential) and evaluate their scalability on large inputs.",
                    f"a) Critically examine when an algorithm with a higher asymptotic complexity outperforms one with a lower complexity due to constant factors."
                ]
            else:
                return [
                    f"a) Formulate a rigorous computational complexity model for an algorithm in {norm_t}, deriving upper and lower bounds using Master Theorem or recurrence trees.",
                    f"a) Design an optimized algorithmic procedure achieving O(n log n) or better performance for {norm_t}, proving its asymptotic optimality."
                ]

        elif st == "ALGORITHMS_DESIGN":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the algorithmic workflow, divide-and-conquer partitioning, and recurrence relation of {norm_t} with a neat trace diagram.",
                    f"a) Describe the foundational strategy, key steps, and operational characteristics of {norm_t} on sample inputs.",
                    f"a) Discuss the theoretical foundations and optimality conditions underlying {norm_t} with illustrative examples."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Trace the step-by-step execution of {norm_t} on a representative dataset and calculate the exact number of comparisons or iterations performed.",
                    f"a) Demonstrate the procedural application of {norm_t} in solving a practical optimization or searching problem.",
                    f"a) Implement the partitioning or traversal subroutine of {norm_t} on an arbitrary input array."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the best-case, average-case, and worst-case time complexities of {norm_t}. Explain how worst-case degradation can be prevented.",
                    f"a) Evaluate the computational efficiency, stability, and space trade-offs of {norm_t} against alternative algorithmic techniques.",
                    f"a) Investigate the recursive call tree and stack space requirements of {norm_t} on unbalanced inputs."
                ]
            else:
                return [
                    f"a) Design an optimized algorithmic solution based on {norm_t} to satisfy stringent runtime and memory constraints for large-scale data.",
                    f"a) Formulate an advanced engineering framework applying {norm_t} to resolve complex multi-dimensional optimization requirements."
                ]

        elif st == "DATABASE_COMPARISON":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Compare and contrast {norm_t} across data models, transaction guarantees (ACID vs BASE), and horizontal scalability.",
                    f"a) Explain the fundamental architectural differences between relational (RDBMS) and non-relational (NoSQL) database paradigms in {norm_t}.",
                    f"a) Describe the core differences between document, key-value, column-family, and graph data stores."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Critically analyze the trade-offs outlined by the CAP theorem with respect to consistency and partition tolerance in {norm_t}.",
                    f"a) Evaluate the performance, schema flexibility, and query expressiveness of structured relational engines versus document-oriented databases.",
                    f"a) Analyze the operational and consistency trade-offs when transitioning from centralized RDBMS to distributed NoSQL architectures."
                ]
            else:
                return [
                    f"a) Formulate an architectural decision matrix evaluating when to deploy structured relational systems versus unstructured NoSQL alternatives in {norm_t}.",
                    f"a) Design a hybrid polyglot persistence architecture combining relational transactions with NoSQL caching for {norm_t}."
                ]

        elif st == "DEFINITION_CHARACTERISTICS":
            return [
                f"a) State the formal definition of {norm_t}. Explain its key characteristics and evaluation criteria with suitable examples.",
                f"a) Elaborate on the core properties, operational boundaries, and theoretical foundations of {norm_t}.",
                f"a) Describe the primary characteristics, syntax conventions, and essential terminology associated with {norm_t}."
            ]

        elif st == "PROBLEM_SOLVING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the various phases of problem solving in computer programming with a neat schematic diagram.",
                    f"a) Describe the systematic methodology of problem solving from requirement analysis to testing with a neat flowchart.",
                    f"a) Discuss the foundational principles and key stages involved in solving computational problems on a computer.",
                    f"a) Elaborate on the role of problem definition, algorithm development, and verification in software development."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Demonstrate the end-to-end phases of problem solving by formulating a systematic solution for a practical programming problem.",
                    f"a) Apply problem-solving techniques to design an algorithm and step-by-step verification process for a given computational task."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the common failure modes and logical pitfalls encountered during the phases of problem solving.",
                    f"a) Evaluate different problem-solving strategies (top-down vs bottom-up) in terms of clarity, modularity, and error reduction."
                ]
            else:
                return [
                    f"a) Formulate a comprehensive problem-solving framework and testing methodology for complex computational requirements."
                ]

        elif st == "ALGORITHMS_REPRESENTATION":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the fundamental representation techniques used for algorithms (flowcharts and pseudocode) with suitable examples.",
                    f"a) Describe the standard flowchart symbols, rules, and best practices used for representing algorithms.",
                    f"a) Discuss the key characteristics, structure, and advantages of pseudocode in algorithm formulation.",
                    f"a) Explain how algorithms are designed, structured, and validated prior to code implementation."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Demonstrate how an algorithm is represented using standard flowchart symbols and pseudocode for a practical engineering problem.",
                    f"a) Develop a comprehensive flowchart and equivalent pseudocode to solve a computational problem with clear step-by-step logic.",
                    f"a) Formulate an algorithm and represent it using both pseudocode and flowcharts with a concrete example."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Compare and contrast pseudocode and flowcharts as algorithmic representation techniques in terms of readability, scalability, and ease of modification.",
                    f"a) Evaluate the computational efficiency, correctness, and termination properties of an algorithm using formal verification techniques."
                ]
            else:
                return [
                    f"a) Design an algorithmic blueprint incorporating structured flowchart symbols and modular pseudocode for a complex computational system."
                ]

        elif st == "CONTROL_STRUCTURES":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the different decision-making control structures (if, if-else, nested-if, switch-case) with syntax and neat flowcharts.",
                    f"a) Describe iterative control structures (while, do-while, and for loops) with syntax, flow diagrams, and execution behavior.",
                    f"a) Differentiate between entry-controlled and exit-controlled looping constructs with flowcharts and code illustrations.",
                    f"a) Explain control flow constructs (Sequence, Selection, and Iteration) with neat diagrams and examples."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Demonstrate the practical implementation of decision-making structures (if-else and switch-case) with appropriate code snippets.",
                    f"a) Write a program demonstrating iterative loops to solve a mathematical series or pattern generation problem.",
                    f"a) Implement a multi-way selection structure using switch-case with proper break statements and default handling."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the performance and readability trade-offs between nested if-else statements and switch-case selection.",
                    f"a) Evaluate infinite loop conditions, boundary terminations, and off-by-one errors in iterative control structures."
                ]
            else:
                return [
                    f"a) Design a menu-driven program architecture utilizing structured decision and iterative control blocks."
                ]

        elif st == "FUNCTIONS_MODULARITY":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the different categories of functions based on arguments and return values with syntax and illustrative code examples.",
                    f"a) Describe the concepts of function declaration, definition, and prototyping with neat code illustrations.",
                    f"a) Discuss call by value and call by reference parameter passing mechanisms in detail with memory stack diagrams.",
                    f"a) Explain the working of recursion and call stack unwinding with a suitable example."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Write a modular program demonstrating various categories of functions and parameter passing mechanisms.",
                    f"a) Implement a recursive function to solve a computational problem, illustrating the activation records on the call stack.",
                    f"a) Demonstrate how functions promote code reusability and structured programming with a complete code example."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the overhead of recursive function calls versus iterative loops in terms of stack memory and execution time.",
                    f"a) Compare call by value and call by reference in terms of side effects, memory efficiency, and caller data integrity."
                ]
            else:
                return [
                    f"a) Formulate a modular program architecture utilizing independent function modules and separate header contracts."
                ]

        elif st == "USER_DEFINED_TYPES":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain self-referential structures with neat schematic memory diagrams and practical code examples.",
                    f"a) Describe the declaration, initialization, and memory layout of structures and unions with suitable diagrams.",
                    f"a) Discuss the syntax, purpose, and advantages of the typedef keyword and enumerations in programming.",
                    f"a) Explain nested structures and arrays of structures with appropriate syntax and memory diagrams."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Write a program to manage student or employee records using an array of structures with nested fields.",
                    f"a) Implement a self-referential structure to create and traverse a linked list node with suitable code.",
                    f"a) Demonstrate the use of typedef to define and manipulate complex structured user types."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Differentiate between structures and unions in terms of memory allocation, member access, and size calculation with diagrams.",
                    f"a) Analyze how memory padding and structure alignment affect the total size of structured data types."
                ]
            else:
                return [
                    f"a) Design a structured data model utilizing nested structures, typedef, and enumerations for a real-world entity."
                ]

        elif st == "POINTERS_MEMORY":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain NULL pointers, void (generic) pointers, and pointer arithmetic with neat memory layout diagrams.",
                    f"a) Describe dynamic memory allocation functions (malloc, calloc, realloc, free) with syntax and memory diagrams.",
                    f"a) Discuss pointer declaration, initialization, and the role of address-of (&) and dereference (*) operators."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Write a program demonstrating the use of generic pointers and dynamic memory allocation for array manipulation.",
                    f"a) Implement a function demonstrating pointer arithmetic and passing pointers to functions.",
                    f"a) Write a program that dynamically allocates memory for a 2D array and releases it cleanly without memory leaks."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze common pointer bugs including dangling pointers, memory leaks, and wild pointers with prevention strategies.",
                    f"a) Evaluate the advantages and performance implications of pointer-based data access over array indexing."
                ]
            else:
                return [
                    f"a) Design a dynamic memory management routine with custom allocation and deallocation tracking."
                ]

        elif st == "COMPUTER_FUNDAMENTALS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain computer hardware architecture, software classification, and the role of language translators with neat schematics.",
                    f"a) Describe the evolution of programming languages and the internal phases of a compiler with a neat diagram.",
                    f"a) Discuss the differences between high-level, assembly, and machine languages with respect to execution speed and portability."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Illustrate the step-by-step translation and execution flow of a high-level program from source code to machine code."
                ]
            else:
                return [
                    f"a) Analyze how language translators, linkers, and loaders coordinate to produce an executable binary."
                ]

        elif st == "SOFTWARE_TESTING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the fundamental concepts, levels, and significance of program testing and debugging with a neat diagram.",
                    f"a) Describe black-box and white-box testing strategies with suitable test case design examples.",
                    f"a) Discuss unit testing, integration testing, and system verification methodologies in software engineering."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Design a comprehensive test suite with positive, negative, and boundary test cases for a given programming problem.",
                    f"a) Demonstrate the process of desk-checking and test case verification on an algorithm with a complete trace table."
                ]
            else:
                return [
                    f"a) Analyze the defect discovery rate and trade-offs between automated unit testing and manual desk-checking."
                ]

        elif st == "REPRESENTATION":
            return [
                f"a) Discuss the primary representation techniques utilized for {norm_t}, comparing their expressive power and clarity.",
                f"a) Illustrate the step-by-step structural representation of an engineering domain using {norm_t} with neat diagrams.",
                f"a) Compare logical versus physical representation models for {norm_t}, highlighting trade-offs in storage and retrieval efficiency."
            ]

        else:
            # GENERAL_TECHNICAL Fallback (OBE University Exam Standard)
            if bn in ['Remember', 'Understand']:
                return [
                    f"a) Explain the fundamental concepts, working principles, and significance of {norm_t} with suitable illustrations.",
                    f"a) Describe the classification, structure, and operational characteristics of {norm_t} in detail.",
                    f"a) Discuss the importance, features, and practical applications of {norm_t} with relevant examples.",
                    f"a) Explain {norm_t} in detail with the help of a neat diagram or workflow chart.",
                    f"a) Differentiate between the core concepts and alternative approaches associated with {norm_t}.",
                    f"a) Elaborate on the principles, advantages, and operational stages of {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"a) Demonstrate the practical application of {norm_t} with an illustrative code example or structured solution.",
                    f"a) Write a program or procedure demonstrating the practical implementation of {norm_t}.",
                    f"a) Show how {norm_t} is applied to solve a practical computational or engineering problem.",
                    f"a) Illustrate the step-by-step execution and practical implementation of {norm_t} with clear logic."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"a) Analyze the architectural role, structural components, and performance factors governing {norm_t} with neat illustrations.",
                    f"a) Critically examine the design constraints, execution trade-offs, and failure modes of {norm_t}.",
                    f"a) Evaluate the computational efficiency, scalability, and operational characteristics of {norm_t} under heavy workloads."
                ]
            else:
                return [
                    f"a) Design a robust technical solution and architectural blueprint incorporating {norm_t} to resolve complex engineering requirements.",
                    f"a) Formulate an end-to-end implementation workflow for {norm_t} with appropriate syntax and verification rules."
                ]

    @classmethod
    def get_semantic_sub_b_variants(cls, st: str, norm_t: str, bn: str) -> List[str]:
        """Returns diverse Bloom-aligned academic question variants for sub-question (b)."""
        if st == "LANGUAGE_KEYWORDS":
            if bn in ['Remember', 'Understand']:
                return [
                    "b) Explain the use of the final keyword in Java.",
                    "b) Define a constructor. Illustrate the different types of constructors with an example.",
                    "b) Illustrate the difference between 'this' keyword and 'super' keyword with an example program.",
                    "b) Explain the use of the static keyword for variables, methods, and blocks.",
                    f"b) Explain the working mechanism and syntax of {norm_t} with an illustrative code snippet.",
                    f"b) Describe the scoping rules, access restrictions, and lifecycle semantics of {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    "b) Write a Java program demonstrating the use of the final keyword with variables, methods, and classes.",
                    "b) Demonstrate the practical use of super keyword to invoke parent constructor and parent methods.",
                    f"b) Write a code snippet demonstrating the practical implementation of {norm_t}.",
                    f"b) Implement a program illustrating custom configurations and exception handling around {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Differentiate between the usage of {norm_t} and related constructs with suitable examples.",
                    f"b) Analyze the execution path and memory allocations when {norm_t} is invoked under concurrent execution.",
                    f"b) Critically examine compiler optimizations and runtime bytecode representations associated with {norm_t}."
                ]
            else:
                return [
                    f"b) Formulate an optimized software pattern leveraging {norm_t} to satisfy stringent performance requirements.",
                    f"b) Design a reusable framework component encapsulating {norm_t} with clear verification steps."
                ]

        elif st == "EXCEPTION_HANDLING":
            if bn in ['Remember', 'Understand']:
                return [
                    "b) Differentiate the keywords throw and throws.",
                    "b) Explain the difference between checked and unchecked exceptions with examples.",
                    f"b) Describe how {norm_t} coordinates error propagation and guarantees resource cleanup.",
                    f"b) Discuss the runtime stack unwinding mechanism and exception hierarchy structure in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    "b) Illustrate a user-defined exception in Java with an example.",
                    "b) Write a program illustrating how multiple catch blocks handle different exception types.",
                    f"b) Implement a program demonstrating custom exception handling and the use of {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the execution path when runtime exceptions occur inside {norm_t}.",
                    f"b) Evaluate how unhandled exceptions in multi-threaded contexts impact data consistency in {norm_t}.",
                    f"b) Compare checked versus unchecked exception strategies in enterprise application architectures."
                ]
            else:
                return [
                    f"b) Design an enterprise exception handling framework incorporating automated telemetry and circuit breakers in {norm_t}.",
                    f"b) Construct a fault-resilient transaction rollback architecture leveraging custom exceptions in {norm_t}."
                ]

        elif st == "MULTITHREADING":
            if bn in ['Remember', 'Understand']:
                return [
                    "b) Draw and explain the lifecycle of thread.",
                    "b) Illustrate inter-thread communication in Java with an example.",
                    "b) Discuss thread priorities, synchronization, and the purpose of the synchronized keyword in Java."
                ]
            elif bn == 'Apply':
                return [
                    "b) Illustrate inter-thread communication in Java with an example.",
                    "b) Design a Java program that showcases the concept of blocking a thread and illustrating how to control the execution flow and coordination between multiple threads in a controlled manner using thread synchronization.",
                    "b) Write a Java program demonstrating thread synchronization using synchronized methods or blocks."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    "b) Differentiate between the Thread class and the Runnable interface for multi-threaded programming.",
                    "b) Analyze the difference between synchronous method execution and synchronized statement blocks in Java."
                ]
            else:
                return [
                    "b) Design a multi-threaded producer-consumer system incorporating thread synchronization and thread blocking in Java.",
                    "b) Formulate an extensible thread scheduling routine for concurrent tasks."
                ]

        elif st == "DATABASE_CONNECTIVITY":
            if bn in ['Remember', 'Understand']:
                return [
                    "b) Describe the architecture of Hibernate framework and explain the role of each component in detail.",
                    "b) Describe the key features and benefits of the Spring Framework.",
                    "b) Explain the step-by-step process of establishing a database connection and executing SQL queries using JDBC."
                ]
            elif bn == 'Apply':
                return [
                    "b) Write a Java code snippet demonstrating database transaction management (commit and rollback) using JDBC.",
                    "b) Demonstrate how to retrieve and iterate through records using ResultSet in JDBC."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    "b) Compare Type-1, Type-2, Type-3, and Type-4 JDBC drivers with respect to performance and portability.",
                    "b) Differentiate between JDBC and Hibernate ORM framework for enterprise data persistence."
                ]
            else:
                return [
                    "b) Design an enterprise persistence layer using Hibernate ORM and Spring Framework in Java.",
                    "b) Formulate an end-to-end database connectivity architecture incorporating connection pooling."
                ]

        elif st == "APPLET_GUI":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Describe event delegation models, listener interfaces, and adapter classes in {norm_t}.",
                    f"b) Explain the component hierarchy and repaint mechanics utilized in {norm_t}.",
                    f"b) Discuss layout manager strategies (FlowLayout, BorderLayout, GridLayout) used in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write an illustrative implementation demonstrating user interaction or event listeners in {norm_t}.",
                    f"b) Implement custom drawing and geometric rendering routines in {norm_t} using paint and graphics methods.",
                    f"b) Construct an interactive GUI form processing user input and validating form fields in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze thread safety considerations on the Event Dispatch Thread (EDT) in {norm_t}.",
                    f"b) Evaluate event propagation latency and component clipping issues in complex GUI hierarchies for {norm_t}."
                ]
            else:
                return [
                    f"b) Design a responsive graphical user dashboard incorporating asynchronous data feeds in {norm_t}.",
                    f"b) Formulate an extensible custom widget library utilizing custom rendering and event hooks in {norm_t}."
                ]

        elif st == "OOP_CONCEPTS":
            if bn in ['Remember', 'Understand']:
                return [
                    "b) Illustrate method overloading in Java with an example program.",
                    "b) Define a constructor. Illustrate the different types of constructors with an example.",
                    "b) Demonstrate how to create and implement an interface with an example program.",
                    "b) Explain the distinction between abstract classes and interfaces with suitable code examples.",
                    f"b) Explain the distinction between compile-time (static) polymorphism and runtime (dynamic) binding in {norm_t}.",
                    f"b) Describe how abstract classes and interfaces define behavioral contracts in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    "b) Illustrate method overloading in Java with an example program.",
                    "b) Demonstrate how to create and implement an interface with an example program.",
                    "b) Write a Java program demonstrating method overriding and dynamic polymorphism.",
                    f"b) Demonstrate the procedural application of {norm_t} with appropriate class hierarchies and code snippets.",
                    f"b) Implement an object-oriented solution demonstrating method overriding and superclass constructor chaining in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the runtime memory footprint and virtual dispatch table (vtable) resolution in {norm_t}.",
                    f"b) Critically examine deep inheritance hierarchies versus object composition in {norm_t} with respect to maintainability.",
                    f"b) Evaluate how dynamic binding impacts runtime execution performance under high-frequency method invocations."
                ]
            else:
                return [
                    f"b) Design an extensible domain model employing SOLID principles and abstract component interfaces based on {norm_t}.",
                    f"b) Synthesize an architectural pattern utilizing dependency inversion and loose coupling based on {norm_t}."
                ]

        elif st == "RELATIONAL_DATA_MODELING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the normalization process from 1NF through 3NF/BCNF with relational examples, showing how functional dependencies eliminate anomalies.",
                    f"b) Describe the syntax and operational role of fundamental Relational Algebra operators (Selection, Projection, Join, Union) with sample relations.",
                    f"b) Discuss the concepts of primary key, surrogate key, foreign key, and referential integrity enforcement in relational database management systems.",
                    f"b) Explain how views are created, updated, and queried in relational database systems to enforce security and simplify queries."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Demonstrate the normalization of an unnormalized relation with given functional dependencies up to 3NF/BCNF step-by-step.",
                    f"b) Formulate Relational Algebra expressions to retrieve specific data attributes across multiple relations for a given database instance.",
                    f"b) Illustrate the conversion of an enterprise ER schema containing weak entities and recursive relationships into normalized relational schemas.",
                    f"b) Write formal relational queries demonstrating natural join, outer join, and division operations on sample relations."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze whether a given relational decomposition is lossless-join and dependency-preserving, providing formal mathematical proof.",
                    f"b) Critically examine the trade-offs between schema normalization (reducing redundancy) and query performance (join overhead) in production databases.",
                    f"b) Evaluate how Boyce-Codd Normal Form (BCNF) handles overlapping candidate keys compared to Third Normal Form (3NF)."
                ]
            else:
                return [
                    f"b) Formulate an enterprise database schema in 3NF/BCNF for a given problem specification, detailing all integrity constraints, domains, and keys.",
                    f"b) Design a relational schema migration blueprint for {norm_t}, specifying foreign key cascades, triggers, and table partition schemes."
                ]

        elif st == "WEB_DATABASE_ARCH":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Discuss database connectivity interfaces (ODBC/JDBC) and connection pooling strategies in Web Database Architectures.",
                    f"b) Describe the role of middleware, object-relational mapping (ORM), and database drivers in bridging web applications with database engines.",
                    f"b) Explain how web servers manage persistent database connections and coordinate transaction lifecycles across HTTP requests."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Demonstrate how a server-side script establishes connection pooling and executes parameterized queries using JDBC/ODBC.",
                    f"b) Write an end-to-end implementation workflow showing how a web service connects to a backend database, processes transactions, and returns formatted data.",
                    f"b) Construct a database connectivity module utilizing connection pooling and transaction commit/rollback logic."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze transaction management, session state synchronization, and caching mechanisms in high-traffic web database architectures.",
                    f"b) Evaluate how connection pool exhaustion and resource leakage impact web database server throughput under heavy traffic loads.",
                    f"b) Examine latency and concurrency bottlenecks when multiple web server instances access a shared database cluster."
                ]
            else:
                return [
                    f"b) Formulate an end-to-end database connectivity and connection pool management architecture for high-concurrency web applications.",
                    f"b) Design an enterprise multi-datacenter web database connectivity blueprint incorporating read/write splitting and distributed caching."
                ]

        elif st == "DATABASE_CRUD":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the syntax, filter operators, and projection rules used for data querying in {norm_t} with illustrative examples.",
                    f"b) Describe the execution pipeline and syntax used for inserting, modifying, and deleting records or documents in {norm_t}.",
                    f"b) Discuss the operational behavior of bulk insert, upsert, and conditional update commands in {norm_t}."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Formulate structured queries or commands demonstrating data retrieval, filtering, and aggregation in {norm_t}.",
                    f"b) Implement queries demonstrating multi-field updates, conditional deletions, and array operations in {norm_t}.",
                    f"b) Write structured aggregation pipelines demonstrating grouping, counting, and sorting in {norm_t}."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze query performance in {norm_t} with and without index utilization, detailing how execution plans reflect efficiency.",
                    f"b) Evaluate the computational efficiency of aggregation pipelines versus map-reduce operations in {norm_t}.",
                    f"b) Examine the write amplification and lock overhead associated with high-frequency updates in {norm_t}."
                ]
            else:
                return [
                    f"b) Design a complete data manipulation and aggregation pipeline in {norm_t} to produce comprehensive analytical summary reports.",
                    f"b) Formulate a high-throughput ETL data pipeline specifying extraction, transformation, and load commands in {norm_t}."
                ]

        elif st == "DATABASE_TRANSACTIONS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain how the write-ahead logging (WAL) protocol and checkpointing guarantee durability during system crashes in {norm_t}.",
                    f"b) Describe the principles of serializability and conflict serializability in concurrent transaction schedules with illustrative examples.",
                    f"b) Discuss the differences between shared (read) and exclusive (write) locks in database transaction management."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Design a practical database schema implementing integrity constraints, transactions, and views for an enterprise application in {norm_t}.",
                    f"b) Illustrate how isolation levels (Read Committed vs Serializable) resolve race conditions in {norm_t} with a step-by-step transaction trace.",
                    f"b) Construct a database transaction script implementing error checking, savepoint management, and conditional commit/rollback."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze how lock contention, lock escalation, and deadlocks affect transaction throughput in high-concurrency database systems.",
                    f"b) Evaluate recovery algorithms (such as ARIES) in maintaining atomicity and durability after an abrupt power failure in {norm_t}.",
                    f"b) Compare multi-version concurrency control (MVCC) with lock-based concurrency control in high-write transactional systems."
                ]
            else:
                return [
                    f"b) Construct a robust transactional schema architecture enforcing ACID compliance and automated conflict resolution for {norm_t}.",
                    f"b) Design a distributed transaction management protocol for microservices utilizing the Saga pattern or two-phase commit."
                ]

        elif st == "STATE_MANAGEMENT":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Discuss session security vulnerabilities (session hijacking, fixation) and explain mitigation strategies (HttpOnly, Secure, SameSite) in {norm_t}.",
                    f"b) Explain how token-based authentication (such as JWT) differs from traditional session-cookie state management in web applications.",
                    f"b) Describe how server-side session stores manage session timeout, serialized state objects, and garbage collection."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Implement a secure session management workflow in {norm_t} incorporating session expiration, regeneration, and HTTPS enforcement.",
                    f"b) Demonstrate how stateless authentication tokens are signed, verified, and refreshed during client-server exchanges in {norm_t}.",
                    f"b) Write code demonstrating how session attributes are bound, retrieved, and invalidated across multiple page requests."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the architectural trade-offs between client-side token storage (localStorage vs cookies) and server-side session stores in {norm_t}.",
                    f"b) Evaluate token revocation and replay attack mitigation strategies in distributed stateless architectures.",
                    f"b) Critically examine sticky sessions (session affinity) versus centralized session caches (Redis) in clustered web server deployments."
                ]
            else:
                return [
                    f"b) Design an enterprise-grade stateless authentication and authorization pipeline utilizing secure tokens in {norm_t}.",
                    f"b) Formulate a distributed caching blueprint for session state synchronization across geographically distributed web servers."
                ]

        elif st == "WEB_REQUESTS_HTTP":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the role of JSON in modern web data interchange and illustrate its usage in API request-response payloads.",
                    f"b) Describe the format, encoding, and transport of HTTP request headers and response status lines during web transactions.",
                    f"b) Discuss content negotiation headers (Accept, Content-Type) and explain how web services serialize data structures into JSON payloads."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Formulate a structured JSON request payload and its corresponding API response schema for a client-server interaction in {norm_t}.",
                    f"b) Demonstrate how HTTP methods (GET, POST, PUT, DELETE) and query parameters are utilized to interact with a RESTful web resource.",
                    f"b) Implement a client-side API invocation script parsing JSON responses and handling HTTP error codes gracefully."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the serialization overhead, parsing efficiency, and data validation rules when using JSON compared to XML in web communications.",
                    f"b) Critically examine how HTTP persistent connections (Keep-Alive) and pipelining impact network latency in high-volume web services.",
                    f"b) Evaluate security risks associated with unvalidated HTTP headers, including cross-site scripting (XSS) and header injection."
                ]
            else:
                return [
                    f"b) Design a comprehensive JSON data schema and API payload contract for an enterprise web service utilizing {norm_t}.",
                    f"b) Formulate an end-to-end API communication protocol incorporating JSON schema validation, compression, and rate limiting."
                ]

        elif st == "ASYMPTOTIC_NOTATIONS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the formal definitions of Little o and Little Omega notations and contrast them with Big O and Big Omega.",
                    f"b) Describe how asymptotic notations allow algorithm designers to compare algorithm efficiency independently of machine hardware.",
                    f"b) Discuss why Big O is used for upper bounds and Big Omega for lower bounds with graphical plots."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Analyze the best, average, and worst-case time complexities of fundamental search or sort algorithms using asymptotic notations.",
                    f"b) Solve recurrence relations of divide-and-conquer algorithms using the Master Theorem, stating the applicable case and asymptotic solution.",
                    f"b) Compute the exact asymptotic growth rate for given code snippets containing nested and dependent loops."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Critically examine how constant factors and lower-order terms influence algorithm selection for small versus large input sizes.",
                    f"b) Evaluate the space complexity and auxiliary memory requirements of recursive versus iterative algorithms using asymptotic notation.",
                    f"b) Prove mathematically that f(n) = 3n^2 + 5n + 2 is O(n^2) using formal epsilon-c definitions."
                ]
            else:
                return [
                    f"b) Formulate an optimized algorithmic design in {norm_t} achieving O(n log n) or better time complexity, proving its asymptotic optimality.",
                    f"b) Synthesize an algorithmic framework with proven sub-quadratic bounds to solve large-scale computational challenges."
                ]

        elif st == "ALGORITHMS_DESIGN":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the fundamental differences between Greedy algorithms and Dynamic Programming paradigms with suitable examples.",
                    f"b) Describe how optimal substructure and overlapping subproblems enable efficient solution design in {norm_t}.",
                    f"b) Discuss the workflow of backtracking and branch-and-bound techniques in solving combinatorial problems."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Demonstrate the execution and trace of {norm_t} on a sample dataset, evaluating its operational efficiency.",
                    f"b) Apply the principles of {norm_t} to formulate a step-by-step solution for a classic computational problem.",
                    f"b) Write pseudocode implementing {norm_t} and calculate its exact step count on sample inputs."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the time complexity recurrence relation and recursion tree of {norm_t}, deriving its exact closed-form bound.",
                    f"b) Evaluate the space complexity and recursive call stack overhead of {norm_t} under adverse input configurations.",
                    f"b) Differentiate between dynamic programming memoization (top-down) and tabulation (bottom-up) in {norm_t}."
                ]
            else:
                return [
                    f"b) Design a dynamic programming or greedy formulation for {norm_t}, detailing state definitions, transitions, and base conditions.",
                    f"b) Construct a hybrid algorithmic strategy combining divide-and-conquer with heuristic pruning for {norm_t}."
                ]

        elif st == "PROBLEM_SOLVING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the concept and significance of desk-checking in program development. Illustrate with a sample trace table.",
                    f"b) Discuss how algorithm validation and verification prevent logical errors during software development.",
                    f"b) Describe the role of data representation and formal problem definition in computational problem solving."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Illustrate the step-by-step desk-checking of an algorithm using a structured trace table with test values.",
                    f"b) Apply validation techniques to trace the execution of an algorithm and identify potential logical flaws."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the effectiveness of desk-checking compared to automated unit test execution for detecting runtime anomalies."
                ]
            else:
                return [
                    f"b) Formulate a structured verification strategy incorporating desk-checking and test trace tables."
                ]

        elif st == "ALGORITHMS_REPRESENTATION":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Describe the key design objectives, structure, and advantages of Pseudocode with a suitable example.",
                    f"b) Explain the rules and conventions for drawing flowcharts with neat schematic illustrations.",
                    f"b) Differentiate between flowcharts and pseudocode in terms of clarity, modification, and machine independence."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Illustrate the practical representation of an algorithm using structured pseudocode with an example.",
                    f"b) Draw an authentic flowchart representing decision and iteration logic for a given computational problem."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Critically examine when pseudocode is preferable over graphical flowchart representations in large-scale system design."
                ]
            else:
                return [
                    f"b) Design a comprehensive pseudocode specification for a multi-step algorithmic pipeline."
                ]

        elif st == "CONTROL_STRUCTURES":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the syntax, execution flow, and advantages of the switch-case statement compared to an if-else ladder.",
                    f"b) Discuss the break and continue control statements with illustrative code examples.",
                    f"b) Explain nested looping structures and loop termination conditions with flowcharts."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write an illustrative code snippet demonstrating nested conditional or iterative control logic.",
                    f"b) Develop a program utilizing a switch-case statement to implement a menu-driven arithmetic calculator."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the jump mechanics and control hazards of goto and break statements in structured programming."
                ]
            else:
                return [
                    f"b) Design an optimized state machine using switch-case selection and loop constructs."
                ]

        elif st == "USER_DEFINED_TYPES":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the purpose, declaration syntax, and advantages of the typedef keyword with illustrative examples.",
                    f"b) Differentiate between structures and unions in terms of syntax, memory allocation, and access speed.",
                    f"b) Describe self-referential structures and explain their role in creating dynamic data structures."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write a code snippet demonstrating how self-referential structures or typedef are used in practice.",
                    f"b) Demonstrate structure variable declaration, initialization, and dot-operator member access with a program."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the memory footprint and member alignment of structure variables versus union variables with diagrams."
                ]
            else:
                return [
                    f"b) Formulate an extensible user-defined type definition utilizing typedef and self-referential structures."
                ]

        elif st == "PROGRAMMING_FUNDAMENTALS":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain variable declaration, initialization, scope, and storage rules with suitable examples.",
                    f"b) Describe arithmetic operators, precedence rules, and associativity in expression evaluation.",
                    f"b) Discuss the importance of keywords and identifier naming rules in programming languages."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Illustrate the step-by-step evaluation of a complex arithmetic expression according to precedence rules.",
                    f"b) Write a code snippet demonstrating local versus global variable scope and lifetime."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the side effects of prefix and postfix increment operators in compound arithmetic expressions."
                ]
            else:
                return [
                    f"b) Formulate a robust expression evaluation routine respecting operator precedence and type promotion."
                ]

        elif st == "FUNCTIONS_MODULARITY":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Explain the distinction between pass by value and pass by reference with suitable memory diagrams.",
                    f"b) Describe the role and syntax of function prototypes in modern modular programming.",
                    f"b) Discuss recursive functions, base cases, and stack frame allocation with an example."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write a function demonstrating call by reference to swap or modify caller variables.",
                    f"b) Implement a recursive function with an illustrative trace of its execution stages."
                ]
            else:
                return [
                    f"b) Analyze call stack growth and memory limit considerations during deep recursive calls."
                ]

        elif st == "POINTERS_MEMORY":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Differentiate between a NULL pointer and a generic (void) pointer with syntax and memory diagrams.",
                    f"b) Explain dynamic memory allocation using malloc() and free() with illustrative code.",
                    f"b) Describe pointer-to-structure access using the arrow (->) operator with an example."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write a code snippet demonstrating dynamic memory allocation and deallocation for an array of integers.",
                    f"b) Implement a pointer function to traverse and manipulate elements of an array."
                ]
            else:
                return [
                    f"b) Analyze the causes of segmentation faults and memory corruption associated with uninitialized pointers."
                ]

        elif st == "SOFTWARE_TESTING":
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Differentiate between verification and validation in the software testing lifecycle.",
                    f"b) Describe the structure of a test case and explain boundary value analysis with examples.",
                    f"b) Discuss unit testing versus integration testing in ensuring program correctness."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Formulate a set of boundary value test cases for validating user input in a computational function.",
                    f"b) Illustrate the debugging process used to isolate and correct a logic error in code."
                ]
            else:
                return [
                    f"b) Critically assess the test coverage and defect prevention capabilities of white-box testing."
                ]

        else:
            # GENERAL_TECHNICAL Fallback (OBE University Exam Standard)
            if bn in ['Remember', 'Understand']:
                return [
                    f"b) Illustrate the working and practical use of {norm_t} with a suitable example.",
                    f"b) Explain the declaration syntax, components, and primary features of {norm_t} with code or diagrams.",
                    f"b) Discuss the key advantages, limitations, and practical importance of {norm_t}.",
                    f"b) Describe the execution steps and behavioral characteristics of {norm_t} in detail.",
                    f"b) Differentiate {norm_t} from related foundational techniques with illustrative examples."
                ]
            elif bn == 'Apply':
                return [
                    f"b) Write a code snippet or procedure demonstrating the practical use of {norm_t}.",
                    f"b) Illustrate how {norm_t} is applied to solve a practical programming task with syntax and explanation.",
                    f"b) Demonstrate the practical application of {norm_t} in solving a computational problem.",
                    f"b) Construct a structured solution implementing {norm_t} with appropriate syntax and logic."
                ]
            elif bn in ['Analyze', 'Evaluate']:
                return [
                    f"b) Analyze the execution trade-offs, scalability considerations, and operational characteristics of {norm_t}.",
                    f"b) Critically examine how {norm_t} handles concurrency, fault recovery, and resource allocation under heavy workloads.",
                    f"b) Evaluate alternative engineering methodologies against {norm_t}, assessing maintainability and performance."
                ]
            else:
                return [
                    f"b) Design a robust technical solution leveraging {norm_t} to satisfy stringent system requirements.",
                    f"b) Formulate an end-to-end implementation workflow for {norm_t} with appropriate syntax and verification rules."
                ]

    @classmethod
    def generate_semantic_long_answer_sub(
        cls,
        t1: str,
        t2: str,
        t3: str = "",
        t4: str = "",
        bloom_level: str = "Understand",
        co_id: str = "CO1",
        pattern_idx: int = 0,
        bloom_level_b: Optional[str] = None
    ) -> str:
        st1 = cls.classify_topic_semantic_type(t1)
        st2 = cls.classify_topic_semantic_type(t2)
        norm_t1 = cls.normalize_topic_for_question(t1)
        norm_t2 = cls.normalize_topic_for_question(t2)
        bn_a = (bloom_level or 'Understand').capitalize()
        bn_b = (bloom_level_b or bloom_level or 'Apply').capitalize()

        var_a = cls.get_semantic_sub_a_variants(st1, norm_t1, bn_a)
        qa = var_a[pattern_idx % len(var_a)]

        var_b = cls.get_semantic_sub_b_variants(st2, norm_t2, bn_b)
        qb = var_b[pattern_idx % len(var_b)]

        return f"{qa}\n\n{qb}"

    @classmethod
    def generate_semantic_long_answer_or(
        cls,
        t1: str,
        t2: str,
        t3: str = "",
        t4: str = "",
        bloom_level: str = "Understand",
        co_id: str = "CO1",
        pattern_idx: int = 0,
        bloom_level_b: Optional[str] = None
    ) -> str:
        topic_a = t3 or t1
        topic_b = t4 or t2
        st_a = cls.classify_topic_semantic_type(topic_a)
        st_b = cls.classify_topic_semantic_type(topic_b)
        norm_ta = cls.normalize_topic_for_question(topic_a)
        norm_tb = cls.normalize_topic_for_question(topic_b)
        bn_a = (bloom_level or 'Understand').capitalize()
        bn_b = (bloom_level_b or bloom_level or 'Apply').capitalize()

        var_a = cls.get_semantic_sub_a_variants(st_a, norm_ta, bn_a)
        qa = var_a[(pattern_idx + 1) % len(var_a)]

        var_b = cls.get_semantic_sub_b_variants(st_b, norm_tb, bn_b)
        qb = var_b[(pattern_idx + 1) % len(var_b)]

        return f"{qa}\n\n{qb}"


    @classmethod
    def generate_semantic_mcq(cls, t1: str, course_name: str = "") -> str:
        st1 = cls.classify_topic_semantic_type(t1)
        if st1 == "STATE_MANAGEMENT":
            return (
                f"Which of the following attributes is essential to prevent client-side script access to sensitive session cookies?\n"
                f"A) HttpOnly\n"
                f"B) Max-Age\n"
                f"C) Path=/\n"
                f"D) Domain"
            )
        elif st1 == "WEB_REQUESTS_HTTP":
            return (
                f"Which HTTP method is defined as idempotent and primarily utilized for resource modification in RESTful services?\n"
                f"A) PUT\n"
                f"B) POST\n"
                f"C) CONNECT\n"
                f"D) PATCH"
            )
        elif st1 == "DATABASE_TRANSACTIONS":
            return (
                f"Which ACID property guarantees that all operations within a database transaction succeed or all are rolled back?\n"
                f"A) Atomicity\n"
                f"B) Consistency\n"
                f"C) Isolation\n"
                f"D) Durability"
            )
        elif st1 == "ASYMPTOTIC_NOTATIONS":
            return (
                f"Which asymptotic notation characterizes a strict asymptotic upper bound for algorithm running time?\n"
                f"A) Big O notation\n"
                f"B) Omega notation\n"
                f"C) Theta notation\n"
                f"D) Little o notation"
            )
        elif st1 == "ALGORITHMS_DESIGN":
            return (
                f"What is the average-case time complexity of the Quick Sort algorithm when sorting an array of n elements?\n"
                f"A) O(n log n)\n"
                f"B) O(n^2)\n"
                f"C) O(n)\n"
                f"D) O(log n)"
            )
        elif st1 == "DATABASE_COMPARISON":
            return (
                f"Which key architectural advantage distinguishes NoSQL document databases like MongoDB from traditional RDBMS?\n"
                f"A) Dynamic, schema-free JSON/BSON document modeling\n"
                f"B) Strict compile-time relational table normalization\n"
                f"C) Absence of distributed horizontal scalability\n"
                f"D) Mandatory single-node storage architectures"
            )
        else:
            return (
                f"Which of the following statements best describes {t1} in modern software architecture?\n"
                f"A) It provides core operational mechanics and interfaces for {t1}.\n"
                f"B) It bypasses data integrity checks without preserving consistency.\n"
                f"C) It optimizes resource utilization and modular communication between components.\n"
                f"D) It enforces static compile-time constraints without runtime overhead."
            )

    @classmethod
    def get_domain_fallback_concepts(cls, course_name: str = "") -> Dict[str, List[str]]:
        cn = (course_name or "").lower()
        if "database" in cn or "web" in cn:
            return {
                'Unit 1': ["Core Web Database Concepts & Architecture", "Web Database Gateways", "Client-Side and Server-Side Web Database Programming", "Session Management & Cookie-Based State Tracking", "Common Gateway Interface (CGI)"],
                'Unit 2': ["Relational Database Management Systems (RDBMS)", "Structured Data Models & Schema Design", "PostgreSQL Database CRUD Operations", "PostgreSQL Integrity Constraints & Views", "PostgreSQL Transactions & ACID Properties", "PostgreSQL Triggers & Stored Procedures"],
                'Unit 3': ["Principles & Applications of Unstructured Data", "NoSQL Database Architectures & Data Models", "Advantages of NoSQL over Relational Databases (RDBMS)", "MongoDB Data Types & Document Modeling", "MongoDB Query and Update Operators", "Cassandra Architecture and Data Model", "GraphQL Architecture and Application Components"],
                'Unit 4': ["Native Database APIs", "Database-Independent APIs", "Template-Driven Database Access Packages", "Third-Party Database Class Libraries", "Structure of Web Requests & Protocols", "JavaScript Object Notation (JSON) Data Interchange", "HTTP Request Methods (GET, POST, PUT, DELETE)", "HTTP Response Status Codes"],
                'Unit 5': ["Web Service Security & Authentication Mechanisms", "RESTful API Architecture & Endpoint Protection", "Database Encryption, Access Control & Authorization", "Web Database Scalability & Connection Pooling"]
            }
        elif "java" in cn or "oop" in cn or "programming" in cn:
            return {
                'Unit 1': ["OOP Principles & Encapsulation", "Multidimensional Arrays & Matrix Operations", "Garbage Collection & Memory Management in Java", "JVM Architecture & Bytecode Execution"],
                'Unit 2': ["Constructors & Constructor Overloading in Java", "Method Overloading & Method Overriding in Java", "The 'this' Keyword & Object Reference in Java", "The 'final' Keyword in Java (Variables, Methods, Classes)"],
                'Unit 3': ["Inheritance Hierarchies & Student Details Modeling", "Interfaces & Multiple Inheritance in Java", "Java Packages & Access Protection", "The 'super' Keyword & Member Resolution in Java"],
                'Unit 4': ["Exception Handling (try, catch, finally)", "Throw and Throws Keywords", "User-Defined Custom Exceptions"],
                'Unit 5': ["Java Multithreading & Thread Lifecycle", "Thread Synchronization & Inter-Thread Communication", "Thread Blocking & Coordination"],
                'Unit 6': ["JDBC Drivers & Database Connectivity Architecture", "Architecture of Hibernate Framework & ORM", "Features and Benefits of Spring Framework"]
            }
        elif "algorithm" in cn or "data structure" in cn:
            return {
                'Unit 1': ["Definition and Characteristics of Algorithms", "Algorithm Representation Techniques (Pseudocode & Flowcharts)", "Asymptotic Notations (Big O, Big Omega, Big Theta)", "Algorithm Complexity Analysis & Growth Rates"],
                'Unit 2': ["Divide and Conquer Strategy", "Binary Search Algorithm", "Merge Sort and Quick Sort Algorithms & Recurrence Relations"],
                'Unit 3': ["Greedy Method Principles", "Minimum Spanning Trees (Prim's and Kruskal's Algorithms)", "Single-Source Shortest Path (Dijkstra's Algorithm)"],
                'Unit 4': ["Dynamic Programming Paradigms", "0/1 Knapsack Problem", "All-Pairs Shortest Path (Floyd-Warshall Algorithm)"],
                'Unit 5': ["Backtracking and Branch & Bound", "N-Queens Problem", "Graph Coloring & Hamiltonian Cycles", "NP-Completeness and Tractability"]
            }
        else:
            c_title = course_name or "Curriculum"
            return {
                'Unit 1': [f"{c_title} Foundational Principles & Architecture", f"{c_title} Core Concepts & Terminology"],
                'Unit 2': [f"{c_title} Structural Modeling & Design Patterns", f"{c_title} Execution Frameworks"],
                'Unit 3': [f"{c_title} Operational Mechanisms & Protocols", f"{c_title} Implementation Strategies"],
                'Unit 4': [f"{c_title} Optimization & Performance Evaluation", f"{c_title} System Verification"],
                'Unit 5': [f"{c_title} Advanced Engineering Methodologies", f"{c_title} Architectural Formulation"]
            }

    # Reference fallback patterns for custom extensions
    SHORT_ANSWER_PATTERNS = [
        lambda t1, t2, c: f"Explain the core concept, operational mechanism, and practical significance of {t1}.",
        lambda t1, t2, c: f"Differentiate between {t1} and {t2} with respect to their core characteristics and practical use cases.",
        lambda t1, t2, c: f"State the primary purpose of {t1}. Mention two key practical benefits or applications.",
        lambda t1, t2, c: f"Describe the structural components and operational flow of {t1}.",
        lambda t1, t2, c: f"Outline the step-by-step process, syntax, or commands involved in executing {t1}."
    ]

    LONG_ANSWER_PATTERNS = [
        (
            lambda t1, t2, t3, t4: f"a) Explain the fundamental concepts, working principles, and practical significance of {t1} with suitable illustrations. [{{p1}}M]\n\nb) Illustrate the practical application of {t2} with appropriate syntax, code snippets, or structured models. [{{p2}}M]",
            lambda t1, t2, t3, t4: f"a) Analyze the architectural role, structural components, and performance factors governing {t3} with neat illustrations. [{{p1}}M]\n\nb) Design a comprehensive technical solution demonstrating how {t4} is utilized to resolve practical engineering requirements. [{{p2}}M]",
            lambda t1, t2: f"Explain the foundational concepts, working mechanisms, and structural models of {t1} with neat schematics and illustrative examples."
        ),
        (
            lambda t1, t2, t3, t4: f"a) Discuss the theoretical foundations, structural organization, and key characteristics of {t1} with neat diagrams. [{{p1}}M]\n\nb) Demonstrate the procedural application of {t2} in solving a practical engineering problem with illustrative examples. [{{p2}}M]",
            lambda t1, t2, t3, t4: f"a) Evaluate the execution trade-offs, scalability considerations, and operational characteristics of {t3}. [{{p1}}M]\n\nb) Illustrate the step-by-step implementation of {t4} with appropriate structural models, pseudocode, or schemas. [{{p2}}M]",
            lambda t1, t2: f"Demonstrate the practical implementation and procedural workflow of {t1}. Analyze how it is applied to resolve domain-specific computational challenges with step-by-step illustrations."
        ),
        (
            lambda t1, t2, t3, t4: f"a) Describe the functional workflow, components, and primary execution stages of {t1} with illustrative examples. [{{p1}}M]\n\nb) Formulate an implementation strategy for {t2}, highlighting key parameters, configurations, and verification steps. [{{p2}}M]",
            lambda t1, t2, t3, t4: f"a) Examine the internal design principles and structural dependencies governing {t3} with neat diagrams. [{{p1}}M]\n\nb) Propose a robust engineering approach incorporating {t4} to achieve high throughput and reliability. [{{p2}}M]",
            lambda t1, t2: f"Critically examine the architectural trade-offs, performance bottlenecks, and design constraints associated with {t1}. Contrast its operational efficiency against alternative approaches."
        ),
        (
            lambda t1, t2, t3, t4: f"a) Elaborate on the underlying principles, classification, and operational flow of {t1} with neat schematics. [{{p1}}M]\n\nb) Design a structured model or schema demonstrating how {t2} is applied in practical software engineering workflows. [{{p2}}M]",
            lambda t1, t2, t3, t4: f"a) Analyze how {t3} coordinates system resources, handles concurrency, and ensures operational consistency. [{{p1}}M]\n\nb) Formulate an optimized technical solution utilizing {t4} to satisfy stringent system requirements. [{{p2}}M]",
            lambda t1, t2: f"Analyze the internal mechanics and procedural execution of {t1}. Explain how parameters, runtime constraints, and workload variations affect its operational outcome."
        ),
        (
            lambda t1, t2, t3, t4: f"a) Compare and evaluate the structural models and execution paradigms governing {t1} with neat diagrams. [{{p1}}M]\n\nb) Formulate an end-to-end implementation workflow for {t2} with appropriate syntax and verification rules. [{{p2}}M]",
            lambda t1, t2, t3, t4: f"a) Investigate the performance characteristics, failure modes, and security factors associated with {t3}. [{{p1}}M]\n\nb) Construct a robust technical solution leveraging {t4} to resolve real-world deployment challenges. [{{p2}}M]",
            lambda t1, t2: f"Design a comprehensive technical solution and architectural blueprint incorporating {t1}. Detail the end-to-end processing pipeline, data contracts, and fault-tolerance mechanisms with neat schematics."
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
    def extract_explicit_course_outcomes(cls, text: str, course_name: str = "") -> List[Dict[str, Any]]:
        """
        Scans text strictly for explicit Course Outcomes (CO1..CO6 or numbered list under Course Outcomes heading).
        Dynamically maps extracted COs to syllabus units.
        Returns [] if not found.
        """
        cleaned = cls.clean_text(text)
        if not cleaned:
            return []

        outcomes = []
        lines = [l.strip() for l in cleaned.split('\n') if l.strip()]

        # 1. Look for explicit CO1:, CO2:, CO 1 -, CO-1 patterns anywhere
        co_pattern = re.compile(r'^(CO\s*[-–—\.]?\s*[0-9]+)\s*[:\.\-–—\)]\s*(.+)', re.IGNORECASE)
        for line in lines:
            match = co_pattern.match(line)
            if match:
                raw_id = match.group(1).upper().replace(' ', '').replace('-', '').replace('.', '')
                desc = match.group(2).strip()
                desc = re.sub(r'^[0-9\.\-\s]+', '', desc).strip()
                desc = re.sub(r'\[.*?\]|\(.*?\)$', '', desc).strip()
                if len(desc) >= 8:
                    co_num = re.findall(r'[0-9]+', raw_id)
                    num_val = int(co_num[0]) if co_num else len(outcomes) + 1
                    formatted_id = f"CO{num_val}"
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

        # 2. Section heading: Course Outcomes / COs
        if not outcomes:
            co_section_active = False
            co_counter = 1
            ignore_preambles = (
                'the student will', 'students will be able to', 'upon completion',
                'at the end of the course', 'course outcomes', 'course learning outcomes',
                'expected outcomes', 'co-po mapping', 'hours', 'credits', 'course code', 'course title'
            )
            for i, line_s in enumerate(lines):
                # Check for header
                if re.search(r'^(course\s+outcomes?|course\s+learning\s+outcomes?|expected\s+outcomes?|cos?)\s*[:\.\-–—]?$', line_s, re.I):
                    co_section_active = True
                    continue
                elif re.search(r'^(syllabus|unit\s*[1-5ivx]|module\s*[1-5ivx]|course\s+content|text\s*books|references|co-po\s+mapping)', line_s, re.I):
                    if co_section_active and outcomes:
                        break
                    co_section_active = False

                if co_section_active:
                    if any(line_s.lower().startswith(p) for p in ignore_preambles):
                        continue
                    # Match numbered or bulleted: "1. Describe..." or "1." on line, desc on next line
                    bullet_match = re.match(r'^([0-9]+[\.\)]|[•\*\-\–])\s*(.*)', line_s)
                    desc_candidate = ""
                    if bullet_match:
                        desc_candidate = bullet_match.group(2).strip()
                        # If number alone on line: check next line
                        if not desc_candidate and i + 1 < len(lines):
                            next_l = lines[i + 1]
                            if not re.match(r'^[0-9]+[\.\)]', next_l) and not any(next_l.lower().startswith(p) for p in ignore_preambles):
                                desc_candidate = next_l.strip()
                    elif len(line_s) >= 20 and not line_s.endswith(':'):
                        desc_candidate = line_s

                    desc_candidate = re.sub(r'\[.*?\]|\(.*?\)$', '', desc_candidate).strip()
                    if len(desc_candidate) >= 15 and not any(desc_candidate.lower().startswith(p) for p in ignore_preambles):
                        if not any(o['description'] == desc_candidate for o in outcomes):
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

        # 3. Dynamically map COs to extracted units if units exist
        if outcomes:
            units = cls.extract_units_and_topics(cleaned, course_name)
            if units and len(units) > 0:
                outcomes = cls.map_cos_to_units(outcomes, units)

        return outcomes

    @classmethod
    def synthesize_cos_from_syllabus(cls, text: str, course_name: str = "") -> List[Dict[str, Any]]:
        """
        Synthesizes 6 accurate, domain-specific Course Outcomes (CO1..CO6) grounded directly in
        the units, topics, and technical concepts of the syllabus text.
        """
        cleaned = cls.clean_text(text)
        c_name = course_name or "the course domain"

        # Parse units
        lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
        unit_blocks = []
        cur_unit_label = None
        cur_unit_lines = []

        for l in lines:
            m = re.match(r'^(Unit|Module|Chapter)\s*([0-9IVXLCDMivxlcdm]+)', l, re.I)
            if m:
                if cur_unit_label:
                    unit_blocks.append((cur_unit_label, cur_unit_lines))
                cur_unit_label = f"Unit {m.group(2).upper()}"
                cur_unit_lines = []
            elif cur_unit_label:
                cur_unit_lines.append(l)

        if cur_unit_label:
            unit_blocks.append((cur_unit_label, cur_unit_lines))

        units_data = []
        for u_label, u_lines in unit_blocks:
            non_hours = [l for l in u_lines if not re.match(r'^[0-9]+\s*(hours|hrs|credits|marks)', l, re.I)]
            raw_title = non_hours[0] if non_hours else u_label
            u_title = re.sub(r'^(overview\s+of|introduction\s+to|basics\s+of|fundamentals\s+of)\s+', '', raw_title, flags=re.I).strip()
            body_text = ' '.join(non_hours[1:])
            
            phrases = []
            for segment in re.split(r'[,;•\t\.\-–]\s*', body_text):
                seg_c = segment.strip()
                if 3 <= len(seg_c) <= 60 and not any(sw in seg_c.lower() for sw in ['hours', 'syllabus', 'unit', 'chapter', 'question']):
                    phrases.append(seg_c)
            
            seen = set()
            dedup_phrases = []
            for p in phrases:
                if p.lower() not in seen:
                    seen.add(p.lower())
                    dedup_phrases.append(p)

            units_data.append({
                'label': u_label,
                'title': u_title,
                'phrases': dedup_phrases
            })

        outcomes = []
        num_units = len(units_data)

        if num_units == 4:
            u1 = units_data[0]
            u2 = units_data[1]
            u3 = units_data[2]
            u4 = units_data[3]

            p1_sample = ', '.join(u1['phrases'][:3]) if u1['phrases'] else 'core language constructs and paradigms'
            p1_applied = ', '.join(u1['phrases'][3:6]) if len(u1['phrases']) >= 6 else (u1['phrases'][1] if len(u1['phrases']) > 1 else 'modular implementations')
            p2_sample = ', '.join(u2['phrases'][:3]) if u2['phrases'] else 'structural components and interfaces'
            p3_sample = ', '.join(u3['phrases'][:3]) if u3['phrases'] else 'error handling and synchronization mechanisms'
            p4_sample = ', '.join(u4['phrases'][:3]) if u4['phrases'] else 'event-driven and interface components'

            outcomes = [
                {
                    'id': 'CO1',
                    'description': f"Explain foundational principles of {u1['title']}, including {p1_sample}.",
                    'bloom_level': 'Understand',
                    'unit': 'Unit 1'
                },
                {
                    'id': 'CO2',
                    'description': f"Implement modular programs applying {p1_applied} in {c_name}.",
                    'bloom_level': 'Apply',
                    'unit': 'Unit 1'
                },
                {
                    'id': 'CO3',
                    'description': f"Design extensible software components utilizing {u2['title']}, covering {p2_sample}.",
                    'bloom_level': 'Apply',
                    'unit': 'Unit 2'
                },
                {
                    'id': 'CO4',
                    'description': f"Analyze and construct robust solutions using {u3['title']}, emphasizing {p3_sample}.",
                    'bloom_level': 'Analyze',
                    'unit': 'Unit 3'
                },
                {
                    'id': 'CO5',
                    'description': f"Develop interactive applications and systems implementing {u4['title']}, including {p4_sample}.",
                    'bloom_level': 'Create',
                    'unit': 'Unit 4'
                },
                {
                    'id': 'CO6',
                    'description': f"Evaluate design trade-offs, architecture patterns, and runtime constraints in {c_name}.",
                    'bloom_level': 'Evaluate',
                    'unit': 'Unit 4'
                }
            ]
        elif num_units >= 5:
            bloom_cycle = ['Understand', 'Apply', 'Apply', 'Analyze', 'Evaluate', 'Create']
            verbs = [
                'Explain foundational principles and architectures of',
                'Implement practical algorithms and methods using',
                'Design modular components and structural solutions for',
                'Analyze computational workflows and performance bottlenecks in',
                'Evaluate trade-offs, constraints, and system specifications in',
                'Synthesize advanced implementations and system designs for'
            ]
            for i in range(6):
                target_unit = units_data[min(i, num_units - 1)]
                p_sample = ', '.join(target_unit['phrases'][:3]) if target_unit['phrases'] else 'domain constructs'
                outcomes.append({
                    'id': f"CO{i+1}",
                    'description': f"{verbs[i]} {target_unit['title']}, addressing {p_sample}.",
                    'bloom_level': bloom_cycle[i],
                    'unit': f"Unit {min(5, i+1)}"
                })
        else:
            concepts = cls.extract_keywords(cleaned)
            buckets = [concepts[i::6] for i in range(6)]
            bloom_cycle = ['Understand', 'Apply', 'Apply', 'Analyze', 'Evaluate', 'Create']
            verbs = [
                'Explain fundamental principles and core concepts of',
                'Apply practical techniques and programming methods for',
                'Design component structures and modular frameworks in',
                'Analyze critical mechanisms, data flows, and constraints in',
                'Evaluate architectural trade-offs and performance criteria in',
                'Formulate comprehensive solutions and engineering designs for'
            ]
            for i in range(6):
                c_slice = ', '.join(buckets[i][:3]) if buckets[i] else f"key topic {i+1}"
                outcomes.append({
                    'id': f"CO{i+1}",
                    'description': f"{verbs[i]} {c_slice} in {c_name}.",
                    'bloom_level': bloom_cycle[i],
                    'unit': f"Unit {min(5, i+1)}"
                })

        return outcomes

    @classmethod
    def extract_course_outcomes(cls, text: str, course_name: str = "", force_synthesize: bool = False) -> Tuple[List[Dict[str, Any]], str]:
        """
        Unified extraction & synthesis:
        1. If not force_synthesize, tries to extract explicit COs from the document.
        2. If explicit COs not found (or force_synthesize is True), accurately synthesizes 6 OBE COs from syllabus units/topics.
        Returns: (outcomes, source_type) where source_type is 'document' or 'syllabus_synthesized'.
        """
        if not force_synthesize:
            explicit = cls.extract_explicit_course_outcomes(text, course_name=course_name)
            if explicit and len(explicit) > 0:
                return explicit, 'document'

        synthesized = cls.synthesize_cos_from_syllabus(text, course_name)
        return synthesized, 'syllabus_synthesized'

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
        'unit 4', 'unit 5', 'module 1', 'module 2', 'module 3', 'module 4', 'module 5',
        'web application overview', 'structured databases', 'unstructured databases', 'overview of postgresql',
        'overview of mongodb', 'connecting to database', 'web requests', 'advanced postgresql', 'postgresql database',
        'challenges of structured data', 'challenges of unstructured data', 'overview of web databases',
        'definition', 'definitions', 'characteristics', 'representation', 'representations', 'environment setup',
        'setup', 'create', 'select', 'drop', 'select and drop', 'create database', 'drop database',
        'create collection', 'drop collection', 'crud', 'documents', 'shell', 'cloud', 'post', 'put', 'delete', 'get',
        'status code', 'response status code', 'install mongodb', 'challenges', 'programs and algorithms'
    }

    @classmethod
    def clean_concept_name(cls, concept: str, course_name: str = "") -> str:
        """
        Cleans topic name by removing section noise, unit prefixes, hour counts, and enrich domain concepts.
        Strictly filters out course codes (e.g. 23CSC23, CSC23), course titles, and structural document keywords.
        Ensures proper capitalization and no fragmented phrases remain.
        """
        if not concept:
            return ""
        c = concept.strip()
        
        # Strip unit/module/chapter prefixes
        c = re.sub(r'^(unit|module|chapter|part|section)\s*[-–—:\s]*([0-9]+|[IVXLCDMivxlcdm]+)[:\.\-\s]*', '', c, flags=re.IGNORECASE).strip()
        # Strip hours/credits/marks markers
        c = re.sub(r'^[0-9]+\s*(hours|hrs|credits|marks)\s*[:\.\-]?\s*', '', c, flags=re.IGNORECASE).strip()
        c = re.sub(r'\b[0-9]+\s*(hours|hrs|credits|marks)\b', '', c, flags=re.IGNORECASE).strip()
        # Strip introductory boilerplates
        c = re.sub(r'^(overview\s+of|introduction\s+to|basics\s+of|fundamentals\s+of|importance\s+of|concept\s+of|usage\s+of|study\s+of|principles\s+of|syllabus\s+for|syllabus\s+of|detailed\s+syllabus\s+of)\s+', '', c, flags=re.IGNORECASE).strip()
        # Strip leading/trailing numbering, bullets or symbols
        c = re.sub(r'^[0-9\.\*\#\s\(\)\:\-\[\]\>•]+', '', c).strip()
        c = re.sub(r'[:\.\-,\;\s\[\]\>\(\)•]+$', '', c).strip()

        # Balance unmatched parentheses
        if c.count('(') > c.count(')'):
            c = re.sub(r'\s*\([^)]*$', '', c).strip()
        elif c.count(')') > c.count('('):
            c = re.sub(r'^[^()]*\)\s*', '', c).strip()

        # Remove leading/trailing conjunctions and prepositions
        c = re.sub(r'^(and|or|with|for|in|of|by|to|etc)\s+', '', c, flags=re.IGNORECASE).strip()
        c = re.sub(r'\s+(and|or|with|for|in|of|by|to|etc)$', '', c, flags=re.IGNORECASE).strip()

        # Reject if contains course code pattern (e.g. "23CSC23", "CSC23", "CS101", "20IT302")
        if re.search(r'\b[0-9]{0,4}[A-Z]{2,}[0-9]{2,}\b', c):
            return ""

        # Reject credit patterns e.g. "3 0 0 3", "3-0-0-3", "L T P C", "L-T-P-C"
        if re.match(r'^[0-9]\s+[0-9]\s+[0-9]\s+[0-9]$', c) or re.search(r'\b(l\s*t\s*p\s*c|ltpc)\b', c, re.IGNORECASE):
            return ""

        # Reject CO-PO mapping matrix lines
        if re.search(r'\b(co-po|pso[0-9]|po[0-9]|cos\s+po|strongly\s+linked|moderately\s+linked|weakly\s+linked)\b', c, re.IGNORECASE):
            return ""

        # Reject pure numbers or page numbers
        if re.match(r'^[0-9]+$', c):
            return ""

        if not c or len(c) < 3 or len(c) > 90:
            return ""

        c_low = c.lower().strip()

        # Direct blocklist match
        if c_low in cls.METADATA_STOPWORDS:
            return ""

        # Reject isolated action verbs and standalone metadata fragments
        isolated_bad_words = {
            'definition', 'definitions', 'define', 'characteristics', 'characteristic',
            'representation', 'representations', 'introduction', 'overview', 'basics',
            'fundamental', 'fundamentals', 'setup', 'environment setup', 'install',
            'installation', 'create', 'select', 'drop', 'select and drop', 'create database',
            'drop database', 'create collection', 'drop collection', 'crud', 'document',
            'documents', 'shell', 'cloud', 'mongodb shell', 'mongodb cloud', 'post', 'put',
            'delete', 'get', 'status code', 'response status code', 'web application overview',
            'structured databases', 'unstructured databases', 'overview of postgresql',
            'overview of mongodb', 'connecting to database', 'web requests', 'advanced postgresql',
            'challenges of structured data', 'challenges of unstructured data', 'algorithms',
            'programs and algorithms', 'challenges', 'types', 'type', 'usages', 'usage'
        }
        if c_low in isolated_bad_words or (len(c_low.split()) == 1 and c_low in isolated_bad_words):
            return ""

        # Substring/Regex check for metadata keywords (e.g., "Syllabus Content", "Text Books", "Reference Books")
        if re.search(r'\b(syllabus|curriculum|text\s*books?|reference\s*books?|course\s*outcomes?|course\s*objectives?|prerequisites?|credits?|lecture\s*hours?|edition|isbn|publisher|publishers|publication|author|authors|academic\s*year|regulation)\b', c_low):
            return ""

        # Author / publisher specific checks
        if re.search(r'\b(herbert\s+schildt|balagurusamy|kathy\s+sierra|pearson|mcgraw\s*hill|wiley|prentice\s+hall|oxford|tata\s+mcgraw|deitel)\b', c_low):
            return ""

        # URL / file / page citations
        if c_low.startswith(('http://', 'https://', 'www.', 'ftp://', 'page ', 'pages ', 'vol.', 'isbn', 'doi:')):
            return ""

        c_low = c_low.replace('cgl', 'cgi').replace('apls', 'apis')

        c_name_lower = (course_name or "").lower().strip()
        if c_name_lower:
            if c_low == c_name_lower or c_low in c_name_lower or c_name_lower in c_low:
                stripped = c_low.replace(c_name_lower, '').strip()
                if len(stripped) < 4:
                    return ""

        # Human-like domain enrichments & standardizations
        if c_low in ["basic concepts of web", "concept of web", "web concepts"]:
            return "Core Web Database Concepts & Architecture"
        if c_low in ["structured data", "structured data models"]:
            return "Structured Data & Relational Schema Modeling"
        if c_low in ["auto increment", "auto-increment"]:
            return "PostgreSQL Auto Increment & Sequence Generators"
        if c_low in ["triggers", "trigger"]:
            return "PostgreSQL Triggers & Stored Procedures"
        if "postgresql interface" in c_low or "sqlite postgresql interface" in c_low:
            return "PostgreSQL Native Drivers & Programming Interfaces"
        if "mysql connection" in c_low:
            return "MySQL Database Connectivity & Interfaces"
        if "sqlite connection" in c_low:
            return "SQLite Database Connectivity & Interfaces"
        if c_low in ["unstructured data and its usages", "unstructured data"]:
            return "Principles & Applications of Unstructured Data"
        if c_low in ["nosql databases", "no sql database", "nosql database", "no sql databases"]:
            return "NoSQL Database Architectures & Data Models"
        if c_low in ["mongodb data types", "mongodb data type"]:
            return "MongoDB Data Types & Document Modeling"
        if "data modeling" in c_low:
            return "MongoDB Data Modeling & Document Schemas"
        if "native database api" in c_low:
            return "Native Database APIs"
        if "database-independent api" in c_low:
            return "Database-Independent APIs"
        if "template-driven" in c_low:
            return "Template-Driven Database Access Packages"
        if "third-party class" in c_low:
            return "Third-Party Database Class Libraries"
        if "structure of web requests" in c_low:
            return "Structure of Web Requests & Protocols"
        if "asymptotic notation" in c_low:
            return "Asymptotic Notations (Big O, Big Omega, Big Theta)"
        if "analysis of algorithm" in c_low:
            return "Algorithm Complexity Analysis & Growth Rates"
        if "divide and conquer" in c_low:
            return "Divide and Conquer Strategy: Binary Search, Merge Sort, Quick Sort"
        if "cassandra" in c_low:
            return "Cassandra Architecture and Data Model"
        if "graphql" in c_low:
            return "GraphQL Architecture and Application Components"
        if c_low in ["rdbms", "advantage over rdbms", "advantages over rdbms"]:
            return "Advantages of NoSQL over Relational Databases (RDBMS)"
        if "crud operations" in c_low or "crud: documents" in c_low:
            return "CRUD Operations on Database Documents"
        if "python interface" in c_low:
            return "Python Database Connectivity Interface"
        if "session management" in c_low:
            return "Session Management & State Tracking"
        if "request methods" in c_low:
            return "HTTP Request Methods (GET, POST, PUT, DELETE)"
        if "response status codes" in c_low or "response status code" in c_low:
            return "HTTP Response Status Codes"
        if "database gateways" in c_low:
            return "Web Database Gateways"
        if c_low == "cgi":
            return "Common Gateway Interface (CGI)"
        if c_low in ["java to the internet", "importance of java to the internet"]:
            return "Java Internet Architecture & Web Capabilities"
        if c_low in ["jdk", "java development kit"]:
            return "Java Development Kit (JDK) & Tools"
        if c_low in ["byte code", "bytecode"]:
            return "JVM Architecture & Bytecode Execution"
        if c_low in ["garbage collection", "garbage collection in java", "gc"]:
            return "Garbage Collection & Memory Management in Java"
        if c_low in ["methods", "method", "methods in java"]:
            return "Methods & Method Overloading in Java"
        if c_low in ["classes", "objects", "classes and objects", "classes & methods", "classes and methods"]:
            return "Classes and Objects in Java"
        if c_low in ["control statements", "control structures"]:
            return "Control Statements & Decision Making in Java"
        if c_low in ["encapsulation", "oop principles & encapsulation"]:
            return "Encapsulation in Object-Oriented Programming"
        if c_low in ["arrays", "multidimensional arrays"]:
            return "Multidimensional Arrays & Matrix Operations"
        if c_low in ["constructors", "constructor"]:
            return "Constructors & Constructor Overloading in Java"
        if c_low in ["using super", "super keyword"]:
            return "The 'super' Keyword & Member Resolution in Java"
        if c_low in ["using this", "this keyword"]:
            return "The 'this' Keyword & Object Reference in Java"
        if c_low in ["using final", "final keyword"]:
            return "The 'final' Keyword in Java (Variables, Methods, Classes)"
        if c_low in ["packages", "packages and interfaces"]:
            return "Java Packages & Access Protection"
        if c_low in ["interfaces", "interface"]:
            return "Interfaces & Multiple Inheritance in Java"
        if c_low in ["inheritance: basics", "basics", "inheritance basics", "inheritance"]:
            return "Inheritance Hierarchies & Code Reusability"
        if c_low in ["try", "catch", "throw", "throws", "finally", "usage of try", "try and catch", "throw and throws", "throws and finally"]:
            return "Try, Catch, Throw, Throws and Finally Blocks"
        if "user defined exception" in c_low or "built-in and user defined" in c_low:
            return "Built-in and User-Defined Exceptions"
        if c_low in ["multithreading", "thread model", "java thread model", "threads", "thread life cycle", "thread lifecycle"]:
            return "Java Multithreading & Thread Lifecycle"
        if c_low in ["synchronization", "thread synchronization"]:
            return "Thread Synchronization & Inter-Thread Communication"
        if c_low in ["inter-thread communication", "inter thread communication"]:
            return "Inter-Thread Communication & Thread States"
        if c_low in ["thread priorities"]:
            return "Thread Priorities & CPU Scheduling"
        if c_low in ["exception types", "types of exceptions"]:
            return "Checked and Unchecked Exception Types"
        if c_low in ["jdbc", "jdbc drivers"]:
            return "JDBC Drivers & Database Connectivity Architecture"
        if c_low in ["hibernate", "hibernate framework"]:
            return "Architecture of Hibernate Framework & ORM"
        if c_low in ["spring", "spring framework"]:
            return "Features and Benefits of Spring Framework"
        if c_low in ["list", "set", "map"]:
            return f"{c.capitalize()} Interface & Implementations"

        # Apply Title Case if all lowercase
        if c.islower():
            c = " ".join([w.capitalize() if w.lower() not in ['and', 'of', 'in', 'to', 'for', 'with', 'the', 'a', 'an'] else w.lower() for w in c.split()])
            if c:
                c = c[0].upper() + c[1:]

        return c

    @classmethod
    def is_valid_topic(cls, topic: str, course_name: str = "") -> bool:
        """
        Validates if a topic is a genuine technical syllabus topic suitable for question generation.
        Strictly rejects course codes, course titles, metadata, hours, and document headers.
        """
        if not topic or len(topic.strip()) < 3:
            return False
        tl = topic.strip().lower()
        if re.search(r'\b[0-9]{0,4}[A-Z]{2,}[0-9]{2,}\b', topic):
            return False
        cn = (course_name or '').strip().lower()
        if cn and (tl == cn or tl in cn or cn in tl):
            if len(tl.replace(cn, '').strip()) < 4:
                return False
        if any(w in tl for w in ['course code', 'hours', 'credits', 'ltpc', 'mapping', 'strongly linked', 'weakly linked', 'unit 1', 'unit 2']):
            return False
        if tl in cls.METADATA_STOPWORDS:
            return False
        if len(tl.split()) == 1 and tl in {'create', 'select', 'drop', 'crud', 'document', 'documents', 'shell', 'cloud', 'post', 'put', 'delete', 'get', 'setup', 'definition', 'characteristics', 'representation', 'types', 'type', 'usages', 'usage', 'sqlite', 'mysql', 'views'}:
            return False
        return True

    @classmethod
    def extract_units_and_topics(cls, text: str, course_name: str = "") -> List[Dict[str, Any]]:
        """
        Dynamically extracts Curriculum Units from document headings (e.g. Unit-I, Unit 1, Module 1)
        along with Unit Titles, allocated Hours, and domain-grounded topics.
        Strictly ensures preambles, titles, credits, and COs prior to Unit 1 are excluded.
        """
        cleaned = cls.clean_text(text)
        if not cleaned:
            return cls.get_fallback_units_structure(course_name)

        lines = [l.strip() for l in cleaned.split('\n') if l.strip()]
        unit_regex = re.compile(r'^(Unit|Module|Chapter|Part)\s*[-–—:\s]*([0-9IVXLCDMivxlcdm]+)\b(.*)', re.IGNORECASE)
        hours_regex = re.compile(r'([0-9]+)\s*(hours?|hrs?)\b', re.IGNORECASE)

        roman_to_int = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8}
        units = []
        current_unit = None

        for line in lines:
            m = unit_regex.match(line)
            if m:
                if current_unit:
                    units.append(current_unit)
                u_prefix = m.group(1).capitalize()
                u_num_raw = m.group(2).upper()
                rem = m.group(3).strip()

                num_val = roman_to_int.get(u_num_raw)
                if not num_val:
                    try:
                        num_val = int(u_num_raw)
                    except ValueError:
                        num_val = len(units) + 1

                u_key = f"Unit {num_val}"
                u_label = f"{u_prefix}-{u_num_raw}"

                hrs_m = hours_regex.search(rem)
                hrs = int(hrs_m.group(1)) if hrs_m else None
                title = hours_regex.sub('', rem).strip(' -:\t')

                current_unit = {
                    'id': num_val,
                    'unit_key': u_key,
                    'unit_label': u_label,
                    'unit_title': title,
                    'hours': hrs,
                    'topics': [],
                    'raw_content': []
                }
            elif current_unit:
                # Discard pure page numbers or footers
                if re.match(r'^[0-9]+$', line):
                    continue
                # Discard reference section headers that signify syllabus end
                if re.search(r'^(text\s*books?|references?|prescribed\s+books?|recommended\s+books?|evaluation|scheme\s+of)', line, re.IGNORECASE):
                    continue

                if not current_unit['unit_title']:
                    hrs_m = hours_regex.search(line)
                    if hrs_m and not current_unit['hours']:
                        current_unit['hours'] = int(hrs_m.group(1))
                    clean_l = hours_regex.sub('', line).strip(' -:\t')
                    current_unit['unit_title'] = clean_l
                else:
                    hrs_m = hours_regex.search(line)
                    if hrs_m and not current_unit['hours']:
                        current_unit['hours'] = int(hrs_m.group(1))
                    clean_l = hours_regex.sub('', line).strip(' -:\t')
                    if clean_l:
                        current_unit['raw_content'].append(clean_l)

        if current_unit:
            units.append(current_unit)

        if not units:
            return cls.get_fallback_units_structure(course_name)

        # Calculate balanced weightage across extracted units
        num_u = len(units)
        base_w = 100 // num_u
        rem_w = 100 - (base_w * num_u)
        for i, u in enumerate(units):
            u['weight'] = base_w + (rem_w if i == num_u - 1 else 0)

        # Extract topics semantically for each unit
        for u in units:
            raw_text = "\n".join(u['raw_content'])
            raw_text = raw_text.replace('—', ' - ').replace('–', ' - ')
            seen = set()
            u_topics = []

            def add_unit_topic(t):
                if not t:
                    return
                t = t.strip()
                t = re.sub(r'^[0-9\.\*\#\s\(\)\:\-\[\]\>]+', '', t).strip()
                t = re.sub(r'[:\.\-,\;\s\[\]\>]+$', '', t).strip()
                if not t or len(t) < 3:
                    return
                clean = cls.clean_concept_name(t, course_name)
                if clean and clean.lower() not in seen and cls.is_valid_topic(clean, course_name):
                    seen.add(clean.lower())
                    u_topics.append(clean)

            # Split by clause / sentence boundaries
            clauses = [cl.strip() for cl in re.split(r'[;\n]|\.(?:\s+(?=[A-Z0-9])|\s*$)', raw_text) if cl.strip()]

            for clause in clauses:
                cl_low = clause.lower()

                # Dedicated semantic clause detectors
                if any(k in cl_low for k in ['asymptotic notation', 'big o, omega', 'omega, theta']):
                    add_unit_topic("Asymptotic Notations (Big O, Big Omega, Big Theta)")
                    add_unit_topic("Algorithm Complexity Analysis & Growth Rates")
                    continue
                if any(k in cl_low for k in ['divide and conquer', 'binary search, merge sort', 'merge sort, quick sort']):
                    add_unit_topic("Divide and Conquer Strategy: Binary Search, Merge Sort, Quick Sort")
                    continue
                if 'connecting to database' in cl_low:
                    add_unit_topic("Native Database APIs")
                    add_unit_topic("Database-Independent APIs")
                    add_unit_topic("Template-Driven Database Access Packages")
                    add_unit_topic("Third-Party Database Class Libraries")
                    continue
                if 'web requests:' in cl_low or ('request methods' in cl_low and 'json' in cl_low):
                    add_unit_topic("Structure of Web Requests & Protocols")
                    add_unit_topic("JavaScript Object Notation (JSON) Data Interchange")
                    add_unit_topic("HTTP Request Methods (GET, POST, PUT, DELETE)")
                    add_unit_topic("HTTP Response Status Codes")
                    continue

                # Look for Subheading: item1, item2, item3
                matches = list(re.finditer(r'(?:^|(?<=[,;\.\n]))\s*([A-Za-z0-9\s\-]+?)\s*:\s*', clause))
                if matches:
                    for idx, m in enumerate(matches):
                        header = m.group(1).strip()
                        start_content = m.end()
                        end_content = matches[idx + 1].start() if idx + 1 < len(matches) else len(clause)
                        content = clause[start_content:end_content].strip(' ,;')

                        h_low = header.lower()
                        items = [it.strip() for it in cls.split_respecting_parentheses(content) if it.strip()]
                        item_lows = [it.lower() for it in items]

                        attr_words = {'definition', 'characteristics', 'representation', 'properties', 'types', 'need', 'components', 'features'}

                        if any(w in item_lows for w in attr_words) and ('algorithm' in h_low or 'data model' in h_low or 'database' in h_low):
                            add_unit_topic(f"Definition and Characteristics of {header.title()}")
                            add_unit_topic(f"{header.title()} Representation Techniques")
                        elif 'postgresql database' in h_low or ('postgresql' in h_low and any(w in item_lows for w in ['create', 'select', 'drop', 'crud'])):
                            add_unit_topic("PostgreSQL Database CRUD Operations (Create, Select, Update, Drop)")
                        elif 'mongodb architecture' in h_low or ('mongodb' in h_low and any(w in item_lows for w in ['create', 'drop', 'collection'])):
                            add_unit_topic("MongoDB Database & Collection Management (Create, Drop, CRUD)")
                        elif 'web application overview' in h_low:
                            for it in items:
                                it_l = it.lower()
                                if 'basic concepts' in it_l:
                                    add_unit_topic("Core Web Database Concepts & Architecture")
                                elif 'architectures' in it_l:
                                    add_unit_topic("Web Database Architectures")
                                elif 'gateways' in it_l:
                                    add_unit_topic("Web Database Gateways")
                                else:
                                    add_unit_topic(it)
                        else:
                            for it in items:
                                it_low = it.lower()
                                if any(x in it_low for x in ['- introduction', 'introduction', 'create database', 'create collection', 'drop database', 'drop collection', 'mongodb shell', 'mongodb cloud', 'environment setup']):
                                    continue
                                elif it_low in {'create', 'select', 'drop', 'crud', 'views', 'shell', 'cloud', 'install mongodb'}:
                                    continue
                                elif 'session' in it_low or 'cookie' in it_low:
                                    add_unit_topic("Session Management & Cookie-Based State Tracking")
                                elif 'header' in it_low:
                                    add_unit_topic("HTTP Request and Response Headers")
                                elif 'python interface' in it_low:
                                    add_unit_topic("Python Database Connectivity Interface")
                                elif 'rdbms' in it_low or 'advantage over rdbms' in it_low:
                                    add_unit_topic("Advantages of NoSQL over Relational Databases (RDBMS)")
                                elif 'data modeling' in it_low:
                                    add_unit_topic("MongoDB Data Modeling & Document Schemas")
                                elif 'operators' in it_low:
                                    add_unit_topic("MongoDB Query & Update Operators")
                                elif 'commands' in it_low:
                                    add_unit_topic("MongoDB Database Commands & Shell Operations")
                                elif 'cassandra' in it_low:
                                    add_unit_topic("Cassandra Architecture & Data Model")
                                elif 'graphql' in it_low:
                                    add_unit_topic("GraphQL Architecture and Application Components")
                                elif 'constraints' in it_low:
                                    add_unit_topic("PostgreSQL Integrity Constraints & Views")
                                elif 'transactions' in it_low:
                                    add_unit_topic("PostgreSQL Transactions & ACID Properties")
                                elif 'privileges' in it_low or 'functions' in it_low:
                                    add_unit_topic("PostgreSQL Privileges, Roles & Stored Functions")
                                elif 'auto increment' in it_low:
                                    add_unit_topic("PostgreSQL Auto Increment & Sequence Generators")
                                elif 'migrate database' in it_low:
                                    add_unit_topic("Database Migration Concepts & Schema Evolution")
                                elif 'challenges of structured data' in it_low:
                                    add_unit_topic("Challenges of Structured Data in MySQL and SQLite")
                                elif 'challenges of unstructured data' in it_low:
                                    add_unit_topic("Challenges of Unstructured Data in Cassandra and GraphQL")
                                else:
                                    add_unit_topic(it)
                else:
                    items = [it.strip() for it in cls.split_respecting_parentheses(clause) if it.strip()]
                    for it in items:
                        it_low = it.lower()
                        if any(x in it_low for x in ['- introduction', 'introduction', 'create database', 'create collection', 'drop database', 'drop collection', 'mongodb shell', 'mongodb cloud', 'environment setup']):
                            continue
                        elif it_low in {'create', 'select', 'drop', 'crud', 'views', 'shell', 'cloud', 'install mongodb'}:
                            continue
                        elif it_low == 'cgi':
                            add_unit_topic("Common Gateway Interface (CGI)")
                        elif 'database gateways' in it_low:
                            add_unit_topic("Web Database Gateways")
                        elif 'browser extensions' in it_low:
                            add_unit_topic("Browser Extensions & Web Integration")
                        elif 'triggers' in it_low:
                            add_unit_topic("PostgreSQL Triggers & Stored Procedures")
                        elif 'cassandra data model' in it_low or 'architecture of cassandra' in it_low:
                            add_unit_topic("Cassandra Architecture and Data Model")
                        elif 'graphql' in it_low:
                            add_unit_topic("GraphQL Architecture and Component Integration")
                        elif 'mysql connection' in it_low or 'sqlite connection' in it_low:
                            add_unit_topic("MySQL and SQLite Database Connectivity")
                        elif 'postgresql interface' in it_low or 'sqlite postgresql interface' in it_low:
                            add_unit_topic("PostgreSQL Native Drivers & Programming Interfaces")
                        else:
                            add_unit_topic(it)

            u['topics'] = u_topics
            if not u['topics']:
                domain_defaults = cls.get_domain_fallback_concepts(course_name)
                u['topics'] = domain_defaults.get(u['unit_key'], [f"{u['unit_title'] or 'Core'} Foundations", f"{u['unit_title'] or 'System'} Architecture"])

            u['name'] = f"{u['unit_key']}: {u['unit_title']}" if u['unit_title'] else u['unit_key']

        return units

    @classmethod
    def get_fallback_units_structure(cls, course_name: str = "") -> List[Dict[str, Any]]:
        """
        Generates standard 5-unit curriculum structure with domain topics and balanced weightage.
        """
        defaults = cls.get_domain_fallback_concepts(course_name)
        units = []
        for i in range(1, 6):
            uk = f"Unit {i}"
            topics = defaults.get(uk, [f"{course_name} Module {i} Principles", f"{course_name} Module {i} Implementation"])
            title = topics[0] if topics else f"{course_name} Part {i}"
            units.append({
                'id': i,
                'unit_key': uk,
                'unit_label': f"Unit-{['I', 'II', 'III', 'IV', 'V'][i-1]}",
                'unit_title': title,
                'name': f"{uk}: {title}",
                'hours': 12,
                'weight': 20,
                'topics': topics
            })
        return units

    @classmethod
    def map_cos_to_units(cls, cos_list: List[Dict[str, Any]], units_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Semantically maps Course Outcomes (COs) to extracted units based on title and topic keyword alignment.
        """
        if not units_list:
            return cos_list

        num_units = len(units_list)
        mapped = []

        for idx, co in enumerate(cos_list):
            co_desc_lower = (co.get('description') or '').lower()
            co_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', co_desc_lower))

            best_unit = None
            best_score = 0

            for u in units_list:
                score = 0
                u_title_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', (u.get('unit_title') or '').lower()))
                score += len(co_words.intersection(u_title_words)) * 3

                all_topics_text = " ".join(u.get('topics', [])).lower()
                topic_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', all_topics_text))
                score += len(co_words.intersection(topic_words))

                if score > best_score:
                    best_score = score
                    best_unit = u

            if not best_unit or best_score == 0:
                assigned_idx = min(idx * num_units // len(cos_list), num_units - 1)
                best_unit = units_list[assigned_idx]

            mapped.append({
                **co,
                'unit': best_unit['unit_key'],
                'unit_name': best_unit.get('name', best_unit['unit_key'])
            })

        return mapped

    @classmethod
    def extract_unit_concepts(cls, text: str, course_name: str = "") -> Dict[str, List[str]]:
        """
        Parses document text into clean Unit buckets with pristine, domain-grounded topics.
        Strictly prevents document headers, course codes, or preambles from leaking into concepts.
        """
        units = cls.extract_units_and_topics(text, course_name)
        if units and any(u.get('topics') for u in units):
            buckets = {}
            for u in units:
                buckets[u['unit_key']] = u.get('topics', [])
            return buckets

        return cls.get_domain_fallback_concepts(course_name)

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
        user_outcomes: Optional[List[Dict[str, Any]]] = None,
        custom_units_topics: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Synthesizes categorized candidate pools strictly aligned with Course Outcomes (COs) and Syllabus:
          - 'Short Answer' (concise, direct 2M/4M questions with rich human phrasing)
          - 'Long Answer' (comprehensive analytical questions with dynamic mark splitting & diverse pair structures)
          - 'MCQ' (multiple choice questions with 4 distinct options)
        """
        if custom_units_topics and len(custom_units_topics) > 0:
            unit_concepts = custom_units_topics
        else:
            unit_concepts = cls.extract_unit_concepts(document_text, course_name)
        
        pools = {
            'Short Answer': [],
            'Long Answer': [],
            'MCQ': [],
            'Numerical': []
        }
        seed_offset = random.randint(1, 10000)

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
                {'id': 'CO1', 'description': 'Understand core principles and foundational architectures', 'unit': 'Unit 1', 'bloom_level': 'Understand'},
                {'id': 'CO2', 'description': 'Apply fundamental concepts and algorithmic paradigms', 'unit': 'Unit 2', 'bloom_level': 'Understand'},
                {'id': 'CO3', 'description': 'Analyze component interactions and design trade-offs', 'unit': 'Unit 3', 'bloom_level': 'Apply'},
                {'id': 'CO4', 'description': 'Evaluate system models, error handling, and performance', 'unit': 'Unit 4', 'bloom_level': 'Analyze'},
                {'id': 'CO5', 'description': 'Design modular solutions for complex technical specifications', 'unit': 'Unit 5', 'bloom_level': 'Evaluate'},
                {'id': 'CO6', 'description': 'Synthesize comprehensive engineering designs, methodologies, and system implementations', 'unit': 'Unit 6', 'bloom_level': 'Create'}
            ]

        for u_idx, co_info in enumerate(co_list):
            co_id = co_info['id']
            co_desc = co_info['description']
            unit_key = co_info['unit']
            
            # Retrieve concepts for this unit and strictly validate
            raw_concepts = unit_concepts.get(unit_key, [])
            concepts = [c for c in raw_concepts if cls.is_valid_topic(c, course_name)]
            if not concepts:
                # Check other units or fallbacks
                for other_u, o_concepts in unit_concepts.items():
                    valid_other = [c for c in o_concepts if cls.is_valid_topic(c, course_name)]
                    if valid_other:
                        concepts = valid_other[:5]
                        break
            if not concepts:
                domain_f = cls.get_domain_fallback_concepts(course_name)
                concepts = domain_f.get(unit_key, domain_f.get('Unit 1', ['Core Principles', 'Architectural Models']))

            co_blooms = cls.CO_BLOOM_MAP.get(co_id, blooms_list)
            if co_info.get('bloom_level') and co_info['bloom_level'] in cls.BLOOM_ACTION_VERBS:
                co_blooms = [co_info['bloom_level']] + co_blooms

            # Shuffle/rotate concepts per unit so primary candidate order varies across generations
            if len(concepts) > 1:
                concepts = list(concepts)
                rot = random.randint(0, len(concepts) - 1)
                concepts = concepts[rot:] + concepts[:rot]

            for i in range(len(concepts)):
                t1 = concepts[i]
                t2 = concepts[(i + 1) % len(concepts)]
                t3 = concepts[(i + 2) % len(concepts)]
                t4 = concepts[(i + 3) % len(concepts)]

                # Skip if primary topic is invalid or resembles course metadata
                if not cls.is_valid_topic(t1, course_name):
                    continue

                for b_idx, bloom in enumerate(co_blooms):
                    diff = 'Easy' if (i + b_idx) % 3 == 0 else ('Medium' if (i + b_idx) % 3 == 1 else 'Hard')
                    pattern_idx = seed_offset + (u_idx * 11 + i * 7 + b_idx * 3)

                    # 1. Short Answer Candidate
                    sa_text = cls.generate_semantic_short_answer(
                        t1, t2, course_name, bloom_level=bloom, pattern_idx=pattern_idx
                    )

                    # Safety guard: Never generate question asking to define or state the course code or course name!
                    if re.search(r'\b(Define|What is)\s+[0-9]{0,4}[A-Z]{2,}[0-9]{2,}\b', sa_text, re.IGNORECASE):
                        continue
                    if course_name and re.search(rf'\b(Define|What is)\s+{re.escape(course_name)}\b', sa_text, re.IGNORECASE):
                        continue

                    pools['Short Answer'].append({
                        'pattern_id': pattern_idx % len(cls.SHORT_ANSWER_PATTERNS),
                        'question_template': sa_text,
                        'type': 'Short Answer',
                        'unit': unit_key,
                        'co': co_id,
                        'co_description': co_desc,
                        'bloom_level': bloom,
                        'difficulty': diff,
                        'topic': t1,
                        'topic_b': t2,
                        'grounded': True
                    })

                    # 2. MCQ Candidate (only on first bloom level per concept to avoid bloating)
                    if b_idx == 0:
                        mcq_text = cls.generate_semantic_mcq(t1, course_name)
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
                    la_single = cls.generate_semantic_long_answer_single(
                        t1, t2, course_name, bloom_level=bloom, co_id=co_id, pattern_idx=pattern_idx
                    )
                    la_sub = cls.generate_semantic_long_answer_sub(
                        t1, t2, t3, t4, bloom_level=bloom, co_id=co_id, pattern_idx=pattern_idx
                    )
                    la_choice = f"{la_sub}\n\n                                    [OR]\n\n{cls.generate_semantic_long_answer_or(t1, t2, t3, t4, bloom_level=bloom, co_id=co_id, pattern_idx=pattern_idx)}"

                    pools['Long Answer'].append({
                        'pattern_id': pattern_idx % len(cls.LONG_ANSWER_PATTERNS),
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
                        'topic_b': f"{t2}",
                        'grounded': True
                    })

        # Shuffle candidate pools so tie-breaking or first-fit selections differ across generation runs
        for pool_key in pools:
            if pools[pool_key]:
                random.shuffle(pools[pool_key])

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
