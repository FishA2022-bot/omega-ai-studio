from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import asyncio
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)

    async def broadcast(self, project_id: str, message: dict):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# Models
class ProjectCreate(BaseModel):
    name: str
    description: str
    prompt: Optional[str] = None
    template: Optional[str] = "custom"

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    prompt: Optional[str] = None
    template: str = "custom"
    status: str = "planning"  # planning, generating, reviewing, deploying, deployed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agents: Dict[str, str] = Field(default_factory=lambda: {
        "governor": "idle",
        "creator": "idle", 
        "launcher": "idle"
    })
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
    plan: Optional[Dict[str, Any]] = None

class ActivityEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    agent: str  # governor, creator, launcher, system
    type: str  # info, success, warning, error, thinking
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Optional[Dict[str, Any]] = None

class AssistantMessage(BaseModel):
    message: str
    project_id: Optional[str] = None

# Helper to add activity event
async def add_activity(project_id: str, agent: str, event_type: str, message: str, metadata: dict = None):
    event = ActivityEvent(
        project_id=project_id,
        agent=agent,
        type=event_type,
        message=message,
        metadata=metadata
    )
    doc = event.model_dump()
    await db.activities.insert_one(doc)
    await manager.broadcast(project_id, {"type": "activity", "data": doc})
    return event

