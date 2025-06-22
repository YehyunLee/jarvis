from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
import sys
import platform
from dotenv import load_dotenv
from browser_use import Agent, BrowserSession, Controller, ActionResult
from langchain_openai import ChatOpenAI
import os
import subprocess
import time
import litellm
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware


# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Browser Automation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or better: ["http://localhost:3000"] or wherever your frontend is running
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Configuration ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
AIML_API_KEY = os.environ.get("AIML_API_KEY")
AIML_API_ENDPOINT = os.environ.get("AIML_API_ENDPOINT")

# --- Brave configuration (macOS) ---
# FIXED: Using the robust way to get your home directory
HOME = os.path.expanduser("~")
chrome_path = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
user_data_dir = os.path.join(HOME, "Library/Application Support/BraveSoftware/Brave-Browser/")
remote_debug_port = "9422"

# Controller setup
controller = Controller()

@controller.action('Presses a specified keyboard key down and holds it.')
async def press_keyboard_down(key: str, page) -> ActionResult:
    await page.keyboard.down(key)
    return ActionResult(extracted_content=f'Keyboard key "{key}" is now pressed down.')

# Pydantic models
class TaskRequest(BaseModel):
    task: str
    use_llm_cleaning: bool = True

class TaskResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None

# Helpers
def close_all_chrome():
    print("Closing all Brave processes...")
    try:
        os.system("pkill -f 'Brave Browser'")
        time.sleep(2)
        print("All Brave processes closed.")
    except Exception as e:
        print(f"Error closing Brave: {e}")


def start_chrome():
    print("Starting Brave with remote debugging...")
    try:
        # kill any running Brave
        close_all_chrome()

        # FIXED: Lock files are inside the specific profile directory, not the user_data_dir
        profile_path = os.path.join(user_data_dir, "Profile 1")
        for lock in ("LOCK", "SingletonLock"):
            fn = os.path.join(profile_path, lock)
            if os.path.exists(fn):
                try:
                    os.remove(fn)
                    print(f"Removed stale {lock} from profile directory")
                except OSError as e:
                    print(f"Error removing lock file {fn}: {e}")

        # Command to launch Brave with your "abdolla" profile
        chrome_cmd = [
            chrome_path,
            f"--remote-debugging-port={remote_debug_port}",
            f"--user-data-dir={user_data_dir}",
            "--profile-directory=Profile 1",
            "--no-first-run",
            "--no-default-browser-check",
        ]

        subprocess.Popen(chrome_cmd)
        print(f"Attempting to start Brave on port {remote_debug_port} with profile 'Profile 1'...")
        time.sleep(5)

    except Exception as e:
        print(f"Error starting Brave: {e}")
        raise



def get_cleaned_task(task: str) -> str:
    try:
        response = litellm.completion(
            model="openai/nvidia/llama-3.1-nemotron-70b-instruct",
            api_key=AIML_API_KEY,
            api_base="https://api.aimlapi.com/v2",
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI agent that controls a web browser...",
                },
                {
                    "role": "user",
                    "content": task,
                },
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"LLM cleaning failed: {e}")
        return task

async def execute_browser_task(task: str) -> str:
    try:
        await asyncio.sleep(5)
        browser_session = BrowserSession(cdp_url=f"http://127.0.0.1:{remote_debug_port}")
        print("Connecting to Brave using gpt-4o...")
        agent = Agent(
            task=task,
            llm=ChatOpenAI(
                model="gpt-4o",
                api_key=OPENAI_API_KEY,
                base_url="https://api.openai.com/v1",
            ),
            browser_session=browser_session,
            controller=controller,
        )
        result = await agent.run()
        return str(result)
    except Exception as e:
        print(f"Agent error: {e}")
        raise

# Routes
@app.get("/")
async def root():
    return {"message": "Browser Automation API is running"}

@app.post("/execute-task", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    try:
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")
        start_chrome()

        task_to_execute = request.task
        if request.use_llm_cleaning and AIML_API_KEY:
            task_to_execute = get_cleaned_task(task_to_execute)
            print(f"Cleaned task: {task_to_execute}")

        result = await execute_browser_task(task_to_execute)
        close_all_chrome()
        return TaskResponse(success=True, result=result)
    except Exception as e:
        close_all_chrome()
        return TaskResponse(success=False, error=f"Error: {str(e)}")

@app.post("/start-chrome")
async def start_chrome_endpoint():
    try:
        start_chrome()
        return {"message": "Brave started", "port": remote_debug_port}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Brave: {e}")

@app.post("/stop-chrome")
async def stop_chrome_endpoint():
    try:
        close_all_chrome()
        return {"message": "Brave stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop Brave: {e}")

# Main
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)