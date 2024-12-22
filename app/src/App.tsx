import React, { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import "./App.css";
import { NOTIMP } from "dns";


const network = clusterApiUrl("devnet");
const connection = new Connection(network, "confirmed");

interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface APIResponse {
    message: string;
    message_at: string;
    is_user: string,
}

interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

const App: React.FC = () => {
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [transcript, setTranscript] = useState<string>("");
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const [isListening, setIsListening] = useState<boolean>(false); 
    const [response, setResponse] = useState<APIResponse | null>(null);
    const [emotion, setEmotion] = useState<string>("");
    const url = "https://api.assisterr.ai/api/v1/slm/TheraSol/chat/";
    const apiKey = "https://api.assisterr.ai/oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";
    const emotionURL = "https://api.assisterr.ai/api/v1/slm/motionundle/chat/";
    const emotionAPIKey = "https://api.assisterr.ai/oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";

    useEffect(() => {
        if (publicKey) {
            const fetchBalance = async () => {
                const lamports = await connection.getBalance(publicKey);
                setBalance(lamports / 1e9);
            };
            fetchBalance();
        }
    }, [publicKey]);

    useEffect(() => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error("Web Speech API is not supported in this browser.");
            return;
        }

        const recognition: SpeechRecognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const spokenText = event.results[0][0].transcript;
            setTranscript(spokenText);
        };

        recognition.onend = () => {
            if (transcript) {
                setConversationHistory((prevHistory) => [...prevHistory, transcript]); 
                setTranscript(""); 
            }
            console.log("Speech recognition ended.");
            setIsListening(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error:", event.error);
        };

        if (isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }

        return () => {
            recognition.abort();
        };
    }, [isListening, transcript]);

    useEffect(() => {
        if (response?.message) {
            const speech = new SpeechSynthesisUtterance(response.message);
            speech.lang = "en-GB";

            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find((voice) =>
                voice.name.includes("Daniel")
            );
            if (selectedVoice) speech.voice = selectedVoice;

            window.speechSynthesis.speak(speech);
        }
    }, [response]);

    useEffect(() => {
        const sendRequest = async () => {
            if (transcript) {
                try {
                    const conversationContext =
                        "Conversation until now: " +
                        conversationHistory.join(" ") +
                        ". If a previous conversation exists, answer the question based on the knowledge of the previous answers: " +
                        transcript;
    
                    console.log("Conversation Context:", conversationContext);
    
                    // Send main API request for response
                    const response = await fetch(url, {
                        method: "POST",
                        headers: {
                            "X-Api-Key": apiKey,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ query: conversationContext }),
                    });
    
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
    
                    const responseData = await response.json();
                    setResponse(responseData);
                    setConversationHistory((prevHistory) => [...prevHistory, responseData.message]);
    
                    // emotion Detection 
                    const emotionResponse = await fetch(emotionURL, {
                        method: "POST",
                        headers: {
                            "X-Api-Key": emotionAPIKey,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ query: transcript }),
                    });
    
                    if (!emotionResponse.ok) {
                        throw new Error(`HTTP error! Status: ${emotionResponse.status}`);
                    }
    
                    const emotionData = await emotionResponse.json();
                    setEmotion(emotionData.message);
                    console.log(emotionData.message);
    
                } catch (error) {
                    console.error("Error in sendRequest:", error);
                }
            }
        };
    
        sendRequest();
    }, [transcript]);
    const toggleListening = () => {
        setIsListening(!isListening);
    };


    return (
        <div>
            <div className="wallet-connect-card">
                <h1>Welcome to THERASOL</h1>
                <h2>Please connect to a wallet</h2>
                <div className="wallet-button">
                    <WalletMultiButton />
                </div>
                {publicKey && <p>Connected Wallet: {publicKey.toBase58()}</p>}
                <p>{balance !== null ? `Balance: ${balance} SOL` : ""}</p>
            </div>
            {publicKey ? (
                <>
                    <h1>Speech to Text Demo</h1>
                    <button onClick={toggleListening}>
                        {isListening ? "Stop Listening" : "Start Listening"}
                    </button>
                    <p id="output">You said: {transcript}</p>
                    <p className="response">Response: {response?.message}</p>

                    <ul>
                        {conversationHistory.map((entry, index) => (
                            <li key={index}>
                                {index % 2 === 0 ? "User: " : "TheraSol: "} {entry}
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p></p>
            )}
        </div>
    );
};

export default App;