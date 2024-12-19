import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WalletConnectionProvider } from "./WalletContext"; // Add this

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
    <React.StrictMode>
        <WalletConnectionProvider>
            <App />
        </WalletConnectionProvider>
    </React.StrictMode>
);
