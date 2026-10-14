import os
import re
import json
import time
from pathlib import Path
from difflib import SequenceMatcher
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field


app = FastAPI(
    title="InterviewAI API",
    version="0.3.0",
    description="Backend API for the InterviewAI interview platform."
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://interview-ai-xi-six.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# QUESTION BANK
# ============================================================
# This is a temporary in-memory question bank.
# Later we will move this into PostgreSQL.
#
# Each question contains:
# - id
# - role
# - track
# - organization
# - difficulty
# - question
# - reference_answer
# ============================================================

QUESTION_BANK = [

    # ========================================================
    # JAVA DEVELOPER - MNC
    # ========================================================

    {
        "id": 1,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between an interface and "
            "an abstract class in Java?"
        ),
        "reference_answer": (
            "An interface defines a contract that classes can implement, "
            "while an abstract class can contain both abstract and concrete "
            "methods and can maintain instance state. A class can implement "
            "multiple interfaces but can extend only one class."
        ),
    },

    {
        "id": 2,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "Explain the four pillars of object-oriented programming."
        ),
        "reference_answer": (
            "The four pillars are encapsulation, abstraction, inheritance, "
            "and polymorphism. Encapsulation controls access to data, "
            "abstraction hides implementation details, inheritance allows "
            "reuse through parent-child relationships, and polymorphism "
            "allows the same interface or method call to behave differently."
        ),
    },

    {
        "id": 3,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Google-style",
        "difficulty": "Hard",
        "question": (
            "What is the average time complexity of searching for an "
            "element in a HashMap, and what can make it worse?"
        ),
        "reference_answer": (
            "HashMap lookup is O(1) on average. Poor hash distribution "
            "or many hash collisions can degrade performance. Modern "
            "Java implementations can convert heavily collided buckets "
            "into balanced trees, improving worst-case bucket operations."
        ),
    },

    {
        "id": 4,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Product Company-style",
        "difficulty": "Medium",
        "question": (
            "When would you choose ArrayList over LinkedList in Java?"
        ),
        "reference_answer": (
            "ArrayList is generally preferred when random access is common "
            "because indexed access is O(1) and it usually has better cache "
            "locality. LinkedList can be useful for frequent insertions or "
            "removals when the relevant node position is already known."
        ),
    },

    {
        "id": 8,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Easy",
        "question": (
            "What is method overloading in Java?"
        ),
        "reference_answer": (
            "Method overloading means defining multiple methods with the "
            "same name in a class but with different parameter lists. "
            "It is an example of compile-time polymorphism."
        ),
    },

    {
        "id": 9,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is method overriding in Java?"
        ),
        "reference_answer": (
            "Method overriding occurs when a subclass provides its own "
            "implementation of an inherited method with the same signature. "
            "It supports runtime polymorphism."
        ),
    },

    {
        "id": 11,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between String, StringBuilder, "
            "and StringBuffer in Java?"
        ),
        "reference_answer": (
            "String objects are immutable, so modifying a String creates "
            "a new object. StringBuilder is mutable and is generally used "
            "for string modifications in single-threaded code because it "
            "is not synchronized. StringBuffer is mutable and synchronized, "
            "so it provides thread safety with additional synchronization overhead."
        ),
    },

    # ========================================================
    # JAVA DEVELOPER - GOVERNMENT
    # ========================================================

    {
        "id": 5,
        "role": "Java Developer",
        "track": "Government Interviews",
        "organization": "ISRO Technical",
        "difficulty": "Medium",
        "question": (
            "What is exception handling in Java?"
        ),
        "reference_answer": (
            "Exception handling is a mechanism for handling runtime errors "
            "without abruptly terminating normal program flow. Java provides "
            "try, catch, finally, throw, and throws for exception handling."
        ),
    },

    {
        "id": 6,
        "role": "Java Developer",
        "track": "Government Interviews",
        "organization": "DRDO Technical",
        "difficulty": "Hard",
        "question": (
            "What is the difference between a process and a thread?"
        ),
        "reference_answer": (
            "A process is an independent program execution environment "
            "with its own memory space. A thread is a lightweight execution "
            "unit within a process and shares the process resources such as memory."
        ),
    },

    {
        "id": 7,
        "role": "Java Developer",
        "track": "Government Interviews",
        "organization": "PSU Technical",
        "difficulty": "Medium",
        "question": (
            "What is the difference between stack memory and heap memory in Java?"
        ),
        "reference_answer": (
            "Stack memory is used for method calls, local variables, and "
            "execution frames for each thread. Heap memory stores objects "
            "and is shared across threads. Garbage collection primarily "
            "reclaims unused objects from the heap."
        ),
    },

    {
        "id": 10,
        "role": "Java Developer",
        "track": "Government Interviews",
        "organization": "ISRO Technical",
        "difficulty": "Medium",
        "question": (
            "What is the purpose of the final keyword in Java?"
        ),
        "reference_answer": (
            "A final variable cannot be reassigned, a final method cannot "
            "be overridden, and a final class cannot be extended."
        ),
    },

    # ========================================================
    # PYTHON DEVELOPER
    # ========================================================

    {
        "id": 20,
        "role": "Python Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between a list and a tuple in Python?"
        ),
        "reference_answer": (
            "A list is mutable, meaning its elements can be changed after "
            "creation. A tuple is immutable. Lists are generally used for "
            "collections that may change, while tuples are useful for fixed data."
        ),
    },

    {
        "id": 21,
        "role": "Python Developer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between == and is in Python?"
        ),
        "reference_answer": (
            "The == operator checks whether two values are equal, while "
            "the is operator checks whether two references point to the "
            "same object in memory."
        ),
    },

    {
        "id": 22,
        "role": "Python Developer",
        "track": "MNC Interviews",
        "organization": "Google-style",
        "difficulty": "Hard",
        "question": (
            "What is a Python decorator?"
        ),
        "reference_answer": (
            "A decorator is a callable that modifies or extends the behavior "
            "of another function or class without changing its original source code."
        ),
    },

    {
        "id": 23,
        "role": "Python Developer",
        "track": "Government Interviews",
        "organization": "PSU Technical",
        "difficulty": "Medium",
        "question": (
            "Explain exception handling in Python."
        ),
        "reference_answer": (
            "Python uses try, except, else, and finally blocks to handle "
            "exceptions. Code that may raise an exception is placed inside "
            "try, and matching exceptions are handled in except."
        ),
    },

    # ========================================================
    # AI / ML ENGINEER
    # ========================================================

    {
        "id": 30,
        "role": "AI/ML Engineer",
        "track": "MNC Interviews",
        "organization": "Google-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between supervised and unsupervised learning?"
        ),
        "reference_answer": (
            "Supervised learning uses labelled training data to learn a mapping "
            "from inputs to outputs. Unsupervised learning works with unlabelled "
            "data and discovers patterns such as clusters or underlying structure."
        ),
    },

    {
        "id": 31,
        "role": "AI/ML Engineer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "What is overfitting and how can it be reduced?"
        ),
        "reference_answer": (
            "Overfitting happens when a model learns the training data too closely "
            "and performs poorly on unseen data. It can be reduced using methods "
            "such as regularization, cross-validation, pruning, dropout, data "
            "augmentation, or obtaining more representative training data."
        ),
    },

    {
        "id": 32,
        "role": "AI/ML Engineer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is the purpose of a confusion matrix?"
        ),
        "reference_answer": (
            "A confusion matrix summarizes classification predictions using "
            "true positives, true negatives, false positives, and false negatives. "
            "It helps calculate metrics such as accuracy, precision, recall, and F1-score."
        ),
    },

    {
        "id": 33,
        "role": "AI/ML Engineer",
        "track": "Government Interviews",
        "organization": "ISRO Technical",
        "difficulty": "Medium",
        "question": (
            "What is the difference between classification and regression?"
        ),
        "reference_answer": (
            "Classification predicts discrete categories or classes, while "
            "regression predicts continuous numerical values."
        ),
    },

    {
        "id": 34,
        "role": "AI/ML Engineer",
        "track": "Government Interviews",
        "organization": "DRDO Technical",
        "difficulty": "Hard",
        "question": (
            "What is gradient descent?"
        ),
        "reference_answer": (
            "Gradient descent is an optimization algorithm that updates model "
            "parameters in the direction that reduces the loss function. The "
            "learning rate controls the size of each update."
        ),
    },

    # ========================================================
    # DATA ANALYST
    # ========================================================

    {
        "id": 40,
        "role": "Data Analyst",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Easy",
        "question": (
            "What is the difference between mean, median, and mode?"
        ),
        "reference_answer": (
            "Mean is the arithmetic average, median is the middle value after "
            "sorting the data, and mode is the value that occurs most frequently."
        ),
    },

    {
        "id": 41,
        "role": "Data Analyst",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "What is data cleaning?"
        ),
        "reference_answer": (
            "Data cleaning is the process of detecting and correcting or removing "
            "inaccurate, incomplete, duplicated, inconsistent, or improperly "
            "formatted data."
        ),
    },

    {
        "id": 42,
        "role": "Data Analyst",
        "track": "MNC Interviews",
        "organization": "Google-style",
        "difficulty": "Medium",
        "question": (
            "Explain the difference between INNER JOIN and LEFT JOIN."
        ),
        "reference_answer": (
            "INNER JOIN returns only rows that have matching values in both tables. "
            "LEFT JOIN returns all rows from the left table and matching rows from "
            "the right table; unmatched right-side values become NULL."
        ),
    },

    {
        "id": 43,
        "role": "Data Analyst",
        "track": "Government Interviews",
        "organization": "PSU Technical",
        "difficulty": "Medium",
        "question": (
            "What is normalization in data analysis?"
        ),
        "reference_answer": (
            "Normalization is a transformation process used to put numerical "
            "features onto a comparable scale. Common approaches include min-max "
            "scaling and standardization."
        ),
    },

    {
        "id": 44,
        "role": "Data Analyst",
        "track": "Government Interviews",
        "organization": "ISRO Technical",
        "difficulty": "Easy",
        "question": (
            "What is the purpose of data visualization?"
        ),
        "reference_answer": (
            "Data visualization represents information graphically so that trends, "
            "patterns, relationships, comparisons, and anomalies can be understood "
            "more easily."
        ),
    },

    # ========================================================
    # SOFTWARE DEVELOPER
    # ========================================================

    {
        "id": 50,
        "role": "Software Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Easy",
        "question": (
            "What is the Software Development Life Cycle?"
        ),
        "reference_answer": (
            "The Software Development Life Cycle is a structured process for "
            "planning, designing, developing, testing, deploying, and maintaining "
            "software."
        ),
    },

    {
        "id": 51,
        "role": "Software Developer",
        "track": "MNC Interviews",
        "organization": "Microsoft-style",
        "difficulty": "Medium",
        "question": (
            "What is an API?"
        ),
        "reference_answer": (
            "An API, or Application Programming Interface, defines how software "
            "components communicate with each other. It specifies available "
            "operations, inputs, outputs, and rules for interaction."
        ),
    },

    {
        "id": 52,
        "role": "Software Developer",
        "track": "MNC Interviews",
        "organization": "Google-style",
        "difficulty": "Medium",
        "question": (
            "What is version control and why is Git used?"
        ),
        "reference_answer": (
            "Version control tracks changes to files over time and allows developers "
            "to collaborate and restore previous versions. Git is a distributed "
            "version-control system commonly used for source-code management."
        ),
    },

    {
        "id": 53,
        "role": "Software Developer",
        "track": "Government Interviews",
        "organization": "DRDO Technical",
        "difficulty": "Medium",
        "question": (
            "What is the difference between SQL and NoSQL databases?"
        ),
        "reference_answer": (
            "SQL databases typically use structured relational tables and support "
            "SQL for querying. NoSQL databases use models such as document, key-value, "
            "column, or graph and are often chosen for flexible schemas and certain "
            "large-scale distributed workloads."
        ),
    },

    {
        "id": 54,
        "role": "Software Developer",
        "track": "Government Interviews",
        "organization": "PSU Technical",
        "difficulty": "Medium",
        "question": (
            "What is the difference between a process and a thread?"
        ),
        "reference_answer": (
            "A process is an independent program execution environment with its own "
            "address space. A thread is an execution unit within a process and shares "
            "resources such as memory with other threads of that process."
        ),
    },

    {
        "id": 55,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is the difference between == and equals() in Java?"
        ),
        "reference_answer": (
            "The == operator compares primitive values or checks whether two object "
            "references point to the same object. The equals() method is used to compare "
            "object content when the class provides an appropriate implementation."
        ),
    },

    {
        "id": 56,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is garbage collection in Java?"
        ),
        "reference_answer": (
            "Garbage collection is the automatic process of identifying and reclaiming "
            "heap memory occupied by objects that are no longer reachable by the program. "
            "It helps reduce manual memory management in Java."
        ),
    },

    {
        "id": 57,
        "role": "Java Developer",
        "track": "MNC Interviews",
        "organization": "Amazon-style",
        "difficulty": "Medium",
        "question": (
            "What is a constructor in Java and how is it different from a method?"
        ),
        "reference_answer": (
            "A constructor initializes an object when it is created. It has the same name "
            "as the class and has no return type. A method performs an operation and can "
            "have a return type and can be called after the object is created."
        ),
    },
]


