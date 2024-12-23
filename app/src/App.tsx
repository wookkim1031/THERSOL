import React, { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet,  } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { connection, getUserPDA, program } from "./anchor/setup";
import "./App.css";
import "@solana/wallet-adapter-react-ui/styles.css";

// Type definitions
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

// User account type from the smart contract
type UserAccount = {
    owner: PublicKey;
    balance: anchor.BN;
    startTime: anchor.BN;
    endTime: anchor.BN;
    totalSessions: number;
    sessionHistory: Array<{
        startTime: anchor.BN;
        endTime: anchor.BN;
        cost: anchor.BN;
    }>;
};

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
    const [sessionStarted, setSessionStarted] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [theraSolBalance, setTheraSolBalance] = useState<number | null>(null);
    const [depositAmount, setDepositAmount] = useState<number>(0);
    const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
    const url = "https://api.assisterr.ai/api/v1/slm/TheraSol/chat/";
    const apiKey = "oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";
    const emotionURL = "https://api.assisterr.ai/api/v1/slm/motionundle/chat/";
    const emotionAPIKey = "oPnCa0g1e2xarySmIuMhy6TuSYBILf0nHzzbTp4-jYU";
    const myPublicKey = new PublicKey("A6aGukho6tY2abd8h7pcsLsQRgncu9WBjy3mYSjqUTAJ");
    const paymentAmount = 0.001 * Math.pow(10, 9);

    useEffect(() => {
        console.log('Current network:', connection.rpcEndpoint);
    }, []);

    useEffect(() => {
        if (publicKey) {
            console.log('Wallet network:', connection.rpcEndpoint);
            console.log('App network:', connection.rpcEndpoint);

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
            const appIsDevnet = connection.rpcEndpoint.includes('devnet');

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

    useEffect(() => {
        const checkIfInitialized = async () => {
            if (!publicKey) {
                setIsInitialized(false);
                setTheraSolBalance(null);
                return;
            }

            try {
                const userPDA = await getUserPDA(publicKey);
                const userAccount = await program.account.userAccount.fetch(userPDA);
                setIsInitialized(true);
                // Convert from lamports to SOL
                setTheraSolBalance(userAccount.balance.toNumber() / anchor.web3.LAMPORTS_PER_SOL);
            } catch (error) {
                console.log("Account not initialized yet:", error);
                setIsInitialized(false);
                setTheraSolBalance(null);
            }
        };

        checkIfInitialized();
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
            const transaction = new anchor.web3.Transaction().add(
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: myPublicKey,
                    lamports: paymentAmount,
                })
            );
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

    const startTheSession = async () => {
        if (!publicKey) return;

        try {
            const userPDA = await getUserPDA(publicKey);
            const startTime = Math.floor(Date.now() / 1000);

            const transaction = await program.methods
                .startSession(new anchor.BN(startTime))
                .accounts({
                    user: publicKey,
                    userAccount: userPDA,
                })
                .transaction();

            const transactionSignature = await sendTransaction(
                transaction,
                connection
            );

            await connection.confirmTransaction(transactionSignature, "confirmed");
            setSessionStarted(true);
            console.log("Session started successfully at:", startTime);
        } catch (error) {
            console.error("Error starting session:", error);
            // Handle the error appropriately
        }
    };

    const endTheSession = async () => {
        if (!publicKey) return;

        try {
            const userPDA = await getUserPDA(publicKey);
            const endTime = Math.floor(Date.now() / 1000);

            console.log("Creating transaction with:", {
                publicKey: publicKey?.toString(),
                userPDA: userPDA.toString(),
                endTime
            });

            const transaction = await program.methods
                .endSession(new anchor.BN(endTime))
                .accounts({
                    user: publicKey,
                    userAccount: userPDA,
                })
                .transaction();

            console.log("Transaction created, preparing to send");

            try {
                const transactionSignature = await sendTransaction(
                    transaction,
                    connection,
                    { skipPreflight: false }  // Enable preflight checks
                );

                console.log("Transaction sent with signature:", transactionSignature);

                const confirmation = await connection.confirmTransaction(transactionSignature, "confirmed");
                console.log("Transaction confirmation:", confirmation);

                setSessionStarted(false);
                console.log("Session ended successfully at:", endTime);
            } catch (sendError) {
                console.error("Transaction send error details:", {
                    error: sendError
                });
                throw sendError;
            }
        } catch (error) {
            console.error("Error ending session:", error);

            // Handle the error appropriately
        }
    };

    const initializeAccount = async () => {
        if (!publicKey) return;

        try {
            const userPDA = await getUserPDA(publicKey);

            const transaction = await program.methods
                .initializeUser()
                .accounts({
                    user: publicKey,
                    userAccount: userPDA,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .transaction();

            const transactionSignature = await sendTransaction(
                transaction,
                connection
            );

            await connection.confirmTransaction(transactionSignature, "confirmed");
            setIsInitialized(true);
            console.log("Account initialized successfully");
        } catch (error) {
            console.error("Error initializing account:", error);
            // Handle the error appropriately
        }
    };

    const handleDeposit = async () => {
        if (!publicKey || depositAmount <= 0) return;

        try {
            const userPDA = await getUserPDA(publicKey);
            const lamports = depositAmount * anchor.web3.LAMPORTS_PER_SOL;
            
            const transaction = await program.methods
                .depositFunds(new anchor.BN(lamports))
                .accounts({
                    user: publicKey,
                    userAccount: userPDA,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .transaction();

            const transactionSignature = await sendTransaction(
                transaction,
                connection
            );

            await connection.confirmTransaction(transactionSignature, "confirmed");
            console.log("Successfully deposited:", depositAmount, "SOL");
            
            // Refresh the balances
            const userAccount = await program.account.userAccount.fetch(userPDA) as UserAccount;
            setTheraSolBalance(userAccount.balance.toNumber() / anchor.web3.LAMPORTS_PER_SOL);
            
            // Reset deposit amount
            setDepositAmount(0);
        } catch (error) {
            console.error("Error depositing funds:", error);
        }
    };

    const handleWithdraw = async () => {
        if (!publicKey || withdrawAmount <= 0) return;

        try {
            const userPDA = await getUserPDA(publicKey);
            const lamports = withdrawAmount * anchor.web3.LAMPORTS_PER_SOL;
            
            const transaction = await program.methods
                .reclaimFunds(new anchor.BN(lamports))
                .accounts({
                    user: publicKey,
                    userAccount: userPDA,
                })
                .transaction();

            const transactionSignature = await sendTransaction(
                transaction,
                connection
            );

            await connection.confirmTransaction(transactionSignature, "confirmed");
            console.log("Successfully withdrawn:", withdrawAmount, "SOL");
            
            // Refresh the balances
            const userAccount = await program.account.userAccount.fetch(userPDA) as UserAccount;
            setTheraSolBalance(userAccount.balance.toNumber() / anchor.web3.LAMPORTS_PER_SOL);
            
            // Reset withdraw amount
            setWithdrawAmount(0);
        } catch (error) {
            console.error("Error withdrawing funds:", error);
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
                {publicKey && <p>{balance !== null ? `Main Balance: ${balance} SOL` : ""}</p>}
                {publicKey && isInitialized && <p>{theraSolBalance !== null ? `TheraSol Wallet Balance: ${theraSolBalance} SOL` : ""}</p>}
                {publicKey && !networkMismatch && !sessionStarted && (
                    <div className="session-controls">
                        {!isInitialized && (
                            <button onClick={initializeAccount} className="action-button">
                                Initialize Account
                            </button>
                        )}
                        {isInitialized && (
                            <div className="wallet-controls">
                                <div className="deposit-controls">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                                        placeholder="Amount in SOL"
                                        className="deposit-input"
                                    />
                                    <button 
                                        onClick={handleDeposit} 
                                        className="action-button"
                                        disabled={depositAmount <= 0}
                                    >
                                        Deposit to TheraSol Wallet
                                    </button>
                                </div>
                                <div className="withdraw-controls">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                                        placeholder="Amount in SOL"
                                        className="withdraw-input"
                                    />
                                    <button 
                                        onClick={handleWithdraw} 
                                        className="action-button"
                                        disabled={withdrawAmount <= 0 || (theraSolBalance !== null && withdrawAmount > theraSolBalance)}
                                    >
                                        Withdraw from TheraSol Wallet
                                    </button>
                                </div>
                            </div>
                        )}
                        <button onClick={startTheSession} className="action-button" disabled={!isInitialized}>
                            Start Session
                        </button>
                    </div>
                )}
                {publicKey && !networkMismatch && sessionStarted && (
                    <button
                        className="end-session-button"
                        onClick={endTheSession}
                    >
                        End Session
                    </button>
                )}
                <div className="network-info">
                    <p>App Network: {connection.rpcEndpoint.includes("devnet") ? "Devnet" :
                                   connection.rpcEndpoint.includes("mainnet") ? "Mainnet" :
                                   connection.rpcEndpoint}</p>
                    <p>Wallet Network: {walletNetwork || "Not Connected"}</p>
                </div>
                {networkMismatch && (
                    <div className="network-warning">
                        ⚠️ Warning: Please switch your wallet to {connection.rpcEndpoint.includes("devnet") ? "Devnet" : "Mainnet"} network
                    </div>
                )}
            </div>

            {publicKey && !networkMismatch && sessionStarted && (
                <div className="main-content">
                    <h1>Speech to Text and Suggestions</h1>

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

                    <button
                        onClick={toggleListening}
                        disabled={!publicKey}
                        className={`talk-button ${isListening ? 'listening' : ''}`}
                        title={isListening ? "Stop Recording" : "Start Recording"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="mic-icon"
                        >
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;