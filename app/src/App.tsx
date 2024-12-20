import React, { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

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

        // Handle errors
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error:", event.error);
        };

        if (isListening) {
            recognition.start();
        } else {
            recognition.stop();
        }

        return () => {
            recognition.abort(); // Cleanup on unmount
        };
    }, [isListening, transcript]);

    const toggleListening = () => {
        setIsListening(!isListening);
    };

    return (
        <div>
            <h1>Welcome to THERASOL</h1>
            <h2>Please connect to a wallet</h2>
            <WalletMultiButton />
            {publicKey && <p>Connected Wallet: {publicKey.toBase58()}</p>}
            <p>Balance: {balance !== null ? `${balance} SOL` : "Loading..."}</p>

            <h1>Speech to Text Demo</h1>
            <button onClick={toggleListening}>
                {isListening ? "Stop Listening" : "Start Listening"}
            </button>
            <p id="output">You said: {transcript}</p>
            {conversationHistory.map((entry, index) => (
                    <li key={index}>{entry}</li>
                ))}
        </div>
    );
};

export default App;