# ============================================================
# EVALUATION CONCEPTS
# ============================================================
# This is a transparent preliminary rule-based evaluator.
#
# Later this will be replaced/enhanced by the actual AI
# evaluation engine.
#
# Each tuple:
# ("Concept name", ["keyword1", "keyword2"])
# ============================================================

EVALUATION_CONCEPTS = {

    # Java
    1: [
        ("Interface", ["interface"]),
        ("Abstract class", ["abstract class"]),
        (
            "Instance state",
            ["instance state", "object state", "state of the object"],
        ),
        (
            "Multiple interfaces",
            ["multiple interface", "multiple interfaces"],
        ),
        (
            "Single class inheritance",
            [
                "only one class",
                "one class",
                "single class",
            ],
        ),
    ],

    2: [
        ("Encapsulation", ["encapsulation"]),
        ("Abstraction", ["abstraction"]),
        ("Inheritance", ["inheritance"]),
        ("Polymorphism", ["polymorphism"]),
    ],

    3: [
        ("HashMap", ["hashmap", "hash map"]),
        ("Average O(1)", ["o(1)", "o( 1 )", "constant time"]),
        (
            "Hash collisions",
            ["collision", "collisions"],
        ),
        (
            "Worst-case handling",
            ["tree", "balanced tree", "tree structure"],
        ),
    ],

    4: [
        ("ArrayList", ["arraylist"]),
        (
            "Random/indexed access",
            [
                "random access",
                "indexed access",
                "o(1)",
                "constant time",
            ],
        ),
        ("LinkedList", ["linkedlist"]),
        (
            "Insertion/removal",
            [
                "insertion",
                "insert",
                "removal",
                "remove",
            ],
        ),
    ],

    5: [
        ("Exception handling", ["exception handling"]),
        ("try", ["try"]),
        ("catch", ["catch"]),
        ("finally", ["finally"]),
        ("throw/throws", ["throw", "throws"]),
    ],

    6: [
        ("Process", ["process"]),
        ("Thread", ["thread"]),
        (
            "Separate memory/address space",
            [
                "separate memory",
                "memory space",
                "address space",
            ],
        ),
        (
            "Shared resources",
            [
                "shared resources",
                "share memory",
                "shared memory",
            ],
        ),
    ],

    7: [
        ("Stack", ["stack"]),
        ("Heap", ["heap"]),
        (
            "Local variables/method calls",
            [
                "local variable",
                "method call",
                "execution frame",
            ],
        ),
        (
            "Objects/garbage collection",
            [
                "objects",
                "garbage collection",
                "garbage collector",
            ],
        ),
    ],

    8: [
        ("Same method name", ["same name"]),
        (
            "Different parameters",
            [
                "different parameter",
                "different parameters",
            ],
        ),
        ("Compile-time polymorphism", ["compile-time polymorphism"]),
    ],

    9: [
        ("Subclass", ["subclass", "sub-class", "extends"]),
        (
            "Same method signature",
            [
                "same signature",
                "method signature",
                "same method",
            ],
        ),
        (
            "Runtime polymorphism",
            [
                "runtime polymorphism",
                "dynamic polymorphism",
            ],
        ),
    ],

    10: [
        ("Final variable", ["final variable"]),
        ("Final method", ["final method"]),
        ("Final class", ["final class"]),
        (
            "Cannot reassign/override/extend",
            [
                "cannot be reassigned",
                "cannot reassign",
                "cannot be overridden",
                "cannot be extended",
            ],
        ),
    ],

    11: [
        ("String immutable", ["immutable"]),
        ("StringBuilder", ["stringbuilder"]),
        ("StringBuffer", ["stringbuffer"]),
        ("Mutable strings", ["mutable"]),
        (
            "Synchronization/thread safety",
            [
                "synchronized",
                "synchronised",
                "thread safe",
                "thread safety",
            ],
        ),
    ],

    # Python
    20: [
        ("List", ["list"]),
        ("Tuple", ["tuple"]),
        ("List is mutable", ["mutable"]),
        ("Tuple is immutable", ["immutable"]),
    ],

    21: [
        ("Equality operator ==", ["=="]),
        ("Identity operator is", [" is "]),
        (
            "Value comparison",
            [
                "value",
                "equal",
                "equality",
            ],
        ),
        (
            "Object identity",
            [
                "same object",
                "identity",
                "memory",
            ],
        ),
    ],

    22: [
        ("Decorator", ["decorator"]),
        (
            "Modifies behaviour",
            [
                "modify",
                "modifies",
                "extends",
                "behaviour",
                "behavior",
            ],
        ),
        (
            "Function/class",
            [
                "function",
                "class",
            ],
        ),
    ],

    23: [
        ("try", ["try"]),
        ("except", ["except"]),
        ("else", ["else"]),
        ("finally", ["finally"]),
    ],

    # AI/ML
    30: [
        ("Supervised learning", ["supervised"]),
        ("Unsupervised learning", ["unsupervised"]),
        ("Labeled data", ["labelled", "labeled"]),
        ("Unlabeled data", ["unlabelled", "unlabeled"]),
    ],

    31: [
        ("Overfitting", ["overfitting"]),
        ("Unseen/generalization", ["unseen", "generalize", "generalization"]),
        (
            "Regularization",
            ["regularization", "regularisation"],
        ),
        (
            "Cross-validation",
            ["cross-validation", "cross validation"],
        ),
        (
            "Dropout/data augmentation",
            [
                "dropout",
                "data augmentation",
            ],
        ),
    ],

    32: [
        ("Confusion matrix", ["confusion matrix"]),
        ("True positive", ["true positive"]),
        ("True negative", ["true negative"]),
        ("False positive", ["false positive"]),
        ("False negative", ["false negative"]),
        (
            "Classification metrics",
            [
                "precision",
                "recall",
                "f1",
                "accuracy",
            ],
        ),
    ],

    33: [
        ("Classification", ["classification"]),
        ("Regression", ["regression"]),
        (
            "Discrete classes",
            [
                "discrete",
                "category",
                "categories",
                "class",
            ],
        ),
        (
            "Continuous value",
            [
                "continuous",
                "numerical value",
                "numeric value",
            ],
        ),
    ],

    34: [
        ("Gradient descent", ["gradient descent"]),
        ("Loss function", ["loss", "loss function"]),
        ("Parameter updates", ["parameter", "parameters", "update", "updates"]),
        ("Learning rate", ["learning rate"]),
    ],

    # Data Analyst
    40: [
        ("Mean", ["mean", "average"]),
        ("Median", ["median", "middle"]),
        ("Mode", ["mode", "frequently"]),
    ],

    41: [
        ("Data cleaning", ["data cleaning"]),
        (
            "Missing/inaccurate data",
            [
                "missing",
                "inaccurate",
                "incomplete",
            ],
        ),
        (
            "Duplicates",
            ["duplicate", "duplicates"],
        ),
        (
            "Inconsistency",
            [
                "inconsistent",
                "inconsistency",
            ],
        ),
    ],

    42: [
        ("INNER JOIN", ["inner join"]),
        ("LEFT JOIN", ["left join"]),
        (
            "Matching rows",
            [
                "matching",
                "match",
            ],
        ),
        ("NULL values", ["null"]),
    ],

    43: [
        ("Normalization", ["normalization"]),
        ("Min-max scaling", ["min-max", "min max"]),
        (
            "Standardization",
            [
                "standardization",
                "standardisation",
                "z-score",
            ],
        ),
        ("Comparable scale", ["comparable scale", "same scale"]),
    ],

    44: [
        ("Visualization", ["visualization", "visualisation"]),
        ("Trends", ["trend", "trends"]),
        ("Patterns", ["pattern", "patterns"]),
        (
            "Relationships/comparison",
            [
                "relationship",
                "relationships",
                "comparison",
                "compare",
            ],
        ),
    ],

    # Software Developer
    50: [
        ("Software Development Life Cycle", ["software development life cycle", "sdlc"]),
        ("Planning", ["planning"]),
        ("Development", ["development", "coding"]),
        ("Testing", ["testing"]),
        ("Deployment/maintenance", ["deployment", "maintenance"]),
    ],

    51: [
        ("API", ["api", "application programming interface"]),
        (
            "Software communication",
            [
                "communicate",
                "communication",
                "interaction",
            ],
        ),
        ("Operations", ["operations"]),
        ("Inputs/outputs", ["input", "output"]),
    ],

    52: [
        ("Version control", ["version control"]),
        ("Git", ["git"]),
        ("Change tracking", ["track changes", "changes"]),
        (
            "Collaboration/history",
            [
                "collaboration",
                "collaborate",
                "previous versions",
                "history",
            ],
        ),
    ],

    53: [
        ("SQL", ["sql"]),
        ("NoSQL", ["nosql", "no sql"]),
        ("Relational tables", ["relational", "tables"]),
        (
            "Flexible schema",
            [
                "flexible schema",
                "schema flexibility",
            ],
        ),
    ],

    54: [
        ("Process", ["process"]),
        ("Thread", ["thread"]),
        ("Independent address space", ["address space", "memory space"]),
        ("Shared resources", ["shared resources", "shared memory"]),
    ],

    55: [
        ("== operator", ["==", "equality operator", "double equals"]),
        ("equals() method", ["equals", "equals()", "equals method"]),
        ("Reference comparison", ["reference", "same object", "same reference"]),
        ("Content comparison", ["content", "object content", "values", "value comparison"]),
    ],

    56: [
        ("Garbage collection", ["garbage collection", "garbage collector"]),
        ("Heap memory", ["heap", "heap memory"]),
        ("Unreachable objects", ["unreachable", "no longer reachable"]),
        ("Automatic memory reclamation", ["reclaim", "reclaiming", "automatic memory"]),
    ],

    57: [
        ("Constructor", ["constructor"]),
        ("Object initialization", ["initialize", "initializes", "initialization"]),
        ("Same class name", ["same name", "same class name"]),
        ("No return type", [
            "no return type",
            "without return type",
            "does not have a return type",
            "doesn't have a return type",
            "has no return type",
            "no return value",
        ]),
    ],
}


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def home():
    return {
        "message": "InterviewAI backend is running!",
        "version": "0.3.0",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "InterviewAI API",
    }


