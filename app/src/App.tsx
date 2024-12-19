import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { clusterApiUrl } from "@solana/web3.js";
 
const network = clusterApiUrl("devnet");
const connection = new Connection(network, 'confirmed');

interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    addEventListener(
        type: "result",
        listener: (this: SpeechRecognition, ev: SpeechRecognitionEvent) => any
    ): void;
    addEventListener(
        type: "end",
        listener: (this: SpeechRecognition, ev: Event) => any
    ): void;
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

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Set the language to English
    recognition.interimResults = false; // Get only final results

    // Event: Fired when speech is recognized
    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        console.log('You said:', transcript);
    };

    // Event: Fired when speech recognition ends
    recognition.onend = () => {
        console.log('Speech recognition ended.');
    };

    // Start speech recognition
    recognition.start();
} else {
    console.error('SpeechRecognition API is not supported in this browser.');
}

const App: React.FC = () => {
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        if (publicKey) {
            const fetchBalance = async () => {
                const lamports = await connection.getBalance(publicKey);
                setBalance(lamports/ 1e9);
            }
            fetchBalance()
        }
    }, [publicKey])


    return (
        <div>
            <h1>Welcome to THERASOL</h1>
            <h2>Please connect to a wallet</h2>
            <WalletMultiButton />
            {publicKey && <p>Connected Wallet: {publicKey.toBase58()}</p>}
            <p>Balance: {balance !== null ? `${balance} SOL` : 'Loading ...'}</p>
        </div>
    );
};

export default App;
