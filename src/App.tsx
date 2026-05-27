import { useState, useRef, useEffect, useCallback } from "react";
import OpenAI from "openai";
import "./App.css";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const images = [
  {
    src: "/images/walk.png",
    description: "수업시간에 교실을 돌아다니는 한그리",
    hints: ["교실 안을 잘 살펴봐! 👀", "한그리가 자리에 앉아있지 않아! 🪑"],
  },
  {
    src: "/images/talk.png",
    description: "수업시간에 옆 친구와 떠드는 한그리",
    hints: ["한그리 옆에 친구가 있어! 👀", "한그리가 입을 벌리고 있어! 🗣️"],
  },
  {
    src: "/images/hallway.png",
    description: "학교 복도에서 뛰는 한그리",
    hints: ["여기는 교실 밖이야! 👀", "한그리의 다리를 봐! 🏃"],
  },
  {
    src: "/images/skip.png",
    description: "급식실에서 새치기하는 한그리",
    hints: ["급식실에서 줄을 서고 있어! 👀", "한그리가 줄 앞으로 가고 있어! 😮"],
  },
  {
    src: "/images/stairs.png",
    description: "계단에서 위험하게 뛰는 한그리",
    hints: ["계단이 보여! 👀", "한그리가 천천히 걷지 않아! 🏃"],
  },
];

export default function App() {
  const [currentImage, setCurrentImage] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>(
    new Array(images.length).fill(false)
  );
  const [showHint, setShowHint] = useState("");
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  const recognitionRef = useRef<any>(null);
  const hintIndexRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show next available hint
  const showNextHint = useCallback(() => {
    const hints = images[currentImage].hints;
    const idx = hintIndexRef.current;
    if (idx < hints.length) {
      setShowHint(hints[idx]);
      hintIndexRef.current = idx + 1;
    }
  }, [currentImage]);

  // Auto-show hint after 3 seconds of inactivity
  useEffect(() => {
    // Reset hint state when image changes
    hintIndexRef.current = 0;
    setShowHint("");

    // Start 3-second timer
    hintTimerRef.current = setTimeout(() => {
      showNextHint();
    }, 3000);

    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, [currentImage, showNextHint]);

  const startListening = () => {
    // Cancel auto-hint timer when user starts speaking
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("이 브라우저는 음성인식을 지원하지 않아요!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      await checkAnswer(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const checkAnswer = async (text: string) => {
    setIsLoading(true);
    setFeedback("");
    setIsCorrectAnswer(null);

    const imageDesc = images[currentImage].description;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `너는 초등학생을 가르치는 친절한 한국어 선생님이야.
지금 학생이 그림을 보고 한그리가 무엇을 잘못하고 있는지 말했어.
그림 설명: "${imageDesc}"

학생이 말한 내용을 평가해줘:
1. 그림 속 상황을 올바르게 설명했으면 맨 첫줄에 "정답" 이라고만 쓰고, 틀렸으면 "오답" 이라고만 써줘.
2. 그 다음 줄부터 피드백을 줘:
   - 맞았으면 "잘했어요! 🎉" 라고 칭찬해줘.
   - 틀리거나 부족하면 왜 그런지 설명하고 바른 문장을 알려줘.
3. 항상 "~이기 때문이야", "~하면 안 돼", "~해야 해" 문형을 자연스럽게 사용해줘.
4. 잘못한 것을 지적한 다음, 올바른 규칙도 꼭 알려줘. 예: "수업시간에는 자리에 앉아 있어야 해!"
5. 짧고 친절하게 말해줘. 초등학생 수준으로!`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const result = response.choices[0].message.content || "";

    // Check if the answer is correct by looking at the first line
    const isCorrect = result.trimStart().startsWith("정답");
    const feedbackText = result.replace(/^(정답|오답)\s*\n?/, "").trim();

    if (isCorrect && !answered[currentImage]) {
      setScore((prev) => prev + 1);
      const newAnswered = [...answered];
      newAnswered[currentImage] = true;
      setAnswered(newAnswered);
    }

    // If wrong, show next hint automatically
    if (!isCorrect) {
      showNextHint();
    }

    setIsCorrectAnswer(isCorrect);
    setFeedback(feedbackText);
    setIsLoading(false);
  };

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
    setTranscript("");
    setFeedback("");
    setShowHint("");
    setIsCorrectAnswer(null);
  };

  const allCompleted = score === images.length;

  return (
    <div className="container">
      {/* Score display */}
      <div className="score-bar">
        <div className="score-stars">
          {images.map((_, i) => (
            <span key={i} className={`star ${answered[i] ? "earned" : ""}`}>
              {answered[i] ? "⭐" : "☆"}
            </span>
          ))}
        </div>
        <div className="score-text">
          {score} / {images.length} 점
        </div>
      </div>

      <h1>🐾 한그리가 뭘 잘못했을까요?</h1>
      <p className="subtitle">그림을 보고 한그리가 잘못한 것을 말해보세요!</p>

      <div className="image-box">
        <img src={images[currentImage].src} alt="한그리 그림" />
        {answered[currentImage] && (
          <div className="image-badge">✅ 완료!</div>
        )}
      </div>

      <div className="progress">
        {images.map((_, i) => (
          <span
            key={i}
            className={`dot ${i === currentImage ? "active" : ""} ${answered[i] ? "completed" : ""}`}
          />
        ))}
      </div>

      {/* Hint area - auto shown */}
      {showHint && (
        <div className="hint-box">
          💡 <strong>힌트:</strong> {showHint}
        </div>
      )}

      <div className="button-group">
        <button
          className={`mic-button ${isListening ? "listening" : ""}`}
          onClick={startListening}
          disabled={isListening || isLoading}
        >
          {isListening ? "🎤 듣는 중..." : "🎤 말하기"}
        </button>
      </div>

      {transcript && (
        <div className="transcript">
          <strong>내가 말한 것:</strong> {transcript}
        </div>
      )}

      {isLoading && (
        <div className="loading">선생님이 생각하는 중... 🤔</div>
      )}

      {feedback && (
        <div className={`feedback ${isCorrectAnswer ? "correct" : "incorrect"}`}>
          <strong>🐾 한그리 선생님:</strong>
          <p>{feedback}</p>
        </div>
      )}

      <button className="next-button" onClick={nextImage}>
        다음 그림 →
      </button>

      {/* Completion celebration */}
      {allCompleted && (
        <div className="completion">
          <span className="completion-emoji">🎊</span>
          <p>축하해요! 모든 문제를 맞혔어요!</p>
          <span className="completion-emoji">🎊</span>
        </div>
      )}
    </div>
  );
}