# ============================================================
# GET QUESTIONS
# ============================================================

@app.get("/api/questions")
def get_questions(
    role: str = Query("Java Developer"),
    track: str = Query("MNC Interviews"),
    organization: str = Query("Amazon-style"),
    difficulty: str = Query("Medium"),
    count: int = Query(5, ge=1, le=50),
):
    # First, match every selected filter.
    filtered_questions = [
        question
        for question in QUESTION_BANK
        if (
            question["role"] == role
            and question["track"] == track
            and question["difficulty"] == difficulty
            and (
                question["organization"] == organization
                or organization == "All"
            )
        )
    ]

    # Do not mix questions from other organizations.
    # If the selected organization does not have enough questions,
    # return the questions that are actually available.

    # Still not enough questions.
    if len(filtered_questions) < count:
        return {
            "success": False,
            "requested_count": count,
            "available_count": len(filtered_questions),
            "message": (
                "The current question bank does not contain enough "
                "questions for this selection."
            ),
            "questions": filtered_questions,
        }

    return {
        "success": True,
        "requested_count": count,
        "available_count": len(filtered_questions),
        "questions": filtered_questions[:count],
    }


# ============================================================
# PYDANTIC MODELS FOR EVALUATION
# ============================================================

class SubmittedAnswer(BaseModel):
    question_id: int
    answer: str


