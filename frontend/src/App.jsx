import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Configure Firebase in frontend/.env. Never paste private server keys here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;

const mncOptions = [
  "Amazon-style",
  "Microsoft-style",
  "Google-style",
  "Apple-style",
  "Product Company-style",
];

const governmentOptions = [
  "ISRO Technical",
  "DRDO Technical",
  "PSU Technical",
  "UPSC Personality",
];

function App() {
  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const [authScreen, setAuthScreen] = useState("signup");
  // signup | signin | forgot | app

  // Keep the account in localStorage, but never treat it as an active login.
  // A fresh visit must always go through the entrance and then authentication.
  const [candidate, setCandidate] = useState(null);
  const [hasAccount, setHasAccount] = useState(() =>
    Boolean(localStorage.getItem("interviewai_candidate"))
  );

  const [showEntrance, setShowEntrance] = useState(true);

  const [showProfile, setShowProfile] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEvaluationPreview, setShowEvaluationPreview] = useState(false);

  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    college: "",
    department: "",
    graduationYear: "",
  });

  const [signinData, setSigninData] = useState({
    email: "",
    password: "",
  });

  const [forgotData, setForgotData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [googleSigninLoading, setGoogleSigninLoading] = useState(false);
  const [emailAuthLoading, setEmailAuthLoading] = useState(false);

  // =========================================================
  // INTERVIEW STATE
  // =========================================================

  const [track, setTrack] = useState("MNC Interviews");
  const [organization, setOrganization] = useState("Amazon-style");
  const [role, setRole] = useState("Java Developer");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState("5");

  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionList, setQuestionList] = useState([]);
  const [questionSource, setQuestionSource] = useState("gemini");

  // Browser voice features: speech recognition (microphone) + speech synthesis (spoken questions).
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);
  const manualVoiceStopRef = useRef(false);
  const voiceRestartTimerRef = useRef(null);
  const voiceBaseAnswerRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const voiceInterimTranscriptRef = useRef("");

  const [answer, setAnswer] = useState("");
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  const [answerDrafts, setAnswerDrafts] = useState([]);

  // Gemini AI Practice Coach state
  const [coachAction, setCoachAction] = useState("hint");
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachReply, setCoachReply] = useState("");
  const [coachError, setCoachError] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // =========================================================
  // EVALUATION STATE
  // =========================================================

  const [evaluation, setEvaluation] = useState(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  // =========================================================
  // FIREBASE PROFILE HELPERS
  // =========================================================

  // Profiles and interview history are still stored locally for this MVP,
  // but passwords are never saved in localStorage.
  const readStoredCandidateByEmail = (email) => {
    try {
      const saved = localStorage.getItem("interviewai_candidate");
      if (!saved) return null;
      const profile = JSON.parse(saved);
      return String(profile?.email || "").trim().toLowerCase() ===
        String(email || "").trim().toLowerCase()
        ? profile
        : null;
    } catch (error) {
      console.warn("Could not read the saved InterviewAI profile:", error);
      return null;
    }
  };

  const buildCandidateFromFirebaseUser = (user, overrides = {}) => {
    const email = String(user?.email || overrides.email || "")
      .trim()
      .toLowerCase();
    const storedProfile = readStoredCandidateByEmail(email) || {};
    const safeStoredProfile = { ...storedProfile };
    delete safeStoredProfile.password;

    const merged = { ...safeStoredProfile, ...overrides };
    // Prevent legacy profiles or caller-supplied data from persisting passwords.
    delete merged.password;

    const isGoogleUser = Array.isArray(user?.providerData) &&
      user.providerData.some((provider) => provider.providerId === "google.com");

    return {
      ...merged,
      candidateId:
        merged.candidateId ||
        ("IA-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000)),
      fullName: String(overrides.fullName || user?.displayName || merged.fullName || email.split("@")[0]).trim(),
      email,
      mobile: merged.mobile || "",
      college: merged.college || "",
      department: merged.department || "",
      graduationYear: merged.graduationYear || "",
      createdAt: merged.createdAt || new Date().toISOString(),
      interviews: Array.isArray(merged.interviews) ? merged.interviews : [],
      authProvider: isGoogleUser ? "google" : "password",
      firebaseUid: user?.uid || merged.firebaseUid || "",
      photoURL: user?.photoURL || merged.photoURL || "",
    };
  };

  const enterWithFirebaseProfile = (profile, message) => {
    localStorage.setItem("interviewai_candidate", JSON.stringify(profile));
    setHasAccount(true);
    setCandidate(profile);
    setShowEntrance(false);
    setAuthError("");
    setAuthSuccess(message);
    setAuthScreen("app");
  };

  const explainFirebaseAuthError = (error, flow) => {
    const code = error?.code || "";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/weak-password") return "Choose a password with at least 6 characters.";
    if (code === "auth/email-already-in-use") return "An account already exists with this email. Please sign in or reset your password.";
    if (code === "auth/user-disabled") return "This account has been disabled. Please contact support.";
    if (code === "auth/too-many-requests") return "Too many attempts were made. Please wait a while and try again.";
    if (code === "auth/network-request-failed") return "Network error. Check your internet connection and try again.";
    if (code === "auth/operation-not-allowed") return "Email/Password sign-in is disabled in Firebase Authentication. Enable the Email/Password provider and try again.";
    if (code === "auth/unauthorized-domain") return "This website domain is not authorized. Add localhost under Firebase Authentication → Settings → Authorized domains.";
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) {
      return flow === "signin"
        ? "Email or password is incorrect. If you registered with Google, choose Continue with Google. New users should create an account first."
        : "We could not verify this account. Check the email address and try again.";
    }
    return error?.message || "Authentication failed. Please try again.";
  };

  // =========================================================
  // SIGN UP (Firebase Email/Password Authentication)
  // =========================================================

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((previous) => ({ ...previous, [name]: value }));
    setAuthError("");
    setAuthSuccess("");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const {
      fullName,
      email,
      mobile,
      password,
      confirmPassword,
      college,
      department,
      graduationYear,
    } = signupData;
    const normalizedEmail = email.trim().toLowerCase();

    if (!fullName.trim() || !normalizedEmail || !mobile.trim() || !password || !confirmPassword || !college.trim() || !department.trim() || !graduationYear.trim()) {
      setAuthError("Please complete all fields.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (mobile.replace(/\D/g, "").length < 10) {
      setAuthError("Please enter a valid mobile number.");
      return;
    }
    if (!firebaseAuth) {
      setAuthError("Firebase is not configured. Check frontend/.env and restart the Vite server.");
      return;
    }

    setEmailAuthLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        normalizedEmail,
        password
      );
      try {
        await updateProfile(credential.user, { displayName: fullName.trim() });
      } catch (profileError) {
        console.warn("Account was created, but the display name could not be saved:", profileError);
      }

      const newCandidate = buildCandidateFromFirebaseUser(credential.user, {
        fullName: fullName.trim(),
        email: normalizedEmail,
        mobile: mobile.trim(),
        college: college.trim(),
        department: department.trim(),
        graduationYear: graduationYear.trim(),
        authProvider: "password",
      });
      enterWithFirebaseProfile(newCandidate, "Account created successfully. Welcome to InterviewAI.");
    } catch (error) {
      console.error("Firebase email sign-up failed:", error);
      setAuthError(explainFirebaseAuthError(error, "signup"));
    } finally {
      setEmailAuthLoading(false);
    }
  };

  // =========================================================
  // SIGN IN (Firebase Email/Password Authentication)
  // =========================================================

  const handleSigninChange = (e) => {
    const { name, value } = e.target;
    setSigninData((previous) => ({ ...previous, [name]: value }));
    setAuthError("");
    setAuthSuccess("");
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const email = signinData.email.trim().toLowerCase();
    const password = signinData.password;
    if (!email || !password) {
      setAuthError("Enter your email address and password.");
      return;
    }
    if (!firebaseAuth) {
      setAuthError("Firebase is not configured. Check frontend/.env and restart the Vite server.");
      return;
    }

    setEmailAuthLoading(true);
    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      } catch (signInError) {
        // Smoothly migrate a matching legacy local-only account into Firebase.
        // This is only attempted when the user proves they know the old local password.
        const legacyProfile = readStoredCandidateByEmail(email);
        const mayMigrateLegacy = legacyProfile &&
          legacyProfile.password === password &&
          ["auth/user-not-found", "auth/invalid-credential", "auth/wrong-password"].includes(signInError?.code);

        if (!mayMigrateLegacy) throw signInError;

        credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (legacyProfile.fullName) {
          try {
            await updateProfile(credential.user, { displayName: legacyProfile.fullName });
          } catch (profileError) {
            console.warn("Legacy account migrated, but display name could not be saved:", profileError);
          }
        }
        const migratedCandidate = buildCandidateFromFirebaseUser(credential.user, {
          fullName: legacyProfile.fullName || email.split("@")[0],
          mobile: legacyProfile.mobile || "",
          college: legacyProfile.college || "",
          department: legacyProfile.department || "",
          graduationYear: legacyProfile.graduationYear || "",
          interviews: Array.isArray(legacyProfile.interviews) ? legacyProfile.interviews : [],
        });
        enterWithFirebaseProfile(migratedCandidate, "Signed in successfully. Your previous local profile was connected to Firebase.");
        return;
      }

      const signedInCandidate = buildCandidateFromFirebaseUser(credential.user);
      enterWithFirebaseProfile(signedInCandidate, "Signed in successfully.");
    } catch (error) {
      console.error("Firebase email sign-in failed:", error);
      setAuthError(explainFirebaseAuthError(error, "signin"));
    } finally {
      setEmailAuthLoading(false);
    }
  };

  // =========================================================
  // GOOGLE SIGN IN (Firebase Authentication)
  // =========================================================

  const handleGoogleSignin = async () => {
    setAuthError("");
    setAuthSuccess("");

    if (!firebaseAuth) {
      setAuthError("Google sign-in is not configured yet. Check frontend/.env, then restart Vite.");
      return;
    }

    setGoogleSigninLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(firebaseAuth, provider);
      if (!result.user.email) {
        throw new Error("Google did not return an email address. Please try another Google account.");
      }
      const googleCandidate = buildCandidateFromFirebaseUser(result.user, {
        authProvider: "google",
      });
      enterWithFirebaseProfile(googleCandidate, "Signed in with Google successfully.");
    } catch (error) {
      console.error("Google sign-in failed:", error);
      if (error?.code === "auth/popup-closed-by-user") {
        setAuthError("Google sign-in was cancelled. Click Continue with Google to try again.");
      } else if (error?.code === "auth/popup-blocked") {
        setAuthError("Your browser blocked the Google sign-in popup. Allow popups for this site and try again.");
      } else if (error?.code === "auth/unauthorized-domain") {
        setAuthError("This website domain is not authorized in Firebase. Add localhost to Firebase Authentication → Settings → Authorized domains.");
      } else if (error?.code === "auth/operation-not-allowed") {
        setAuthError("Google sign-in is disabled in Firebase. Enable Google under Authentication → Sign-in method.");
      } else {
        setAuthError(error?.message || "Google sign-in failed. Check your Firebase setup and try again.");
      }
    } finally {
      setGoogleSigninLoading(false);
    }
  };

  // =========================================================
  // FORGOT PASSWORD (Firebase email reset link)
  // =========================================================

  const handleForgotChange = (e) => {
    const { name, value } = e.target;
    setForgotData((previous) => ({ ...previous, [name]: value }));
    setAuthError("");
    setAuthSuccess("");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    const email = forgotData.email.trim().toLowerCase();

    if (!email) {
      setAuthError("Enter the email address associated with your account.");
      return;
    }
    if (!firebaseAuth) {
      setAuthError("Firebase is not configured. Check frontend/.env and restart the Vite server.");
      return;
    }

    setEmailAuthLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setAuthSuccess("If an email/password account exists for this address, Firebase has sent a password-reset link. Check your inbox and spam folder.");
      setForgotData({ email, newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Firebase password-reset request failed:", error);
      if (["auth/user-not-found", "auth/invalid-email"].includes(error?.code)) {
        // Use a generic response rather than disclose whether an account exists.
        setAuthSuccess("If an email/password account exists for this address, Firebase has sent a password-reset link. Check your inbox and spam folder.");
      } else {
        setAuthError(explainFirebaseAuthError(error, "forgot"));
      }
    } finally {
      setEmailAuthLoading(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    if (firebaseAuth) {
      signOut(firebaseAuth).catch((error) => {
        console.warn("Could not clear the Firebase session during logout:", error);
      });
    }
    setShowProfile(false);
    setCandidate(null);
    setAuthScreen("signin");
    setShowEntrance(true);

    setStarted(false);
    setCompleted(false);
    setQuestionList([]);
    setSubmittedAnswers([]);
    setAnswerDrafts([]);
    setAnswer("");
    setCurrentQuestion(0);
    setEvaluation(null);
    setEvaluationLoading(false);
    setEvaluationError("");
    setErrorMessage("");
    setReportMessage("");
  };

  // =========================================================
  // TRACK CHANGE
  // =========================================================

  const handleTrackChange = (newTrack) => {
    setTrack(newTrack);

    if (newTrack === "MNC Interviews") {
      setOrganization("Amazon-style");
    } else {
      setOrganization("ISRO Technical");
    }
  };

  // =========================================================
  // SCROLL
  // =========================================================

  const scrollToSetup = () => {
    document.getElementById("setup")?.scrollIntoView({
      behavior: "smooth",
    });
  };

  // =========================================================
  // START INTERVIEW
  // =========================================================

  const startInterview = async () => {
    setLoading(true);
    setErrorMessage("");
    setVoiceError("");
    stopVoiceInput();
    stopQuestionSpeech();

    try {
      const selection = {
        role,
        track,
        organization,
        difficulty,
        count: Number(questionCount),
      };

      let questionsData = null;
      let selectedSource = "Gemini AI";

      // Ask Gemini to create a fresh, role-specific question set first.
      try {
        const aiResponse = await fetch(`${API_URL}/api/ai/generate-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selection),
        });
        const aiData = await aiResponse.json().catch(() => ({}));
        if (aiResponse.ok && aiData.success && Array.isArray(aiData.questions) && aiData.questions.length === Number(questionCount)) {
          questionsData = aiData;
        } else {
          console.warn("Gemini question generation unavailable; trying the built-in question bank.", aiData.detail || "No complete question set returned.");
        }
      } catch (aiError) {
        console.warn("Gemini question generation could not connect; trying the built-in question bank.", aiError);
      }

      // Keep the project usable if the Gemini service is temporarily unavailable.
      if (!questionsData) {
        selectedSource = "Built-in question bank";
        const params = new URLSearchParams({
          role,
          track,
          organization,
          difficulty,
          count: questionCount,
        });
        const response = await fetch(`${API_URL}/api/questions?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Unable to connect to InterviewAI backend.");
        }
        questionsData = await response.json();
      }

      if (!questionsData.success || !Array.isArray(questionsData.questions) || !questionsData.questions.length) {
        setErrorMessage(
          `Questions could not be prepared for this selection. ${questionsData.message || questionsData.detail || "Try another role or question count."}`
        );
        setLoading(false);
        return;
      }

      setQuestionList(questionsData.questions);
      setQuestionSource(selectedSource);
      setCurrentQuestion(0);
      setAnswer("");
      setAnswerDrafts(Array(questionsData.questions.length).fill(""));
      setSubmittedAnswers([]);
      setCoachAction("hint");
      setCoachLoading(false);
      setCoachReply("");
      setCoachError("");
      setEvaluation(null);
      setEvaluationLoading(false);
      setEvaluationError("");
      setReportMessage("");
      setCompleted(false);
      setStarted(true);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Interview start error:", error);
      setErrorMessage(
        error.message || "Could not connect to the InterviewAI backend. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SUBMIT ANSWER
  // =========================================================

  const buildSubmittedAnswersFromDrafts = (drafts) =>
    questionList
      .map((item, index) => ({
        questionId: item.id,
        question: item.question,
        referenceAnswer: item.reference_answer,
        answer: String(drafts[index] || "").trim(),
      }))
      .filter((item) => item.answer);

  const handleAnswerChange = (value) => {
    setAnswer(value);
    setAnswerDrafts((previous) => {
      const next = [...previous];
      next[currentQuestion] = value;
      return next;
    });
    // Clear stale feedback once the candidate edits their answer.
    if (coachAction === "improve") {
      setCoachReply("");
      setCoachError("");
    }
  };

  const askAICoach = async (action) => {
    const current = questionList[currentQuestion];
    if (!current) return;

    if (action === "improve" && !answer.trim()) {
      setCoachAction(action);
      setCoachReply("");
      setCoachError("Write your answer first, then choose Improve my answer.");
      return;
    }

    setCoachAction(action);
    setCoachLoading(true);
    setCoachReply("");
    setCoachError("");

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: current.question,
          action,
          role,
          candidate_answer: answer.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.detail || `AI Coach request failed (${response.status}).`
        );
      }
      if (!data.success || !data.reply) {
        throw new Error("The AI Coach did not return a response. Please try again.");
      }

      setCoachReply(data.reply);
    } catch (error) {
      console.error("AI Coach request error:", error);
      setCoachError(
        error.message ||
          "Could not connect to the AI Coach. Check that the FastAPI backend is running."
      );
    } finally {
      setCoachLoading(false);
    }
  };

  const clearCoachForQuestionChange = () => {
    setCoachAction("hint");
    setCoachReply("");
    setCoachError("");
  };


  // =========================================================
  // VOICE INTERVIEW CONTROLS
  // =========================================================

  const stopVoiceInput = () => {
    manualVoiceStopRef.current = true;
    if (voiceRestartTimerRef.current) {
      window.clearTimeout(voiceRestartTimerRef.current);
      voiceRestartTimerRef.current = null;
    }

    const recognition = recognitionRef.current;
    // stop() lets the browser deliver any final words; abort() can discard them.
    try {
      recognition?.stop();
    } catch (error) {
      // The recognition session may already have ended.
    }
    setIsListening(false);
  };

  const stopQuestionSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakCurrentQuestion = () => {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") {
      setVoiceError("Spoken questions are not supported in this browser. Try the latest version of Chrome or Edge.");
      return;
    }

    stopQuestionSpeech();
    setVoiceError("");
    const utterance = new window.SpeechSynthesisUtterance(questionList[currentQuestion]?.question || "");
    utterance.lang = "en-IN";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => /^en-IN$/i.test(voice.lang)) || voices.find((voice) => /^en-/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceError("The question could not be played aloud. Try clicking Read Question again.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Voice typing is not supported in this browser. Use the latest Chrome or Edge, or type your answer.");
      return;
    }

    stopVoiceInput();
    if (voiceRestartTimerRef.current) {
      window.clearTimeout(voiceRestartTimerRef.current);
      voiceRestartTimerRef.current = null;
    }
    manualVoiceStopRef.current = false;
    voiceBaseAnswerRef.current = answer.trim();
    voiceFinalTranscriptRef.current = "";
    voiceInterimTranscriptRef.current = "";
    setVoiceError("");

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      // Keep recognition alive across sentences, and use interim results to
      // keep the editable answer box updated while the candidate speaks.
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (recognitionRef.current === recognition) setIsListening(true);
      };

      recognition.onresult = (event) => {
        // Append only newly-finalized phrases. Do not keep stale interim text,
        // because that can make the answer repeat or combine words incorrectly.
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const words = result?.[0]?.transcript?.trim() || "";
          if (!words || !result.isFinal) continue;

          voiceFinalTranscriptRef.current = [voiceFinalTranscriptRef.current, words]
            .filter(Boolean)
            .join(" ")
            .trim();
        }

        // Rebuild the interim part from the current browser results on every
        // event instead of appending interim phrases to old interim text.
        const interimPieces = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) continue;
          const words = result?.[0]?.transcript?.trim() || "";
          if (words) interimPieces.push(words);
        }
        voiceInterimTranscriptRef.current = interimPieces.join(" ").trim();

        const transcript = [voiceFinalTranscriptRef.current, voiceInterimTranscriptRef.current]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (transcript) {
          const combinedAnswer = [voiceBaseAnswerRef.current, transcript]
            .filter(Boolean)
            .join(" ")
            .trim();
          handleAnswerChange(combinedAnswer);
          setVoiceError("");
        }
      };

      recognition.onerror = (event) => {
        const fatalErrors = ["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"];
        if (event.error === "aborted" && manualVoiceStopRef.current) return;

        const message = event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone permission was blocked. Allow microphone access in your browser settings."
          : event.error === "audio-capture"
            ? "No microphone was found. Check your microphone connection and browser permissions."
            : event.error === "no-speech"
              ? "No speech detected yet. Keep speaking when ready; recording will resume automatically after a pause."
              : `Voice input reported ${event.error || "an unknown issue"}. You can keep typing or try recording again.`;
        setVoiceError(message);

        if (fatalErrors.includes(event.error)) {
          manualVoiceStopRef.current = true;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Ignore callbacks from an older session if the user restarted recording.
        if (recognitionRef.current !== recognition) return;

        if (manualVoiceStopRef.current) {
          recognitionRef.current = null;
          setIsListening(false);
          return;
        }

        // Some browsers end a speech session after a pause or after a time limit,
        // even with continuous=true. Restart it unless the candidate pressed Stop.
        voiceRestartTimerRef.current = window.setTimeout(() => {
          if (recognitionRef.current !== recognition || manualVoiceStopRef.current) return;
          try {
            recognition.start();
          } catch (error) {
            manualVoiceStopRef.current = true;
            recognitionRef.current = null;
            setIsListening(false);
            setVoiceError("Recording stopped unexpectedly. Click Speak answer to start again; your recognized text is preserved.");
          }
        }, 300);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (error) {
      recognitionRef.current = null;
      manualVoiceStopRef.current = true;
      setIsListening(false);
      setVoiceError("Could not start the microphone. Check browser permission and try again.");
    }
  };

  useEffect(() => {
    return () => {
      manualVoiceStopRef.current = true;
      if (voiceRestartTimerRef.current) {
        window.clearTimeout(voiceRestartTimerRef.current);
      }
      try {
        recognitionRef.current?.abort();
      } catch (error) {
        // Safe cleanup when leaving the interview screen.
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const goToPreviousQuestion = () => {
    if (currentQuestion === 0) return;
    stopVoiceInput();
    stopQuestionSpeech();

    const drafts = [...answerDrafts];
    drafts[currentQuestion] = answer;
    setAnswerDrafts(drafts);
    setSubmittedAnswers(buildSubmittedAnswersFromDrafts(drafts));

    const previousIndex = currentQuestion - 1;
    setCurrentQuestion(previousIndex);
    setAnswer(drafts[previousIndex] || "");
    clearCoachForQuestionChange();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitAnswer = async () => {
    if (!answer.trim()) {
      return;
    }
    stopVoiceInput();
    stopQuestionSpeech();

    const drafts = [...answerDrafts];
    drafts[currentQuestion] = answer.trim();
    setAnswerDrafts(drafts);

    const updatedAnswers = buildSubmittedAnswersFromDrafts(drafts);
    setSubmittedAnswers(updatedAnswers);

    if (currentQuestion < questionList.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      setAnswer(drafts[nextIndex] || "");
      clearCoachForQuestionChange();
      return;
    }

    // LAST QUESTION -> EVALUATE COMPLETE INTERVIEW
    // All question drafts are preserved, including any edits made after going back.
    setStarted(false);
    setCompleted(true);

    setEvaluation(null);
    setEvaluationError("");
    setEvaluationLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/ai/evaluate-interview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role,
            track,
            organization,
            difficulty,
            answers: updatedAnswers.map((item) => ({
              question_id: String(item.questionId ?? ""),
              question: item.question,
              reference_answer: item.referenceAnswer || "",
              answer: item.answer,
            })),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Gemini evaluation request failed.");
      }

      if (!data.success) {
        throw new Error("Interview evaluation failed.");
      }

      // Never treat a summary-only response as a complete evaluation. The PDF
      // report needs one scored result per evaluated question.
      const normalizedEvaluation = normalizeReportData(data);
      if (!normalizedEvaluation.results.length) {
        throw new Error(
          "Gemini returned an overall response without per-question scores. No report was saved. Please retry the interview evaluation."
        );
      }

      const completeEvaluation = {
        ...data,
        results: normalizedEvaluation.results,
        overall_score: normalizedEvaluation.overall_score,
        total_score: normalizedEvaluation.total_score,
        maximum_score: normalizedEvaluation.maximum_score,
        questions_evaluated: normalizedEvaluation.results.length,
        performance_level: normalizedEvaluation.performance_level,
      };

      setEvaluation(completeEvaluation);
      saveInterviewToHistory(completeEvaluation, updatedAnswers);
    } catch (error) {
      console.error("Evaluation error:", error);

      setEvaluationError(
        error.message || "Gemini could not evaluate this interview. Please check the backend terminal and try again."
      );
    } finally {
      setEvaluationLoading(false);
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================================
  // ANALYTICS + REPORT HELPERS
  // =========================================================

  const scrollToAnalytics = () => {
    setShowAnalytics(true);

    setTimeout(() => {
      document.getElementById("analytics")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 50);
  };

  const openEvaluationPreview = () => {
    const history = Array.isArray(candidate?.interviews)
      ? candidate.interviews
      : [];
    const latestEvaluatedInterview = [...history]
      .reverse()
      .find((item) => hasEvaluatedResults(item));

    if (!latestEvaluatedInterview && !hasEvaluatedResults(evaluation)) {
      setReportMessage(
        "No per-question evaluation results are saved yet. Complete an interview and wait for Gemini's evaluation before opening the report."
      );
      scrollToSetup();
      return;
    }

    setShowEvaluationPreview(true);
  };

  // Accept the canonical API shape and compatible aliases, but only use
  // per-question scored results as evidence for a detailed report.
  const extractReportResults = (source) => {
    if (!source || typeof source !== "object") return [];

    const possibleLists = [
      source.results,
      source.question_results,
      source.questionResults,
      source.evaluation_results,
      source.evaluationResults,
      source.evaluation?.results,
      source.report?.results,
    ];
    const rawResults = possibleLists.find(
      (items) => Array.isArray(items) && items.length > 0
    );
    if (!rawResults) return [];

    return rawResults.map((item, index) => ({
      ...item,
      question:
        item?.question ?? item?.question_text ?? item?.prompt ?? `Question ${index + 1}`,
      score: item?.score ?? item?.total_score ?? item?.totalScore ?? item?.points,
      max_score: item?.max_score ?? item?.maxScore ?? item?.max_points ?? 20,
    }));
  };

  const hasEvaluatedResults = (source) => {
    const results = extractReportResults(source);
    return results.length > 0 && results.every((item) =>
      item.score !== undefined &&
      item.score !== null &&
      item.score !== "" &&
      Number.isFinite(Number(item.score))
    );
  };

  const normalizeReportData = (source) => {
    if (!source) return null;

    const results = extractReportResults(source);
    const resultTotal = results.reduce(
      (sum, item) => sum + Number(item?.score || 0),
      0
    );
    const resultMaximum = results.reduce(
      (sum, item) => sum + Number(item?.max_score ?? item?.maxScore ?? 20),
      0
    );

    // When per-question results exist, derive totals from the full results list.
    // This keeps reports accurate for any selected count (5, 10, 15, 20, etc.)
    // and prevents an older/stale aggregate value from disagreeing with the rows.
    const rawTotal = results.length
      ? resultTotal
      : (source.total_score ?? source.totalScore ?? null);

    const rawMaximum = results.length
      ? resultMaximum
      : (source.maximum_score ?? source.maximumScore ?? null);

    let rawOverall = results.length
      ? (rawMaximum ? Math.round((Number(rawTotal) / Number(rawMaximum)) * 100) : 0)
      : (source.overall_score ?? source.overallScore ?? source.score ?? null);

    if (rawOverall === null && rawTotal !== null && rawMaximum) {
      rawOverall = Math.round((Number(rawTotal) / Number(rawMaximum)) * 100);
    }

    const overallScore = Number(rawOverall ?? 0);
    const totalScore = Number(rawTotal ?? 0);
    const maximumScore = Number(rawMaximum ?? 0);

    let performanceLevel =
      source.performance_level ??
      source.performanceLevel ??
      null;

    if (!performanceLevel && maximumScore > 0) {
      if (overallScore >= 85) performanceLevel = "Excellent";
      else if (overallScore >= 70) performanceLevel = "Strong";
      else if (overallScore >= 50) performanceLevel = "Developing";
      else performanceLevel = "Needs Improvement";
    }

    return {
      ...source,
      overall_score: overallScore,
      total_score: totalScore,
      maximum_score: maximumScore,
      // Per-question result rows are the source of truth whenever available.
      questions_evaluated: results.length > 0
        ? results.length
        : Number(source.questions_evaluated ?? source.questionsEvaluated ?? 0),
      performance_level: performanceLevel || "Not available",
      improvement_topics:
        source.improvement_topics ?? source.improvementTopics ?? [],
      results,
    };
  };

  const saveInterviewToHistory = (evaluationData, answers) => {
    const saved = localStorage.getItem("interviewai_candidate");

    if (!saved) {
      return;
    }

    try {
      const savedCandidate = JSON.parse(saved);
      const normalized = normalizeReportData(evaluationData);

      const interviewRecord = {
        id: Date.now(),
        completedAt: new Date().toISOString(),
        role,
        track,
        organization,
        difficulty,
        questionCount: answers.length,
        score: normalized.overall_score,
        overall_score: normalized.overall_score,
        totalScore: normalized.total_score,
        total_score: normalized.total_score,
        maximumScore: normalized.maximum_score,
        maximum_score: normalized.maximum_score,
        performanceLevel: normalized.performance_level,
        performance_level: normalized.performance_level,
        questionsEvaluated: normalized.questions_evaluated,
        questions_evaluated: normalized.questions_evaluated,
        improvementTopics: normalized.improvement_topics,
        improvement_topics: normalized.improvement_topics,
        summary: normalized.summary || "",
        readiness_recommendation: normalized.readiness_recommendation || "",
        readiness_summary: normalized.readiness_summary || "",
        strengths: normalized.strengths || [],
        areas_to_improve: normalized.areas_to_improve || [],
        next_steps: normalized.next_steps || [],
        results: normalized.results,
      };

      const existingInterviews = Array.isArray(
        savedCandidate.interviews
      )
        ? savedCandidate.interviews
        : [];

      const updatedCandidate = {
        ...savedCandidate,
        interviews: [
          ...existingInterviews,
          interviewRecord,
        ].slice(-20),
      };

      localStorage.setItem(
        "interviewai_candidate",
        JSON.stringify(updatedCandidate)
      );

      setCandidate(updatedCandidate);
    } catch (error) {
      console.error(
        "Could not save interview history:",
        error
      );
    }
  };

  const downloadReport = (reportSource = null) => {
    const history = Array.isArray(candidate?.interviews)
      ? candidate.interviews
      : [];
    const latestEvaluatedInterview = [...history]
      .reverse()
      .find((item) => hasEvaluatedResults(item));

    // Prefer a selected source only when it really contains scored question rows.
    // Otherwise use the current evaluation, then the latest valid saved evaluation.
    const preferredReport = [
      reportSource,
      evaluation,
      ...(reportSource ? [] : [latestEvaluatedInterview]),
    ].find((item) => hasEvaluatedResults(item));

    if (!preferredReport) {
      setReportMessage(
        "No per-question evaluation results were found for this session. No empty report was created. Complete a fresh interview, wait for Gemini's evaluation to finish, then download the report from the results screen."
      );
      return;
    }

    const report = normalizeReportData(preferredReport);
    if (!report || !Array.isArray(report.results) || report.results.length === 0) {
      setReportMessage(
        "The evaluation did not include scored question details, so the report was not generated. Please complete or retry an interview evaluation."
      );
      return;
    }

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    const reportRole = report.role || role;
    const reportTrack = report.track || track;
    const reportOrganization = report.organization || organization;
    const reportDifficulty = report.difficulty || difficulty;
    const results = Array.isArray(report.results) ? report.results : [];

    const safeText = (value) =>
      String(value ?? "").replace(/\s+/g, " ").trim();

    const resultScoreTotal = results.reduce(
      (sum, item) => sum + Number(item?.score || 0),
      0
    );
    const resultMaximumTotal = results.reduce(
      (sum, item) => sum + Number(item?.max_score ?? item?.maxScore ?? 20),
      0
    );

    // Recalculate from every displayed question to keep all report values aligned.
    const totalScore = results.length
      ? resultScoreTotal
      : Number(report.total_score ?? report.totalScore ?? 0);
    const maximumScore = results.length
      ? resultMaximumTotal
      : Number(report.maximum_score ?? report.maximumScore ?? 0);

    let overallScore = results.length
      ? (maximumScore > 0 ? Math.round((totalScore / maximumScore) * 100) : 0)
      : Number(report.overall_score ?? report.overallScore ?? report.score ?? 0);

    if (!overallScore && maximumScore > 0) {
      overallScore = Math.round((totalScore / maximumScore) * 100);
    }

    const performance =
      report.performance_level ||
      report.performanceLevel ||
      (overallScore >= 85
        ? "Excellent"
        : overallScore >= 70
        ? "Strong"
        : overallScore >= 50
        ? "Developing"
        : "Needs Improvement");

    const topics = Array.isArray(
      report.improvement_topics || report.improvementTopics
    )
      ? (report.improvement_topics || report.improvementTopics).slice(0, 6)
      : [];

    const colors = {
      navy: [12, 17, 30],
      ink: [25, 30, 44],
      muted: [100, 107, 124],
      line: [224, 227, 235],
      soft: [246, 247, 251],
      accent: [84, 96, 205],
      accentSoft: [239, 241, 255],
      green: [43, 150, 103],
      greenSoft: [233, 248, 239],
      amber: [184, 127, 40],
      amberSoft: [252, 244, 228],
      red: [188, 73, 84],
      redSoft: [253, 236, 239],
      white: [255, 255, 255],
    };

    const setText = (color) => doc.setTextColor(...color);
    const setFill = (color) => doc.setFillColor(...color);
    const setStroke = (color) => doc.setDrawColor(...color);

    const scoreTone = (score, maxScore = 20) => {
      const pct = maxScore ? (score / maxScore) * 100 : 0;
      if (pct >= 85)
        return { label: "Excellent", fill: colors.greenSoft, text: colors.green };
      if (pct >= 70)
        return { label: "Strong", fill: colors.accentSoft, text: colors.accent };
      if (pct >= 50)
        return { label: "Developing", fill: colors.amberSoft, text: colors.amber };
      return { label: "Needs Review", fill: colors.redSoft, text: colors.red };
    };

    const roundedBox = (
      x,
      y,
      width,
      height,
      fill = colors.white,
      stroke = colors.line,
      radius = 4
    ) => {
      setFill(fill);
      setStroke(stroke);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, width, height, radius, radius, "FD");
    };

    const progressBar = (x, y, width, percent, fill, bg = colors.soft, height = 4) => {
      setFill(bg);
      doc.roundedRect(x, y, width, height, 2, 2, "F");
      setFill(fill);
      doc.roundedRect(
        x,
        y,
        Math.max(percent > 0 ? 0.8 : 0, width * Math.max(0, Math.min(100, percent)) / 100),
        height,
        2,
        2,
        "F"
      );
    };

    let y = margin;

    // Header
    setFill(colors.navy);
    doc.roundedRect(margin, y, contentWidth, 24, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setText(colors.white);
    doc.text("InterviewAI", margin + 7, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("OVERALL INTERVIEW REPORT CARD", margin + 7, y + 17);
    doc.text(
      performance,
      pageWidth - margin - 7,
      y + 10,
      { align: "right" }
    );
    doc.setFontSize(7);
    doc.text(
      new Date(report.completedAt || Date.now()).toLocaleDateString(),
      pageWidth - margin - 7,
      y + 17,
      { align: "right" }
    );

    y += 30;

    // Candidate line
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setText(colors.ink);
    doc.text(candidate?.fullName || "Candidate", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(colors.muted);
    doc.text(
      `${candidate?.candidateId || ""} • ${candidate?.email || ""}`,
      margin,
      y + 5
    );
    y += 12;

    // Interview meta — compact
    const meta = [
      ["ROLE", reportRole],
      ["TRACK", reportTrack],
      ["ORG", reportOrganization],
      ["LEVEL", reportDifficulty],
    ];
    const gap = 4;
    const metaW = (contentWidth - gap * 3) / 4;
    meta.forEach(([label, value], index) => {
      const x = margin + index * (metaW + gap);
      roundedBox(x, y, metaW, 16, colors.soft);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      setText(colors.muted);
      doc.text(label, x + 4, y + 5.5);
      doc.setFontSize(7.5);
      setText(colors.ink);
      doc.text(
        doc.splitTextToSize(safeText(value), metaW - 8).slice(0, 2),
        x + 4,
        y + 11
      );
    });
    y += 22;

    // Overall score
    roundedBox(margin, y, contentWidth, 37, colors.accentSoft, [216, 220, 249], 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(colors.muted);
    doc.text("OVERALL SCORE", margin + 7, y + 8);
    doc.setFontSize(24);
    setText(colors.accent);
    doc.text(`${overallScore}/100`, margin + 7, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(colors.muted);
    doc.text(`${totalScore}/${maximumScore} total points`, margin + 7, y + 29);

    roundedBox(pageWidth - margin - 38, y + 7, 31, 14, colors.white, colors.line, 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(colors.accent);
    doc.text(performance, pageWidth - margin - 22.5, y + 15.5, {
      align: "center",
    });
    progressBar(
      margin + 63,
      y + 25,
      contentWidth - 72,
      overallScore,
      colors.accent,
      colors.white,
      4
    );
    y += 45;

    // Quick stats
    const kpiGap = 4;
    const kpiW = (contentWidth - kpiGap * 3) / 4;
    const best = results.length
      ? Math.max(...results.map((r) => Number(r?.score || 0)))
      : 0;
    const bestIndex = results.findIndex((r) => Number(r?.score || 0) === best);
    const focus = results.length
      ? Math.min(...results.map((r) => Number(r?.score || 0)))
      : 0;
    const focusIndex = results.findIndex((r) => Number(r?.score || 0) === focus);
    const avg = results.length ? (totalScore / results.length).toFixed(1) : "0.0";

    [
      ["QUESTIONS", `${results.length > 0 ? results.length : report.questions_evaluated || 0}`, "evaluated"],
      ["AVERAGE", `${avg}/20`, "per question"],
      ["BEST", `${best}/20`, bestIndex >= 0 ? `Q${bestIndex + 1}` : "—"],
      ["FOCUS", `${focus}/20`, focusIndex >= 0 ? `Q${focusIndex + 1}` : "—"],
    ].forEach(([label, value, note], index) => {
      const x = margin + index * (kpiW + kpiGap);
      roundedBox(x, y, kpiW, 20, colors.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      setText(colors.muted);
      doc.text(label, x + 5, y + 5.5);
      doc.setFontSize(9.5);
      setText(colors.ink);
      doc.text(value, x + 5, y + 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      setText(colors.muted);
      doc.text(note, x + 5, y + 17.5);
    });
    y += 27;

    // Performance summary — one short sentence
    roundedBox(margin, y, contentWidth, 23, colors.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(colors.ink);
    doc.text("Performance summary", margin + 6, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(colors.muted);
    const summary = results.length
      ? `Completed ${results.length} questions with ${totalScore}/${maximumScore}. Best: Q${bestIndex + 1 || "—"}. Focus next: Q${focusIndex + 1 || "—"}.`
      : "Detailed evaluation data is not available for this session.";
    doc.text(doc.splitTextToSize(summary, contentWidth - 12).slice(0, 2), margin + 6, y + 15);
    y += 30;

    // Question performance — short table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(colors.ink);
    doc.text("Question performance", margin, y);
    y += 5;

    const colQ = margin + 5;
    const colQuestion = margin + 18;
    const colScore = pageWidth - margin - 44;
    const colStatus = pageWidth - margin - 8;

    const drawQuestionTableHeader = () => {
      setFill(colors.navy);
      doc.roundedRect(margin, y, contentWidth, 8.5, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      setText(colors.white);
      doc.text("Q", colQ, y + 5.7);
      doc.text("QUESTION", colQuestion, y + 5.7);
      doc.text("SCORE", colScore, y + 5.7, { align: "right" });
      doc.text("STATUS", colStatus, y + 5.7, { align: "right" });
      y += 11;
    };

    drawQuestionTableHeader();

    results.forEach((result, index) => {
      // Continue on another PDF page rather than dropping questions or
      // allowing the question table to overlap the footer.
      if (y + 11 > pageHeight - 25) {
        doc.addPage();
        y = margin + 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        setText(colors.ink);
        doc.text("Question performance (continued)", margin, y);
        y += 5;
        drawQuestionTableHeader();
      }

      const score = Number(result?.score || 0);
      const maxScore = Number(result?.max_score || 20);
      const tone = scoreTone(score, maxScore);
      const question = safeText(result?.question || `Question ${index + 1}`);
      roundedBox(
        margin,
        y,
        contentWidth,
        11,
        index % 2 === 0 ? colors.white : [250, 250, 253],
        colors.line,
        2.5
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      setText(colors.ink);
      doc.text(`Q${index + 1}`, colQ, y + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      const qLines = doc.splitTextToSize(question, 92).slice(0, 1);
      doc.text(qLines, colQuestion, y + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      setText(tone.text);
      doc.text(`${score}/${maxScore}`, colScore, y + 7, { align: "right" });
      doc.setFontSize(5.8);
      doc.text(tone.label, colStatus, y + 7, { align: "right" });

      y += 13;
    });

    y += 2;

    // Keep the improvement section clear of the footer on longer interviews.
    if (y + 22 > pageHeight - 25) {
      doc.addPage();
      y = margin + 8;
    }

    // Improvement topics — short tags
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(colors.ink);
    doc.text("Key areas to improve", margin, y);
    y += 7;

    if (!topics.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(colors.muted);
      doc.text("No major improvement areas recorded.", margin, y);
    } else {
      let chipX = margin;
      topics.slice(0, 5).forEach((topic) => {
        const label = safeText(topic).slice(0, 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.8);
        const chipW = Math.min(34, Math.max(24, doc.getTextWidth(label) + 8));
        roundedBox(chipX, y, chipW, 7, colors.accentSoft, [220, 223, 249], 3.5);
        setText([72, 80, 151]);
        doc.text(label, chipX + chipW / 2, y + 4.7, { align: "center" });
        chipX += chipW + 3;
      });
    }

    setText(colors.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.text(
      "This report is generated from the InterviewAI evaluation recorded for this session.",
      margin,
      pageHeight - 18
    );

    // Add a consistent footer to every page in the downloaded report.
    const pageCount = doc.getNumberOfPages();
    const reportDate = new Date(report.completedAt || Date.now()).toLocaleDateString();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      const footerY = pageHeight - 8;
      setStroke(colors.line);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(colors.muted);
      doc.text("InterviewAI • Overall Interview Report", margin, footerY);
      doc.text(reportDate, pageWidth - margin, footerY, { align: "right" });
      doc.setFontSize(5.8);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth / 2, footerY, { align: "center" });
    }
    doc.setPage(pageCount);

    const safeOrganization =
      safeText(reportOrganization).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") ||
      "Interview";

    doc.save(
      `InterviewAI-Overall-Report-${safeOrganization}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    setReportMessage("Overall report downloaded successfully.");
  };

  // =========================================================
  // START NEW INTERVIEW
  // =========================================================

  const startNewInterview = () => {
    setStarted(false);
    setCompleted(false);
    setCurrentQuestion(0);
    setQuestionList([]);
    setAnswer("");
    setAnswerDrafts([]);
    setSubmittedAnswers([]);
    setErrorMessage("");
    setEvaluation(null);
    setEvaluationLoading(false);
    setEvaluationError("");
    setReportMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================================================
  // INTERNAL PAGE NAVIGATION
  // =========================================================

  const backToEntrance = () => {
    // Returning to the welcome screen intentionally requires authentication again.
    setCandidate(null);
    setShowEntrance(true);
    setAuthScreen("signin");
    setAuthError("");
    setAuthSuccess("");
    setShowProfile(false);
  };

  const backToSignIn = () => {
    setAuthScreen("signin");
    setAuthError("");
    setAuthSuccess("");
  };

  const backToDashboard = () => {
    setStarted(false);
    setCompleted(false);
    setCurrentQuestion(0);
    setQuestionList([]);
    setAnswer("");
    setAnswerDrafts([]);
    setSubmittedAnswers([]);
    setCoachLoading(false);
    setCoachReply("");
    setCoachError("");
    setEvaluationLoading(false);
    setEvaluationError("");
    setReportMessage("");
    setShowEvaluationPreview(false);
    setShowAnalytics(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backButtonStyle = {
    position: "absolute",
    top: "22px",
    left: "22px",
    zIndex: 20,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.11)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.82)",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
    backdropFilter: "blur(12px)",
  };

  const topbarBackButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    padding: "8px 11px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.78)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  };

  // =========================================================
  // AUTH SCREEN STYLES
  // =========================================================

  const authPageStyle = {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 15% 20%, rgba(80,100,255,0.18), transparent 35%), radial-gradient(circle at 85% 80%, rgba(0,210,180,0.12), transparent 35%), #070910",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  };

  const authContainerStyle = {
    width: "100%",
    maxWidth: "1100px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "30px",
    alignItems: "stretch",
  };

  const authBrandStyle = {
    borderRadius: "28px",
    padding: "55px",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minHeight: "650px",
  };

  const authCardStyle = {
    borderRadius: "28px",
    padding: "42px",
    background: "rgba(13,16,27,0.94)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.045)",
    color: "#ffffff",
    outline: "none",
    fontSize: "14px",
    marginTop: "8px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    color: "rgba(255,255,255,0.62)",
    marginBottom: "18px",
  };

  const authButtonStyle = {
    width: "100%",
    padding: "15px",
    borderRadius: "13px",
    border: "none",
    background:
      "linear-gradient(135deg, #ffffff, #cfd5ff)",
    color: "#080a10",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "8px",
  };

  // =========================================================
  // CINEMATIC ENTRANCE SCREEN
  // =========================================================

  if (showEntrance) {
    const enterAuth = (screen = null) => {
      if (screen) {
        setAuthScreen(screen);
      }
      setAuthError("");
      setAuthSuccess("");
      setShowEntrance(false);
    };

    return (
      <div className="entrance-screen">
        <div className="entrance-grid"></div>
        <div className="entrance-orb entrance-orb-one"></div>
        <div className="entrance-orb entrance-orb-two"></div>
        <div className="entrance-topbar">
          <div className="entrance-brand">
            <span className="entrance-brand-mark">IA</span>
            <span>InterviewAI</span>
          </div>
          <span className="entrance-status">AI INTERVIEW LAB</span>
        </div>

        <div className="entrance-content">
          <div className="entrance-kicker">
            <span className="entrance-pulse"></span>
            YOUR NEXT INTERVIEW STARTS HERE
          </div>

          <h1 className="entrance-title">
            Practice like the
            <span>real interview.</span>
          </h1>

          <p className="entrance-subtitle">
            Build confidence with role-focused questions, instant evaluation,
            and measurable progress — all in one focused workspace.
          </p>

          <div className="entrance-actions">
            <button
              type="button"
              className="entrance-primary"
              onClick={() => enterAuth(hasAccount ? "signin" : "signup")}
            >
              <span>{hasAccount ? "Sign in to InterviewAI" : "Start Preparing"}</span>
              <span className="entrance-arrow">→</span>
            </button>

            <button
              type="button"
              className="entrance-secondary"
              onClick={() => enterAuth(hasAccount ? "signup" : "signin")}
            >
              {hasAccount ? (
                <>New here? <strong>Create account</strong></>
              ) : (
                <>Already have an account? <strong>Sign in</strong></>
              )}
            </button>
          </div>

          <div className="entrance-trust-row">
            <div className="entrance-trust-item">
              <span className="entrance-mini-icon">01</span>
              <div>
                <strong>Role-focused</strong>
                <span>Targeted questions</span>
              </div>
            </div>
            <div className="entrance-trust-item">
              <span className="entrance-mini-icon">02</span>
              <div>
                <strong>Smart evaluation</strong>
                <span>Actionable feedback</span>
              </div>
            </div>
            <div className="entrance-trust-item">
              <span className="entrance-mini-icon">03</span>
              <div>
                <strong>Track progress</strong>
                <span>Improve every session</span>
              </div>
            </div>
          </div>
        </div>

        <div className="entrance-footer">
          <span>INTERVIEWAI</span>
          <span>Prepare smarter. Interview better.</span>
        </div>
      </div>
    );
  }

  // =========================================================
  // SIGN UP SCREEN
  // =========================================================

  if (!candidate && authScreen === "signup") {
    return (
      <div style={{ ...authPageStyle, position: "relative" }}>
        <button
          type="button"
          onClick={backToEntrance}
          style={backButtonStyle}
          aria-label="Back to welcome screen"
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>←</span>
          Back
        </button>
        <div style={authContainerStyle}>
          <div style={authBrandStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "45px",
              }}
            >
              <span
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  display: "grid",
                  placeItems: "center",
                  background: "#ffffff",
                  color: "#080a10",
                  fontWeight: "900",
                }}
              >
                IA
              </span>

              <strong style={{ fontSize: "21px" }}>
                InterviewAI
              </strong>
            </div>

            <span
              style={{
                fontSize: "11px",
                letterSpacing: "2px",
                color: "#9ca7ff",
                fontWeight: "700",
              }}
            >
              AI-POWERED INTERVIEW PREPARATION
            </span>

            <h1
              style={{
                fontSize: "52px",
                lineHeight: "1.02",
                margin: "18px 0",
                letterSpacing: "-2px",
              }}
            >
              Prepare smarter.
              <br />
              <span style={{ color: "#9ca7ff" }}>
                Interview better.
              </span>
            </h1>

            <p
              style={{
                color: "rgba(255,255,255,0.58)",
                lineHeight: "1.8",
                maxWidth: "470px",
              }}
            >
              Build your candidate profile, practice role-focused
              interviews, track your performance, and understand
              exactly where you need to improve.
            </p>

            <div
              style={{
                marginTop: "45px",
                display: "grid",
                gap: "16px",
              }}
            >
              {[
                "Role-focused interview practice",
                "MNC and government preparation tracks",
                "Performance reports and progress tracking",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    color: "rgba(255,255,255,0.72)",
                    fontSize: "13px",
                  }}
                >
                  <span
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(156,167,255,0.12)",
                      color: "#9ca7ff",
                    }}
                  >
                    ✓
                  </span>

                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={authCardStyle}>
            <div style={{ marginBottom: "30px" }}>
              <span
                style={{
                  fontSize: "11px",
                  letterSpacing: "1.5px",
                  color: "#9ca7ff",
                  fontWeight: "700",
                }}
              >
                CREATE ACCOUNT
              </span>

              <h2
                style={{
                  fontSize: "32px",
                  margin: "10px 0 8px",
                }}
              >
                Join InterviewAI
              </h2>

              <p
                style={{
                  color: "rgba(255,255,255,0.52)",
                  fontSize: "13px",
                }}
              >
                Create your candidate profile to begin.
              </p>
            </div>

            {authError && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(255,70,70,0.08)",
                  border:
                    "1px solid rgba(255,100,100,0.2)",
                  color: "#ffb0b0",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authError}
              </div>
            )}

            {authSuccess && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(70,220,160,0.08)",
                  border:
                    "1px solid rgba(70,220,160,0.2)",
                  color: "#8ff0c8",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleSignup}>
              <label style={labelStyle}>
                Full Name
                <input
                  style={inputStyle}
                  name="fullName"
                  value={signupData.fullName}
                  onChange={handleSignupChange}
                  placeholder="Enter your full name"
                />
              </label>

              <label style={labelStyle}>
                Email Address
                <input
                  style={inputStyle}
                  type="email"
                  name="email"
                  value={signupData.email}
                  onChange={handleSignupChange}
                  placeholder="you@example.com"
                />
              </label>

              <label style={labelStyle}>
                Mobile Number
                <input
                  style={inputStyle}
                  name="mobile"
                  value={signupData.mobile}
                  onChange={handleSignupChange}
                  placeholder="10-digit mobile number"
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label style={labelStyle}>
                  Password
                  <input
                    style={inputStyle}
                    type="password"
                    name="password"
                    value={signupData.password}
                    onChange={handleSignupChange}
                    placeholder="Create password"
                  />
                </label>

                <label style={labelStyle}>
                  Confirm Password
                  <input
                    style={inputStyle}
                    type="password"
                    name="confirmPassword"
                    value={signupData.confirmPassword}
                    onChange={handleSignupChange}
                    placeholder="Confirm password"
                  />
                </label>
              </div>

              <label style={labelStyle}>
                College / Institution
                <input
                  style={inputStyle}
                  name="college"
                  value={signupData.college}
                  onChange={handleSignupChange}
                  placeholder="Your college"
                />
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <label style={labelStyle}>
                  Department
                  <input
                    style={inputStyle}
                    name="department"
                    value={signupData.department}
                    onChange={handleSignupChange}
                    placeholder="AI/ML"
                  />
                </label>

                <label style={labelStyle}>
                  Graduation Year
                  <input
                    style={inputStyle}
                    name="graduationYear"
                    value={signupData.graduationYear}
                    onChange={handleSignupChange}
                    placeholder="2027"
                  />
                </label>
              </div>

              <button
                type="submit"
                style={{ ...authButtonStyle, opacity: emailAuthLoading ? 0.7 : 1, cursor: emailAuthLoading ? "wait" : "pointer" }}
                disabled={emailAuthLoading}
              >
                {emailAuthLoading ? "Creating account..." : "Create Account →"}
              </button>
            </form>

            <div
              style={{
                textAlign: "center",
                marginTop: "22px",
                fontSize: "13px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthScreen("signin");
                  setAuthError("");
                  setAuthSuccess("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aeb7ff",
                  cursor: "pointer",
                  fontWeight: "700",
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // SIGN IN SCREEN
  // =========================================================

  if (!candidate && authScreen === "signin") {
    return (
      <div style={{ ...authPageStyle, position: "relative" }}>
        <button
          type="button"
          onClick={backToEntrance}
          style={backButtonStyle}
          aria-label="Back to welcome screen"
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>←</span>
          Back
        </button>
        <div
          style={{
            width: "100%",
            maxWidth: "1000px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "30px",
          }}
        >
          <div style={authBrandStyle}>
            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "17px",
                display: "grid",
                placeItems: "center",
                background: "#ffffff",
                color: "#080a10",
                fontWeight: "900",
                fontSize: "18px",
                marginBottom: "35px",
              }}
            >
              IA
            </div>

            <span
              style={{
                fontSize: "11px",
                letterSpacing: "2px",
                color: "#9ca7ff",
                fontWeight: "700",
              }}
            >
              WELCOME BACK
            </span>

            <h1
              style={{
                fontSize: "48px",
                lineHeight: "1.05",
                margin: "15px 0",
              }}
            >
              Continue your
              <br />
              <span style={{ color: "#9ca7ff" }}>
                preparation.
              </span>
            </h1>

            <p
              style={{
                color: "rgba(255,255,255,0.55)",
                lineHeight: "1.8",
              }}
            >
              Access your interview history, performance reports,
              progress, and personalized preparation.
            </p>
          </div>

          <div
            style={{
              ...authCardStyle,
              minHeight: "500px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "1.5px",
                color: "#9ca7ff",
                fontWeight: "700",
              }}
            >
              SIGN IN
            </span>

            <h2
              style={{
                fontSize: "34px",
                margin: "10px 0",
              }}
            >
              Welcome back
            </h2>

            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "13px",
                marginBottom: "30px",
              }}
            >
              Sign in to continue to your dashboard.
            </p>

            {authError && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(255,70,70,0.08)",
                  border:
                    "1px solid rgba(255,100,100,0.2)",
                  color: "#ffb0b0",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authError}
              </div>
            )}

            {authSuccess && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(70,220,160,0.08)",
                  color: "#8ff0c8",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleSignin}>
              <label style={labelStyle}>
                Email Address
                <input
                  style={inputStyle}
                  type="email"
                  name="email"
                  value={signinData.email}
                  onChange={handleSigninChange}
                  placeholder="you@example.com"
                />
              </label>

              <label style={labelStyle}>
                Password
                <input
                  style={inputStyle}
                  type="password"
                  name="password"
                  value={signinData.password}
                  onChange={handleSigninChange}
                  placeholder="Enter your password"
                />
              </label>

              <div
                style={{
                  textAlign: "right",
                  marginTop: "-5px",
                  marginBottom: "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAuthScreen("forgot");
                    setAuthError("");
                    setAuthSuccess("");
                    setForgotData({
                      email: signinData.email,
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#aeb7ff",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                style={{ ...authButtonStyle, opacity: emailAuthLoading ? 0.7 : 1, cursor: emailAuthLoading ? "wait" : "pointer" }}
                disabled={emailAuthLoading}
              >
                {emailAuthLoading ? "Signing in..." : "Sign In →"}
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "20px 0 16px",
                color: "rgba(255,255,255,0.35)",
                fontSize: "11px",
              }}
            >
              <span style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.10)" }} />
              OR CONTINUE WITH
              <span style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.10)" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignin}
              disabled={googleSigninLoading}
              style={{
                width: "100%",
                minHeight: "46px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "11px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "#ffffff",
                color: "#202124",
                fontSize: "13px",
                fontWeight: 700,
                cursor: googleSigninLoading ? "wait" : "pointer",
                opacity: googleSigninLoading ? 0.75 : 1,
                transition: "transform .18s ease, box-shadow .18s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontWeight: 900,
                  fontSize: "19px",
                  lineHeight: 1,
                  color: "#4285F4",
                }}
              >
                G
              </span>
              {googleSigninLoading ? "Connecting to Google..." : "Continue with Google"}
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: "22px",
                fontSize: "13px",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthScreen("signup");
                  setAuthError("");
                  setAuthSuccess("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aeb7ff",
                  cursor: "pointer",
                  fontWeight: "700",
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // COMPLETED INTERVIEW
  // =========================================================

  if (completed) {
    return (
      <div className="app-shell">
        <header
          className="topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            padding: "16px 28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              minWidth: 0,
            }}
          >
            <button
              type="button"
              onClick={backToDashboard}
              style={{
                ...topbarBackButtonStyle,
                whiteSpace: "nowrap",
              }}
              aria-label="Back to dashboard"
            >
              <span style={{ fontSize: "17px", lineHeight: 1 }}>←</span>
              Dashboard
            </button>

            <div className="brand" style={{ flexShrink: 0 }}>
              <span className="brand-mark">IA</span>
              <span>InterviewAI</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <span className="topbar-status">
              <span className="status-dot"></span>
              Interview completed
            </span>

            <button
              className="secondary-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="results-page">
          <section className="results-hero">
            <div>
              <span className="eyebrow">
                ASSESSMENT COMPLETE
              </span>

              <h1>
                Your interview
                <span> is complete.</span>
              </h1>

              <p>
                Gemini has reviewed your answers and prepared a practical readiness recommendation.
                Review your score, strengths, improvement areas, and next steps below.
              </p>
            </div>

            <div className="result-score-card">
              <span>INTERVIEW SCORE</span>

              {evaluationLoading ? (
                <>
                  <strong className="score-loading">...</strong>
                  <small>Evaluating your answers</small>
                </>
              ) : evaluation ? (
                <>
                  <strong>
                    {evaluation.overall_score}
                    <small>/100</small>
                  </strong>
                  <small>{evaluation.performance_level}</small>
                </>
              ) : (
                <>
                  <strong>—</strong>
                  <small>
                    {evaluationError
                      ? "Evaluation failed"
                      : "Evaluation pending"}
                  </small>
                </>
              )}
            </div>
          </section>

          <section className="results-grid">
            <div className="metric-card">
              <span>QUESTIONS</span>

              <strong>
                {submittedAnswers.length}/{questionList.length}
              </strong>

              <small>Completed successfully</small>
            </div>

            <div className="metric-card">
              <span>INTERVIEW TYPE</span>

              <strong>{organization}</strong>

              <small>{track}</small>
            </div>

            <div className="metric-card">
              <span>TARGET ROLE</span>

              <strong>{role}</strong>

              <small>{difficulty} difficulty</small>
            </div>
          </section>

          {evaluation && (
            <section className="evaluation-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    SMART EVALUATION
                  </span>

                  <h2>Your performance report</h2>
                </div>
              </div>

              <div className="evaluation-grid">
                <div className="evaluation-card">
                  <span>PERFORMANCE</span>
                  <strong>{evaluation.performance_level}</strong>
                  <small>Overall interview performance</small>
                </div>

                <div className="evaluation-card">
                  <span>QUESTIONS EVALUATED</span>
                  <strong>{evaluation.questions_evaluated}</strong>
                  <small>Responses analyzed</small>
                </div>

                <div className="evaluation-card">
                  <span>TOTAL SCORE</span>
                  <strong>
                    {evaluation.total_score}/{evaluation.maximum_score}
                  </strong>
                  <small>Based on concept coverage</small>
                </div>
              </div>

              {(evaluation.readiness_recommendation || evaluation.readiness_summary) && (
                <div
                  className="ai-readiness-card"
                  style={{
                    marginTop: "20px",
                    padding: "20px",
                    borderRadius: "16px",
                    border: "1px solid rgba(143,153,255,0.26)",
                    background: "linear-gradient(135deg, rgba(88,101,210,0.14), rgba(20,25,43,0.76))",
                  }}
                >
                  <span className="eyebrow">GEMINI INTERVIEW READINESS</span>
                  <h3 style={{ margin: "9px 0 8px", fontSize: "20px", color: "#f5f6ff" }}>
                    {evaluation.readiness_recommendation || "Your next interview preparation steps"}
                  </h3>
                  <p style={{ margin: 0, color: "rgba(239,241,255,0.72)", fontSize: "13px", lineHeight: 1.75 }}>
                    {evaluation.readiness_summary || evaluation.summary}
                  </p>
                  {evaluation.strengths?.length > 0 && (
                    <div style={{ marginTop: "16px" }}>
                      <strong style={{ display: "block", marginBottom: "8px", color: "#a8e5c6", fontSize: "11px", letterSpacing: "0.8px" }}>WHAT YOU DID WELL</strong>
                      <ul style={{ margin: 0, paddingLeft: "19px", color: "rgba(239,241,255,0.78)", fontSize: "12px", lineHeight: 1.8 }}>
                        {evaluation.strengths.map((item, index) => <li key={`strength-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                  {(evaluation.areas_to_improve?.length > 0 || evaluation.next_steps?.length > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginTop: "16px" }}>
                      {evaluation.areas_to_improve?.length > 0 && (
                        <div>
                          <strong style={{ display: "block", marginBottom: "8px", color: "#ffd99b", fontSize: "11px", letterSpacing: "0.8px" }}>PRIORITY AREAS</strong>
                          <ul style={{ margin: 0, paddingLeft: "19px", color: "rgba(239,241,255,0.72)", fontSize: "12px", lineHeight: 1.8 }}>
                            {evaluation.areas_to_improve.map((item, index) => <li key={`area-${index}`}>{item}</li>)}
                          </ul>
                        </div>
                      )}
                      {evaluation.next_steps?.length > 0 && (
                        <div>
                          <strong style={{ display: "block", marginBottom: "8px", color: "#bfc6ff", fontSize: "11px", letterSpacing: "0.8px" }}>YOUR NEXT STEPS</strong>
                          <ol style={{ margin: 0, paddingLeft: "19px", color: "rgba(239,241,255,0.72)", fontSize: "12px", lineHeight: 1.8 }}>
                            {evaluation.next_steps.map((item, index) => <li key={`next-${index}`}>{item}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                  <p style={{ margin: "16px 0 0", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(235,238,255,0.44)", fontSize: "10px", lineHeight: 1.6 }}>
                    {evaluation.readiness_disclaimer || "This is AI-generated practice guidance, not a guarantee of passing a real interview or receiving a job offer."}
                  </p>
                </div>
              )}

              {evaluation.improvement_topics?.length > 0 && (
                <div className="improvement-card">
                  <span className="eyebrow">
                    AREAS TO IMPROVE
                  </span>

                  <h3>Concepts to strengthen</h3>

                  <div className="concept-list">
                    {evaluation.improvement_topics.map((topic) => (
                      <span
                        key={topic}
                        className="concept-pill"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {evaluationError && !evaluationLoading && (
            <div className="evaluation-error">
              {evaluationError}
            </div>
          )}

          <section className="review-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  RESPONSE REVIEW
                </span>

                <h2>Your interview answers</h2>
              </div>

              <div className="results-actions">
                <button
                  className="secondary-button report-download-button"
                  onClick={downloadReport}
                  disabled={!evaluation || evaluationLoading}
                >
                  {evaluationLoading
                    ? "Preparing Report..."
                    : "Download Overall Report"}
                </button>

                <button
                  className="secondary-button"
                  onClick={startNewInterview}
                >
                  Start New Interview
                </button>
              </div>
            </div>

            <div className="review-list">
              {submittedAnswers.map((item, index) => (
                <article
                  className="review-card"
                  key={index}
                >
                  <div className="question-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="review-content">
                    <h3>{item.question}</h3>

                    <div className="answer-box">
                      <span>Your answer</span>
                      <p>{item.answer}</p>
                    </div>

                    <div
                      className="answer-box"
                      style={{ marginTop: "10px" }}
                    >
                      <span>Reference answer</span>
                      <p>{item.referenceAnswer}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <span>InterviewAI</span>
          <span>
            AI-powered interview preparation platform
          </span>
        </footer>
      </div>
    );
  }

  // =========================================================
  // FORGOT PASSWORD SCREEN
  // =========================================================

  if (!candidate && authScreen === "forgot") {
    return (
      <div style={{ ...authPageStyle, position: "relative" }}>
        <button
          type="button"
          onClick={backToSignIn}
          style={backButtonStyle}
          aria-label="Back to sign in"
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>←</span>
          Back
        </button>
        <div
          style={{
            width: "100%",
            maxWidth: "520px",
          }}
        >
          <div
            style={{
              ...authCardStyle,
              minHeight: "520px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "1.5px",
                color: "#9ca7ff",
                fontWeight: "700",
              }}
            >
              ACCOUNT RECOVERY
            </span>

            <h2
              style={{
                fontSize: "34px",
                margin: "10px 0",
              }}
            >
              Reset your password
            </h2>

            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "13px",
                lineHeight: "1.7",
                marginBottom: "30px",
              }}
            >
              Enter the email associated with your account. We’ll send you a secure password-reset link.
            </p>

            {authError && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(255,70,70,0.08)",
                  border: "1px solid rgba(255,100,100,0.2)",
                  color: "#ffb0b0",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authError}
              </div>
            )}

            {authSuccess && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(70,220,160,0.08)",
                  color: "#8ff0c8",
                  fontSize: "12px",
                  marginBottom: "18px",
                }}
              >
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPassword}>
              <label style={labelStyle}>
                Email Address
                <input
                  style={inputStyle}
                  type="email"
                  name="email"
                  value={forgotData.email}
                  onChange={handleForgotChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <button
                type="submit"
                style={{ ...authButtonStyle, opacity: emailAuthLoading ? 0.7 : 1, cursor: emailAuthLoading ? "wait" : "pointer" }}
                disabled={emailAuthLoading}
              >
                {emailAuthLoading ? "Sending reset email..." : "Send Reset Link →"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setAuthScreen("signin");
                setAuthError("");
                setAuthSuccess("");
              }}
              style={{
                marginTop: "20px",
                alignSelf: "center",
                background: "none",
                border: "none",
                color: "#aeb7ff",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // LIVE INTERVIEW
  // =========================================================

  if (started) {
    const progress =
      ((currentQuestion + 1) / questionList.length) * 100;

    const currentQuestionData =
      questionList[currentQuestion];
    const robotMode = isListening ? "listening" : isSpeaking ? "speaking" : coachLoading ? "thinking" : "ready";
    const robotStatus = isListening
      ? "Listening — pause naturally and press Stop when finished"
      : isSpeaking
        ? "Reading your question aloud"
        : coachLoading
          ? "Thinking through your question"
          : "Ready when you are";

    const handleInterviewBack = () => {
      stopVoiceInput();
      stopQuestionSpeech();
      const hasProgress =
        submittedAnswers.length > 0 || answer.trim().length > 0;

      if (hasProgress) {
        const shouldLeave = window.confirm(
          "Go back to the dashboard? Your current interview progress will be cleared."
        );
        if (!shouldLeave) return;
      }

      backToDashboard();
    };

    return (
      <div className="app-shell">
        <header
          className="topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            padding: "16px 28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
              minWidth: 0,
            }}
          >
            <button
              type="button"
              onClick={handleInterviewBack}
              style={{
                ...topbarBackButtonStyle,
                whiteSpace: "nowrap",
              }}
              aria-label="Back to dashboard"
            >
              <span style={{ fontSize: "17px", lineHeight: 1 }}>←</span>
              Dashboard
            </button>

            <div className="brand" style={{ flexShrink: 0 }}>
              <span className="brand-mark">IA</span>
              <span>InterviewAI</span>
            </div>
          </div>

          <div className="interview-meta" style={{ flexShrink: 0 }}>
            {organization}
            <span>•</span>
            {role}
            <span>•</span>
            {difficulty}
          </div>
        </header>

        <main className="interview-page">
          <div className="interview-header">
            <div>
              <span className="eyebrow">
                LIVE INTERVIEW
              </span>

              <p>
                Question {currentQuestion + 1} of{" "}
                {questionList.length}
              </p>
            </div>

            <div className="progress-label">
              {Math.round(progress)}%
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
              }}
            ></div>
          </div>

          <section className="question-card">
            <div className="question-card-top">
              <span>{track.toUpperCase()}</span>
              <span>{organization}</span>
            </div>

            <h1>{currentQuestionData.question}</h1>

            <div
              className="voice-interview-controls"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "14px 15px",
                margin: "16px 0 18px",
                borderRadius: "14px",
                border: "1px solid rgba(143,153,255,0.2)",
                background: "rgba(85,99,190,0.08)",
              }}
            >
              <div className={`interviewer-robot robot-${robotMode}`} role="status" aria-live="polite">
                <div className="interviewer-robot-figure" aria-hidden="true">
                  <span className="interviewer-robot-antenna"><span /></span>
                  <span className="interviewer-robot-ear interviewer-robot-ear-left" />
                  <span className="interviewer-robot-ear interviewer-robot-ear-right" />
                  <span className="interviewer-robot-head">
                    <span className="interviewer-robot-face">
                      <span className="interviewer-robot-eye" />
                      <span className="interviewer-robot-eye" />
                      <span className="interviewer-robot-mouth" />
                    </span>
                  </span>
                  <span className="interviewer-robot-body"><span /></span>
                </div>
                <div className="interviewer-robot-copy">
                  <span className="interviewer-robot-kicker">YOUR AI INTERVIEWER</span>
                  <strong>Nova <span>•</span> InterviewAI</strong>
                  <span className="interviewer-robot-status">{robotStatus}</span>
                  <small>{questionSource === "Gemini AI" ? "Questions prepared by Gemini" : "Using the built-in question bank"}</small>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  type="button"
                  onClick={isSpeaking ? stopQuestionSpeech : speakCurrentQuestion}
                  style={{ padding: "9px 12px", borderRadius: "10px", border: "1px solid rgba(159,169,255,0.28)", background: "rgba(123,135,255,0.13)", color: "#dfe2ff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isSpeaking ? "⏹ Stop voice" : "🔊 Read question"}
                </button>
                <button
                  type="button"
                  onClick={isListening ? stopVoiceInput : startVoiceInput}
                  style={{ padding: "9px 12px", borderRadius: "10px", border: isListening ? "1px solid rgba(255,126,126,0.45)" : "1px solid rgba(100,220,170,0.3)", background: isListening ? "rgba(255,80,80,0.1)" : "rgba(55,190,130,0.1)", color: isListening ? "#ffbcbc" : "#a9f0ce", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  {isListening ? "⏹ Stop recording" : "🎙️ Speak answer"}
                </button>
              </div>
            </div>
            {voiceError && (
              <div role="status" aria-live="polite" style={{ margin: "-6px 0 16px", padding: "10px 12px", borderRadius: "10px", background: "rgba(143,153,255,0.08)", color: "#cbd0ff", fontSize: "11px", lineHeight: 1.55 }}>
                {voiceError}
              </div>
            )}
            {isListening && (
              <p className="voice-recording-tip">Keep speaking naturally, even across several sentences. Your recognized words will appear below; click <strong>Stop recording</strong> when your answer is complete.</p>
            )}

            <section
              aria-label="AI Practice Coach"
              style={{
                margin: "22px 0 24px",
                padding: "18px",
                borderRadius: "18px",
                border: "1px solid rgba(143, 153, 255, 0.24)",
                background: "linear-gradient(135deg, rgba(91, 103, 214, 0.12), rgba(21, 28, 48, 0.62))",
                boxShadow: "0 14px 34px rgba(0, 0, 0, 0.14)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      color: "#aeb7ff",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    <span aria-hidden="true">✦</span> Gemini AI Practice Coach
                  </span>
                  <h2 style={{ margin: "7px 0 4px", fontSize: "17px", color: "#f4f5ff" }}>
                    Need a little guidance?
                  </h2>
                  <p style={{ margin: 0, color: "rgba(235,238,255,0.62)", fontSize: "12px", lineHeight: 1.6 }}>
                    Get a hint or learn how to improve your answer while you practise.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#b9c0ff",
                    border: "1px solid rgba(143,153,255,0.25)",
                    background: "rgba(143,153,255,0.08)",
                    borderRadius: "999px",
                    padding: "6px 9px",
                    whiteSpace: "nowrap",
                  }}
                >
                  AI ASSIST
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                  gap: "9px",
                }}
              >
                {[
                  { action: "hint", icon: "💡", title: "Give me a hint", description: "A clue, not the full answer" },
                  { action: "explain", icon: "🧠", title: "Explain concept", description: "Learn it in simple words" },
                  { action: "structure", icon: "📝", title: "Answer structure", description: "Organize a strong response" },
                  { action: "improve", icon: "✨", title: "Improve my answer", description: "Feedback on your draft" },
                ].map((item) => {
                  const isSelected = coachAction === item.action;
                  const isDisabled = coachLoading || (item.action === "improve" && !answer.trim());
                  return (
                    <button
                      key={item.action}
                      type="button"
                      onClick={() => askAICoach(item.action)}
                      disabled={isDisabled}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "9px",
                        minHeight: "66px",
                        padding: "11px 10px",
                        textAlign: "left",
                        borderRadius: "12px",
                        border: isSelected
                          ? "1px solid rgba(156,167,255,0.68)"
                          : "1px solid rgba(255,255,255,0.09)",
                        background: isSelected
                          ? "rgba(112,124,240,0.16)"
                          : "rgba(255,255,255,0.035)",
                        color: isDisabled ? "rgba(255,255,255,0.4)" : "#f3f4ff",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled && item.action !== "improve" ? 0.7 : 1,
                        transition: "border-color 160ms ease, background 160ms ease",
                      }}
                    >
                      <span style={{ fontSize: "18px", lineHeight: 1.2 }} aria-hidden="true">{item.icon}</span>
                      <span style={{ display: "grid", gap: "4px" }}>
                        <strong style={{ fontSize: "11.5px", lineHeight: 1.35 }}>{item.title}</strong>
                        <small style={{ fontSize: "10px", lineHeight: 1.35, color: "rgba(235,238,255,0.55)" }}>{item.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              {coachLoading && (
                <div
                  role="status"
                  style={{
                    marginTop: "14px",
                    padding: "12px 13px",
                    borderRadius: "12px",
                    background: "rgba(8,12,24,0.5)",
                    color: "#cbd0ff",
                    fontSize: "12px",
                  }}
                >
                  Gemini is thinking about this question…
                </div>
              )}

              {coachError && !coachLoading && (
                <div
                  role="alert"
                  style={{
                    marginTop: "14px",
                    padding: "12px 13px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,120,120,0.22)",
                    background: "rgba(255,80,80,0.07)",
                    color: "#ffbcbc",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  {coachError}
                </div>
              )}

              {coachReply && !coachLoading && (
                <div
                  aria-live="polite"
                  style={{
                    marginTop: "14px",
                    padding: "15px",
                    borderRadius: "12px",
                    border: "1px solid rgba(143,153,255,0.18)",
                    background: "rgba(7,10,20,0.62)",
                    color: "rgba(245,246,255,0.88)",
                    fontSize: "13px",
                    lineHeight: 1.75,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "6px", color: "#aeb7ff", fontSize: "10px", letterSpacing: "1.2px" }}>
                    {({ hint: "YOUR HINT", explain: "CONCEPT EXPLAINED", structure: "ANSWER STRUCTURE", improve: "ANSWER FEEDBACK" })[coachAction] || "AI COACH RESPONSE"}
                  </strong>
                  {coachReply}
                </div>
              )}
            </section>

            <div className="answer-area">
              <div className="answer-label">
                <span>Your response</span>
                <span>Be clear and concise</span>
              </div>

              <textarea
                value={answer}
                onChange={(e) =>
                  handleAnswerChange(e.target.value)
                }
                placeholder="Type your answer or use Speak answer above..."
              />

              <div
                className="answer-actions"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span>{answer.length} characters</span>
                  <button
                    type="button"
                    onClick={goToPreviousQuestion}
                    disabled={currentQuestion === 0}
                    style={{
                      padding: "9px 13px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: currentQuestion === 0
                        ? "rgba(255,255,255,0.025)"
                        : "rgba(255,255,255,0.06)",
                      color: currentQuestion === 0
                        ? "rgba(255,255,255,0.28)"
                        : "rgba(255,255,255,0.8)",
                      cursor: currentQuestion === 0 ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                  >
                    ← Previous Question
                  </button>
                </div>

                <button
                  className="primary-button"
                  onClick={submitAnswer}
                  disabled={!answer.trim()}
                >
                  {currentQuestion ===
                  questionList.length - 1
                    ? "Finish Interview"
                    : "Save & Next →"}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // =========================================================
  // MAIN INTERVIEW DASHBOARD
  // =========================================================

  return (
    <div className="app-shell">
      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <header className="topbar landing-topbar">
        <button
          type="button"
          onClick={backToEntrance}
          aria-label="Back to welcome screen"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 11px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.035)",
            color: "rgba(255,255,255,0.76)",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "700",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "17px", lineHeight: 1 }}>←</span>
          Back
        </button>

        <div className="brand">
          <span className="brand-mark">IA</span>
          <span>InterviewAI</span>
        </div>

        <nav className="main-nav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#setup">Practice</a>
          <button
            type="button"
            className="analytics-nav-button"
            onClick={scrollToAnalytics}
          >
            Progress & Analytics
          </button>
        </nav>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => setShowProfile((previous) => !previous)}
            aria-label="Open candidate profile"
            aria-expanded={showProfile}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "6px 9px",
              borderRadius: "12px",
              border: showProfile
                ? "1px solid rgba(156,167,255,0.28)"
                : "1px solid transparent",
              background: showProfile
                ? "rgba(156,167,255,0.07)"
                : "transparent",
              color: "rgba(255,255,255,0.78)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ffffff, #aeb7ff)",
                color: "#080a10",
                display: "grid",
                placeItems: "center",
                fontSize: "10px",
                fontWeight: "800",
              }}
            >
              {candidate?.fullName
                ?.split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>

            <span style={{ fontSize: "12px", fontWeight: "600" }}>
              {candidate?.fullName}
            </span>

            <span
              style={{
                fontSize: "10px",
                opacity: 0.65,
                transform: showProfile ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 180ms ease",
              }}
            >
              ▾
            </span>
          </button>

          {showProfile && (
            <div
              style={{
                position: "absolute",
                top: "50px",
                right: "0",
                width: "300px",
                padding: "18px",
                borderRadius: "18px",
                background: "rgba(12,14,22,0.98)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.42)",
                backdropFilter: "blur(20px)",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  paddingBottom: "15px",
                  marginBottom: "14px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg, #ffffff, #aeb7ff)",
                    color: "#080a10",
                    fontWeight: "900",
                  }}
                >
                  {candidate?.fullName
                    ?.split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      display: "block",
                      color: "#ffffff",
                      fontSize: "15px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {candidate?.fullName}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: "3px",
                      color: "rgba(255,255,255,0.45)",
                      fontSize: "11px",
                    }}
                  >
                    {candidate?.candidateId}
                  </span>
                </div>
              </div>

              {[
                ["Email", candidate?.email],
                ["Mobile", candidate?.mobile],
                ["College", candidate?.college],
                ["Department", candidate?.department],
                ["Graduation", candidate?.graduationYear],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "82px 1fr",
                    gap: "10px",
                    padding: "8px 0",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.38)" }}>
                    {label}
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.78)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {value || "—"}
                  </span>
                </div>
              ))}

              <button
                type="button"
                className="nav-button"
                onClick={() => {
                  setShowProfile(false);
                  handleLogout();
                }}
                style={{
                  width: "100%",
                  marginTop: "12px",
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="landing-page">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-badge">
              <span className="pulse-dot"></span>
              AI-POWERED INTERVIEW PRACTICE
            </div>

            <h1>
              Practice interviews.
              <br />
              <span>Build confidence.</span>
            </h1>

            <p className="hero-description">
              Welcome back, {candidate?.fullName}.
              InterviewAI simulates role-focused interviews,
              evaluates your responses, tracks your progress,
              and helps you understand exactly where to improve.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button hero-button"
                onClick={scrollToSetup}
              >
                Start Practicing
                <span>→</span>
              </button>

              <button
                className="text-button"
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                Explore the platform
              </button>
            </div>

            <div className="hero-trust">
              <div>
                <strong>Role-focused</strong>
                <span>
                  Practice around your target career path
                </span>
              </div>

              <div>
                <strong>Interview-style</strong>
                <span>
                  MNC and government preparation tracks
                </span>
              </div>

              <div>
                <strong>Progress-driven</strong>
                <span>
                  Build a history of measurable improvement
                </span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-orbit orbit-one"></div>
            <div className="visual-orbit orbit-two"></div>

            <div className="dashboard-preview">
              <div className="preview-header">
                <div>
                  <span className="preview-kicker">
                    CANDIDATE PROFILE
                  </span>

                  <strong>{candidate?.candidateId}</strong>
                </div>

                <span className="preview-live">
                  PROFILE ACTIVE
                </span>
              </div>

              <div className="preview-candidate">
                <div className="preview-candidate-copy">
                  <span>Candidate</span>

                  <strong>
                    {candidate?.fullName}
                  </strong>

                  <small>
                    {candidate?.email}
                  </small>
                </div>

                <div className="preview-ai-badge">
                  <span>AI</span>
                  <small>Practice mode</small>
                </div>
              </div>

              <div className="preview-stats">
                <div>
                  <span>Role</span>
                  <strong>{role}</strong>
                </div>

                <div>
                  <span>Track</span>
                  <strong>MNC</strong>
                </div>

                <div>
                  <span>Questions</span>
                  <strong>{questionCount}</strong>
                </div>
              </div>

              <button
                type="button"
                className="preview-report preview-report-button"
                onClick={() => {
                  setReportMessage("");
                  const history = Array.isArray(candidate?.interviews)
                    ? candidate.interviews
                    : [];
                  const latestEvaluatedInterview = [...history]
                    .reverse()
                    .find((item) => hasEvaluatedResults(item));
                  downloadReport(
                    hasEvaluatedResults(evaluation)
                      ? evaluation
                      : latestEvaluatedInterview
                  );
                }}
              >
                <div className="report-icon">
                  ✓
                </div>

                <div className="preview-report-copy">
                  <strong>Interview report</strong>
                  <span>
                    Click to download your overall report card
                  </span>
                </div>

                <span className="report-arrow">
                  ↓
                </span>
              </button>

              {reportMessage && (
                <div className="preview-report-message">
                  {reportMessage}
                </div>
              )}
            </div>

            <div className="hero-insight-grid">
              <button
                type="button"
                className="hero-insight-card hero-insight-button"
                onClick={openEvaluationPreview}
              >
                <span className="hero-insight-icon">AI</span>
                <div>
                  <span className="hero-insight-kicker">EVALUATION</span>
                  <strong>AI Evaluation</strong>
                  <small>View your latest evaluation</small>
                </div>
                <span className="hero-insight-arrow">→</span>
              </button>

              <button
                type="button"
                className="hero-insight-card hero-insight-button"
                onClick={scrollToAnalytics}
              >
                <span className="hero-insight-icon">↗</span>
                <div>
                  <span className="hero-insight-kicker">
                    PERFORMANCE CENTER
                  </span>
                  <strong>Progress & Analytics</strong>
                  <small>Track scores, trends, and focus areas</small>
                </div>
              </button>
            </div>
          </div>
        </section>

        <section
          className="feature-strip"
          id="features"
        >
          <div className="section-intro">
            <span className="eyebrow">
              ONE PLATFORM
            </span>

            <h2>
              Everything you need to prepare better.
            </h2>
          </div>

          <div className="feature-grid">
            <article className="feature-panel">
              <span className="feature-number">
                01
              </span>

              <h3>Career-focused practice</h3>

              <p>
                Prepare using MNC-style and government
                interview tracks based on your target
                career path.
              </p>
            </article>

            <article className="feature-panel">
              <span className="feature-number">
                02
              </span>

              <h3>AI-powered evaluation</h3>

              <p>
                Analyze technical accuracy,
                completeness, missing concepts,
                and answer quality.
              </p>
            </article>

            <article className="feature-panel">
              <span className="feature-number">
                03
              </span>

              <h3>Progress that stays with you</h3>

              <p>
                Save interview reports and visualize
                your improvement across multiple sessions.
              </p>
            </article>
          </div>
        </section>

        <section
          className="how-section"
          id="how-it-works"
        >
          <div className="how-copy">
            <span className="eyebrow">
              HOW IT WORKS
            </span>

            <h2>
              From practice to measurable progress.
            </h2>

            <p>
              Every interview becomes part of your personal
              preparation history.
            </p>
          </div>

          <div className="steps">
            <div className="step">
              <span>01</span>

              <div>
                <strong>
                  Choose your interview track
                </strong>

                <p>
                  Select MNC or government preparation.
                </p>
              </div>
            </div>

            <div className="step">
              <span>02</span>

              <div>
                <strong>
                  Practice realistic questions
                </strong>

                <p>
                  Answer questions based on your selected
                  role and preparation style.
                </p>
              </div>
            </div>

            <div className="step">
              <span>03</span>

              <div>
                <strong>
                  Understand your performance
                </strong>

                <p>
                  Review scores, reports, and personalized
                  improvement suggestions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {showEvaluationPreview && (() => {
          const history = Array.isArray(candidate?.interviews)
            ? candidate.interviews
            : [];
          const latest = [...history]
            .reverse()
            .find((item) => hasEvaluatedResults(item)) ||
            (hasEvaluatedResults(evaluation) ? normalizeReportData(evaluation) : null);

          if (!latest) {
            return null;
          }

          return (
            <div
              className="modal-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setShowEvaluationPreview(false);
                }
              }}
            >
              <section
                className="evaluation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="evaluation-modal-title"
              >
                <div className="evaluation-modal-header">
                  <div>
                    <span className="eyebrow">LATEST EVALUATION</span>
                    <h2 id="evaluation-modal-title">AI Evaluation</h2>
                    <p>Review the result from your most recently completed interview.</p>
                  </div>
                  <button
                    type="button"
                    className="modal-close-button"
                    onClick={() => setShowEvaluationPreview(false)}
                    aria-label="Close evaluation preview"
                  >
                    ×
                  </button>
                </div>

                <div className="evaluation-preview-score-row">
                  <div className="evaluation-preview-score">
                    <span>OVERALL SCORE</span>
                    <strong>{latest.score}<small>/100</small></strong>
                  </div>
                  <div className="evaluation-preview-level">
                    <span>PERFORMANCE</span>
                    <strong>{latest.performanceLevel || "—"}</strong>
                  </div>
                  <div className="evaluation-preview-level">
                    <span>INTERVIEW</span>
                    <strong>{latest.organization || "—"}</strong>
                  </div>
                </div>

                <div className="evaluation-preview-grid">
                  <div className="evaluation-preview-panel">
                    <span className="eyebrow">SESSION DETAILS</span>
                    <dl className="evaluation-preview-details">
                      <div><dt>Role</dt><dd>{latest.role || "—"}</dd></div>
                      <div><dt>Track</dt><dd>{latest.track || "—"}</dd></div>
                      <div><dt>Difficulty</dt><dd>{latest.difficulty || "—"}</dd></div>
                      <div><dt>Questions</dt><dd>{latest.questionCount || latest.questionsEvaluated || "—"}</dd></div>
                      <div><dt>Total</dt><dd>{latest.totalScore ?? "—"}/{latest.maximumScore ?? "—"}</dd></div>
                    </dl>
                  </div>

                  <div className="evaluation-preview-panel">
                    <span className="eyebrow">FOCUS AREAS</span>
                    {latest.improvementTopics?.length ? (
                      <div className="concept-list evaluation-preview-topics">
                        {latest.improvementTopics.slice(0, 8).map((topic) => (
                          <span className="concept-pill" key={topic}>{topic}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="evaluation-preview-empty">No priority topics recorded for this session.</p>
                    )}
                  </div>
                </div>

                <div className="evaluation-modal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      setShowEvaluationPreview(false);
                      setReportMessage("");
                      downloadReport(latest);
                    }}
                  >
                    Download Overall Report
                    <span>↓</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowEvaluationPreview(false);
                      scrollToAnalytics();
                    }}
                  >
                    View Progress Analytics
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

        <section
          className="analytics-section"
          id="analytics"
        >
          <div className="analytics-section-header">
            <div>
              <span className="eyebrow">
                PROGRESS & ANALYTICS
              </span>
              <h2>
                Turn every interview into measurable progress.
              </h2>
              <p>
                Track your score over time and see exactly how each interview performed.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button analytics-open-button"
              onClick={() => setShowAnalytics((previous) => !previous)}
            >
              {showAnalytics
                ? "Hide Analytics"
                : "View Analytics"}
            </button>
          </div>

          {(() => {
            const interviewHistory = Array.isArray(
              candidate?.interviews
            )
              ? candidate.interviews
              : [];

            const totalInterviews = interviewHistory.length;
            const scores = interviewHistory.map((item) => Number(item.score || 0));
            const averageScore = totalInterviews
              ? Math.round(
                  scores.reduce((sum, value) => sum + value, 0) /
                    totalInterviews
                )
              : 0;
            const bestScore = totalInterviews
              ? Math.max(...scores)
              : 0;
            const latestInterview = totalInterviews
              ? interviewHistory[interviewHistory.length - 1]
              : null;

            const trendItems = interviewHistory.slice(-8);
            const chartWidth = 860;
            const chartHeight = 310;
            const chartPadLeft = 48;
            const chartPadRight = 28;
            const chartPadTop = 26;
            const chartPadBottom = 46;
            const plotWidth =
              chartWidth - chartPadLeft - chartPadRight;
            const plotHeight =
              chartHeight - chartPadTop - chartPadBottom;

            const trendPoints = trendItems.map((item, index) => ({
              x:
                trendItems.length === 1
                  ? chartPadLeft + plotWidth / 2
                  : chartPadLeft +
                    (index / (trendItems.length - 1)) * plotWidth,
              y:
                chartPadTop +
                ((100 - Number(item.score || 0)) / 100) * plotHeight,
              score: Number(item.score || 0),
              label: `#${interviewHistory.indexOf(item) + 1}`,
            }));

            const trendPath = trendPoints
              .map((point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
              )
              .join(" ");

            const questionItems = latestInterview?.results || [];
            const barMax = 20;

            return (
              <>
                <div className="analytics-summary-grid">
                  <div className="analytics-summary-card">
                    <span>TOTAL INTERVIEWS</span>
                    <strong>{totalInterviews}</strong>
                    <small>Completed sessions</small>
                  </div>

                  <div className="analytics-summary-card">
                    <span>AVERAGE SCORE</span>
                    <strong>{averageScore}/100</strong>
                    <small>Across completed interviews</small>
                  </div>

                  <div className="analytics-summary-card">
                    <span>BEST SCORE</span>
                    <strong>{bestScore}/100</strong>
                    <small>Highest recorded performance</small>
                  </div>

                  <div className="analytics-summary-card">
                    <span>LATEST SCORE</span>
                    <strong>
                      {latestInterview
                        ? `${latestInterview.score}/100`
                        : "—"}
                    </strong>
                    <small>
                      {latestInterview?.performanceLevel ||
                        "No interview completed yet"}
                    </small>
                  </div>
                </div>

                {showAnalytics && (
                  <div className="analytics-detail-grid">
                    <article className="analytics-chart-card analytics-chart-wide">
                      <div className="analytics-card-heading">
                        <div>
                          <span className="eyebrow">SCORE TREND</span>
                          <h3>Interview performance over time</h3>
                        </div>
                        <span className="analytics-chart-meta">
                          Last {trendItems.length || 0} sessions
                        </span>
                      </div>

                      {trendItems.length === 0 ? (
                        <div className="analytics-empty-state">
                          <strong>No interview history yet</strong>
                          <span>
                            Complete an interview to start building your progress graph.
                          </span>
                        </div>
                      ) : (
                        <div className="chart-scroll-area">
                          <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="score-trend-chart"
                            role="img"
                            aria-label="Interview score trend chart"
                          >
                            {[0, 25, 50, 75, 100].map((tick) => {
                              const y =
                                chartPadTop +
                                ((100 - tick) / 100) * plotHeight;

                              return (
                                <g key={tick}>
                                  <line
                                    x1={chartPadLeft}
                                    x2={chartWidth - chartPadRight}
                                    y1={y}
                                    y2={y}
                                    className="chart-grid-line"
                                  />
                                  <text
                                    x={chartPadLeft - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    className="chart-axis-label"
                                  >
                                    {tick}
                                  </text>
                                </g>
                              );
                            })}

                            <line
                              x1={chartPadLeft}
                              x2={chartWidth - chartPadRight}
                              y1={chartPadTop + plotHeight}
                              y2={chartPadTop + plotHeight}
                              className="chart-axis-line"
                            />

                            <path
                              d={trendPath}
                              className="chart-trend-line"
                            />

                            {trendPoints.map((point, index) => (
                              <g key={`${point.label}-${index}`}>
                                <circle
                                  cx={point.x}
                                  cy={point.y}
                                  r="5"
                                  className="chart-trend-point"
                                />
                                <text
                                  x={point.x}
                                  y={chartHeight - 17}
                                  textAnchor="middle"
                                  className="chart-x-label"
                                >
                                  {point.label}
                                </text>
                                <text
                                  x={point.x}
                                  y={point.y - 11}
                                  textAnchor="middle"
                                  className="chart-score-label"
                                >
                                  {point.score}
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                      )}
                    </article>

                    <article className="analytics-chart-card">
                      <div className="analytics-card-heading">
                        <div>
                          <span className="eyebrow">LATEST SESSION</span>
                          <h3>Question performance</h3>
                        </div>
                        <span className="analytics-chart-meta">
                          Score / 20
                        </span>
                      </div>

                      {questionItems.length === 0 ? (
                        <div className="analytics-empty-state">
                          <strong>No question data yet</strong>
                          <span>
                            Complete an interview to see per-question scores.
                          </span>
                        </div>
                      ) : (
                        <div className="bar-chart">
                          {questionItems.map((item, index) => {
                            const score = Number(item.score || 0);
                            const height = Math.max(
                              6,
                              (score / barMax) * 190
                            );

                            return (
                              <div
                                className="bar-column"
                                key={`${item.question_id}-${index}`}
                                title={`Question ${index + 1}: ${score}/${barMax}`}
                              >
                                <span
                                  className="bar-value"
                                >
                                  {score}
                                </span>
                                <div
                                  className="bar-fill"
                                  style={{ height: `${height}px` }}
                                ></div>
                                <span className="bar-label">
                                  Q{index + 1}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>

                    <article className="analytics-chart-card">
                      <div className="analytics-card-heading">
                        <div>
                          <span className="eyebrow">FOCUS AREAS</span>
                          <h3>Topics that need attention</h3>
                        </div>
                      </div>

                      {latestInterview?.improvementTopics?.length ? (
                        <div className="analytics-topic-list">
                          {latestInterview.improvementTopics
                            .slice(0, 10)
                            .map((topic) => (
                              <span
                                className="analytics-topic-pill"
                                key={topic}
                              >
                                {topic}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <div className="analytics-empty-state compact">
                          <strong>No priority topics</strong>
                          <span>
                            Your latest session did not record any major improvement topics.
                          </span>
                        </div>
                      )}
                    </article>
                  </div>
                )}
              </>
            );
          })()}
        </section>

        <section
          className="setup-section"
          id="setup"
        >
          <div className="setup-heading">
            <span className="eyebrow">
              START A SESSION
            </span>

            <h2>
              Build your interview.
            </h2>

            <p>
              Select the preparation path that matches
              your target career.
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: "25px",
                padding: "15px 18px",
                borderRadius: "12px",
                border:
                  "1px solid rgba(255,120,120,0.2)",
                background:
                  "rgba(255,90,90,0.07)",
                color: "#ffb4b4",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div className="setup-card interview-setup-grid">
            <div className="setup-field">
              <label>Interview Track</label>

              <select
                value={track}
                onChange={(e) =>
                  handleTrackChange(e.target.value)
                }
              >
                <option>MNC Interviews</option>
                <option>Government Interviews</option>
              </select>
            </div>

            <div className="setup-field">
              <label>
                Organization / Exam Style
              </label>

              <select
                value={organization}
                onChange={(e) =>
                  setOrganization(e.target.value)
                }
              >
                {(track === "MNC Interviews"
                  ? mncOptions
                  : governmentOptions
                ).map((item) => (
                  <option key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="setup-field">
              <label>Target Role</label>

              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value)
                }
              >
                <option>Java Developer</option>
                <option>Python Developer</option>
                <option>AI/ML Engineer</option>
                <option>Data Analyst</option>
                <option>Software Developer</option>
              </select>
            </div>

            <div className="setup-field">
              <label>Difficulty</label>

              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value)
                }
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>

            <div className="setup-field">
              <label>Number of Questions</label>

              <select
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(e.target.value)
                }
              >
                <option>5</option>
                <option>10</option>
                <option>15</option>
                <option>20</option>
                <option>25</option>
                <option>30</option>
                <option>40</option>
                <option>50</option>
              </select>
            </div>

            <button
              className="primary-button setup-button"
              onClick={startInterview}
              disabled={loading}
            >
              {loading
                ? "Preparing Interview..."
                : "Start Interview"}

              {!loading && <span>→</span>}
            </button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>InterviewAI</span>

        <span>
          AI-powered interview preparation platform
        </span>
      </footer>
    </div>
  );
}

export default App;