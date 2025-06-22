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

# Load environment variables
load_dotenv()

# Fix for Windows asyncio subprocess issues
if platform.system() == "Windows":
    # Set the event loop policy to WindowsProactorEventLoopPolicy
    if sys.version_info >= (3, 8):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Initialize FastAPI app
app = FastAPI(title="Browser Automation API", version="1.0.0")

# Configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
AIML_API_KEY = os.environ.get("AIML_API_KEY")
AIML_API_ENDPOINT = os.environ.get("AIML_API_ENDPOINT")

# Chrome configuration
chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
user_data_dir = "C:\\Users\\amrra\\AppData\\Local\\Google\\Chrome\\User Data\\Default"
remote_debug_port = "9422"

# Controller setup
controller = Controller()

@controller.action('Presses a specified keyboard key down and holds it.')
async def press_keyboard_down(key: str, page) -> ActionResult:
    """
    Dispatches a keydown event for the specified key.
    Useful for holding down modifier keys (e.g., Shift, Control)
    while performing other actions.
    """
    await page.keyboard.down(key)
    return ActionResult(extracted_content=f'Keyboard key "{key}" is now pressed down.')

# Pydantic models for API requests/responses
class TaskRequest(BaseModel):
    task: str
    use_llm_cleaning: bool = True

class TaskResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None

# Helper functions
def close_all_chrome():
    """Close all Chrome processes"""
    print("Closing all Chrome processes...")
    try:
        # For Windows
        os.system("taskkill /f /im chrome.exe")
        # For macOS (if needed)
        # os.system("osascript -e 'quit app \"Google Chrome\"'")
        # os.system("pkill -f 'Google Chrome'")
        time.sleep(2)
        print("All Chrome processes closed.")
    except Exception as e:
        print(f"Error closing Chrome: {e}")

def start_chrome():
    """Start Chrome with remote debugging"""
    print("Starting Chrome with remote debugging...")
    try:
        # Kill any existing Chrome processes first
        os.system("taskkill /f /im chrome.exe 2>nul")
        time.sleep(2)
        
        chrome_cmd = [
            chrome_path,
            f"--remote-debugging-port={remote_debug_port}",
            f"--user-data-dir={user_data_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-default-apps"
        ]
        
        # Use CREATE_NEW_CONSOLE to avoid blocking
        if platform.system() == "Windows":
            subprocess.Popen(chrome_cmd, creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:
            subprocess.Popen(chrome_cmd)
            
        print(f"Chrome started on port {remote_debug_port}")
        time.sleep(5)  # Give Chrome more time to start properly
    except Exception as e:
        print(f"Error starting Chrome: {e}")
        raise

def get_cleaned_task(task: str) -> str:
    """Clean and enhance the task using LLM"""
    try:
        response = litellm.completion(
            model="openai/nvidia/llama-3.1-nemotron-70b-instruct",
            api_key=AIML_API_KEY,
            api_base="https://api.aimlapi.com/v2",
            messages=[
                {
                    "role": "system",
                    "content": "You are an AI agent that is capable of controlling a web browser. You have already logged in. You can perform actions like clicking buttons, filling forms, scrolling down and navigating pages. Your task is to automate the process of retrieving specific information from the page, and other tasks like adding things to shopping cart etc. You cannot miss any detail on a page therefore you would scroll to every section. Please provide step-by-step instructions on how to achieve this.",
                },
                {
                    "role": "user",
                    "content": task,
                },
            ],
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error cleaning task with LLM: {e}")
        return task  # Return original task if cleaning fails

async def execute_browser_task(task: str) -> str:
    """Execute the browser automation task"""
    try:
        # Give Chrome more time to fully start
        await asyncio.sleep(5)
        
        # Connect to the pre-existing Chrome via CDP
        browser_session = BrowserSession(
            cdp_url=f"http://127.0.0.1:{remote_debug_port}",
        )

        print("Connecting to Chrome using gpt-4o...")
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
        print(f"Error executing browser task: {e}")
        raise

# API Routes
@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Browser Automation API is running"}

@app.post("/execute-task", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    """
    Execute a browser automation task
    
    Args:
        request: TaskRequest containing the task description and options
        
    Returns:
        TaskResponse with success status and result/error
    """
    try:
        # Validate required environment variables
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
        
        # Close any existing Chrome instances
        close_all_chrome()
        time.sleep(2)
        
        # Start Chrome
        start_chrome()
        
        # Clean the task if requested
        task_to_execute = request.task
        if request.use_llm_cleaning and AIML_API_KEY:
            task_to_execute = get_cleaned_task(request.task)
            print(f"Cleaned task: {task_to_execute}")
        
        # Execute the browser task
        result = await execute_browser_task(task_to_execute)
        
        # Close Chrome
        close_all_chrome()
        
        return TaskResponse(success=True, result=result)
        
    except Exception as e:
        # Ensure Chrome is closed even on error
        close_all_chrome()
        error_msg = f"Error executing task: {str(e)}"
        print(error_msg)
        return TaskResponse(success=False, error=error_msg)

@app.post("/start-chrome")
async def start_chrome_endpoint():
    """Start Chrome browser for debugging"""
    try:
        close_all_chrome()
        time.sleep(2)
        start_chrome()
        return {"message": "Chrome started successfully", "port": remote_debug_port}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Chrome: {str(e)}")

@app.post("/stop-chrome")
async def stop_chrome_endpoint():
    """Stop Chrome browser"""
    try:
        close_all_chrome()
        return {"message": "Chrome stopped successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop Chrome: {str(e)}")

# Run the server
if __name__ == "__main__":
    import uvicorn
    
    # Additional Windows-specific configuration
    if platform.system() == "Windows":
        # Ensure we're using the right event loop policy
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, loop="asyncio")