class EvaluationRequest(BaseModel):
    answers: list[SubmittedAnswer]


# ============================================================
# EVALUATE ONE ANSWER
# ============================================================

def normalize_text(text: str) -> str:
    """Normalize text for local comparison."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9+#= .\-/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


STOP_WORDS = {
    "the", "is", "a", "an", "and", "or", "of", "to", "in",
    "on", "for", "with", "from", "that", "this", "it", "are",
    "was", "were", "be", "by", "as", "can", "may", "into",
    "such", "than", "their", "they", "we", "you", "your",
    "which", "what", "how", "why",
}


def content_words(text: str):
    """Return useful content words, excluding common stop words."""
    words = re.findall(r"[a-z0-9+#]+", normalize_text(text))
    return [word for word in words if word not in STOP_WORDS and len(word) >= 3]


def keyword_found(answer: str, keyword: str) -> bool:
    """Match a keyword or phrase without unsafe substring matching."""
    answer_normalized = normalize_text(answer)
    keyword_normalized = normalize_text(keyword)

    if not keyword_normalized:
        return False

    pattern = r"(?<!\w)" + re.escape(keyword_normalized) + r"(?!\w)"
    return re.search(pattern, answer_normalized) is not None


def calculate_reference_coverage(answer: str, reference_answer: str) -> float:
    """Estimate how much important reference content the answer covers."""
    reference_tokens = set(content_words(reference_answer))
    answer_tokens = set(content_words(answer))

    if not reference_tokens or not answer_tokens:
        return 0.0

    exact_matches = reference_tokens & answer_tokens
    matched = len(exact_matches)

    remaining_reference = reference_tokens - exact_matches

    for ref_word in remaining_reference:
        if len(ref_word) < 6:
            continue

        for answer_word in answer_tokens:
            if len(answer_word) < 6:
                continue

            if (
                ref_word.startswith(answer_word[:6])
                or answer_word.startswith(ref_word[:6])
            ):
                matched += 1
                break

    return min(matched / len(reference_tokens), 1.0)


def answer_is_question(question: str, answer: str) -> bool:
    """Detect when the candidate pasted the question instead of answering it."""
    question_normalized = normalize_text(question)
    answer_normalized = normalize_text(answer)

    if not question_normalized or not answer_normalized:
        return False

    question_words = set(content_words(question))
    answer_words = set(content_words(answer))

    similarity = SequenceMatcher(
        None,
        question_normalized,
        answer_normalized,
    ).ratio()

    overlap = 0.0
    if question_words:
        overlap = len(question_words & answer_words) / len(question_words)

    answer_length = len(content_words(answer))
    question_length = max(len(content_words(question)), 1)
    length_ratio = answer_length / question_length

    return (
        similarity >= 0.88 and length_ratio <= 1.5
    ) or (
        overlap >= 0.90 and length_ratio <= 1.5
    )


def calculate_depth_score(answer: str) -> int:
    """Score answer depth without rewarding excessive length."""
    words = len(content_words(answer))

    if words < 4:
        return 0
    if words < 8:
        return 1
    if words < 15:
        return 2
    if words < 30:
        return 3
    return 4


def calculate_clarity_score(answer: str) -> int:
    """Simple local clarity heuristic based on sentence structure."""
    sentences = [
        sentence.strip()
        for sentence in re.split(r"[.!?]+", answer)
        if sentence.strip()
    ]

    words = len(content_words(answer))

    if words < 4 or not sentences:
        return 0

    average_words_per_sentence = words / len(sentences)

    if 8 <= average_words_per_sentence <= 28:
        return 2

    return 1


def evaluate_answer(
    question_id: int,
    question: str,
    reference_answer: str,
    answer: str,
):
    """
    Smart local preliminary evaluator.

    Per-question rubric (20 points):
    - Concept coverage: 10 points
    - Completeness/reference coverage: 4 points
    - Answer depth: 4 points
    - Clarity: 2 points

    This is intentionally transparent and local.
    It does not use an external AI model.
    """

    clean_answer = answer.strip()
    concepts = EVALUATION_CONCEPTS.get(question_id, [])

    if not clean_answer:
        return {
            "score": 0,
            "max_score": 20,
            "matched_concepts": [],
            "missing_concepts": [
                concept_name for concept_name, _ in concepts
            ],
            "answer_quality": "No Answer",
            "feedback": "No answer was provided.",
            "reference_coverage": 0,
            "concept_score": 0,
            "completeness_score": 0,
            "depth_score": 0,
            "clarity_score": 0,
        }

    if answer_is_question(question, clean_answer):
        return {
            "score": 0,
            "max_score": 20,
            "matched_concepts": [],
            "missing_concepts": [
                concept_name for concept_name, _ in concepts
            ],
            "answer_quality": "Invalid Response",
            "feedback": (
                "The response appears to repeat the interview question. "
                "Please provide your own answer."
            ),
            "reference_coverage": 0,
            "concept_score": 0,
            "completeness_score": 0,
            "depth_score": 0,
            "clarity_score": 0,
        }

    matched_concepts = []
    missing_concepts = []

    for concept_name, keywords in concepts:
        found = any(
            keyword_found(clean_answer, keyword)
            for keyword in keywords
        )

        if found:
            matched_concepts.append(concept_name)
        else:
            missing_concepts.append(concept_name)

    concept_coverage = (
        len(matched_concepts) / len(concepts)
        if concepts else 0.0
    )

    reference_coverage = calculate_reference_coverage(
        clean_answer,
        reference_answer,
    )

    # --------------------------------------------------------
    # DIMENSION SCORES
    # --------------------------------------------------------

    concept_score = round(concept_coverage * 10)
    completeness_score = round(reference_coverage * 4)
    depth_score = calculate_depth_score(clean_answer)
    clarity_score = calculate_clarity_score(clean_answer)

    score = min(
        concept_score
        + completeness_score
        + depth_score
        + clarity_score,
        20,
    )

    # --------------------------------------------------------
    # QUALITY / FEEDBACK
    # --------------------------------------------------------

    if score >= 18:
        answer_quality = "Excellent"

    elif score >= 15:
        answer_quality = "Strong"

    elif score >= 11:
        answer_quality = "Developing"

    else:
        answer_quality = "Needs Improvement"

    feedback_parts = []

    if matched_concepts:
        feedback_parts.append(
            f"Covered {len(matched_concepts)} of {len(concepts)} key concepts."
        )

    if missing_concepts:
        feedback_parts.append(
            "Consider adding: "
            + ", ".join(missing_concepts[:3])
            + "."
        )

    if depth_score <= 1 and score > 0:
        feedback_parts.append(
            "Add a little more explanation to demonstrate depth."
        )

    if clarity_score == 1 and score > 0:
        feedback_parts.append(
            "Use shorter, clearly separated sentences for easier reading."
        )

    if not feedback_parts:
        feedback_parts.append(
            "The answer is concise and covers the expected material."
        )

    feedback = " ".join(feedback_parts)

    return {
        "score": score,
        "max_score": 20,
        "matched_concepts": matched_concepts,
        "missing_concepts": missing_concepts,
        "answer_quality": answer_quality,
        "feedback": feedback,
        "reference_coverage": round(reference_coverage * 100),
        "concept_score": concept_score,
        "completeness_score": completeness_score,
        "depth_score": depth_score,
        "clarity_score": clarity_score,
    }


# ============================================================
# EVALUATE COMPLETE INTERVIEW
# ============================================================

@app.post("/api/evaluate")
def evaluate_interview(
    request: EvaluationRequest,
):
    results = []

    total_score = 0

    for submitted_answer in request.answers:

        question = next(
            (
                item
                for item in QUESTION_BANK
                if item["id"] == submitted_answer.question_id
            ),
            None,
        )

        if question is None:
            continue

        evaluation = evaluate_answer(
            submitted_answer.question_id,
            question["question"],
            question["reference_answer"],
            submitted_answer.answer,
        )

        total_score += evaluation["score"]

        results.append(
            {
                "question_id": submitted_answer.question_id,
                "question": question["question"],
                "candidate_answer": submitted_answer.answer,
                "reference_answer": question["reference_answer"],
                "score": evaluation["score"],
                "max_score": evaluation["max_score"],
                "matched_concepts": evaluation["matched_concepts"],
                "missing_concepts": evaluation["missing_concepts"],
                "answer_quality": evaluation["answer_quality"],
                "feedback": evaluation["feedback"],
                "reference_coverage": evaluation["reference_coverage"],
                "concept_score": evaluation["concept_score"],
                "completeness_score": evaluation["completeness_score"],
                "depth_score": evaluation["depth_score"],
                "clarity_score": evaluation["clarity_score"],
            }
        )

    maximum_score = len(results) * 20

    if maximum_score == 0:
        overall_score = 0
    else:
        overall_score = round(
            (
                total_score
                / maximum_score
            )
            * 100
        )

    # Basic summary
    if overall_score >= 85:
        performance_level = "Excellent"
    elif overall_score >= 70:
        performance_level = "Strong"
    elif overall_score >= 50:
        performance_level = "Developing"
    else:
        performance_level = "Needs Improvement"

    # Collect all missing concepts
    improvement_topics = []

    for result in results:
        for concept in result["missing_concepts"]:
            if concept not in improvement_topics:
                improvement_topics.append(concept)

    return {
        "success": True,
        "evaluation_type": "smart_local_rubric",
        "overall_score": overall_score,
        "total_score": total_score,
        "maximum_score": maximum_score,
        "questions_evaluated": len(results),
        "performance_level": performance_level,
        "improvement_topics": improvement_topics,
        "results": results,
    }
    # ============================================================
# GEMINI AI PRACTICE COACH
# ============================================================

load_dotenv(Path(__file__).with_name(".env"))

gemini_api_key = os.getenv("GEMINI_API_KEY")

gemini_client = (
    genai.Client(api_key=gemini_api_key)
    if gemini_api_key
    else None
)

# Cache identical question selections briefly to make retries/repeated starts fast.
# Entries contain only generic interview questions, never personal candidate data.
QUESTION_CACHE_TTL_SECONDS = 300
_question_cache: dict[tuple, tuple[float, dict]] = {}


class AIChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)

    action: Literal[
        "hint",
        "explain",
        "structure",
        "improve",
    ] = "hint"

    role: str = Field(
        default="Java Developer",
        max_length=100,
    )

    candidate_answer: str = Field(
        default="",
        max_length=8000,
    )


@app.post("/api/ai/chat")
def ai_practice_coach(request: AIChatRequest):
    if gemini_client is None:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key is not configured in backend/.env",
        )

    instructions = {
        "hint": (
            "Give one useful hint without revealing the complete answer."
        ),
        "explain": (
            "Explain the concept in simple language and give one example."
        ),
        "structure": (
            "Give a clear step-by-step structure for answering the question."
        ),
        "improve": (
            "Review the candidate's answer. Explain its strengths, "
            "missing concepts, and how to improve it."
        ),
    }

    prompt = f"""
