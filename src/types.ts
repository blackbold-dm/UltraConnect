export interface HostSpec {
  id: string;
  pass: string;
  os: string;
  hostname: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  sender: "client" | "host" | "system";
  message: string;
  timestamp: string;
}

export interface SimulatedFile {
  id: string;
  name: string;
  path: string;
  size: string;
  content: string;
}

export interface CodeTemplate {
  title: string;
  description: string;
  filename: string;
  language: string;
  code: string;
}
