import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy-loaded Gemini client
let aiInstance: GoogleGenAI | null = null;
const getGeminiClient = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
};

// Simulated Remote Host state preset
interface HostState {
  os: string;
  id: string;
  pass: string;
  hostname: string;
  activeProcesses: string[];
  files: { path: string; size: string; content: string }[];
  chatHistory: { sender: "client" | "host" | "system"; message: string; timestamp: string }[];
}

const defaultHost: HostState = {
  os: "Windows 11 Professional (Build 22631)",
  id: "542 918 367",
  pass: "2468",
  hostname: "WIN-WORKSTATION-X",
  activeProcesses: ["explorer.exe", "chrome.exe", "ultraviewer_service.exe", "notepad.exe", "cmd.exe"],
  files: [
    { path: "C:\\Users\\Support\\Desktop\\ReadMe.txt", size: "1.2 KB", content: "Chào mừng bạn đã kết nối UltraViewer macOS Companion!\nỨng dụng này hướng dẫn chi tiết cách kết nối macOS và Windows.\nHãy kiểm tra các tính năng: File Transfer, Terminal, và Live Chat." },
    { path: "C:\\Users\\Support\\Documents\\Technical_Reports.pdf", size: "14.5 MB", content: "[Binary Data Placeholder]" },
    { path: "C:\\Program Files\\UltraViewer\\Log.txt", size: "4.8 KB", content: "Service started at port 2102" },
  ],
  chatHistory: [
    { sender: "system", message: "Kết nối thành công với Windows 11 Workstation.", timestamp: "Vừa xong" }
  ],
};

// Dynamic memory registry for real-time host connection matchmaking
interface ActiveHost {
  id: string;
  pass: string;
  os: string;
  hostname: string;
  lastSeen: number;
}

interface RealtimeSession {
  sessionId: string;
  controllerId: string;
  hostId: string;
  lastSeen: number;
  chatMessages: any[];
  terminalHistory: string[];
  hostFiles: any[];
  mouseCursor: { x: number; y: number } | null;
  pendingCommand: any | null;
  status: "active" | "disconnected";
}

const activeHosts: { [id: string]: ActiveHost } = {};
const realtimeSessions: { [id: string]: RealtimeSession } = {};

// 1. Dynamic machine registration heartbeat
app.post("/api/register-host", (req, res) => {
  const { id, pass, os, hostname } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Thiếu ID thiết bị" });
  }
  const cleanId = id.replace(/\s+/g, "");
  activeHosts[cleanId] = {
    id,
    pass: pass || "5599",
    os: os || "macOS Client",
    hostname: hostname || "MacBook-Air-User",
    lastSeen: Date.now()
  };

  // Check if someone connected to us
  let connectedSessionId = null;
  let controllerInfo = null;
  for (const sessId in realtimeSessions) {
    const session = realtimeSessions[sessId];
    if (session.hostId.replace(/\s+/g, "") === cleanId && session.status === "active") {
      connectedSessionId = sessId;
      controllerInfo = { id: session.controllerId };
      break;
    }
  }

  // Periodic pruning of stale hosts (> 12 seconds inactive)
  const now = Date.now();
  for (const hostId in activeHosts) {
    if (now - activeHosts[hostId].lastSeen > 12000) {
      delete activeHosts[hostId];
    }
  }

  res.json({
    status: "ok",
    connectedSessionId,
    controllerInfo
  });
});

