import requests
import json
import litellm
import os
import asyncio
import subprocess
import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# --- Environment Setup ---
load_dotenv()

# API Keys and Endpoints
AIML_API_KEY = os.environ.get("AIML_API_KEY")
AIML_API_ENDPOINT = os.environ.get("AIML_API_ENDPOINT")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL") # Recommended: Store webhook in .env

# Chrome Configuration (Windows-specific paths from your script)
CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
USER_DATA_DIR = "C:\\Users\\amrra\\AppData\\Local\\Google\\Chrome\\User Data\\Default"
REMOTE_DEBUG_PORT = "9422"

# --- Custom Modules (included directly for simplicity) ---
# NOTE: The following classes (Agent, BrowserSession, Controller, etc.) are based on your
# provided snippets. You would replace these with your actual module imports.
# For this example, I will create placeholder classes to make the code runnable.

class ActionResult(BaseModel):
    extracted_content: str

class Controller:
    def __init__(self):
        self.actions = {}
    def action(self, description: str):
        def decorator(func):
            self.actions[func.__name__] = {"desc": description, "func": func}
            return func
        return decorator

controller = Controller()

# Mock Browser/Agent classes to make the example self-contained and runnable
# In your actual implementation, you would import these from your modules.
class MockPage:
    async def goto(self, url: str):
        print(f"Navigating to {url}")
        await asyncio.sleep(1)
    async def close(self):
        print("Page closed.")
        await asyncio.sleep(0.5)

class BrowserSession:
    def __init__(self, cdp_url: str):
        self.cdp_url = cdp_url
        print(f"Attempting to connect to browser at {self.cdp_url}")
    
    async def get_page(self) -> MockPage:
        print("Getting new page from browser session.")
        return MockPage()
    
    async def close(self):
        print("Browser session closed.")

class Agent:
    def __init__(self, task: str, llm, browser_session: BrowserSession, controller: Controller):
        self.task = task
        self.llm = llm
        self.browser_session = browser_session
        self.controller = controller
        print(f"Agent initialized for task: {self.task}")

    async def run(self):
        print("Agent is running the task...")
        # Simulate agent performing actions
        page = await self.browser_session.get_page()
        await page.goto("https://www.doordash.com")
        # In a real scenario, the agent would perform complex actions here
        await page.close()
        result = f"Successfully completed task: {self.task}"
        print(result)
        return result

# You can keep your custom LangChain/OpenAI models here
# from langchain_openai import ChatOpenAI

# --- Core Functions ---

def send_discord_webhook(webhook_url, message_content):
    """
    Sends a markdown formatted message to a Discord webhook.
    """
    if not webhook_url:
        print("Discord webhook URL not set. Skipping message.")
        return
    headers = {"Content-Type": "application/json"}
    payload = {"content": message_content}
    try:
        response = requests.post(webhook_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        print(f"Discord message sent successfully! Status Code: {response.status_code}")
    except requests.exceptions.RequestException as err:
        print(f"An error occurred while sending Discord message: {err}")

def get_cleaned_task(task: str) -> str:
    """
    Processes the initial prompt with an LLM to generate detailed steps.
    """
    print("Cleaning and detailing task with LLM...")
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
        cleaned_task = response.choices[0].message.content
        print(f"Cleaned task received: {cleaned_task}")
        return cleaned_task
    except Exception as e:
        print(f"Error calling litellm for task cleaning: {e}")
        raise HTTPException(status_code=500, detail="Failed to process prompt with language model.")

def close_all_chrome():
    """Closes all Chrome processes (Windows-specific)."""
    print("Closing all Chrome processes...")
    try:
        # Use taskkill to forcefully terminate Chrome processes on Windows
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], check=True, capture_output=True, text=True)
        print("All Chrome processes terminated.")
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Could not terminate Chrome (it might not have been running): {e}")
    time.sleep(2)


def start_chrome():
    """Starts Chrome with remote debugging enabled (Windows-specific)."""
    print("Starting Chrome with remote debugging...")
    chrome_cmd = [
        CHROME_PATH,
        f"--remote-debugging-port={REMOTE_DEBUG_PORT}",
        f"--user-data-dir={USER_DATA_DIR}"
    ]
    subprocess.Popen(chrome_cmd)
    print(f"Chrome started on port {REMOTE_DEBUG_PORT}.")
    time.sleep(3) # Give Chrome time to start

async def task_fxn(task: str):
    """
    The core asynchronous function that connects to the browser and runs the agent.
    """
    # This is a placeholder for your ChatOpenAI model initialization
    llm_placeholder = {"model": "gpt-4o", "api_key": OPENAI_API_KEY}
    
    browser_session = BrowserSession(cdp_url=f"http://127.0.0.1:{REMOTE_DEBUG_PORT}")
    
    agent = Agent(
        task=task,
        llm=llm_placeholder, # Replace with your actual ChatOpenAI instance
        browser_session=browser_session,
        controller=controller,
    )
    return await agent.run()

# --- FastAPI API Definition ---

app = FastAPI(
    title="Web Automation Agent API",
    description="An API to trigger a web automation agent with a natural language prompt.",
)

class AgentRequest(BaseModel):
    prompt: str = Field(
        ...,
        example="Go on doordash and order me the first bubble tea you find.",
        description="The natural language task for the agent to perform."
    )

@app.post("/run-agent", summary="Run the web automation agent")
async def run_agent_endpoint(request: AgentRequest):
    """
    This endpoint takes a prompt, processes it to generate a detailed task list,
    and then executes the web automation agent to perform the task.

    It correctly handles blocking I/O in a separate thread.
    """
    initial_prompt = request.prompt
    send_discord_webhook(DISCORD_WEBHOOK_URL, f"# JARVIS CALLED\n**Task:** {initial_prompt}")

    # Using a placeholder for the cleaned task as before
    # You can uncomment the litellm call if your API key is set up
    # cleaned_task = get_cleaned_task(initial_prompt)
    cleaned_task = initial_prompt

    try:
        # Run blocking functions in a separate thread to avoid blocking the event loop
        await asyncio.to_thread(close_all_chrome)
        await asyncio.to_thread(start_chrome)

        # Now that the endpoint is async, we can directly await the async function
        result = await task_fxn(task=cleaned_task)
        
        send_discord_webhook(DISCORD_WEBHOOK_URL, f"## ✅ Task Completed\n**Result:** {result}")
        
        return {"status": "success", "result": result}

    except HTTPException as http_exc:
        # Forward HTTP exceptions from deeper layers
        send_discord_webhook(DISCORD_WEBHOOK_URL, f"## ❌ Task Failed\n**Reason:** {http_exc.detail}")
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors
        error_message = f"An unexpected server error occurred: {e}"
        send_discord_webhook(DISCORD_WEBHOOK_URL, f"## ❌ Task Failed\n**Reason:** {error_message}")
        raise HTTPException(status_code=500, detail=error_message)
    finally:
        # Ensure Chrome is always closed, even if errors occur
        print("Ensuring cleanup in the finally block...")
        await asyncio.to_thread(close_all_chrome)