import { CodeTemplate } from "./types";

export const explanationData = {
  whyDifficultTitle: "Tại sao trực tiếp viết Plugin cho UltraViewer trên macOS lại vô cùng khó?",
  whyDifficultBullets: [
    {
      title: "Mã nguồn đóng & Độc quyền (Proprietary)",
      desc: "UltraViewer là phần mềm thương mại mã nguồn đóng. Giao thức truyền tải hình ảnh, mã hóa dữ liệu, bắt bắt tín hiệu chuột/bàn phím từ xa là độc quyền và không được công bố công khai. Không có bất kỳ tài liệu SDK hay API mở nào để các lập trình viên bên ngoài viết plugin can thiệp."
    },
    {
      title: "Khác biệt nền tảng sâu sắc (OS Architecture Gap)",
      desc: "UltraViewer được phát triển sâu trên nền tảng .NET và các thư viện Win32 / DirectX để chụp màn hình tốc độ cao và giả lập chuột hệ thống Windows. Hệ điều hành macOS sử dụng Quartz Event Services và ScreenCaptureKit hoàn toàn khác biệt. Việc chuyển đổi (porting) lõi Windows này sang Mac nguyên bản đòi hỏi phải xây dựng một lõi hoàn toàn mới từ đầu."
    },
    {
      title: "Mã hóa & Xác thực bảo mật",
      desc: "Các phiên kết nối UltraViewer được bảo mật bằng các lớp mã hóa hai đầu (End-to-End Encryption - AES/RSA). Không nắm giữ giải thuật giải mã khóa bắt bắt bắt tay (handshake), bất kỳ ứng dụng bên thứ 3 nào cố kết nối vào mạng của UltraViewer đều sẽ bị tường lửa và hệ thống bảo mật từ chối ngay lập tức."
    }
  ],
  solutionTitle: "Làm thế nào để xây dựng giải pháp thay thế từ macOS kết nối tới Windows?",
  solutionDescription: "Mặc dù không thể hack hay viết plugin cho UltraViewer chính thức, bạn hoàn toàn có thể tự xây dựng một ứng dụng Điều khiển Máy tính Từ xa (Remote Desktop Client/Server) bằng các giao thức mở tiêu chuẩn công nghiệp như WebRTC, VNC hoặc RDP. Hệ thống này bao gồm 3 lớp chính:",
  architectureSteps: [
    {
      step: "01",
      title: "Signaling Server (Bộ điều phối tín hiệu)",
      desc: "Thực chất là một WebSocket Server trung gian. Giúp client (macOS) và host (Windows) trao đổi thông tin cấu hình mạng SDP (Session Description Protocol) và các ứng viên ICE (STUN/TURN) để thiết lập luồng kết nối trực tiếp (Peer-to-Peer)."
    },
    {
      step: "02",
      title: "Host Agent (Windows Script Capture)",
      desc: "Chạy trên máy Windows mục tiêu. Thực hiện chụp màn hình liên tục (Sử dụng Desktop Duplication API hoặc RobotJS), nén video động dưới định dạng H.264/VP9, và truyền qua luồng WebRTC Media stream. Đồng thời lắng nghe tín hiệu phím chuột nhận được để giả lập nhấn phím thực tế."
    },
    {
      step: "03",
      title: "Viewer Client (macOS Interface)",
      desc: "Ứng dụng Client nền Web hoặc native chạy trên macOS. Nhận luồng video thời gian thực từ WebRTC, render lên thẻ <video> có độ trễ cực thấp (< 50ms) và thu thập mọi sự kiện chuột, bàn phím gõ từ user, sau đó truyền ngược lại server qua DataChannel."
    }
  ]
};