You are the InterviewAI Practice Coach.

Target role: {request.role}

Interview question:
{request.question}

Candidate answer:
{request.candidate_answer or "No answer provided yet."}

Your task:
{instructions[request.action]}

Instructions:
- Use simple, accurate language.
- Give practical interview preparation advice.
- Be specific to the question.
- Do not invent facts.
- Keep the response concise and helpful.
"""

    try:
        started_at = time.perf_counter()
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                # Short coach replies feel much more responsive.
                max_output_tokens=350 if request.action in ("hint", "structure") else 600,
                thinking_config=types.ThinkingConfig(thinking_level="minimal"),
            ),
        )
        print(f"Gemini AI Coach ({request.action}) completed in {time.perf_counter() - started_at:.2f}s")

        reply = (response.text or "").strip()

        if not reply:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty response.",
            )

        return {
            "success": True,
            "reply": reply,
            "action": request.action,
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Gemini AI Coach error:", repr(error))

        raise HTTPException(
            status_code=502,
            detail=f"AI Coach temporarily failed ({type(error).__name__}). Please retry; details are recorded in Render Logs.",
        )

# ============================================================
# AI MOCK INTERVIEW: GEMINI-GENERATED QUESTIONS
# ============================================================

class GenerateInterviewRequest(BaseModel):
    role: str = Field(default="Java Developer", min_length=2, max_length=100)
    track: str = Field(default="MNC Interviews", max_length=100)
    organization: str = Field(default="Amazon-style", max_length=100)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    count: int = Field(default=5, ge=1, le=50)


class AIInterviewAnswer(BaseModel):
    question_id: str = Field(default="", max_length=100)
    question: str = Field(min_length=3, max_length=2000)
    reference_answer: str = Field(default="", max_length=5000)
    answer: str = Field(default="", max_length=8000)


class AIInterviewEvaluationRequest(BaseModel):
    role: str = Field(default="Java Developer", max_length=100)
    track: str = Field(default="MNC Interviews", max_length=100)
    organization: str = Field(default="Amazon-style", max_length=100)
    difficulty: Literal["Easy", "Medium", "Hard"] = "Medium"
    answers: list[AIInterviewAnswer] = Field(min_length=1, max_length=50)


def _gemini_json_response(prompt: str, max_output_tokens: int = 4096) -> dict:
    """Ask Gemini for JSON and parse it defensively."""
    if gemini_client is None:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key is not configured in backend/.env",
        )

    started_at = time.perf_counter()
    response = gemini_client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=max_output_tokens,
            thinking_config=types.ThinkingConfig(thinking_level="minimal"),
        ),
    )
    print(f"Gemini JSON generation completed in {time.perf_counter() - started_at:.2f}s")
    raw = (response.text or "").strip()
    if not raw:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response.")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Defensive fallback if the model wraps its JSON in other text.
        start = raw.find("{")
        end = raw.rfind("}")
        if start < 0 or end <= start:
            raise HTTPException(status_code=502, detail="Gemini returned an invalid JSON response.")
        try:
            parsed = json.loads(raw[start:end + 1])
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=502, detail="Gemini returned an invalid JSON response.") from error

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="Gemini returned an unexpected response format.")
    return parsed


def _clean_string_list(value, limit=8):
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            text = item.strip()
            if text not in cleaned:
                cleaned.append(text[:350])
        if len(cleaned) >= limit:
            break
    return cleaned


@app.post("/api/ai/generate-questions")
def generate_ai_interview_questions(request: GenerateInterviewRequest):
    """Create a fresh, role-focused mock-interview question set using Gemini."""
    prompt = f"""
