import { useState } from 'react';
import reactLogo from './assets/react.svg';
// Assuming you have a custom logo or use the vite logo
import viteLogo from '/vite.svg';
import './App.css';

// // Define a type for the bridge response if needed
// type BridgeResponse = {
//   status: string;
//   data: any;
// };

function App() {
  // State to store the response from the Bridge
  const [bridgeResult, setBridgeResult] = useState<string>('No data received yet.');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Function to handle the interaction with your Bridge.
   * Replace the logic inside with your actual window.bridge or IPC call.
   */
  const handleBridgeCall = async () => {
    setIsLoading(true);
    setBridgeResult('Calling Bridge...');

    try {
      // TODO: Replace this with your actual Bridge call
      // Example: const response = await window.myBridge.getData();

      // Simulating an async operation for UI demonstration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockResponse = "Success: Connected to Native Backend";
      setBridgeResult(mockResponse);
      console.log("Bridge response:", mockResponse);

    } catch (error) {
      console.error("Bridge error:", error);
      setBridgeResult(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Logo Section - Uses .logo and .logo:hover from App.css */}
      <div>
        <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      {/* Main Title - Uses h1 from index.css */}
      <h1>Bridge Interface</h1>

      {/* Card Section - Uses .card from App.css */}
      <div className="card">
        {/* Action Button - Uses button styles from index.css (including hover/focus) */}
        <button onClick={handleBridgeCall} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Invoke Native Bridge'}
        </button>

        <p>
          Edit <code>src/App.tsx</code> to wire up your specific C++/Rust functions.
        </p>
      </div>

      {/* Result Display Area - Inherits text styles */}
      <div className="card">
        <h2>Result:</h2>
        <p className="read-the-docs">
          {bridgeResult}
        </p>
      </div>
    </>
  );
}

export default App;
