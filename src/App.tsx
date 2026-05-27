import { useState, useRef } from "react";
import OpenAI from "openai";
import "./App.css";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const images = [
  { src: "/images/walk.png", description: "수업시간에 교실을 돌아다니는 한그리" },
  { src: "/images/talk.png", description: "수업시간에 옆 친구와 떠드는 한그리" },
  { src: "/images/hallway.png", description: "학교 복도에서 뛰는 한그리" },
  { src: "/images/skip.png", description: "급식실에서 새치기하는 한그리" },
  { src: "/images/stairs.png", description: "계단에서 위험하게 뛰는 한그리" },
];

export default function App() {
  const [currentImage, setCurrentImage] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
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
1. 그림 속 상황을 올바르게 설명했으면 "잘했어요! 🎉" 라고 칭찬해줘.
2. 틀리거나 부족하면 왜 그런지 설명하고 바른 문장을 알려줘.
3. 항상 "~이기 때문이야", "~하면 안 돼", "~해야 해" 문형을 자연스럽게 사용해줘.
4. 짧고 친절하게 말해줘. 초등학생 수준으로!`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    setFeedback(response.choices[0].message.content || "");
    setIsLoading(false);
  };

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
    setTranscript("");
    setFeedback("");
  };

  return (
    <div className="container">
      <h1>🐾 한그리가 뭘 잘못했을까요?</h1>
      <p className="subtitle">그림을 보고 한그리가 잘못한 것을 말해보세요!</p>

      <div className="image-box">
        <img src={images[currentImage].src} alt="한그리 그림" />
      </div>

      <div className="progress">
        {images.map((_, i) => (
          <span key={i} className={i === currentImage ? "dot active" : "dot"} />
        ))}
      </div>

      <button
        className={`mic-button ${isListening ? "listening" : ""}`}
        onClick={startListening}
        disabled={isListening || isLoading}
      >
        {isListening ? "🎤 듣는 중..." : "🎤 말하기"}
      </button>

      {transcript && (
        <div className="transcript">
          <strong>내가 말한 것:</strong> {transcript}
        </div>
      )}

      {isLoading && (
        <div className="loading">선생님이 생각하는 중... 🤔</div>
      )}

      {feedback && (
        <div className="feedback">
          <strong>🐾 한그리 선생님:</strong>
          <p>{feedback}</p>
        </div>
      )}

      <button className="next-button" onClick={nextImage}>
        다음 그림 →
      </button>
    </div>
  );
}