You are an experienced technical interviewer and interview-preparation coach.
Create exactly {request.count} unique interview questions for the candidate configuration below.

Target role: {request.role}
Interview track: {request.track}
Style: {request.organization}
Difficulty: {request.difficulty}

Return ONLY a valid JSON object with this structure:
{{
  "questions": [
    {{
      "question": "...",
      "category": "...",
      "reference_answer": "A concise evaluation guide containing the key concepts a good answer should cover."
    }}
  ]
}}

Rules:
- Return exactly {request.count} questions, not fewer or more.
- Match the role, track, style, and difficulty. Do not merely change names on generic questions.
- Use clear, realistic interview wording, as an interviewer would ask aloud.
- Include a balanced set of fundamentals, applied problem solving, and practical scenarios appropriate for the selected role.
- Avoid duplicate questions, trivia, ambiguous wording, and assumptions that require private information.
- For company-style interviews, emulate the general format only; do not claim these are actual or confidential company questions.
- Each question should be no more than 25 words.
- Each reference_answer must be a compact guide of no more than 45 words.
- Keep the language professional, direct, and accessible.
"""

    cache_key = (request.role, request.track, request.organization, request.difficulty, request.count)
    now = time.monotonic()
    cached = _question_cache.get(cache_key)
    if cached and now - cached[0] < QUESTION_CACHE_TTL_SECONDS:
        print("Gemini question cache hit; returning cached question set")
        return {**cached[1], "cached": True}

    try:
        generated = _gemini_json_response(
            prompt,
            max_output_tokens=min(12000, 1500 + request.count * 250),
        )
        raw_questions = generated.get("questions")
        if not isinstance(raw_questions, list) or len(raw_questions) < request.count:
            raise HTTPException(status_code=502, detail="Gemini did not generate the requested number of questions.")

        questions = []
        for index, item in enumerate(raw_questions[:request.count], start=1):
            if not isinstance(item, dict):
                continue
            question_text = str(item.get("question", "")).strip()
            guide = str(item.get("reference_answer", "")).strip()
            if len(question_text) < 8:
                continue
            questions.append({
                "id": f"gemini-{index}",
                "question": question_text[:2000],
                "category": str(item.get("category", "Technical interview")).strip()[:100],
                "reference_answer": guide[:5000] or "Assess correctness, clarity, practical understanding, and relevant examples.",
                "role": request.role,
                "track": request.track,
                "organization": request.organization,
                "difficulty": request.difficulty,
                "generated_by": "Gemini",
            })

        if len(questions) != request.count:
            raise HTTPException(status_code=502, detail="Gemini returned incomplete questions. Please try again.")

        result = {
            "success": True,
            "source": "gemini",
            "requested_count": request.count,
            "questions": questions,
        }
        _question_cache[cache_key] = (time.monotonic(), result)
        # Drop expired cache entries to keep memory use bounded.
        expired_keys = [key for key, (created, _) in _question_cache.items()
                        if time.monotonic() - created >= QUESTION_CACHE_TTL_SECONDS]
        for key in expired_keys:
            _question_cache.pop(key, None)
        return result
    except HTTPException:
        raise
    except Exception as error:
        print("Gemini question generation error:", repr(error))
        raise HTTPException(
            status_code=502,
            detail=f"Gemini question generation failed ({type(error).__name__}). Please retry; details are recorded in Render Logs.",
        )


# ============================================================
# GEMINI MOCK-INTERVIEW EVALUATION + READINESS ADVICE
# ============================================================

@app.post("/api/ai/evaluate-interview")
def evaluate_ai_mock_interview(request: AIInterviewEvaluationRequest):
    """Evaluate the full mock interview and offer evidence-based practice guidance."""
    answer_payload = [
        {
            "question_number": index,
            "question": item.question,
            "evaluation_guide": item.reference_answer,
            "candidate_answer": item.answer.strip() or "[No answer provided]",
        }
        for index, item in enumerate(request.answers, start=1)
    ]

    prompt = f"""