export const codeTemplates: CodeTemplate[] = [
  {
    title: "1. WebRTC Signaling Server (Bộ Phân Phối Tín Hiệu - Node.js)",
    description: "File này chạy trên máy chủ Cloud công cộng (VPS) nhằm kết nối hai máy macOS và Windows lại với nhau ban đầu thông qua giao thức WebSockets.",
    filename: "signaling-server.js",
    language: "javascript",
    code: `const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

console.log("WebRTC Signaling Server đang chạy tại port 8080...");

// Lưu trữ các peer đang trực tuyến
const peers = {};

wss.on('connection', (ws) => {
  let peerId = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch(data.type) {
      case 'register':
        peerId = data.id;
        peers[peerId] = ws;
        console.log(\`Thiết bị \${peerId} [\${data.role}]đã đăng ký trực tuyến!\`);
        break;
        
      case 'offer':
      case 'answer':
      case 'candidate':
        // Chuyển tiếp gói tin WebRTC SDP đến thiết bị mục tiêu
        const target = peers[data.targetId];
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({
            type: data.type,
            senderId: peerId,
            payload: data.payload
          }));
        }
        break;
    }
  });

  ws.on('close', () => {
    if (peerId && peers[peerId]) {
      delete peers[peerId];
      console.log(\`Thiết bị \${peerId} đã ngắt kết nối.\`);
    }
  });
});`
  },
  {
    title: "2. Windows Host Agent Capture (Chụp Màn Hình & Giả Lập Phím Chuột)",
    description: "Chạy trên máy tính Windows. Nó chụp màn hình liên tục làm nguồn stream cho WebRTC, truyền dữ liệu qua WebRTC, đồng thời lắng nghe điều khiển từ macOS để giả lập nhấn phím và nhấp chuột.",
    filename: "windows-agent.js",
    language: "javascript",
    code: `const robot = require('robotjs'); // Thư viện giả lập phần cứng chuột/phím
const WebSocket = require('ws');

const ws = new WebSocket('ws://YOUR_SERVER_IP:8080');
const PEER_ID = 'WIN-542918';

ws.on('open', () => {
  // Đăng ký với server với vai trò host
  ws.send(JSON.stringify({
    type: 'register',
    id: PEER_ID,
    role: 'host'
  }));
});

// Giả lập WebRTC Peer Connection (Sử dụng thư viện wrtc trên Node.js)
const { RTCPeerConnection } = require('wrtc');
const pc = new RTCPeerConnection();

// Khi có kênh truyền lệnh điều khiển DataChannel
pc.ondatachannel = (event) => {
  const channel = event.channel;
  channel.onmessage = (e) => {
    const command = JSON.parse(e.data);
    
    if (command.type === 'mousemove') {
      // Di chuyển chuột thật của Windows tương ứng với tọa độ từ macOS truyền về
      robot.moveMouse(command.x, command.y);
    } 
    else if (command.type === 'click') {
      robot.mouseClick(command.button || 'left');
    }
    else if (command.type === 'keypress') {
      robot.keyTap(command.key);
    }
  };
};

console.log("Host Agent đang chờ luồng truyền WebRTC từ macOS...");`
  },
  {
    title: "3. macOS Client Web Viewer (Trình xem và điều khiển từ Mac)",
    description: "Trình duyệt Safari/Chrome hoặc phần mềm Electron chạy trên macOS. Nó nhận luồng video thời gian thực và ghi nhận thao tác của bạn để chuyển tiếp sang Windows.",
    filename: "macos-viewer.html",
    language: "html",
    code: `<!DOCTYPE html>
<html>
<head>
  <title>UltraConnect macOS Client</title>
  <style>
    video { width: 100%; border: 2px solid #333; background: #000; }
  </style>
</head>
<body>
  <h2>Bộ màn hình Remote Desktop Windows</h2>
  <video id="remoteVideo" autoplay playsinline></video>

  <script>
    const ws = new WebSocket('ws://YOUR_SERVER_IP:8080');
    const pc = new RTCPeerConnection();
    
    // Đăng ký client
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', id: 'MAC-CLIENT', role: 'viewer' }));
    };

    // Nhận stream video từ Windows host và gắn vào thẻ <video>
    pc.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    // Tạo kênh truyền tải phím chuột thời gian thực
    const controlChannel = pc.createDataChannel('control-signals');
    
    // Bắt sự kiện di chuyển chuột trên video
    const videoEl = document.getElementById('remoteVideo');
    videoEl.addEventListener('mousemove', (e) => {
      const rect = videoEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 1920; // Scale về độ phân giải Windows
      const y = ((e.clientY - rect.top) / rect.height) * 1080;
      
      if (controlChannel.readyState === 'open') {
        controlChannel.send(JSON.stringify({ type: 'mousemove', x: Math.round(x), y: Math.round(y) }));
      }
    });

    videoEl.addEventListener('mousedown', (e) => {
      if (controlChannel.readyState === 'open') {
        controlChannel.send(JSON.stringify({ type: 'click', button: e.button === 2 ? 'right' : 'left' }));
      }
    });
  </script>
</body>
</html>`
  }
];

export const openSourceAlternatives = [
  {
    name: "RustDesk (Được khuyên dùng nhất)",
    type: "Mã nguồn mở đầy đủ",
    desc: "Giải pháp thay thế mã nguồn mở tốt nhất hiện nay cho TeamViewer và UltraViewer. RustDesk hỗ trợ cài đặt chính thức cho macOS (cả Apple Silicon M1/M2/M3 và Intel) kết nối mượt mà tới Windows mà không gặp bất kỳ rào cản nào, có thể tự dựng Server để tăng tốc kết nối riêng tư.",
    linkText: "Tải RustDesk"
  },
  {
    name: "Microsoft Remote Desktop cho Mac",
    type: "Giao thức RDP Chính hãng",
    desc: "Nếu máy tính Windows của bạn là phiên bản Pro (Professional/Enterprise) hỗ trợ tính năng Remote Desktop, chỉ cần tải ứng dụng 'Microsoft Remote Desktop' chính chủ từ Mac App Store. Bạn sẽ có độ mượt và chất lượng render hình ảnh cao nhất mà không cần cài gì thêm lên macOS.",
    linkText: "Tải trên App Store"
  },
  {
    name: "RealVNC / TightVNC",
    type: "Giao thức VNC Tiêu chuẩn",
    desc: "VNC là giao thức điều khiển từ xa cổ điển, cực kỳ nhẹ và ổn định. Bạn chạy một dịch vụ VNC Server trên Windows, sau đó cài các app Viewer mượt mà trên macOS để quản trị mọi lúc.",
    linkText: "Xem thêm VNC"
  }
];
