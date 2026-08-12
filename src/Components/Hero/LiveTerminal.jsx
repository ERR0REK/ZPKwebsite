import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import './LiveTerminal.css';

const LOG_MESSAGES = [
  "INITIALIZING_QUANTUM_CORE...",
  "SECURE_CONNECTION_ESTABLISHED",
  "SCANNING_SECTOR_7G...",
  "ZPK_PROTOCOL_v4_ACTIVE",
  "ENCRYPTING_DATA_STREAMS...",
  "UPLINK_STABLE_88Mbps",
  "THREAT_LEVEL: LOW",
  "PARSING_SQUADRON_INTEL...",
  "GPS_LOCK: COORDINATES_LOCKED",
  "NEBULA_INTERFERENCE: MINIMAL",
  "HEARTBEAT_SIGNAL_STABLE",
  "DEPLOYING_HUD_WIDGETS...",
  "VOICE_ENCRYPTION_KEY_UPDATED",
  "REFRACTING_STARE_LIGHT_AR_PASS",
  "LOCAL_TIME_SYNC_COMPLETE"
];

const LiveTerminal = () => {
  const [logs, setLogs] = useState(["BOOT_SEQUENCE_COMPLETE"]);
  const terminalRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
      const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setLogs(prev => [...prev.slice(-14), `[${timestamp}] ${randomMsg}`]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="live-terminal-widget">
      <div className="terminal-header">
        <Terminal size={12} />
        <span>SYSTEM_LOGS</span>
        <div className="pulse-indicator"></div>
      </div>
      <div className="terminal-body" ref={terminalRef}>
        {logs.map((log, i) => (
          <div key={i} className="log-line">{log}</div>
        ))}
      </div>
      <div className="terminal-footer">
        RUNNING ZPK_OS v4.0.1
      </div>
    </div>
  );
};

export default LiveTerminal;