You are a fair, constructive technical interviewer assessing a PRACTICE interview.
Candidate target role: {request.role}
Interview track: {request.track}
Interview style: {request.organization}
Question difficulty: {request.difficulty}

Evaluate every question and answer below. Use the evaluation guide as context, but accept other technically correct answers. Judge correctness, relevance, completeness, reasoning, examples, and clarity. Do not reward length alone. A blank answer should receive a score of 0 and clear feedback.

INTERVIEW DATA:
{json.dumps(answer_payload, ensure_ascii=False)}

Return ONLY a valid JSON object in exactly this general structure:
{{
  "summary": "A concise, honest overall performance summary.",
  "readiness_recommendation": "One clear recommendation such as Ready to start interviewing, Nearly ready — practise targeted areas, or Build fundamentals before high-stakes interviews.",
  "readiness_summary": "Explain why that recommendation follows from the submitted answers.",
  "strengths": ["..."],
  "areas_to_improve": ["..."],
  "next_steps": ["..."],
  "question_feedback": [
    {{
      "question_number": 1,
      "score": 0,
      "matched_concepts": ["..."],
      "missing_concepts": ["..."],
      "answer_quality": "Strong, Good, Developing, Weak, or No Answer",
      "feedback": "Specific feedback with at least one practical improvement when needed."
    }}
  ]
}}