# Helper to update agent status
async def update_agent_status(project_id: str, agent: str, status: str):
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {f"agents.{agent}": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await manager.broadcast(project_id, {"type": "agent_status", "agent": agent, "status": status})

# Routes
@api_router.get("/")
async def root():
    return {"message": "Omega Studio API"}

@api_router.post("/projects", response_model=Project)
async def create_project(input: ProjectCreate):
    project = Project(
        name=input.name,
        description=input.description,
        prompt=input.prompt,
        template=input.template
    )
    doc = project.model_dump()
    await db.projects.insert_one(doc)
    
    # Add initial activity
    await add_activity(project.id, "system", "info", f"Project '{project.name}' created")
    
    return project

@api_router.get("/projects", response_model=List[Project])
async def get_projects():
    projects = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return projects

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    await db.projects.delete_one({"id": project_id})
    await db.activities.delete_many({"project_id": project_id})
    return {"status": "deleted"}

@api_router.get("/projects/{project_id}/activities", response_model=List[ActivityEvent])
async def get_activities(project_id: str):
    activities = await db.activities.find(
        {"project_id": project_id}, 
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    return activities

# AI Assistant endpoint
@api_router.post("/assistant/chat")
async def assistant_chat(input: AssistantMessage):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"omega-assistant-{input.project_id or 'general'}",
            system_message="""You are the Omega Studio AI Assistant, helping users create software projects.
            
When a user describes what they want to build, respond with a structured project plan in JSON format:
{
  "project_name": "suggested name",
  "description": "brief description",
  "tech_stack": ["list", "of", "technologies"],
  "features": ["feature 1", "feature 2"],
  "phases": [
    {"name": "Phase 1", "tasks": ["task1", "task2"]},
    {"name": "Phase 2", "tasks": ["task3", "task4"]}
  ],
  "estimated_time": "X hours/days"
}

If the user asks general questions, respond helpfully about software development best practices.
Always be concise and actionable."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=input.message)
        response = await chat.send_message(user_message)
        
        # Try to parse as JSON for structured responses
        try:
            if "{" in response and "}" in response:
                json_start = response.index("{")
                json_end = response.rindex("}") + 1
                json_str = response[json_start:json_end]
                parsed = json.loads(json_str)
                return {"response": response, "structured": parsed, "type": "plan"}
        except:
            pass
        
        return {"response": response, "type": "text"}
    except Exception as e:
        logging.error(f"Assistant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Start agent workflow simulation
@api_router.post("/projects/{project_id}/start")
async def start_project_workflow(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Start background task for agent simulation
    asyncio.create_task(simulate_agent_workflow(project_id, project))
    
    return {"status": "started", "message": "Agent workflow initiated"}

async def simulate_agent_workflow(project_id: str, project: dict):
    """Simulates the multi-agent workflow with realistic timing"""
    
    # Phase 1: Governor - Planning
    await update_agent_status(project_id, "governor", "thinking")
    await add_activity(project_id, "governor", "thinking", "Analyzing project requirements...")
    await asyncio.sleep(2)
    
    await update_agent_status(project_id, "governor", "working")
    await add_activity(project_id, "governor", "info", f"Project scope: {project.get('description', 'No description')}")
    await asyncio.sleep(1.5)
    
    # Generate plan using AI if prompt available
    plan = None
    if project.get('prompt'):
        try:
            api_key = os.environ.get('EMERGENT_LLM_KEY')
            if api_key:
                chat = LlmChat(
                    api_key=api_key,
                    session_id=f"governor-{project_id}",
                    system_message="You are a project planning AI. Generate a brief technical plan as JSON with keys: architecture, components, timeline. Be concise."
                ).with_model("openai", "gpt-4o")
                response = await chat.send_message(UserMessage(text=f"Plan for: {project['prompt']}"))
                try:
                    if "{" in response:
                        json_start = response.index("{")
                        json_end = response.rindex("}") + 1
                        plan = json.loads(response[json_start:json_end])
                except:
                    plan = {"architecture": "Microservices", "components": ["API", "UI", "Database"], "timeline": "2 weeks"}
        except Exception as e:
            logging.error(f"Governor AI error: {e}")
            plan = {"architecture": "Standard", "components": ["Frontend", "Backend", "Storage"], "timeline": "1 week"}
    else:
        plan = {"architecture": "Standard", "components": ["Frontend", "Backend", "Storage"], "timeline": "1 week"}
    
    await db.projects.update_one({"id": project_id}, {"$set": {"plan": plan, "status": "planning"}})
    await add_activity(project_id, "governor", "success", f"Architecture defined: {plan.get('architecture', 'Standard')}")
    await asyncio.sleep(1)
    
    await add_activity(project_id, "governor", "info", f"Components: {', '.join(plan.get('components', []))}")
    await update_agent_status(project_id, "governor", "done")
    await add_activity(project_id, "governor", "success", "Planning phase complete. Handing off to Creator.")
    
    await db.projects.update_one({"id": project_id}, {"$set": {"status": "generating"}})
    await asyncio.sleep(1)
    
    # Phase 2: Creator - Code Generation
    await update_agent_status(project_id, "creator", "thinking")
    await add_activity(project_id, "creator", "thinking", "Reviewing project plan...")
    await asyncio.sleep(1.5)
    
    await update_agent_status(project_id, "creator", "working")
    
    artifacts = []
    components = plan.get('components', ['Frontend', 'Backend', 'Database'])
    
    for i, component in enumerate(components):
        await add_activity(project_id, "creator", "info", f"Generating {component} module...")
        await asyncio.sleep(2)
        
        artifact = {
            "id": str(uuid.uuid4()),
            "name": f"{component.lower().replace(' ', '_')}.ts",
            "type": "code",
            "content": f"// {component} implementation\nexport class {component.replace(' ', '')}Service {{\n  // Auto-generated by Creator Agent\n}}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        artifacts.append(artifact)
        
        await db.projects.update_one(
            {"id": project_id}, 
            {"$push": {"artifacts": artifact}}
        )
        await manager.broadcast(project_id, {"type": "artifact", "data": artifact})
        await add_activity(project_id, "creator", "success", f"Generated {artifact['name']}")
    
    await update_agent_status(project_id, "creator", "done")
    await add_activity(project_id, "creator", "success", f"Code generation complete. {len(artifacts)} files created.")
    
    await db.projects.update_one({"id": project_id}, {"$set": {"status": "reviewing"}})
    await asyncio.sleep(1)
    
    # Phase 3: Launcher - Deployment
    await update_agent_status(project_id, "launcher", "thinking")
    await add_activity(project_id, "launcher", "thinking", "Preparing deployment pipeline...")
    await asyncio.sleep(1.5)
    
    await update_agent_status(project_id, "launcher", "working")
    await add_activity(project_id, "launcher", "info", "Running pre-deployment checks...")
    await asyncio.sleep(2)
    
    await add_activity(project_id, "launcher", "success", "All checks passed ✓")
    await asyncio.sleep(1)
    
    await add_activity(project_id, "launcher", "info", "Building container image...")
    await asyncio.sleep(2)
    
    await add_activity(project_id, "launcher", "info", "Deploying to preview environment...")
    await asyncio.sleep(2)
    
    preview_url = f"https://{project.get('name', 'app').lower().replace(' ', '-')}-preview.omega.dev"
    await add_activity(project_id, "launcher", "success", f"Deployment successful! Preview: {preview_url}")
    
    await update_agent_status(project_id, "launcher", "done")
    await db.projects.update_one({"id": project_id}, {"$set": {"status": "deployed"}})
    
    await add_activity(project_id, "system", "success", "🎉 Project workflow complete! All agents finished successfully.")

# WebSocket for real-time updates
@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle any incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
