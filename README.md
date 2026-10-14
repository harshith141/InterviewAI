# InterviewAI — AI-Powered Mock Interview Platform

**InterviewAI** is an AI-powered mock interview preparation platform designed to help students and job seekers prepare for technical interviews. It generates role-specific interview questions, provides AI-powered coaching, evaluates candidate answers, and generates interview feedback reports.

🌐 **Live Demo:** [Try InterviewAI](https://interview-ai-xi-six.vercel.app/)

📂 **GitHub Repository:** [harshith141/InterviewAI](https://github.com/harshith141/InterviewAI)

📘 **Backend API Documentation:** [Explore the API](https://interviewai-api-v2y9.onrender.com/docs)

---

## 🚀 Features

### 1. AI-Powered Interview Question Generation
- Generate interview questions based on the selected job role.
- Customize the interview using the selected track, organization, difficulty level, and number of questions.
- Practice with AI-generated questions for role-specific interview scenarios.

### 2. AI Practice Coach
Get assistance while preparing for interviews through four coaching actions:

- **Hint:** Get guidance to help approach a question.
- **Explain:** Understand the concept behind a question.
- **Structure:** Learn how to organize a clear interview answer.
- **Improve:** Receive suggestions to strengthen a candidate's answer.

### 3. Mock Interview Evaluation
- Submit interview answers for AI-powered evaluation.
- Receive feedback on answer quality and areas for improvement.
- Identify concepts that need further practice.

### 4. Voice-Based Practice
Practice answering interview questions using voice input where supported by the browser and microphone permissions.

### 5. Interview Feedback Report
Generate a downloadable PDF report containing interview evaluation results and feedback.

### 6. User Authentication
Firebase Authentication supports configured sign-in methods, including Google and email/password authentication.

### 7. Responsive User Interface
An interactive web interface designed to make interview preparation accessible through a modern browser.

---

## 🛠️ Tech Stack

| Component | Technologies |
|---|---|
| Frontend | React.js, Vite, CSS |
| Backend | Python, FastAPI |
| AI Integration | Google Gemini API |
| Authentication | Firebase Authentication |
| API Communication | REST API, JSON |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Version Control | Git, GitHub |

---

## 🏗️ System Architecture

```text
             Candidate
                 |
                 v
       React Frontend (Vercel)
                 |
          REST API Requests
                 |
                 v
       FastAPI Backend (Render)
                 |
                 v
          Google Gemini API
                 |
       +---------+----------+
       |         |          |
       v         v          v
   Question   AI Coach   Evaluation
  Generation  Responses  & Feedback
       |         |          |
       +---------+----------+
                 |
                 v
        Results in Frontend
                 |
                 v
          Downloadable PDF
```

Firebase Authentication manages supported sign-in methods separately from the interview-generation and evaluation flow.

---

## 📂 Project Structure

```text
InterviewAI/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
├── .gitignore
└── README.md
```

---

## ⚙️ Run the Project Locally

### Prerequisites

Install the following before starting:

- Python 3.10 or later
- Node.js and npm
- A Google Gemini API key
- A Firebase project with the required authentication providers enabled

### 1. Clone the Repository

```bash
git clone https://github.com/harshith141/InterviewAI.git
cd InterviewAI
```

### 2. Set Up the Backend

From the project folder, run:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder and add your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend server:

```bash
uvicorn main:app --reload
```

The backend will be available at `http://127.0.0.1:8000`.

Open the interactive API documentation at `http://127.0.0.1:8000/docs`.

### 3. Set Up the Frontend

Open a second terminal in the main project folder and run:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` folder with your Firebase web-app configuration:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

Replace the example values with your own Firebase configuration. Do not commit `.env` files to GitHub.

Start the frontend:

```bash
npm run dev
```

Open the local URL shown in the terminal, usually `http://localhost:5173`.

Keep both the backend and frontend servers running while testing locally.

---

## 🔌 Backend API Endpoints

The application exposes the following main endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Backend home endpoint |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/questions` | Retrieve interview questions |
| `POST` | `/api/evaluate` | Evaluate an interview |
| `POST` | `/api/ai/chat` | AI Practice Coach |
| `POST` | `/api/ai/generate-questions` | Generate AI interview questions |
| `POST` | `/api/ai/evaluate-interview` | Evaluate a mock interview |

For request schemas and interactive testing, visit the [InterviewAI API Documentation](https://interviewai-api-v2y9.onrender.com/docs).

---

## 🔐 Security Notes

- Keep the Gemini API key on the backend and store it in the backend environment configuration.
- Never commit `.env` files, passwords, service-account files, or private credentials.
- Configure production environment variables through the appropriate hosting dashboards.
- Variables prefixed with `VITE_` are included in the browser build. Do not place server-side secrets in them.
- Firebase web configuration is used by the client application; secure access through Firebase Authentication, authorized domains, and the appropriate Firebase security rules.

---

## 🌍 Deployment

The project is deployed using:

- **Frontend:** [Vercel](https://interview-ai-xi-six.vercel.app/)
- **Backend:** [Render](https://interviewai-api-v2y9.onrender.com/)
- **API Documentation:** [FastAPI Swagger UI](https://interviewai-api-v2y9.onrender.com/docs)

---

## 🔮 Future Enhancements

Potential improvements include:

- Resume-based personalized interview questions.
- Detailed skill-wise performance analytics.
- Interview history and progress dashboards.
- Additional programming languages and technical domains.
- More comprehensive automated testing.

These are planned enhancements, not claims about currently implemented functionality.

---

## 👨‍💻 Author

**Harshith Kumar**

AI/ML Student | Aspiring Software Engineer

GitHub: [@harshith141](https://github.com/harshith141)

---

*InterviewAI — Prepare smarter. Interview better.*