// 2. Connector matchmaking and setup
app.post("/api/connect-partner", (req, res) => {
  const { partnerId, partnerPass, myId } = req.body;
  if (!partnerId || !partnerPass) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ ID và mật khẩu kết nối." });
  }

  const cleanPartnerId = partnerId.replace(/\s+/g, "");
  const cleanMyId = myId ? myId.replace(/\s+/g, "") : "";

  // Scenario A: Standard Simulated Offline Host
  if (cleanPartnerId === defaultHost.id.replace(/\s+/g, "")) {
    if (partnerPass !== defaultHost.pass) {
      return res.status(400).json({ error: `Mật khẩu kết nối sai. Gợi ý: Nhập mật khẩu '${defaultHost.pass}'` });
    }
    return res.json({
      status: "connected",
      mode: "simulation",
      hostInfo: {
        id: defaultHost.id,
        os: defaultHost.os,
        hostname: defaultHost.hostname
      }
    });
  }

  // Scenario B: Real-time Host Connection
  const targetHost = activeHosts[cleanPartnerId];
  if (!targetHost) {
    return res.status(404).json({ error: "Máy đối tác hiện không trực tuyến! Hãy chắc chắn đối tác đã mở ứng dụng và kết nối cùng mạng Internet." });
  }

  if (targetHost.pass !== partnerPass) {
    return res.status(400).json({ error: "Mật khẩu kết nối chưa chính xác. Vui lòng kiểm tra lại!" });
  }

  // Established connection mapping
  const sessionId = `sess_${cleanMyId}_${cleanPartnerId}`;
  realtimeSessions[sessionId] = {
    sessionId,
    controllerId: myId,
    hostId: targetHost.id,
    lastSeen: Date.now(),
    chatMessages: [
      { id: "1", sender: "system", message: `Hệ thống: Kết nối thành công tới trạm máy ${targetHost.hostname}.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ],
    terminalHistory: [
      `[PROMPT CONNECTED TO REALTIME INSTANCE: ${targetHost.hostname}]`,
      `Client ID: ${targetHost.id}`,
      `OS Platform: ${targetHost.os}`,
      `Gõ lệnh 'dir', 'ipconfig', hoặc 'systeminfo' để truy cứu...`
    ],
    hostFiles: [
      { id: "1", name: "ReadMe.txt", path: "C:\\Users\\Support\\Desktop\\ReadMe.txt", size: "1.2 KB", content: "Chào mừng chuyên gia! Đây là file thật từ máy tính bên kia của tôi." }
    ],
    mouseCursor: { x: 0, y: 0 },
    pendingCommand: null,
    status: "active"
  };

  res.json({
    status: "connected",
    mode: "realtime",
    sessionId,
    hostInfo: {
      id: targetHost.id,
      os: targetHost.os,
      hostname: targetHost.hostname
    }
  });
});

// 3. Client-Host state packet synchronization pool
app.post("/api/session-sync", (req, res) => {
  const { sessionId, role, chatInput, terminalInput, hostFiles, mouseCursor, terminalOutput, deleteFileId } = req.body;
  const session = realtimeSessions[sessionId];
  
  if (!session || session.status !== "active") {
    return res.json({ status: "disconnected" });
  }

  session.lastSeen = Date.now();

  // Handle active chat payload injection
  if (chatInput) {
    session.chatMessages.push({
      id: Date.now().toString(),
      sender: role,
      message: chatInput.message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  // Handle terminal submit
  if (role === "controller" && terminalInput) {
    session.terminalHistory.push(`C:\\Support> ${terminalInput}`);
    session.pendingCommand = {
      id: Date.now().toString(),
      cmd: terminalInput
    };
  }

  // Handle terminal output responses
  if (role === "host" && terminalOutput) {
    session.terminalHistory.push(terminalOutput);
    session.pendingCommand = null;
  }

  // Handle file synchronizations
  if (hostFiles) {
    session.hostFiles = hostFiles;
  }

  if (deleteFileId) {
    session.hostFiles = session.hostFiles.filter((f: any) => f.id !== deleteFileId);
  }

  if (mouseCursor) {
    session.mouseCursor = mouseCursor;
  }

  res.json({
    status: "active",
    chatMessages: session.chatMessages,
    terminalHistory: session.terminalHistory,
    hostFiles: session.hostFiles,
    mouseCursor: session.mouseCursor,
    pendingCommand: session.pendingCommand
  });
});

// 4. Session teardown trigger
app.post("/api/session-disconnect", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && realtimeSessions[sessionId]) {
    realtimeSessions[sessionId].status = "disconnected";
    delete realtimeSessions[sessionId];
  }
  res.json({ status: "disconnected" });
});

// API Endpoints for connection status and simulation control
app.get("/api/host-info", (req, res) => {
  res.json({
    id: defaultHost.id,
    pass: defaultHost.pass,
    os: defaultHost.os,
    hostname: defaultHost.hostname,
    status: "online",
  });
});

// Endpoint to execute commands / chats through Gemini AI to simulate Windows Partner response
app.post("/api/remote-action", async (req, res) => {
  const { actionType, payload, history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If no real API key is configured, return high-fidelity mock replies
    if (actionType === "cmd") {
      const command = payload.trim().toLowerCase();
      let output = "";
      if (command.startsWith("dir")) {
        output = ` Volume in drive C has no label.\n Volume Serial Number is 4C2F-9B1D\n\n Directory of C:\\Users\\Support\n\n13/06/2026  01:49 PM    <DIR>          .\n13/06/2026  01:49 PM    <DIR>          ..\n13/06/2026  01:49 PM    <DIR>          Desktop\n13/06/2026  01:49 PM    <DIR>          Documents\n13/06/2026  01:49 PM    <DIR>          Downloads\n               1 File(s)          1,280 bytes\n               4 Dir(s)  120,412,852,224 bytes free`;
      } else if (command.startsWith("ipconfig")) {
        output = `\nWindows IP Configuration\n\nEthernet adapter Ethernet0:\n   Connection-specific DNS Suffix  . : localdomain\n   IPv4 Address. . . . . . . . . . . : 192.168.10.125\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.10.1\n\nWireless LAN adapter Wi-Fi:\n   Media State . . . . . . . . . . . : Media disconnected`;
      } else if (command.startsWith("systeminfo")) {
        output = `Host Name:                 WIN-WORKSTATION-X\nOS Name:                   Microsoft Windows 11 Professional\nOS Version:                10.0.22631 N/A Build 22631\nOS Manufacturer:           Microsoft Corporation\nOS Configuration:          Stand-alone Workstation\nProduct ID:                00330-80000-00000-AA542\nSystem Model:              Virtual Machine\nSystem Type:               x64-based PC\nProcessor(s):              1 Processor(s) Installed. [01]: Intel64 Family 6 Model 158`;
      } else {
        output = `'${payload}' is not recognized as an internal or external command,\noperable program or batch file. Có thể dùng lệnh: dir, ipconfig, systeminfo`;
      }
      return res.json({ result: output, activeKey: false });
    } else {
      // Chat simulation mock
      const sampleAnswers = [
        "Xin chào! Tôi thấy chuột của bạn bắt đầu di chuyển trên màn hình rồi. Có việc gì cần tôi hỗ trợ không?",
        "Mọi thứ trên máy tính của tôi đều đang hoạt động tốt. Bạn có cần cài đặt phần mềm nào hay chỉnh sửa gì cấu hình không?",
        "Ồ, bạn vừa kéo file tài liệu sang Desktop của tôi phải không? Tôi đã thấy file xuất hiện rồi nhé!",
        "Ok, tôi đồng ý. Bạn cứ thao tác tự nhiên. Máy này là máy Windows 11 chuyên dùng cho lập trình phần mềm.",
        "Tôi thấy bạn đang gõ lệnh trong CMD. Tôi đang mở rộng quyền admin cho bạn dễ cấu hình phần mềm nhé.",
      ];
      const randomReply = sampleAnswers[Math.floor(Math.random() * sampleAnswers.length)];
      return res.json({ result: randomReply, activeKey: false });
    }
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `
      Bạn là một chiếc máy tính Windows 11 đang chạy UltraViewer và được kết nối từ xa bởi một chuyên gia máy tính thông qua phần mềm giả lập kết nối macOS-to-Windows (UltraConnect macOS Companion).
      Người dùng đang truy cập máy của bạn.
      
      Dưới đây là thông số của máy Windows này:
      - OS: ${defaultHost.os}
      - Hostname: ${defaultHost.hostname}
      - Địa chỉ IP: 192.168.10.125
      - Các file trên Desktop: ReadMe.txt, Technical_Reports.pdf
      
      Nhiệm vụ của bạn:
      - Nếu actionType là "cmd": Hãy gõ kết quả trả về của dòng lệnh Windows CMD/PowerShell tương ứng cho lệnh: "${payload}". Trả về CHỈ nội dụng thô dạng màn hình DOS (terminal text) màu đen trắng, không dùng định dạng markdown phong phú, chuẩn hóa phản hồi giống hệt màn hình terminal CMD thật của Windows, ngắn gọn, súc tích. Nếu lệnh lạ, trả lỗi chuẩn của cmd.exe nước Anh/Việt.
      - Nếu actionType là "chat": Hãy trả lời tin nhắn chat của Client (người đang điều khiển). Trả lời bằng tiếng Việt như một người dùng Windows thân thiện, thỉnh thoảng giải thích hoặc hỏi han tiến trình sửa chữa/hỗ trợ cài phần mềm. Giữ câu thoại ngắn gọn (vài chục từ) để giống khung chat online thực tế.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: payload,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ result: response.text || "No reply from system.", activeKey: true });
  } catch (error: any) {
    console.error("Gemini invocation failed:", error);
    res.status(500).json({ error: error.message || "Lỗi kết nối với trí tuệ nhân tạo." });
  }
});

// Serve Vite Assets and Setup Fallback
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[UltraConnect server] started on http://0.0.0.0:${PORT}`);
  });
};

startServer();