Rules:
- Return one question_feedback entry for every supplied question, in the same order.
- Each score must be an integer from 0 to 20. Assess fairly against the question and guide.
- Keep each question's feedback to 1-2 short sentences (maximum 35 words).
- Limit matched_concepts and missing_concepts to 3 items each.
- Keep summary and readiness_summary to 2 short sentences each.
- Keep strengths, areas_to_improve, and next_steps concrete; use no more than 3 items in each list.
- State the readiness recommendation as PRACTICE GUIDANCE, not a guarantee of getting hired or passing a real interview. Do not claim certainty about an employer's decision.
- Be encouraging but honest. Avoid generic praise if the answers do not support it.
- Output JSON only; do not include Markdown fences or any prose outside JSON.
"""

    try:
        ai_result = _gemini_json_response(
            prompt,
            max_output_tokens=min(12000, 1400 + len(request.answers) * 260),
        )
        raw_feedback = ai_result.get("question_feedback", [])
        if not isinstance(raw_feedback, list):
            raw_feedback = []

        results = []
        for index, item in enumerate(request.answers):
            feedback_item = raw_feedback[index] if index < len(raw_feedback) and isinstance(raw_feedback[index], dict) else {}
            try:
                score = max(0, min(20, int(float(feedback_item.get("score", 0)))))
            except (TypeError, ValueError):
                score = 0

            results.append({
                "question_id": item.question_id or str(index + 1),
                "question": item.question,
                "candidate_answer": item.answer,
                "reference_answer": item.reference_answer,
                "score": score,
                "max_score": 20,
                "matched_concepts": _clean_string_list(feedback_item.get("matched_concepts"), 10),
                "missing_concepts": _clean_string_list(feedback_item.get("missing_concepts"), 10),
                "answer_quality": str(feedback_item.get("answer_quality", "Reviewed by Gemini"))[:80],
                "feedback": str(feedback_item.get("feedback", "Review the reference concepts and practise explaining your reasoning."))[:1200],
                "reference_coverage": 0,
                "concept_score": score,
                "completeness_score": 0,
                "depth_score": 0,
                "clarity_score": 0,
            })

        total_score = sum(item["score"] for item in results)
        maximum_score = len(results) * 20
        overall_score = round((total_score / maximum_score) * 100) if maximum_score else 0
        if overall_score >= 85:
            performance_level = "Excellent"
        elif overall_score >= 70:
            performance_level = "Strong"
        elif overall_score >= 50:
            performance_level = "Developing"
        else:
            performance_level = "Needs Improvement"

        improvement_topics = _clean_string_list(ai_result.get("areas_to_improve"), 8)
        for result in results:
            for concept in result["missing_concepts"]:
                if concept not in improvement_topics:
                    improvement_topics.append(concept)
                if len(improvement_topics) >= 10:
                    break

        return {
            "success": True,
            "evaluation_type": "gemini_mock_interview",
            "overall_score": overall_score,
            "total_score": total_score,
            "maximum_score": maximum_score,
            "questions_evaluated": len(results),
            "performance_level": performance_level,
            "summary": str(ai_result.get("summary", "Gemini has reviewed your practice interview."))[:2000],
            "readiness_recommendation": str(ai_result.get("readiness_recommendation", "Continue practising and review your feedback."))[:400],
            "readiness_summary": str(ai_result.get("readiness_summary", "Use this result as a practice guide, not a guarantee of a real interview outcome."))[:1500],
            "strengths": _clean_string_list(ai_result.get("strengths"), 5),
            "areas_to_improve": _clean_string_list(ai_result.get("areas_to_improve"), 5),
            "next_steps": _clean_string_list(ai_result.get("next_steps"), 5),
            "readiness_disclaimer": "This is AI-generated practice feedback, not a guarantee of passing a real interview or receiving a job offer.",
            "improvement_topics": improvement_topics,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as error:
        print("Gemini interview evaluation error:", repr(error))
        raise HTTPException(
            status_code=502,
            detail=f"Gemini evaluation failed ({type(error).__name__}). Please retry; details are recorded in Render Logs.",
        )
