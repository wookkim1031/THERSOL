import React, { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Connection, clusterApiUrl, Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
import "./App.css";
import "@solana/wallet-adapter-react-ui/styles.css";

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

interface Emotions {
    Joy: number;
    Sadness: number;
    Anger: number;
    Fear: number;
    Disgust: number;
}

const App: React.FC = () => {
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState<number | null>(null);
    const [transcript, setTranscript] = useState<string>("");
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [response, setResponse] = useState<APIResponse | null>(null);
    const [finalResponse, setFinalResponse] = useState<APIResponse | null>(null);
    const [emotion, setEmotion] = useState<[string, number][] | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [walletNetwork, setWalletNetwork] = useState<string>("");
    const [networkMismatch, setNetworkMismatch] = useState(false);
    const url = "https://api.assisterr.ai/api/v1/slm/TheraSol/chat/";
    const apiKey = "oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";
    const emotionURL = "https://api.assisterr.ai/api/v1/slm/motionundle/chat/";
    const emotionAPIKey = "oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";
    const myPublicKey = new PublicKey("A6aGukho6tY2abd8h7pcsLsQRgncu9WBjy3mYSjqUTAJ");
    const paymentAmount = 0.001 * Math.pow(10, 9);

    useEffect(() => {
        console.log('Current network:', network);
    }, []);

    useEffect(() => {
        if (publicKey) {
            console.log('Wallet network:', connection.rpcEndpoint);
            console.log('App network:', network);

            // Detect wallet network
            const endpoint = connection.rpcEndpoint.toLowerCase();
            let detectedNetwork = '';
            if (endpoint.includes('devnet')) {
                detectedNetwork = 'Devnet';
            } else if (endpoint.includes('mainnet')) {
                detectedNetwork = 'Mainnet';
            } else if (endpoint.includes('testnet')) {
                detectedNetwork = 'Testnet';
            } else {
                detectedNetwork = 'Custom: ' + endpoint;
            }
            setWalletNetwork(detectedNetwork);

            // Check for network mismatch
            const walletIsDevnet = endpoint.includes('devnet');
            const appIsDevnet = network.includes('devnet');

            setNetworkMismatch(walletIsDevnet !== appIsDevnet);
            if (walletIsDevnet !== appIsDevnet) {
                console.warn('Network mismatch detected! App is on devnet but wallet is on ' + detectedNetwork);
            }

            setIsConnecting(false);
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (publicKey) {
            const fetchBalance = async () => {
                const lamports = await connection.getBalance(publicKey);
                setBalance(lamports / 1e9);
            };
            fetchBalance();
        }
    }, [publicKey]);

    const Emotions = [
        { name: "Joy", value: 0 },
        { name: "Sadness", value: 0 },
        { name: "Anger", value: 0 },
        { name: "Fear", value: 0 },
        { name: "Disgust", value: 0 },
    ];

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

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'aborted') {
              console.warn('Speech recognition aborted.');
            } else {
              console.error('Unhandled error:', event.error);
            }
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
                    const response = await fetch("/api/v1/slm/TheraSol/chat/", {
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
                    const emotionResponse = await fetch("/api/v1/slm/motionundle/chat/", {
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
                    const rawPairs = emotionData.message.replace(/[{}]/g, "").split(",");

                    const parsedEmotion = rawPairs.map((pair:string) => {
                        const [key, value] = pair.split(":");
                        return [key.replace(/"/g, ""), parseFloat(value)] as [string, number];
                    });

                    setEmotion(parsedEmotion);
                    console.log(parsedEmotion);

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

    const pay = async () =>{
        if (!publicKey) {
            return false;
        }

        const lamportsNeeded = paymentAmount + 5000;
        const balance = await connection.getBalance(publicKey);

        if (balance < lamportsNeeded) {
            alert("Insufficient SOL balance. Please add funds to your wallet.");
            return false;
        }

        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: myPublicKey,
                    lamports: paymentAmount,
                })
            );
            const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, "confirmed");
            alert("Payment successful! You can now request a suggestion.");
            return true;
        } catch (error) {
            console.error("Payment failed:", error);
            if (error === "WalletSendTransactionError") {
                alert("Transaction failed. Please check your wallet and try again.");
            } else {
                alert("Unexpected error occurred. Please try again.");
            }
            return false;
        }
        }

    const giveSuggestion = async () => {
        const paymentSuccess = await pay(); // Ensure payment is successful
        if (!paymentSuccess) return;

        try {
            const emotionsString = Emotions.map((item) => `${item.name}: ${item.value}`).join(", ");
            const summary =
                "Give a summary and suggestion about person's situation and how the person feels using emotion"
                + conversationHistory
                + "Also rate the person's emotion based on the Emotion. The higher the score is the higher the emotion is"
                + emotionsString;
            const response = await fetch("/api/v1/slm/TheraSol/chat/", {
                method: "POST",
                headers: {
                    "X-Api-Key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: summary }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const responseData = await response.json();
            setFinalResponse(responseData);
            setConversationHistory((prevHistory) => [...prevHistory, responseData.message]);

        } catch (error) {
            console.error("Error in giveSuggestion:", error);
        }
    };


    return (
        <div id="root-container">
            <div className="header">
                <h1>Welcome to TheraSol</h1>
            </div>
            <p>Currently supported on Chrome</p>
            {!publicKey && <h2>Connect to a Wallet</h2>}
            <div className="wallet-connect-card">
                <div className={`wallet-button-wrapper ${
                        publicKey ? "connected" : isConnecting ? "" : "connecting"
                    }`}
                >
                    <WalletMultiButton
                        className={`wallet-button ${publicKey ? "connected" : ""}`}
                        onClick={() => {
                            if (!publicKey) setIsConnecting(true);
                        }}
                    />
                </div>
                {publicKey && <p>Connected Wallet: {publicKey.toBase58()}</p>}
                {publicKey && <p>{balance !== null ? `Balance: ${balance} SOL` : ""}</p>}
                <div className="network-info">
                    <p>App Network: {network.includes("devnet") ? "Devnet" :
                                   network.includes("mainnet") ? "Mainnet" :
                                   network}</p>
                    <p>Wallet Network: {walletNetwork || "Not Connected"}</p>
                </div>
                {networkMismatch && (
                    <div className="network-warning">
                        ⚠️ Warning: Please switch your wallet to {network.includes("devnet") ? "Devnet" : "Mainnet"} network
                    </div>
                )}
            </div>

            {publicKey && !networkMismatch && (
                <div className="main-content">
                    <h1>Speech to Text and Suggestions</h1>
                    {transcript ? (<button onClick={toggleListening} disabled={!publicKey}>
                        {isListening ? "Stop Talking" : "Start Talking"}
                                </button>
                    ): (<button onClick={toggleListening} disabled={!publicKey}>
                        {isListening ? "Stop Talking" : "Continue Talking"}
                    </button>)
                    }

                    {isListening && <div className="loading"></div>}

                    <p id="output">User: {transcript}</p>
                    <p className="response">{response?.message && `Response: ${response.message}`}</p>

                    <ul>
                        {conversationHistory.map((entry, index) => (
                            <li
                            key={index}
                            style={{
                                color: index % 2 === 0 ? "#007bff" : "#28a745",
                                fontWeight: index % 2 === 0 ? "bold" : "normal",
                            }}
                            >
                                {index % 2 === 0 ? "User: " : "TheraSol: "} {entry}
                            </li>
                        ))}
                    </ul>

                    {emotion && (
                        <div className="emotion-list">
                            {emotion.map(([key, value]) => (
                                <div key={key} className="emotion-item">
                                    <span className="emotion-key">{key}</span>: <span className="emotion-value">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {emotion && (
                        <button onClick={giveSuggestion} disabled={isListening}>
                            Finalize and Get Suggestion <br />
                            Costs: 0.001 SOL + Gas: 0.00003 SOL
                        </button>
                    )}
                    {finalResponse && <div className="loading"></div>}
                    {finalResponse && <div className="response">{finalResponse.message}</div>}
                </div>
            )}
        </div>
    );
};

export default App;