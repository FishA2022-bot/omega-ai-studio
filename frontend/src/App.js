import React, { useState, useEffect, useRef, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Brain, TerminalSquare, Rocket, Plus, Play, Trash2, ChevronRight, Code, Eye, FileText, Sparkles, Send, X, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Agent status colors and icons
const AGENT_CONFIG = {
  governor: { 
    icon: Brain, 
    label: "Governor", 
    description: "Planning & Architecture",
    color: "#002FA7"
  },
  creator: { 
    icon: TerminalSquare, 
    label: "Creator", 
    description: "Code Generation",
    color: "#10B981"
  },
  launcher: { 
    icon: Rocket, 
    label: "Launcher", 
    description: "Build & Deploy",
    color: "#F59E0B"
  }
};

const STATUS_STYLES = {
  idle: { dot: "bg-gray-400", text: "Idle" },
  thinking: { dot: "bg-yellow-400 animate-pulse", text: "Thinking..." },
  working: { dot: "bg-blue-500 animate-pulse", text: "Working" },
  done: { dot: "bg-green-500", text: "Done" }
};

// Project Creation Wizard
function ProjectWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [assistantResponse, setAssistantResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const askAssistant = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setChatMessages(prev => [...prev, { role: "user", content: prompt }]);
    
    try {
      const response = await axios.post(`${API}/assistant/chat`, { message: prompt });
      setChatMessages(prev => [...prev, { role: "assistant", content: response.data.response }]);
      
      if (response.data.structured) {
        setAssistantResponse(response.data.structured);
        if (response.data.structured.project_name && !name) {
          setName(response.data.structured.project_name);
        }
        if (response.data.structured.description && !description) {
          setDescription(response.data.structured.description);
        }
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: "error", content: "Failed to get response. Please try again." }]);
    }
    setLoading(false);
  };

  const createProject = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API}/projects`, {
        name,
        description: description || "No description",
        prompt,
        template: "custom"
      });
      onCreated(response.data);
      onClose();
    } catch (error) {
      console.error("Failed to create project:", error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="project-wizard-overlay">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-border shadow-2xl" data-testid="project-wizard">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#002FA7]" strokeWidth={1.5} />
            <h2 className="text-lg font-medium font-heading">Create New Project</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100" data-testid="wizard-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-label text-muted-foreground mb-4">STEP 1: DESCRIBE YOUR PROJECT</p>
                <p className="text-sm text-secondary mb-4">
                  Tell the AI assistant what you want to build. Be as detailed as possible.
                </p>
              </div>

              {/* Chat Messages */}
              {chatMessages.length > 0 && (
                <div className="border border-border p-4 max-h-60 overflow-y-auto space-y-3 bg-surface">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`text-sm ${msg.role === "user" ? "text-right" : ""}`}>
                      <span className={`inline-block p-2 ${
                        msg.role === "user" ? "bg-[#002FA7] text-white" : 
                        msg.role === "error" ? "bg-red-100 text-red-700" : "bg-gray-100"
                      }`}>
                        {msg.content}
                      </span>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI is thinking...
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Build a task management app with user authentication, real-time updates, and a dashboard..."
                  className="flex-1 p-3 border border-border focus:ring-1 focus:ring-[#002FA7] focus:border-[#002FA7] outline-none resize-none h-24 text-sm"
                  data-testid="project-prompt-input"
                />
              </div>
              <button
                onClick={askAssistant}
                disabled={loading || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#002FA7] text-white hover:bg-[#002FA7]/90 disabled:opacity-50"
                data-testid="ask-assistant-btn"
              >
                <Send className="w-4 h-4" />
                Ask AI Assistant
              </button>

              {/* Structured Response */}
              {assistantResponse && (
                <div className="border border-green-200 bg-green-50 p-4 space-y-2">
                  <p className="text-label text-green-700">AI SUGGESTED PLAN</p>
                  <p className="font-medium">{assistantResponse.project_name}</p>
                  {assistantResponse.tech_stack && (
                    <p className="text-sm text-secondary">Stack: {assistantResponse.tech_stack.join(", ")}</p>
                  )}
                  {assistantResponse.features && (
                    <p className="text-sm text-secondary">Features: {assistantResponse.features.slice(0, 3).join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-label text-muted-foreground mb-4">STEP 2: PROJECT DETAILS</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-label text-muted-foreground block mb-2">PROJECT NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Awesome Project"
                    className="w-full p-3 border border-border focus:ring-1 focus:ring-[#002FA7] focus:border-[#002FA7] outline-none text-sm"
                    data-testid="project-name-input"
                  />
                </div>
                <div>
                  <label className="text-label text-muted-foreground block mb-2">DESCRIPTION</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of your project..."
                    className="w-full p-3 border border-border focus:ring-1 focus:ring-[#002FA7] focus:border-[#002FA7] outline-none resize-none h-24 text-sm"
                    data-testid="project-description-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-surface">
          <div className="flex gap-2">
            <div className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-[#002FA7]" : "bg-gray-300"}`} />
            <div className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-[#002FA7]" : "bg-gray-300"}`} />
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2 border border-border hover:bg-gray-50" data-testid="wizard-back-btn">
                Back
              </button>
            )}
            {step < 2 ? (
              <button 
                onClick={() => setStep(2)} 
                className="px-4 py-2 bg-[#002FA7] text-white hover:bg-[#002FA7]/90"
                data-testid="wizard-next-btn"
              >
                Next
              </button>
            ) : (
              <button 
                onClick={createProject} 
                disabled={loading || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#002FA7] text-white hover:bg-[#002FA7]/90 disabled:opacity-50"
                data-testid="wizard-create-btn"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Agent Status Card
function AgentCard({ agentKey, status }) {
  const config = AGENT_CONFIG[agentKey];
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.idle;
  const Icon = config.icon;

  return (
    <div className="flex-1 p-4 border-r last:border-r-0 border-border" data-testid={`agent-card-${agentKey}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface border border-border">
          <Icon className="w-5 h-5" style={{ color: config.color }} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{config.label}</span>
            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} data-testid={`${agentKey}-status-dot`} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{statusStyle.text}</p>
        </div>
      </div>
    </div>
  );
}

// Activity Feed Item
function ActivityItem({ event }) {
  const typeStyles = {
    info: "text-blue-600",
    success: "text-green-600",
    warning: "text-yellow-600",
    error: "text-red-600",
    thinking: "text-yellow-600"
  };

  const typeIcons = {
    info: null,
    success: <CheckCircle2 className="w-3 h-3" />,
    warning: <AlertCircle className="w-3 h-3" />,
    error: <AlertCircle className="w-3 h-3" />,
    thinking: <Loader2 className="w-3 h-3 animate-spin" />
  };

  const agentColor = AGENT_CONFIG[event.agent]?.color || "#6B7280";
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className="flex gap-3 py-2 px-4 hover:bg-surface/50 transition-colors animate-fade-in" data-testid="activity-feed-item">
      <span className="text-mono text-muted-foreground w-16 shrink-0">{time}</span>
      <span 
        className="text-mono font-medium w-20 shrink-0 uppercase text-xs"
        style={{ color: agentColor }}
      >
        {event.agent}
      </span>
      <span className={`flex items-center gap-1 text-mono ${typeStyles[event.type] || ""}`}>
        {typeIcons[event.type]}
        {event.message}
      </span>
    </div>
  );
}

// Timeline Step
function TimelineStep({ label, status, isActive }) {
  const statusColors = {
    pending: "bg-gray-200 border-gray-300",
    active: "bg-[#002FA7] border-[#002FA7]",
    complete: "bg-green-500 border-green-500"
  };

  return (
    <div className={`flex items-center gap-3 p-3 ${isActive ? "bg-surface" : ""}`} data-testid={`timeline-step-${label.toLowerCase().replace(' ', '-')}`}>
      <div className={`w-3 h-3 rounded-full border-2 ${statusColors[status]}`} />
      <span className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

// Main App
function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activities, setActivities] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const wsRef = useRef(null);
  const feedRef = useRef(null);

  // Fetch projects
  useEffect(() => {
    axios.get(`${API}/projects`).then(res => setProjects(res.data)).catch(console.error);
  }, []);

  // Fetch activities when project selected
  useEffect(() => {
    if (selectedProject) {
      axios.get(`${API}/projects/${selectedProject.id}/activities`)
        .then(res => setActivities(res.data))
        .catch(console.error);
    }
  }, [selectedProject?.id]);

  // WebSocket connection
  useEffect(() => {
    if (!selectedProject) return;

    const ws = new WebSocket(`${WS_URL}/ws/${selectedProject.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "activity") {
        setActivities(prev => [...prev, data.data]);
      } else if (data.type === "agent_status") {
        setSelectedProject(prev => ({
          ...prev,
          agents: { ...prev.agents, [data.agent]: data.status }
        }));
      } else if (data.type === "artifact") {
        setSelectedProject(prev => ({
          ...prev,
          artifacts: [...(prev.artifacts || []), data.data]
        }));
      }
    };

    return () => ws.close();
  }, [selectedProject?.id]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activities]);

  const handleProjectCreated = (project) => {
    setProjects(prev => [project, ...prev]);
    setSelectedProject(project);
  };

  const startWorkflow = async () => {
    if (!selectedProject) return;
    try {
      await axios.post(`${API}/projects/${selectedProject.id}/start`);
    } catch (error) {
      console.error("Failed to start workflow:", error);
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await axios.delete(`${API}/projects/${projectId}`);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setActivities([]);
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const refreshProject = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await axios.get(`${API}/projects/${selectedProject.id}`);
      setSelectedProject(res.data);
    } catch (error) {
      console.error("Failed to refresh project:", error);
    }
  }, [selectedProject?.id]);

  // Refresh project periodically during active workflow
  useEffect(() => {
    if (selectedProject && selectedProject.status !== "deployed") {
      const interval = setInterval(refreshProject, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedProject?.status, refreshProject]);

  const getTimelineStatus = (phase) => {
    if (!selectedProject) return "pending";
    const statusMap = {
      planning: { planning: "active", generating: "pending", reviewing: "pending", deploying: "pending", deployed: "pending" },
      generating: { planning: "complete", generating: "active", reviewing: "pending", deploying: "pending", deployed: "pending" },
      reviewing: { planning: "complete", generating: "complete", reviewing: "active", deploying: "pending", deployed: "pending" },
      deploying: { planning: "complete", generating: "complete", reviewing: "complete", deploying: "active", deployed: "pending" },
      deployed: { planning: "complete", generating: "complete", reviewing: "complete", deploying: "complete", deployed: "complete" }
    };
    return statusMap[selectedProject.status]?.[phase] || "pending";
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-white text-black font-body" data-testid="omega-studio">
      {/* Left Sidebar - Projects & Timeline */}
      <div className="w-72 border-r border-border flex flex-col bg-surface" data-testid="sidebar-left">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-[#002FA7] flex items-center justify-center">
              <span className="text-white font-bold text-sm">Ω</span>
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight">Omega Studio</h1>
          </div>
          <p className="text-xs text-muted-foreground">AI-Powered Software Factory</p>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label text-muted-foreground">PROJECTS</span>
              <button 
                onClick={() => setShowWizard(true)}
                className="p-1 hover:bg-white border border-transparent hover:border-border"
                data-testid="new-project-btn"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {projects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={`group flex items-center gap-2 p-2 cursor-pointer border ${
                    selectedProject?.id === project.id 
                      ? "border-[#002FA7] bg-white" 
                      : "border-transparent hover:border-border hover:bg-white"
                  }`}
                  data-testid={`project-item-${project.id}`}
                >
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedProject?.id === project.id ? "rotate-90" : ""}`} />
                  <span className="flex-1 text-sm truncate">{project.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-500"
                    data-testid={`delete-project-${project.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No projects yet</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          {selectedProject && (
            <div className="border-t border-border">
              <div className="p-4 pb-2">
                <span className="text-label text-muted-foreground">TIMELINE</span>
              </div>
              <TimelineStep label="Planning" status={getTimelineStatus("planning")} isActive={selectedProject.status === "planning"} />
              <TimelineStep label="Generating" status={getTimelineStatus("generating")} isActive={selectedProject.status === "generating"} />
              <TimelineStep label="Reviewing" status={getTimelineStatus("reviewing")} isActive={selectedProject.status === "reviewing"} />
              <TimelineStep label="Deploying" status={getTimelineStatus("deploying")} isActive={selectedProject.status === "deploying"} />
              <TimelineStep label="Deployed" status={getTimelineStatus("deployed")} isActive={selectedProject.status === "deployed"} />
            </div>
          )}
        </div>
      </div>

      {/* Center - Activity Feed */}
      <div className="flex-1 border-r border-border flex flex-col bg-white min-w-[400px]" data-testid="main-center">
        {selectedProject ? (
          <>
            {/* Agent Status Bar */}
            <div className="flex border-b border-border" data-testid="agent-status-bar">
              <AgentCard agentKey="governor" status={selectedProject.agents?.governor || "idle"} />
              <AgentCard agentKey="creator" status={selectedProject.agents?.creator || "idle"} />
              <AgentCard agentKey="launcher" status={selectedProject.agents?.launcher || "idle"} />
            </div>

            {/* Project Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-heading text-lg font-medium">{selectedProject.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedProject.description}</p>
              </div>
              {selectedProject.status !== "deployed" && (
                <button
                  onClick={startWorkflow}
                  className="flex items-center gap-2 px-4 py-2 bg-[#002FA7] text-white hover:bg-[#002FA7]/90"
                  data-testid="start-workflow-btn"
                >
                  <Play className="w-4 h-4" />
                  Start Agents
                </button>
              )}
              {selectedProject.status === "deployed" && (
                <span className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-sm border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  Deployed
                </span>
              )}
            </div>

            {/* Activity Feed */}
            <div className="flex-1 overflow-y-auto bg-[#FAFAFA]" ref={feedRef} data-testid="activity-feed">
              <div className="p-4 border-b border-border sticky top-0 bg-[#FAFAFA]">
                <span className="text-label text-muted-foreground">ACTIVITY FEED</span>
              </div>
              {activities.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  <p>No activity yet. Click "Start Agents" to begin.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activities.map((event, i) => (
                    <ActivityItem key={event.id || i} event={event} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Brain className="w-16 h-16 mb-4 opacity-20" strokeWidth={1} />
            <p className="text-lg">Select a project or create a new one</p>
            <button
              onClick={() => setShowWizard(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#002FA7] text-white hover:bg-[#002FA7]/90"
              data-testid="create-first-project-btn"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar - Artifacts & Preview */}
      <div className="w-[40%] min-w-[450px] flex flex-col bg-white" data-testid="sidebar-right">
        {selectedProject ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-border">
              {[
                { id: "preview", label: "Live Preview", icon: Eye },
                { id: "code", label: "Artifacts", icon: Code },
                { id: "logs", label: "Logs", icon: FileText }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? "border-[#002FA7] text-[#002FA7]" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "preview" && (
                <div className="h-full flex flex-col">
                  {/* Mock Browser Frame */}
                  <div className="bg-gray-100 border-b border-border p-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 bg-white border border-border px-3 py-1 text-xs text-muted-foreground">
                      https://{selectedProject.name.toLowerCase().replace(/\s+/g, '-')}-preview.omega.dev
                    </div>
                  </div>
                  <div className="flex-1 bg-white flex items-center justify-center" data-testid="live-preview-panel">
                    {selectedProject.status === "deployed" ? (
                      <div className="text-center p-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="font-heading text-xl font-medium mb-2">Preview Ready</h3>
                        <p className="text-sm text-muted-foreground mb-4">Your application has been deployed successfully.</p>
                        <a 
                          href="#" 
                          className="text-[#002FA7] hover:underline text-sm"
                        >
                          Open in new tab →
                        </a>
                      </div>
                    ) : (
                      <div className="text-center p-8 text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Preview will be available after deployment</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "code" && (
                <div className="p-4" data-testid="artifacts-panel">
                  <p className="text-label text-muted-foreground mb-4">GENERATED ARTIFACTS</p>
                  {(selectedProject.artifacts || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No artifacts generated yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedProject.artifacts.map((artifact, i) => (
                        <div key={artifact.id || i} className="border border-border">
                          <div className="flex items-center gap-2 p-3 bg-surface border-b border-border">
                            <Code className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{artifact.name}</span>
                          </div>
                          <pre className="p-3 text-xs font-mono bg-[#1e1e1e] text-green-400 overflow-x-auto">
                            {artifact.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "logs" && (
                <div className="p-4 font-mono text-xs" data-testid="logs-panel">
                  <p className="text-label text-muted-foreground mb-4">BUILD LOGS</p>
                  <div className="bg-[#1e1e1e] p-4 text-green-400 max-h-[500px] overflow-y-auto">
                    {selectedProject.status === "deployed" ? (
                      <>
                        <p>[INFO] Build started...</p>
                        <p>[INFO] Installing dependencies...</p>
                        <p>[INFO] Compiling source files...</p>
                        <p>[INFO] Running tests...</p>
                        <p>[INFO] All tests passed ✓</p>
                        <p>[INFO] Building container image...</p>
                        <p>[INFO] Pushing to registry...</p>
                        <p>[INFO] Deploying to preview environment...</p>
                        <p className="text-green-300">[SUCCESS] Deployment complete!</p>
                      </>
                    ) : (
                      <p className="text-gray-500">Waiting for build to start...</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a project to view details</p>
          </div>
        )}
      </div>

      {/* Project Creation Wizard */}
      {showWizard && (
        <ProjectWizard 
          onClose={() => setShowWizard(false)} 
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}

export default App;
